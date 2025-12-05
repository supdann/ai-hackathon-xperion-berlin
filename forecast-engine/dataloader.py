from datetime import datetime, timedelta
from typing import Generator

import pandas as pd
from pathlib import Path
from pydantic import BaseModel
from torch import Tensor, tensor

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
  
  def to_torch_tensor(self, group_dict: dict[int, str], subgroup_dict: dict[int, str], brand_dict: dict[str, str], type_dict: dict[str, str]) -> Tensor:
    return tensor([
      self.promo_start_date.timetuple().tm_yday,
      self.promo_end_date.timetuple().tm_yday,
      self.date.timetuple().tm_yday,
      self.type,
      list(group_dict).index(self.group),
      list(subgroup_dict).index(self.subgroup),
      self.brand,
    ])

if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("-f", "--file", type=Path, required=True)
  args = parser.parse_args()
  
  file = Path(__file__).parent / args.file
  assert file.exists() and file.is_file() and file.suffix == ".xlsb"
  data = load_data(file)

  group_dict = build_group_dict(data, store=False)
  subgroup_dict = build_subgroup_dict(data, store=False)
  brand_dict = build_brand_dict(data, store=False)
  type_dict = build_type_dict(data, store=False)

  for _, row in data.iterrows():
    data_row = DataRow.from_row(row)
    print(data_row)
    print(data_row.to_torch_tensor(group_dict, subgroup_dict, brand_dict, type_dict).shape)
    exit()
