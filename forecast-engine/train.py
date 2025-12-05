from __future__ import annotations

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
  epochs: int = 10
  batch_size: int = 256
  lr: float = 1e-3
  weight_decay: float = 0.0
  test_ratio: float = 0.2
  seed: int = 42
  num_workers: int = 0


def split_dataset(
  X: Tensor,
  y: Tensor,
  test_ratio: float,
  seed: int,
) -> Tuple[Tensor, Tensor, Tensor, Tensor]:
  n = X.shape[0]
  num_test = int(n * test_ratio)
  g = torch.Generator().manual_seed(seed)
  perm = torch.randperm(n, generator=g)
  test_idx = perm[:num_test]
  train_idx = perm[num_test:]
  return X[train_idx], y[train_idx], X[test_idx], y[test_idx]


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


def train_one_run(cfg: TrainConfig) -> None:
  # Load dataset
  data = torch.load(cfg.dataset_path, map_location="cpu")
  X: Tensor = data["X"].float()
  y: Tensor = data["y"].float()

  # Create splits
  X_train, y_train, X_test, y_test = split_dataset(X, y, cfg.test_ratio, cfg.seed)

  # Device
  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

  # Model
  model = ForecastNet().to(device)
  if X.shape[1] != model.INPUT_DIM:
    raise ValueError(f"Feature dimension mismatch: X has {X.shape[1]}, but model expects {model.INPUT_DIM}")

  # Dataloaders
  train_loader = DataLoader(
    TensorDataset(X_train, y_train),
    batch_size=cfg.batch_size,
    shuffle=True,
    num_workers=cfg.num_workers,
    pin_memory=(device.type == "cuda"),
  )
  test_loader = DataLoader(
    TensorDataset(X_test, y_test),
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

  # Final evaluation for checkpoint metadata
  final_train_rmse, final_train_mae = evaluate(model, train_loader, device)
  final_test_rmse, final_test_mae = evaluate(model, test_loader, device)

  # Checkpoint save (once per full training run)
  ckpt_dir = Path("checkpoints")
  ckpt_dir.mkdir(parents=True, exist_ok=True)
  ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
  ckpt_path = ckpt_dir / f"run-{ts}.pt"
  torch.save(
    {
      "model_state": model.state_dict(),
      "optimizer_state": optimizer.state_dict(),
      "config": asdict(cfg),
      "input_dim": int(X.shape[1]),
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

  parser = argparse.ArgumentParser(description="Train ForecastNet on prepared dataset.pt")
  parser.add_argument("--dataset", type=Path, default=Path("data/dataset.pt"))
  parser.add_argument("--epochs", type=int, default=10)
  parser.add_argument("--batch-size", type=int, default=256)
  parser.add_argument("--lr", type=float, default=1e-3)
  parser.add_argument("--weight-decay", type=float, default=0.0)
  parser.add_argument("--test-ratio", type=float, default=0.2)
  parser.add_argument("--seed", type=int, default=42)
  parser.add_argument("--num-workers", type=int, default=0)
  args = parser.parse_args()

  cfg = TrainConfig(
    dataset_path=args.dataset,
    epochs=args.epochs,
    batch_size=args.batch_size,
    lr=args.lr,
    weight_decay=args.weight_decay,
    test_ratio=args.test_ratio,
    seed=args.seed,
    num_workers=args.num_workers,
  )
  train_one_run(cfg)


