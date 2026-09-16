import pandas as pd

input_file = "NNDSS_Weekly_Data_20260914.csv"
output_file = "NNDSS_Weekly_Data_20260914_trimmed.csv"

first = True

for chunk in pd.read_csv(input_file, chunksize=100_000):
    filtered = chunk[
        chunk["Current MMWR Year"].isin([2024, 2025, 2026])
    ]

    filtered.to_csv(
        output_file,
        mode="w" if first else "a",
        header=first,
        index=False
    )

    first = False

print("Done!")