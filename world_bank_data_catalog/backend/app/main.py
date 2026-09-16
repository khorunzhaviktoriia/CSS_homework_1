from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data_loader import store, YEAR_COLS
from .country_meta import AGGREGATE_CODES
from .indicators_catalog import (
    FEATURED_INDICATORS, FEATURED_BY_CODE, MAP_DEFAULT_INDICATOR,
    COUNTRY_KPI_CODES, COMPARE_CODES, GDP_REAL_PER_CAPITA, GDP_PPP_PER_CAPITA,
    get_direction,
)
from .series_meta import get_series_meta, ALL_CATEGORIES
from .footnotes import get_footnote
from .sources import get_source


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.load()
    yield


app = FastAPI(title="Global Development Atlas API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clean(v):
    """pandas stores missing strings as NaN even in object/string columns;
    FastAPI's JSON encoder rejects float('nan'), so normalize to None."""
    return None if pd.isna(v) else v


def indicator_public(code: str):
    row = store.indicator_row(code)
    meta = get_series_meta(code)
    direction = get_direction(code)
    if row is None:
        return {"code": code, "name": code, "category": meta["category"], "unit": meta["unit"], "direction": direction}
    return {"code": row["code"], "name": row["name"], "category": row["category"], "unit": meta["unit"],
            "direction": direction}


def country_public(row: dict):
    return {
        "code": row["code"], "name": row["name"],
        "region": row["region"], "region_code": row["region_code"],
        "income_group": row["income_group"], "income_code": row["income_code"],
    }



@app.get("/api/health")
def health():
    return {"status": "ok", "rows": len(store.df), "countries": len(store.countries),
            "indicators": len(store.indicators)}


@app.get("/api/meta")
def meta():
    """Powers the animated KPI cards on the Overview page."""
    years_with_data = [y for y in YEAR_COLS if store.df[y].notna().any()]
    year_end = int(years_with_data[-1]) if years_with_data else 2025
    return {
        "countries": len(store.countries),
        "indicators": len(store.indicators),
        "year_start": int(years_with_data[0]) if years_with_data else 1960,
        "year_end": year_end,
        "dataset_size_mb": round(store.file_size_bytes / (1024 * 1024), 1),
        "rows": len(store.df),
        # Honest label: this is the most recent year ANY indicator has data
        # for (population estimates are modelled through the current year),
        # not "today" — using date.today() here would just report when the
        # backend process happened to start, which isn't a property of the
        # dataset at all.
        "latest_observation_year": year_end,
        "source": "World Bank — World Development Indicators",
    }


@app.get("/api/countries")
def countries(region: str | None = None, income: str | None = None, search: str | None = None):
    df = store.countries
    if region:
        df = df[df["region_code"] == region]
    if income:
        df = df[df["income_code"] == income]
    if search:
        df = df[df["name"].str.contains(search, case=False, na=False)]
    return [country_public(r) for r in df.to_dict("records")]


@app.get("/api/featured-indicators")
def featured_indicators():
    return FEATURED_INDICATORS


@app.get("/api/all-indicators")
def all_indicators():
    """Lightweight full list (code, name, category, unit) of all 1,498
    indicators — no per-indicator coverage stats, so it's cheap — used to
    populate searchable selectors (e.g. the Overview map) beyond just the
    25 'featured' shortcuts."""
    return [
        {"code": r["code"], "name": r["name"], "category": r["category"], "unit": _clean(r["unit"])}
        for r in store.indicators.to_dict("records")
    ]


@app.get("/api/indicators")
def indicators(search: str | None = None, category: str | None = None,
                page: int = 1, page_size: int = 24):
    df = store.indicators
    if search:
        df = df[df["name"].str.contains(search, case=False, na=False) |
                 df["code"].str.contains(search, case=False, na=False)]
    if category and category != "All":
        df = df[df["category"] == category]
    total = len(df)
    start = (page - 1) * page_size
    page_df = df.iloc[start:start + page_size]

    results = []
    for r in page_df.to_dict("records"):
        countries_covered = int(
            (~store.df[(store.df["Indicator Code"] == r["code"]) &
                       (~store.df["Country Code"].isin(AGGREGATE_CODES))]
             .set_index("Country Code")[YEAR_COLS].isna().all(axis=1)
             ).sum()
        )
        results.append({
            "code": r["code"], "name": r["name"], "category": r["category"],
            "unit": _clean(r["unit"]),
            "countries_covered": countries_covered,
        })
    return {"total": total, "page": page, "page_size": page_size, "results": results}


@app.get("/api/indicator-categories")
def indicator_categories():
    counts = store.indicators["category"].value_counts().to_dict()
    return [{"name": c, "count": counts.get(c, 0)} for c in ALL_CATEGORIES]


@app.get("/api/map-data")
def map_data(indicator: str = MAP_DEFAULT_INDICATOR, year: str | None = None):
    year = year or store.latest_year_with_data(indicator)
    values = store.cross_section(indicator, year)
    return {
        "indicator": indicator_public(indicator),
        "year": int(year),
        "values": values,
    }


@app.get("/api/country/{code}")
def country_detail(code: str):
    row = store.country_row(code)
    if row is None:
        raise HTTPException(404, "Unknown country code")
    kpis = {}
    for ic in COUNTRY_KPI_CODES:
        latest = store.latest_value(code, ic)
        footnote = get_footnote(code, ic, latest["year"]) if latest else None
        source = get_source(code, ic)
        kpis[ic] = {
            **indicator_public(ic),
            "latest": latest,
            "footnote": footnote,
            "source": source,
        }

    charts = {
        "gdp_per_capita": store.series(code, "NY.GDP.PCAP.CD"),
        "population": store.series(code, "SP.POP.TOTL"),
        "life_expectancy": store.series(code, "SP.DYN.LE00.IN"),
        "school_enrollment": store.series(code, "SE.PRM.ENRR"),
    }

    return {
        "country": country_public(row),
        "kpis": kpis,
        "charts": charts,
    }

@app.get("/api/country/{code}/series")
def country_series(code: str, indicator: str):
    row = store.country_row(code)

    if row is None:
        raise HTTPException(404, "Unknown country code")

    if store.indicator_row(indicator) is None:
        raise HTTPException(404, "Unknown indicator code")

    return {
        "country": country_public(row),
        "indicator": indicator_public(indicator),
        "series": store.series(code, indicator),
    }

@app.get("/api/compare")
def compare(a: str, b: str, indicators: str = ",".join(COMPARE_CODES)):
    codes = [c for c in indicators.split(",") if c]
    row_a, row_b = store.country_row(a), store.country_row(b)
    if row_a is None or row_b is None:
        raise HTTPException(404, "Unknown country code")

    rows = []
    for ic in codes:
        year = store.latest_common_year_for_countries(ic, a, b)
        if year is None:
            rows.append({**indicator_public(ic), "a": None, "b": None, "year": None,
                         "no_common_data": True})
            continue
        row = store.df[(store.df["Indicator Code"] == ic) & (store.df["Country Code"].isin([a, b]))].set_index("Country Code")
        rows.append({
            **indicator_public(ic),
            "a": float(row.loc[a, year]), "b": float(row.loc[b, year]),
            "year": int(year), "no_common_data": False,
        })

    lines = {
        "a": store.series(a, "NY.GDP.PCAP.CD"),
        "b": store.series(b, "NY.GDP.PCAP.CD"),
    }

    return {
        "country_a": country_public(row_a),
        "country_b": country_public(row_b),
        "rows": rows,
        "gdp_lines": lines,
    }

@app.get("/api/compare-series")
def compare_series(a: str, b: str, indicator: str):
    row_a = store.country_row(a)
    row_b = store.country_row(b)

    if row_a is None or row_b is None:
        raise HTTPException(404, "Unknown country code")

    if store.indicator_row(indicator) is None:
        raise HTTPException(404, "Unknown indicator code")

    return {
        "country_a": country_public(row_a),
        "country_b": country_public(row_b),
        "indicator": indicator_public(indicator),
        "a": store.series(a, indicator),
        "b": store.series(b, indicator),
    }
@app.get("/api/rankings")
def rankings(indicator: str = MAP_DEFAULT_INDICATOR, year: str | None = None,
             region: str | None = None, order: str = "desc", limit: int = 20):
    year = year or store.latest_year_with_data(indicator)
    values = store.cross_section(indicator, year)
    df = store.countries.copy()
    df["value"] = df["code"].map(values)
    df = df.dropna(subset=["value"])
    if region:
        df = df[df["region_code"] == region]
    df = df.sort_values("value", ascending=(order == "asc"))
    df.insert(0, "rank", range(1, len(df) + 1))
    top = df.head(limit)
    return {
        "indicator": indicator_public(indicator),
        "year": int(year),
        "results": [
            {"rank": int(r["rank"]), "code": r["code"], "name": r["name"],
             "region": r["region"], "value": r["value"]}
            for r in top.to_dict("records")
        ],
    }


@app.get("/api/search")
def search(q: str, limit: int = 8):
    countries_df = store.countries[store.countries["name"].str.contains(q, case=False, na=False)]
    indicators_df = store.indicators[store.indicators["name"].str.contains(q, case=False, na=False)]
    return {
        "countries": [country_public(r) for r in countries_df.head(limit).to_dict("records")],
        "indicators": [
            {"code": r["code"], "name": r["name"], "category": r["category"]}
            for r in indicators_df.head(limit).to_dict("records")
        ],
    }


def best_comparison_year(indicator_code: str, base_year: int, min_pairs: int = 100) -> str:
    """The most recent year for `indicator_code` that still has at least
    `min_pairs` countries which *also* have data in `base_year` — i.e. a
    year that's actually usable for a base_year -> this_year comparison,
    picked per-indicator instead of one hardcoded year for everything
    (some indicators, like CO2 or life expectancy, simply have no data at
    all for the most recent 1-2 years; see README for real numbers)."""
    base_countries = set(store.cross_section(indicator_code, str(base_year)))
    if not base_countries:
        return str(base_year)
    for y in reversed(YEAR_COLS):
        if int(y) <= base_year:
            break
        overlap = base_countries & set(store.cross_section(indicator_code, y))
        if len(overlap) >= min_pairs:
            return y
    return str(base_year)


@app.get("/api/insights")
def insights(base_year: int = 2000, year: int | None = None):
    """A handful of story-driven cards for the Insights page, computed live
    from the featured indicators rather than hard-coded. Each card picks
    its own most-recent comparable year unless `year` is forced explicitly,
    since coverage for the most recent 1-3 years differs a lot by
    indicator (population is modelled through 2025; CO2 and life
    expectancy currently have zero countries with 2025 data at all)."""
    by = str(base_year)

    def delta_ranking(code: str, ascending: bool, top_n=5, mode: str = "absolute", min_start: float = 0):
        y = str(year) if year else best_comparison_year(code, base_year)
        end = store.cross_section(code, y)
        start = store.cross_section(code, by)
        rows = []
        for c, v_end in end.items():
            v_start = start.get(c)
            if v_start is None or v_start <= min_start:
                continue
            metric = (v_end / v_start - 1) * 100 if mode == "percent" else v_end - v_start
            rows.append((c, metric, v_end, v_start))
        rows.sort(key=lambda r: r[1], reverse=not ascending)
        out = []
        for code_, delta, v_end, v_start in rows[:top_n]:
            crow = store.country_row(code_)
            if crow is None:
                continue
            out.append({"code": code_, "name": crow["name"], "delta": delta,
                         "start": v_start, "end": v_end})
        return out, int(y)

    cards_spec = [
        ("life_expectancy_gain", "Biggest gains in life expectancy", "SP.DYN.LE00.IN", False, "absolute"),
        ("gdp_growth", "Fastest-growing economies (real GDP per capita, % change)", GDP_REAL_PER_CAPITA, False, "percent"),
        ("co2_down", "Largest drops in CO2 emissions per capita", "EN.GHG.CO2.PC.CE.AR5", True, "absolute"),
        ("internet_growth", "Fastest internet adoption", "IT.NET.USER.ZS", False, "absolute"),
    ]
    cards = []
    for card_id, title, code, ascending, mode in cards_spec:
        items, end_year = delta_ranking(code, ascending=ascending, mode=mode, min_start=100 if mode == "percent" else 0)
        cards.append({
            "id": card_id, "title": title, "indicator": indicator_public(code),
            "base_year": base_year, "year": end_year, "mode": mode, "items": items,
        })

    return {"base_year": base_year, "cards": cards}


@app.get("/api/correlation")
def correlation(x: str = "NY.GDP.PCAP.CD", y: str = "SP.DYN.LE00.IN", year: str | None = None):
    """Scatter data + Pearson correlation + OLS regression line between any
    two indicators across every country for one year."""
    year = year or store.latest_common_year(x, y)
    vx = store.cross_section(x, year)
    vy = store.cross_section(y, year)
    common = sorted(set(vx) & set(vy))

    points = []
    xs, ys = [], []
    for code in common:
        row = store.country_row(code)
        if row is None:
            continue
        points.append({
            "code": code, "name": row["name"], "region": row["region"],
            "income_group": row["income_group"], "x": vx[code], "y": vy[code],
        })
        xs.append(vx[code])
        ys.append(vy[code])

    r = slope = intercept = None
    if len(xs) >= 2 and np.std(xs) > 0 and np.std(ys) > 0:
        r = float(np.corrcoef(xs, ys)[0, 1])
        slope, intercept = (float(v) for v in np.polyfit(xs, ys, 1))

    return {
        "x": indicator_public(x), "y": indicator_public(y), "year": int(year),
        "n": len(points), "points": points,
        "r": round(r, 3) if r is not None else None,
        "r2": round(r * r, 3) if r is not None else None,
        "slope": slope, "intercept": intercept,
    }


@app.get("/api/convergence")
def convergence(indicator: str = GDP_PPP_PER_CAPITA):
    """Sigma-convergence style analysis: is the spread of this indicator
    across countries shrinking or growing over time?

    Methodology notes (see README for the full rationale):
    - Uses PPP-adjusted, constant-price GDP per capita by default rather
      than nominal current-US$ GDP, so the comparison isn't distorted by
      inflation or exchange-rate movements.
    - The per-year series (used for the chart) reports dispersion among
      that year's own actually-reporting countries, with the country count
      shown alongside every point so coverage is never hidden.
    - The headline trend statement, however, compares the first and last
      analyzed year using ONLY the intersection of countries that reported
      in *both* of those two years — a consistent, balanced sample for the
      one number this feature asserts most strongly.
    - std(log(x)) is the primary dispersion metric (appropriate for the
      strongly right-skewed distribution of GDP per capita); coefficient of
      variation is kept as a secondary, more familiar number.
    """
    sub = store.df[(store.df["Indicator Code"] == indicator) & (~store.df["Country Code"].isin(AGGREGATE_CODES))]

    series = []
    for y in YEAR_COLS:
        vals = sub[y].dropna()
        vals = vals[vals > 0]  # log() requires positive values
        n = len(vals)
        if n < 30:
            continue
        log_vals = np.log(vals)
        mean = float(vals.mean())
        std = float(vals.std())
        sorted_vals = vals.sort_values()
        decile_n = max(1, n // 10)
        bottom10 = float(sorted_vals.iloc[:decile_n].mean())
        top10 = float(sorted_vals.iloc[-decile_n:].mean())
        series.append({
            "year": int(y),
            "countries": int(n),
            "log_dispersion": round(float(log_vals.std()), 4),
            "coefficient_of_variation": round(std / mean, 3) if mean else None,
            "top10_bottom10_ratio": round(top10 / bottom10, 1) if bottom10 else None,
        })

    trend = None
    if len(series) >= 2:
        first_year, last_year = str(series[0]["year"]), str(series[-1]["year"])
        va, vb, common = store.intersection_cross_section(indicator, first_year, last_year)
        common = [c for c in common if va[c] > 0 and vb[c] > 0]
        if len(common) >= 20:
            log_std_first = float(np.log([va[c] for c in common]).std())
            log_std_last = float(np.log([vb[c] for c in common]).std())
            change = (log_std_last - log_std_first) / log_std_first * 100 if log_std_first else 0
            trend = {
                "from_year": int(first_year), "to_year": int(last_year),
                "countries_in_sample": len(common),
                "log_dispersion_change_pct": round(change, 1),
                "direction": "narrowing" if change < 0 else "widening",
                "statement": (
                    f"Cross-country income dispersion {'decreased' if change < 0 else 'increased'} "
                    f"over this period."
                ),
            }

    return {
        "indicator": indicator_public(indicator),
        "series": series,
        "trend": trend,
        "methodology": (
            "Compares the same set of countries in the first and last year using "
            "PPP-adjusted, constant-price real GDP per capita. The year-by-year line "
            "uses each year's own reporting countries (count shown per point); the "
            "headline trend statement above uses only countries reporting in both "
            "the first and last year, for a consistent sample."
        ),
    }
