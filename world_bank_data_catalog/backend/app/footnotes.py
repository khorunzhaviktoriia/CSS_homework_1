"""
Per (country, indicator, year) data-quality footnotes, loaded from the
World Bank's official WDIfootnote.csv (846k rows across all 1,498
indicators). We only keep the subset for the ~25 featured indicators
actually shown on the Country Explorer — filtering at load time keeps
memory small (~6 MB instead of ~230 MB for the full file) while still
giving real, sourced context like "estimated from unit-record data" or
"break in comparability" next to a number, instead of just a bare figure.
"""

import os
import pandas as pd

from .indicators_catalog import FEATURED_CODES

FOOTNOTE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "WDIfootnote.csv")


def _load():
    codes = {code for code, _, _, _ in FEATURED_CODES}
    df = pd.read_csv(FOOTNOTE_PATH, encoding="utf-8-sig")
    # The official file has a couple of small formatting quirks that must be
    # normalized before matching, or rows silently fail to look up later:
    # - ~0.04% of rows have lowercase country/series codes (e.g. "aze")
    # - some Year values carry trailing whitespace (e.g. "YR2003   "),
    #   which would otherwise survive the "YR" strip and leave a mangled
    #   key like "2003   " that never matches a clean lookup year.
    df["CountryCode"] = df["CountryCode"].astype(str).str.strip().str.upper()
    df["SeriesCode"] = df["SeriesCode"].astype(str).str.strip().str.upper()
    df["Year"] = df["Year"].astype(str).str.strip()
    df = df[df["SeriesCode"].isin(codes)]
    out = {}
    for row in df.itertuples(index=False):
        year = row.Year[2:] if row.Year.startswith("YR") else row.Year
        desc = row.DESCRIPTION.strip().rstrip(",") if isinstance(row.DESCRIPTION, str) else None
        if desc:
            out[(row.CountryCode, row.SeriesCode, year)] = desc
    return out


FOOTNOTES = _load()


def get_footnote(country_code: str, series_code: str, year):
    return FOOTNOTES.get((country_code, series_code, str(year)))
