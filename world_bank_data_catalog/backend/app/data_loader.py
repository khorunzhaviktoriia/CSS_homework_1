import os
import time
import math
import numpy as np
import pandas as pd

from .country_meta import get_meta, AGGREGATE_CODES
from .series_meta import get_series_meta

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "WDICSV.csv")

YEAR_COLS = [str(y) for y in range(1960, 2026)]


class WDIStore:
    """Loads the raw World Bank CSV once and serves fast in-memory queries.

    The file is kept in wide format (one row per country+indicator, one
    column per year) because that is the shape the source CSV already has
    and every query this app needs (a single country/indicator time series,
    or a single indicator/year cross-section for ranking/mapping) is a plain
    filter on that shape - no reshaping to long format is required.
    """

    def __init__(self):
        self.loaded_at = None
        self.df = None
        self.countries = None
        self.indicators = None

    def load(self):
        t0 = time.time()
        dtypes = {
            "Country Name": "string",
            "Country Code": "string",
            "Indicator Name": "string",
            "Indicator Code": "string",
            **{c: "float32" for c in YEAR_COLS},
        }

        parts = []
        before = 0

        for chunk in pd.read_csv(
                CSV_PATH,
                dtype=dtypes,
                chunksize=50_000
        ):
            before += len(chunk)

            chunk = chunk.dropna(
                subset=YEAR_COLS,
                how="all"
            )

            parts.append(chunk)

        df = pd.concat(parts, ignore_index=True)

        for c in ["Country Name", "Country Code", "Indicator Code"]:
            df[c] = df[c].astype("category")

        # Preprocessing: drop (country, indicator) rows with literally zero
        # observations across all 66 years. This does NOT remove any real
        # observation (every value kept is exactly what was in the source
        # file) — it only discards rows that were 100% NaN to begin with,
        # which is about a quarter of the raw file and pure memory waste.
        # Genuine partial gaps (a country missing some but not all years)
        # are left untouched — WDI's missing values mean "not observed",
        # never 0, and this project never fills or interpolates them.
        dropped = before - len(df)
        self.df = df
        self.rows_dropped_empty = dropped
        self.file_size_bytes = os.path.getsize(CSV_PATH)

        countries = (
            df[["Country Name", "Country Code"]]
            .drop_duplicates()
            .rename(columns={"Country Name": "name", "Country Code": "code"})
        )
        countries = countries[~countries["code"].isin(AGGREGATE_CODES)].reset_index(drop=True)
        countries["code"] = countries["code"].astype(str)
        countries["name"] = countries["name"].astype(str)
        meta = pd.DataFrame([get_meta(c) for c in countries["code"]])
        self.countries = pd.concat([countries, meta], axis=1)

        indicators = (
            df[["Indicator Name", "Indicator Code"]]
            .drop_duplicates()
            .rename(columns={"Indicator Name": "name", "Indicator Code": "code"})
        )
        indicators["name"] = indicators["name"].astype(str)
        indicators["code"] = indicators["code"].astype(str)
        indicators["category"] = indicators["code"].map(lambda c: get_series_meta(c)["category"])
        indicators["unit"] = indicators["code"].map(lambda c: get_series_meta(c)["unit"])
        self.indicators = indicators.reset_index(drop=True)

        self.loaded_at = time.time()
        print(f"[data_loader] loaded {len(df):,} rows in {self.loaded_at - t0:.1f}s "
              f"(dropped {dropped:,} fully-empty rows; "
              f"{len(self.countries)} countries, {len(self.indicators)} indicators)")

    # ---------- lookups ----------

    def country_row(self, code):
        rec = self.countries[self.countries["code"] == code]
        return None if rec.empty else rec.iloc[0].to_dict()

    def indicator_row(self, code):
        rec = self.indicators[self.indicators["code"] == code]
        return None if rec.empty else rec.iloc[0].to_dict()

    def series(self, country_code: str, indicator_code: str):
        """Return [{year, value}] for one country/indicator, nulls dropped."""
        row = self.df[(self.df["Country Code"] == country_code) & (self.df["Indicator Code"] == indicator_code)]
        if row.empty:
            return []
        row = row.iloc[0]
        out = []
        for y in YEAR_COLS:
            v = row[y]
            if pd.notna(v):
                out.append({"year": int(y), "value": float(v)})
        return out

    def latest_value(self, country_code: str, indicator_code: str):
        s = self.series(country_code, indicator_code)
        return s[-1] if s else None

    def cross_section(self, indicator_code: str, year: str, countries_only=True):
        """Return {country_code: value} for every economy for one indicator/year."""
        sub = self.df[self.df["Indicator Code"] == indicator_code][["Country Code", year]].dropna(subset=[year])
        if countries_only:
            sub = sub[~sub["Country Code"].isin(AGGREGATE_CODES)]
        return {row["Country Code"]: float(row[year]) for _, row in sub.iterrows()}

    def latest_year_with_data(self, indicator_code: str, countries_only=True, min_countries: int = 15) -> str:
        """Latest year with at least `min_countries` reporting — plain
        `.any()` would happily return a year where only 1-2 countries (out
        of 217) have a value, which makes for a near-blank map by default
        for sparser indicators. The year slider can still be dragged to
        any year manually."""
        sub = self.df[self.df["Indicator Code"] == indicator_code]
        if countries_only:
            sub = sub[~sub["Country Code"].isin(AGGREGATE_CODES)]
        best_year, best_count = YEAR_COLS[-1], 0
        for y in reversed(YEAR_COLS):
            count = int(sub[y].notna().sum())
            if count >= min_countries:
                return y
            if count > best_count:
                best_year, best_count = y, count
        return best_year

    def latest_common_year(self, x_code: str, y_code: str, min_pairs: int = 25) -> str:
        """Most recent year where indicators x and y both have at least
        `min_pairs` overlapping countries with data — used by the
        correlation explorer so the scatter plot isn't sparse."""
        sub_x = self.df[(self.df["Indicator Code"] == x_code) & (~self.df["Country Code"].isin(AGGREGATE_CODES))]
        sub_y = self.df[(self.df["Indicator Code"] == y_code) & (~self.df["Country Code"].isin(AGGREGATE_CODES))]
        for y in reversed(YEAR_COLS):
            nx = set(sub_x[sub_x[y].notna()]["Country Code"])
            ny = set(sub_y[sub_y[y].notna()]["Country Code"])
            if len(nx & ny) >= min_pairs:
                return y
        return YEAR_COLS[-1]

    def latest_common_year_for_countries(self, indicator_code: str, country_a: str, country_b: str):
        """Most recent year where BOTH given countries have a value for one
        indicator — used by Compare so the two numbers shown are never
        silently pulled from two different years. Returns None if the two
        countries never overlap on this indicator at all."""
        row = self.df[(self.df["Indicator Code"] == indicator_code) &
                       (self.df["Country Code"].isin([country_a, country_b]))]
        by_country = row.set_index("Country Code")
        if country_a not in by_country.index or country_b not in by_country.index:
            return None
        for y in reversed(YEAR_COLS):
            va = by_country.loc[country_a, y]
            vb = by_country.loc[country_b, y]
            if pd.notna(va) and pd.notna(vb):
                return y
        return None

    def intersection_cross_section(self, indicator_code: str, year_a: str, year_b: str):
        """Values for `indicator_code` at year_a and year_b, restricted to
        the countries that have a valid observation in BOTH years — used by
        convergence analysis so dispersion is compared on a consistent
        sample rather than year A's set of reporters vs. year B's."""
        va = self.cross_section(indicator_code, year_a)
        vb = self.cross_section(indicator_code, year_b)
        common = set(va) & set(vb)
        return {c: va[c] for c in common}, {c: vb[c] for c in common}, common


store = WDIStore()
