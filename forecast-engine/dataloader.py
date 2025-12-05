import pandas as pd
from pathlib import Path

if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("-f", "--file", type=Path, required=True)
  args = parser.parse_args()
  
  file = Path(__file__).parent / args.file
  assert file.exists() and file.is_file() and file.suffix == ".xlsb"

  data = pd.read_excel(file, engine="pyxlsb")
