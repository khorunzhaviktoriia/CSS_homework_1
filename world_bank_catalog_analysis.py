import requests
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
session.mount("https://", HTTPAdapter(max_retries=retries, pool_maxsize=50))


def safe_size(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def clean_html(text, max_len=400):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


print("Loading dataset list...")
raw_datasets = []
skip = 0
page_size = 1000
while True:
    resp = session.get(
        "https://ddh-openapi.worldbank.org/datasets",
        params={"skip": skip, "top": page_size},
        timeout=30,
    ).json()
    batch = resp["data"]
    if not batch:
        break
    raw_datasets.extend(batch)
    skip += page_size

seen = set()
datasets = []
for d in raw_datasets:
    uid = d.get("dataset_unique_id")
    if not uid or uid in seen:
        continue
    seen.add(uid)
    datasets.append(d)

print(f"Received  {len(raw_datasets)} records, of which {len(datasets)} are valid unique datasets\n")


def fetch_dataset_sizes(dataset):
    dataset_id = dataset["dataset_unique_id"]
    try:
        resp = session.get(
            "https://ddh-openapi.worldbank.org/resources",
            params={"dataset_unique_id": dataset_id},
            timeout=20,
        )
        data = resp.json()
    except Exception:
        return dataset_id, dataset, []

    if "data" not in data:
        return dataset_id, dataset, []

    sizes = []
    for r in data["data"]:
        raw = r.get("distribution", {}).get("distribution_size")
        s = safe_size(raw)
        if s is not None:
            sizes.append(s)

    return dataset_id, dataset, sizes


all_resource_sizes = []
largest_resource_sizes = []
dataset_sum_sizes = []
dataset_max_sizes = []

datasets_with_size = 0
datasets_without_size = 0

print("Retrieving resources and file sizes for each dataset...")
start = time.time()

with ThreadPoolExecutor(max_workers=30) as executor:
    futures = [executor.submit(fetch_dataset_sizes, ds) for ds in datasets]

    for i, future in enumerate(as_completed(futures), 1):
        dataset_id, dataset, sizes = future.result()

        if sizes:
            datasets_with_size += 1
            all_resource_sizes.extend(sizes)

            largest = max(sizes)
            total = sum(sizes)

            largest_resource_sizes.append(largest)
            dataset_sum_sizes.append((total, dataset_id, dataset))
            dataset_max_sizes.append((largest, dataset_id, dataset))
        else:
            datasets_without_size += 1

        if i % 1000 == 0 or i == len(datasets):
            print(f"  ...{i}/{len(datasets)}")

print(f"Completed in {time.time() - start:.0f} seconds\n")

print("Calculating average values...")

average_resource_size_mb = (sum(all_resource_sizes) / len(all_resource_sizes)) / (1024 ** 2)
average_largest_resource_size_mb = (sum(largest_resource_sizes) / len(largest_resource_sizes)) / (1024 ** 2)
average_sum_size_mb = (sum(s for s, _, _ in dataset_sum_sizes) / len(dataset_sum_sizes)) / (1024 ** 2)
min_size_mb = min(all_resource_sizes) / (1024 ** 2)
max_size_mb = max(all_resource_sizes) / (1024 ** 2)

print("\n\n=== RESULTS ===")
print("Total valid datasets:", len(datasets))
print("Datasets with size information:", datasets_with_size,
      f"({datasets_with_size / len(datasets) * 100:.1f}%)")
print("Datasets without size information:", datasets_without_size,
      f"({datasets_without_size / len(datasets) * 100:.1f}%)")
print("Resources with known size:", len(all_resource_sizes))
print()
print("Average resource size:", round(average_resource_size_mb, 2), "MB")
print("Average dataset size (MAX):", round(average_largest_resource_size_mb, 2), "MB")
print("Average dataset size (SUM):", round(average_sum_size_mb, 2), "MB")
print("Range: min =", round(min_size_mb, 2), "MB, max =", round(max_size_mb, 2), "MB")

print("\nTop 3 largest datasets...")


def fetch_clean_description(dataset_id):
    try:
        resp = session.get(
            f"https://ddh-openapi.worldbank.org/datasets/{dataset_id}",
            timeout=20,
        ).json()
        return resp.get("identification", {}).get("description", "")
    except Exception:
        return ""


for label, data_list in [("SUM", dataset_sum_sizes), ("MAX", dataset_max_sizes)]:
    data_list.sort(key=lambda x: x[0], reverse=True)
    top3 = data_list[:3]

    print(f"\n=== TOP 3 (method {label}) ===")
    for size, dataset_id, dataset in top3:
        name = dataset.get("name", dataset_id)
        link = f"https://datacatalog.worldbank.org/search/dataset/{dataset_id}"
        size_mb = size / (1024 ** 2)
        raw_desc = fetch_clean_description(dataset_id)
        description = clean_html(raw_desc)

        print(f"\n{name}")
        print(f"Link: {link}")
        print(f"Size: {round(size_mb, 2)} MB")
        print(f"Description: {description if description else '(опис недоступний)'}")