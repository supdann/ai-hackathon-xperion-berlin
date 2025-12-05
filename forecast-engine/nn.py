from typing import Tuple

import torch
from torch import Tensor, nn
from torch.utils.data import DataLoader, TensorDataset, random_split

# Net Architecture
# ---
# Input
#   - 3 scalars: promo_start_date, promo_end_date, date
#   - 3-dim one-hot type
#   - 160-dim one-hot group
#   - 592-dim one-hot subgroup
#   - 500-dim one-hot brand
#   - 32-dim product-name embedding (precomputed)
#   - 2 scalars: sales_value, margin_value
# Fully Connected: - 512 units, dropout 0.2, relu activation
# Fully Connected: - 256 units, dropout 0.2, relu activation
# Fully Connected: - 128 units, dropout 0.2, relu activation
# Output: - 1 unit, linear activation

class ForecastNet(nn.Module):
  # INPUT_DIM = 1292 # 3 + 3 + 160 + 592 + 500 + 32 + 2
  INPUT_DIM = 1260
  HIDDEN1_DIM = 512
  HIDDEN2_DIM = 256
  HIDDEN3_DIM = 128
  DROPOUT = 0.2

  def __init__(self):
    super().__init__()

    self.fc1 = nn.Linear(self.INPUT_DIM, self.HIDDEN1_DIM)
    self.fc2 = nn.Linear(self.HIDDEN1_DIM, self.HIDDEN2_DIM)
    self.fc3 = nn.Linear(self.HIDDEN2_DIM, self.HIDDEN3_DIM)

    self.out = nn.Linear(self.HIDDEN3_DIM, 1)

    self.relu = nn.ReLU()
    self.dropout = nn.Dropout(p=self.DROPOUT)

  def forward(self, x: Tensor) -> Tensor:
    x = self.fc1(x)
    x = self.relu(x)
    x = self.dropout(x)

    x = self.fc2(x)
    x = self.relu(x)
    x = self.dropout(x)

    x = self.fc3(x)
    x = self.relu(x)
    x = self.dropout(x)

    x = self.out(x)
    return x

  def num_parameters(self) -> int:
    return sum(p.numel() for p in self.parameters() if p.requires_grad)

if __name__ == "__main__":
  BATCH_SIZE = 64

  device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
  model = ForecastNet().to(device)

  data = torch.load('data/dataset.pt', map_location='cpu')
  X, y = data['X'].float(), data['y'].float()
  assert X.shape[1] == model.INPUT_DIM, (X.shape, model.INPUT_DIM)
  ds = TensorDataset(X, y)
  train_size = int(0.8 * len(ds))
  test_size = len(ds) - train_size
  g = torch.Generator().manual_seed(42)
  train_dataset, test_dataset = random_split(ds, [train_size, test_size], generator=g)

  train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
  test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

  for xb, yb in train_loader:
    xb, yb = xb.to(device), yb.to(device)
    print(xb.shape, yb.shape)
    exit()
