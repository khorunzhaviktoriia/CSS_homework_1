"""
Official per-indicator metadata, loaded from the World Bank's own
WDISeries.csv (the companion "series" export — same family of file as
WDICountry.csv). This replaces the earlier keyword-guessing classifier:
every indicator's category now comes from the real "Topic" column WDI
ships, e.g. "Economic Policy & Debt: National accounts: ...". We use the
top-level segment (before the first colon) as the browsing category,
which gives the 13 official top-level WDI topics instead of 8 guessed
ones, with zero unclassified indicators.
"""

import csv
import os

SERIES_META_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "WDISeries.csv")


def _load():
    meta = {}
    with open(SERIES_META_PATH, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            code = row["Series Code"].strip()
            topic = row["Topic"].strip()
            category = topic.split(":")[0].strip() if topic else "Other"
            meta[code] = {
                "topic": topic or None,
                "category": category or "Other",
                "unit": row["Unit of measure"].strip() or None,
                "periodicity": row["Periodicity"].strip() or None,
                "source": row["Source"].strip() or None,
                "definition": (row["Long definition"] or row["Short definition"] or "").strip() or None,
            }
    return meta


SERIES_META = _load()
ALL_CATEGORIES = sorted({m["category"] for m in SERIES_META.values()})


def get_series_meta(code: str):
    return SERIES_META.get(code, {
        "topic": None, "category": "Other", "unit": None,
        "periodicity": None, "source": None, "definition": None,
    })
