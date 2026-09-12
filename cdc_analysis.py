import requests
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
session.mount("https://", HTTPAdapter(max_retries=retries, pool_maxsize=50))

DOMAIN = "data.cdc.gov"
CATALOG_URL = "https://api.us.socrata.com/api/catalog/v1"
PAGE_LIMIT = 100

print("Loading catalog list...")
raw_items = []
offset = 0
while True:
    resp = session.get(
        CATALOG_URL,
        params={"domains": DOMAIN, "search_context": DOMAIN, "limit": PAGE_LIMIT, "offset": offset},
        timeout=30,
    ).json()
    batch = resp.get("results", [])
    if not batch:
        break
    raw_items.extend(batch)
    offset += PAGE_LIMIT
    if offset >= resp.get("resultSetSize", 0):
        break

print(f"Received {len(raw_items)} total catalog items\n")

type_counts = Counter(item.get("resource", {}).get("type") for item in raw_items)
print("Breakdown by asset type:")
for asset_type, cnt in type_counts.most_common():
    print(f"  {asset_type}: {cnt}")

datasets = [item for item in raw_items if item.get("resource", {}).get("type") == "dataset"]
print(f"\nOf which {len(datasets)} are tabular datasets\n")


def fetch_dataset_rows(item):
    resource = item.get("resource", {})
    dataset_id = resource.get("id")
    try:
        resp = session.get(f"https://{DOMAIN}/api/views/{dataset_id}.json", timeout=20)
        meta = resp.json()
    except Exception:
        return dataset_id, item, None, "error"

    counts = []
    for col in meta.get("columns", []):
        value = col.get("cachedContents", {}).get("count")
        if value is not None:
            counts.append(int(value))

    if not counts:
        return dataset_id, item, None, "no_columns"

    row_count = counts[0]
    return dataset_id, item, row_count, "ok"


results = []
datasets_with_rows = 0
datasets_without_rows = 0
datasets_with_errors = 0

print("Retrieving row counts for each dataset...")
start = time.time()

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(fetch_dataset_rows, ds) for ds in datasets]

    for i, future in enumerate(as_completed(futures), 1):
        dataset_id, item, row_count, status = future.result()

        if status == "ok":
            datasets_with_rows += 1
            results.append((row_count, dataset_id, item))
        elif status == "error":
            datasets_with_errors += 1
        else:
            datasets_without_rows += 1

        if i % 200 == 0 or i == len(datasets):
            print(f"  ...{i}/{len(datasets)}")

print(f"Completed in {time.time() - start:.0f} seconds\n")

print("Calculating average values...")

all_rows = [r for r, _, _ in results]

average_rows = sum(all_rows) / len(all_rows)
min_rows = min(all_rows)
max_rows = max(all_rows)
empty_datasets = sum(1 for r in all_rows if r == 0)

print("\n=== RESULTS ===")
print("Total tabular datasets:", len(datasets))
print("Datasets with row count:", datasets_with_rows,
      f"({datasets_with_rows / len(datasets) * 100:.1f}%)")
print("Datasets without row count (no columns / no cachedContents):", datasets_without_rows,
      f"({datasets_without_rows / len(datasets) * 100:.1f}%)")
print("Datasets that failed due to request errors:", datasets_with_errors,
      f"({datasets_with_errors / len(datasets) * 100:.1f}%)")
print()
print("Empty datasets (0 rows), included in average/min below:", empty_datasets)
print()
print("Average number of rows per dataset:", round(average_rows))
print("Range: min =", min_rows, "rows, max =", max_rows, "rows")

print("\nTop 3 largest datasets...")

results.sort(key=lambda x: x[0], reverse=True)
top3 = results[:3]

print("\n=== TOP 3 (by row count) ===")
for row_count, dataset_id, item in top3:
    resource = item.get("resource", {})
    name = resource.get("name", dataset_id)
    link = item.get("permalink") or item.get("link") or f"https://{DOMAIN}/d/{dataset_id}"
    description = resource.get("description") or "(description unavailable)"

    print(f"\n{name}")
    print(f"Link: {link}")
    print(f"Size: {row_count} rows")
    print(f"Description: {description}")


print('\n\nMain datasets providers:')
attributions = Counter(item.get("resource", {}).get("attribution") for item in raw_items)
for source, cnt in attributions.most_common(10):
    print(source, cnt)