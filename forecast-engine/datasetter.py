from datetime import datetime, timedelta
from typing import Generator

import pandas as pd
from pathlib import Path
from pydantic import BaseModel
import torch
from tqdm import tqdm

from utils import load_data, build_group_dict, build_subgroup_dict, build_brand_dict, build_type_dict

EXCEL_EPOCH = datetime(1899, 12, 30)

class DataRow(BaseModel):
  promo_start_date: datetime
  promo_end_date: datetime
  date: datetime
  type: str
  group: int
  subgroup: int
  brand: str
  product_name: str
  sales_value: float
  margin_value: float

  @classmethod
  def from_row(cls, row: pd.Series) -> 'DataRow':
    return cls(
      promo_start_date=EXCEL_EPOCH + timedelta(days=row['DATE START PROMO']),
      promo_end_date=EXCEL_EPOCH + timedelta(days=row['DATE END PROMO']),
      date=EXCEL_EPOCH + timedelta(days=row['DATE']),
      type=row['TYPE OF PROMO'],
      group=row['CODE GROUP'],
      subgroup=row['CODE SUBGROUP'],
      brand=row['BRAND'],
      product_name=(row['DESC 1 SKU'] + ' ' + row['DESC 2 SKU']).strip(),
      sales_value=row['SALES VALUE ANON'],
      margin_value=row['MARGIN VALUE ANON'],
    )

  @classmethod
  def from_df(cls, df: pd.DataFrame) -> Generator['DataRow', None, None]:
    return (cls.from_row(row) for _, row in df.iterrows())
  
  def to_torch_tensor(self, group_dict: dict[int, str], subgroup_dict: dict[int, str], brand_dict: dict[str, str], type_dict: dict[str, str]) -> torch.Tensor:
    return torch.tensor([
      self.promo_start_date.timetuple().tm_yday,
      self.promo_end_date.timetuple().tm_yday,
      self.date.timetuple().tm_yday,
      *[1 if key == self.type else 0 for key in type_dict.keys()],
      *[1 if key == self.group else 0 for key in group_dict.keys()],
      *[1 if key == self.subgroup else 0 for key in subgroup_dict.keys()],
      *[1 if key == self.brand else 0 for key in brand_dict.keys()],
      # product name embedding is missing !!!
      self.sales_value,
      self.margin_value,
    ], dtype=torch.float32)

if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("-f", "--file", type=Path, required=True)
  args = parser.parse_args()
  
  file = Path(__file__).parent / args.file
  assert file.exists() and file.is_file() and file.suffix == ".xlsb"
  print('Loading data...')
  data = load_data(file)

  print('Building dictionaries...')
  group_dict = build_group_dict(data, store=False)
  subgroup_dict = build_subgroup_dict(data, store=False)
  brand_dict = build_brand_dict(data, store=False)
  type_dict = build_type_dict(data, store=False)

  print('Building dataset...')
  tensor_list_input: list[torch.Tensor] = []
  tensor_list_output: list[torch.Tensor] = []
  for _, row in tqdm(data.iterrows(), total=len(data)):
    torch_tensor = DataRow.from_row(row).to_torch_tensor(group_dict, subgroup_dict, brand_dict, type_dict)
    tensor_list_input.append(torch_tensor)
    tensor_list_output.append(torch.tensor([row['SALES QTY ANON']], dtype=torch.float32))

  dataset_input = torch.stack(tensor_list_input)
  dataset_output = torch.stack(tensor_list_output)

  print('Saving dataset...')
  torch.save({"in": dataset_input, "out": dataset_output}, 'data/dataset.pt')
