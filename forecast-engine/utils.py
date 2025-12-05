from functools import lru_cache
import json
from pathlib import Path

from dotenv import load_dotenv
import pandas as pd
import openai

def load_data(file: Path) -> pd.DataFrame:
  df = pd.read_excel(file, engine="pyxlsb")
  df['TYPE OF PROMO'] = df['TYPE OF PROMO'].str.strip()
  df['DESC GROUP'] = df['DESC GROUP'].str.strip()
  df['DESC SUBGROUP'] = df['DESC SUBGROUP'].str.strip()
  df['DESC 1 SKU'] = df['DESC 1 SKU'].str.strip()
  df['DESC 2 SKU'] = df['DESC 2 SKU'].str.strip()
  df['BRAND'] = df['BRAND'].str.strip()
  return df

def build_group_dict(data: pd.DataFrame, store: bool = False) -> dict[int, str]:
  group_dict = dict(zip(data['CODE GROUP'], data['DESC GROUP']))
  if store:
    print(f'Storing groups.json with {len(group_dict)} groups')
    with open('data/groups.json', 'w') as f:
      f.write(json.dumps(group_dict))
  return group_dict

def build_subgroup_dict(data: pd.DataFrame, store: bool = False) -> dict[int, str]:
  subgroup_dict = dict(zip(data['CODE SUBGROUP'], data['DESC SUBGROUP']))
  if store:
    print(f'Storing subgroups.json with {len(subgroup_dict)} subgroups')
    with open('data/subgroups.json', 'w') as f:
      f.write(json.dumps(subgroup_dict))
  return subgroup_dict

def build_brand_dict(data: pd.DataFrame, store: bool = False) -> dict[str, str]:
  brand_dict = dict(zip(data['BRAND'], data['BRAND']))
  if store:
    print(f'Storing brands.json with {len(brand_dict)} brands')
    with open('data/brands.json', 'w') as f:
      f.write(json.dumps(brand_dict))
  return brand_dict

def build_type_dict(data: pd.DataFrame, store: bool = False) -> dict[str, str]:
  type_dict = dict(zip(data['TYPE OF PROMO'], data['TYPE OF PROMO']))
  if store:
    print(f'Storing type.json with {len(type_dict)} types of promo')
    with open('data/type.json', 'w') as f:
      f.write(json.dumps(type_dict))
  return type_dict

@lru_cache(maxsize=None)
def openai_embedding(text: str, dimensions: int = 32) -> list[float]:
  load_dotenv()
  response = openai.embeddings.create(
    input=text,
    model="text-embedding-3-large",
    dimensions=dimensions
  )
  return response.data[0].embedding

def openai_embeddings_parallel(texts: list[str], dimensions: int = 32, max_workers: int = 20) -> dict[str, list[float]]:
  from concurrent.futures import ThreadPoolExecutor, as_completed
  from tqdm import tqdm
  unique_texts = list(dict.fromkeys(texts))
  results: dict[str, list[float]] = {}
  with ThreadPoolExecutor(max_workers=max_workers) as ex:
    futures = {ex.submit(openai_embedding, t, dimensions): t for t in unique_texts}
    for fut in tqdm(as_completed(futures), total=len(futures), desc="Embeddings"):
      t = futures[fut]
      emb = fut.result()
      results[t] = emb
  return results
