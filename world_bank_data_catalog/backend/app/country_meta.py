"""
Country / region / income-group metadata, loaded from the World Bank's own
companion file WDICountry.csv (the official metadata export that ships
alongside WDICSV.csv). WDICSV.csv only contains indicator values — it has
no region or income classification columns — so that classification is
read here, live, from the real WDICountry.csv file rather than typed in by
hand.

In WDICountry.csv, the 217 real economies have a non-empty "Region" field;
the ~47 World Bank aggregates (World, regional groups, income groups,
lending groups, etc.) have an empty Region field. One further code, INX
("Not classified"), appears as a data row in WDICSV.csv but has no entry
at all in WDICountry.csv, so it is added to the aggregate set explicitly.
"""

import csv
import os

COUNTRY_META_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "WDICountry.csv")

# Present in WDICSV.csv as a data row but absent from WDICountry.csv entirely.
EXTRA_AGGREGATE_CODES = {"INX"}


def _load():
    countries = {}
    aggregates = set(EXTRA_AGGREGATE_CODES)
    with open(COUNTRY_META_PATH, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            code = row["Country Code"].strip()
            region = row["Region"].strip()
            income = row["Income Group"].strip()
            if region:
                countries[code] = {
                    "region": region,
                    "region_code": _REGION_TO_CODE.get(region, region[:3].upper()),
                    "income_group": income or "Not classified",
                    "income_code": _INCOME_TO_CODE.get(income, None),
                }
            else:
                aggregates.add(code)
    return countries, aggregates


_REGION_TO_CODE = {
    "East Asia & Pacific": "EAS",
    "Europe & Central Asia": "ECA",
    "Latin America & Caribbean": "LCN",
    "Middle East & North Africa": "MEA",
    "North America": "NAC",
    "South Asia": "SAS",
    "Sub-Saharan Africa": "SSF",
}

_INCOME_TO_CODE = {
    "High income": "H",
    "Upper middle income": "UM",
    "Lower middle income": "LM",
    "Low income": "L",
}

_COUNTRIES, AGGREGATE_CODES = _load()


def get_meta(code: str):
    meta = _COUNTRIES.get(code)
    if meta is None:
        return {"region": "Other", "region_code": None,
                "income_group": "Not classified", "income_code": None}
    return meta
