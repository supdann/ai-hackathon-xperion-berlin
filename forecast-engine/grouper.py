import json
import pandas as pd
from pathlib import Path

from utils import load_data, build_group_dict, build_subgroup_dict, build_brand_dict, build_type_dict

if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("-f", "--file", type=Path, required=True)
  args = parser.parse_args()
  
  file = Path(__file__).parent / args.file
  assert file.exists() and file.is_file() and file.suffix == ".xlsb"

  data = load_data(file)

  build_group_dict(data, store=True)
  build_subgroup_dict(data, store=True)
  build_brand_dict(data, store=True)
  build_type_dict(data, store=True)
