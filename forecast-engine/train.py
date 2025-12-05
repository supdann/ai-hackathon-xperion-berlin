from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Tuple

import torch
from torch import Tensor, nn
from torch.utils.data import DataLoader, TensorDataset

from nn import ForecastNet


@dataclass
class TrainConfig:
  dataset_path: Path
  epochs: int
  batch_size: int
  lr: float
  weight_decay: float
  test_ratio: float
  seed: int
  num_workers: int


def split_dataset(input: Tensor, output: Tensor, test_ratio: float, seed: int) -> Tuple[Tensor, Tensor, Tensor, Tensor]:
  n = input.shape[0]
  num_test = int(n * test_ratio)
  g = torch.Generator().manual_seed(seed)
  perm = torch.randperm(n, generator=g)
  test_idx = perm[:num_test]
  train_idx = perm[num_test:]
  return input[train_idx], output[train_idx], input[test_idx], output[test_idx]


def rmse_loss(pred: Tensor, target: Tensor, eps: float = 1e-12) -> Tensor:
  mse = nn.functional.mse_loss(pred, target, reduction="mean")
  return torch.sqrt(mse + eps)


def epoch_metrics(pred: Tensor, target: Tensor) -> Tuple[float, float]:
  # Returns (rmse, mae)
  with torch.no_grad():
    diff = pred - target
    mse = torch.mean(diff.pow(2))
    mae = torch.mean(diff.abs())
    rmse = torch.sqrt(mse)
    return float(rmse.item()), float(mae.item())


def evaluate(model: ForecastNet, loader: DataLoader, device: torch.device) -> Tuple[float, float]:
  model.eval()
  preds: list[Tensor] = []
  tgts: list[Tensor] = []
  with torch.no_grad():
    for xb, yb in loader:
      xb = xb.to(device)
      yb = yb.to(device)
      out = model(xb)
      preds.append(out)
      tgts.append(yb)
  pred_all = torch.cat(preds, dim=0)
  tgt_all = torch.cat(tgts, dim=0)
  return epoch_metrics(pred_all, tgt_all)


def train(cfg: TrainConfig) -> None:
  # Load dataset
  data = torch.load(cfg.dataset_path, map_location="cpu")
  input: Tensor = data["in"].float()
  output: Tensor = data["out"].float()

  # Create splits
  in_train, out_train, in_test, out_test = split_dataset(input, output, cfg.test_ratio, cfg.seed)

  # Device
  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

  # Model
  model = ForecastNet().to(device)
  if input.shape[1] != model.INPUT_DIM:
    raise ValueError(f"Feature dimension mismatch: X has {input.shape[1]}, but model expects {model.INPUT_DIM}")

  # Run directory (one per training run)
  ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
  run_dir = Path("checkpoints") / f"run-{ts}"
  run_dir.mkdir(parents=True, exist_ok=True)

  # Dataloaders
  train_loader = DataLoader(
    TensorDataset(in_train, out_train),
    batch_size=cfg.batch_size,
    shuffle=True,
    num_workers=cfg.num_workers,
    pin_memory=(device.type == "cuda"),
  )
  test_loader = DataLoader(
    TensorDataset(in_test, out_test),
    batch_size=cfg.batch_size,
    shuffle=False,
    num_workers=cfg.num_workers,
    pin_memory=(device.type == "cuda"),
  )

  # Optimizer
  optimizer = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)

  # Training
  print("Starting training...")
  for epoch in range(1, cfg.epochs + 1):
    model.train()
    running_loss = 0.0
    n_batches = 0

    for xb, yb in train_loader:
      xb = xb.to(device)
      yb = yb.to(device)

      optimizer.zero_grad(set_to_none=True)
      pred = model(xb)
      loss = rmse_loss(pred, yb)
      loss.backward()
      optimizer.step()

      running_loss += float(loss.item())
      n_batches += 1

    # Metrics at epoch end
    train_rmse, train_mae = evaluate(model, train_loader, device)
    test_rmse, test_mae = evaluate(model, test_loader, device)
    avg_loss = running_loss / max(n_batches, 1)

    print(
      f"Epoch {epoch:03d}/{cfg.epochs} "
      f"loss={avg_loss:.6f} "
      f"train_rmse={train_rmse:.6f} train_mae={train_mae:.6f} "
      f"test_rmse={test_rmse:.6f} test_mae={test_mae:.6f}"
    )

    # Save model weights for this epoch (use test MAE in filename)
    epoch_path = run_dir / f"epoch_{epoch:03d}_{test_mae:.6f}.pt"
    torch.save(model.state_dict(), epoch_path)

  # Final evaluation for checkpoint metadata
  final_train_rmse, final_train_mae = evaluate(model, train_loader, device)
  final_test_rmse, final_test_mae = evaluate(model, test_loader, device)

  # Final checkpoint save into the run directory (once per full training run)
  ckpt_path = run_dir / "final.pt"
  torch.save(
    {
      "model_state": model.state_dict(),
      "optimizer_state": optimizer.state_dict(),
      "config": asdict(cfg),
      "input_dim": int(input.shape[1]),
      "metrics": {
        "train_rmse": final_train_rmse,
        "train_mae": final_train_mae,
        "test_rmse": final_test_rmse,
        "test_mae": final_test_mae,
      },
      "timestamp_utc": ts,
    },
    ckpt_path,
  )
  print(f"Saved checkpoint to {ckpt_path}")


if __name__ == "__main__":
  import argparse
  parser = argparse.ArgumentParser()
  parser.add_argument("-d", "--dataset", type=Path, required=True)
  args = parser.parse_args()

  cfg = TrainConfig(
    dataset_path=args.dataset,
    epochs=100,
    batch_size=256,
    lr=1e-3,
    weight_decay=0.0,
    test_ratio=0.2,
    seed=1337,
    num_workers=0,
  )
  train(cfg)
