import json
import pandas as pd
from pathlib import Path

def build_group_dict(data: pd.DataFrame) -> None:
  data['DESC GROUP'] = data['DESC GROUP'].str.strip()
  group_dict = dict(zip(data['CODE GROUP'], data['DESC GROUP']))
  print(f'Storing groups.json with {len(group_dict)} groups')
  with open('data/groups.json', 'w') as f:
    f.write(json.dumps(group_dict))

def build_subgroup_dict(data: pd.DataFrame) -> None:
  data['DESC SUBGROUP'] = data['DESC SUBGROUP'].str.strip()
  subgroup_dict = dict(zip(data['CODE SUBGROUP'], data['DESC SUBGROUP']))
  print(f'Storing subgroups.json with {len(subgroup_dict)} subgroups')
  with open('data/subgroups.json', 'w') as f:
    f.write(json.dumps(subgroup_dict))

def build_brand_dict(data: pd.DataFrame) -> None:
  data['BRAND'] = data['BRAND'].str.strip()
  brand_dict = dict(zip(data['BRAND'], data['BRAND']))
  print(f'Storing brands.json with {len(brand_dict)} brands')
  with open('data/brands.json', 'w') as f:
    f.write(json.dumps(brand_dict))

def build_type_dict(data: pd.DataFrame) -> None:
  data['TYPE OF PROMO'] = data['TYPE OF PROMO'].str.strip()
  type_dict = dict(zip(data['TYPE OF PROMO'], data['TYPE OF PROMO']))
  print(f'Storing type.json with {len(type_dict)} types of promo')
  with open('data/type.json', 'w') as f:
    f.write(json.dumps(type_dict))

if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("-f", "--file", type=Path, required=True)
  args = parser.parse_args()
  
  file = Path(__file__).parent / args.file
  assert file.exists() and file.is_file() and file.suffix == ".xlsb"

  data = pd.read_excel(file, engine="pyxlsb")

  build_group_dict(data)
  build_subgroup_dict(data)
  build_brand_dict(data)
  build_type_dict(data)
