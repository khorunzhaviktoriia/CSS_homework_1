"""
Per (country, indicator) source citations, loaded from the World Bank's
official WDIcountry-series.csv — e.g. "Data source: United Nations World
Population Prospects" for life expectancy, or a note that a country's GDP
series is estimated jointly with a neighboring country's statistics
office. Same filtering approach as footnotes.py: keep only the featured
indicators so the lookup table stays small (~4k rows) instead of loading
all ~8k rows for indicators the UI never shows.

(The fourth official companion file, WDIseries-time.csv, was also
obtained and inspected — it holds series-level methodology notes, but
all 143 of its rows are about regional/income-group *aggregate*
averaging methodology, and none of them reference any of the 25 featured
indicators, so there is nothing genuine to surface from it in the current
UI. It's kept in backend/data/ for future use rather than wired to a
component that would always render empty.)
"""

import os
import csv

from .indicators_catalog import FEATURED_CODES

SOURCES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "WDIcountry-series.csv")


def _load():
    codes = {code for code, _, _, _ in FEATURED_CODES}
    out = {}
    with open(SOURCES_PATH, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            series_code = row["SeriesCode"].strip()
            if series_code not in codes:
                continue
            country_code = row["CountryCode"].strip().upper()
            desc = row["DESCRIPTION"].strip()
            if desc:
                out[(country_code, series_code)] = desc
    return out


SOURCES = _load()


def get_source(country_code: str, series_code: str):
    return SOURCES.get((country_code, series_code))
