## Forecast Engine

End-to-end workflow to prepare data, train a PyTorch model, and run inference sweeps over margin values.

### Prerequisites

- Python 3.11+
- pipenv
- (Optional) CUDA-capable GPU for faster training/inference

### Install & Activate

```bash
cd forecast-engine
pipenv install
pipenv shell
```

Set your OpenAI API key in a `.env` (loaded via `python-dotenv`):

```bash
echo 'OPENAI_API_KEY=sk-xxxx' > .env
```

### Data Preparation

Place the source Excel binary into `data/`, e.g. `data/promo_data.xlsb`.

Build the tensor dataset (and product-name embeddings) from the file:

```bash
python grouper.py -f data/promo_data.xlsb
python datasetter.py -f data/promo_data.xlsb
```

Outputs:
- `data/dataset.pt` with tensors: `{ "in": <features>, "out": <targets> }`

Note: Name embeddings are generated via OpenAI and cached in-memory during the run; ensure `OPENAI_API_KEY` is available. This step can take several minutes depending on the number of unique product names.

### Train

```bash
python train.py -d data/dataset.pt
```

What happens:
- Random split (train/test) with a fixed seed
- Optional input standardization (enabled by default)
- Checkpoints are saved into `checkpoints/run-YYYYMMDD-HHMMSS/`
  - Per-epoch weights: `epoch_###_<test_mae>.pt`
  - Final bundle: `final.pt` (includes model state, optimizer state, config, metrics, and input scaler stats)

### Inference

The runner loads a checkpoint, constructs the input vector from CLI fields, then evaluates the model across a sweep of margin values.

- Range: by default 100 points uniformly from `-sales_value` to `+sales_value` (100% down to 100% up)
- Input semantics:
  - `sales_value` is treated as the baseline price input to the net (constant across the sweep)
  - `margin` is the only varying scalar input
  - The printed `price` column is computed as `sales_value + margin` for convenience

Usage (pass either a run directory or a specific `.pt` file to `--model`):

```bash
python runner.py \
  --model checkpoints/run-20251205-153155/final.pt \
  --start-date 2025-01-01 \
  --end-date 2025-01-30 \
  --date 2025-01-15 \
  --type "NO PEAK" \
  --group 29 \
  --subgroup 401 \
  --brand CELLULARLINE \
  --product-name "CELL COV SENSATIPH13K APPLE IPHONE 17" \
  --sales-value 800
```

Output:

```text
margin,price,qty,total_margin
-177.000000,0.000000, ..., ...
...
177.000000,354.000000, ..., ...
```

- `margin`: value swept across the range
- `price`: `sales_value + margin` (informational)
- `qty`: model-predicted quantity
- `total_margin`: `margin * qty`
