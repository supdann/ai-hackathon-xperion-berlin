from datetime import datetime
from pathlib import Path
import json
from typing import Optional, Tuple
import pathlib

import torch

from nn import ForecastNet
from datasetter import DataRow
from utils import openai_embedding

def _load_ordered_dict(path: Path, key_type):
  with open(path, "r") as f:
    data = json.load(f)
  # Preserve order from JSON and cast keys to required type
  return {key_type(k): v for k, v in data.items()}


def _resolve_checkpoint(model_path: Path) -> Path:
  if model_path.is_file():
    return model_path
  if model_path.is_dir():
    final = model_path / "final.pt"
    if final.exists():
      return final
    # Fallback: pick most recent epoch_*.pt by mtime
    epoch_files = sorted(model_path.glob("epoch_*.pt"), key=lambda p: p.stat().st_mtime, reverse=True)
    if epoch_files:
      return epoch_files[0]
  raise FileNotFoundError(f"Could not resolve checkpoint from path: {model_path}")


def _load_model_and_scaler(ckpt_path: Path, device: torch.device) -> Tuple[ForecastNet, Optional[torch.Tensor], Optional[torch.Tensor]]:
  model = ForecastNet().to(device)
  # Try safe loading first; allowlist pathlib.PosixPath used inside saved configs
  try:
    torch.serialization.add_safe_globals([pathlib.PosixPath])
    blob = torch.load(ckpt_path, map_location=device, weights_only=True)
  except Exception:
    # Fallback to legacy behavior; only do this if you trust the checkpoint source
    blob = torch.load(ckpt_path, map_location=device, weights_only=False)
  input_mean: Optional[torch.Tensor] = None
  input_std: Optional[torch.Tensor] = None

  if isinstance(blob, dict) and "model_state" in blob:
    state_dict = blob["model_state"]
    scaler = blob.get("input_scaler")
    if scaler and scaler.get("mean") is not None and scaler.get("std") is not None:
      # Ensure tensors on correct device and 1-D shape
      input_mean = scaler["mean"].to(device).flatten()
      input_std = scaler["std"].to(device).flatten()
    model.load_state_dict(state_dict)
  else:
    # Assume raw state_dict
    model.load_state_dict(blob)

  model.eval()
  return model, input_mean, input_std


def _prepare_input(
  start_date: datetime,
  end_date: datetime,
  date: datetime,
  type_str: str,
  group: int,
  subgroup: int,
  brand: str,
  product_name: str,
  sales_value: float,
  margin_value: float,
) -> torch.Tensor:
  base_dir = Path(__file__).parent
  group_dict = _load_ordered_dict(base_dir / "data/groups.json", int)
  subgroup_dict = _load_ordered_dict(base_dir / "data/subgroups.json", int)
  brand_dict = _load_ordered_dict(base_dir / "data/brands.json", str)
  type_dict = _load_ordered_dict(base_dir / "data/type.json", str)

  # Build product name embedding (32-dim)
  name_to_embedding = {product_name: openai_embedding(product_name)}

  row = DataRow(
    promo_start_date=start_date,
    promo_end_date=end_date,
    date=date,
    type=type_str,
    group=group,
    subgroup=subgroup,
    brand=brand,
    product_name=product_name,
    sales_value=sales_value,
    margin_value=margin_value,
  )
  x = row.to_torch_tensor(group_dict, subgroup_dict, brand_dict, type_dict, name_to_embedding)
  return x


def run(
  model_path: Path,
  start_date: datetime,
  end_date: datetime,
  date: datetime,
  type_str: str,
  group: int,
  subgroup: int,
  brand: str,
  product_name: str,
  sales_value: float,
  num_points: int = 100,
) -> list[float]:
  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
  ckpt_path = _resolve_checkpoint(model_path)
  model, input_mean, input_std = _load_model_and_scaler(ckpt_path, device)

  # Base input (margin will be overwritten per point)
  x0 = _prepare_input(start_date, end_date, date, type_str, group, subgroup, brand, product_name, sales_value, margin_value=0.0)
  if x0.numel() != model.INPUT_DIM:
    raise ValueError(f"Input vector has dimension {x0.numel()}, but model expects {model.INPUT_DIM}")

  # Generate margins linearly spaced
  lo = -sales_value
  hi = sales_value
  margins = torch.linspace(lo, hi, steps=num_points, dtype=torch.float32)

  # Build batch by repeating x0 and setting last feature (margin) to each value
  X = x0.unsqueeze(0).repeat(num_points, 1)
  X[:, -1] = margins

  # Standardize if scaler present
  if input_mean is not None and input_std is not None:
    # Avoid division by zero
    safe_std = torch.where(input_std < 1e-8, torch.ones_like(input_std), input_std)
    X = (X - input_mean) / safe_std

  x = X.to(device)
  with torch.no_grad():
    y_hat = model(x)
  preds = y_hat.squeeze(-1).detach().cpu().tolist()
  return preds

if __name__ == "__main__":
  from argparse import ArgumentParser
  parser = ArgumentParser()
  parser.add_argument("--model", type=Path, required=True)
  parser.add_argument("--start-date", type=datetime.fromisoformat, required=True)
  parser.add_argument("--end-date", type=datetime.fromisoformat, required=True)
  parser.add_argument("--date", type=datetime.fromisoformat, required=True)
  parser.add_argument("--type", type=str, required=True)
  parser.add_argument("--group", type=int, required=True)
  parser.add_argument("--subgroup", type=int, required=True)
  parser.add_argument("--brand", type=str, required=True)
  parser.add_argument("--product-name", type=str, required=True)
  parser.add_argument("--sales-value", type=float, required=True)
  # optional: allow custom number of points
  parser.add_argument("--points", type=int, default=100)

  args = parser.parse_args()
  preds = run(
    args.model,
    args.start_date,
    args.end_date,
    args.date,
    args.type,
    args.group,
    args.subgroup,
    args.brand,
    args.product_name,
    args.sales_value,
    num_points=args.points,
  )
  # Emit CSV: margin,prediction
  lo = -args.sales_value
  hi = args.sales_value
  margins = torch.linspace(lo, hi, steps=len(preds), dtype=torch.float32).tolist()
  print("margin,qty,total_margin")
  for m, p in zip(margins, preds):
    mp = m * p  # margin * quantity
    print(f"{m:.6f},{p:.6f},{mp:.6f}")
