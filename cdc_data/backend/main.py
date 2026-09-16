"""
Disease Radar — backend API
============================
Loads the full CDC NNDSS Weekly Tables CSV (data/NNDSS_Weekly_Data_20260914.csv,
~274MB / ~1.6M rows) into memory once at startup, aggregates it into
per-(disease, area) weekly time series, and serves it over a small REST API
that the React frontend consumes.

Run:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

All analytics shown in the frontend (robust anomaly scores, growth index,
correlation, forecasting, etc.) are computed client-side from the raw
weekly arrays this API returns — the backend's job is loading, cleaning,
and serving the real dataset, not pre-baking the analysis.
"""

import os
import re
import time
import logging
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("disease-radar")

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH = os.path.join(DATA_DIR, "NNDSS_Weekly_Data_20260914_trimmed.csv")
TOP_N_BOOTSTRAP = 40  # how many top-volume diseases get state-level detail bundled up-front

STATE_LIST = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas',
    'Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
    'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York',
    'New York City','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
    'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia',
    'Washington','West Virginia','Wisconsin','Wyoming','Puerto Rico','Guam','American Samoa',
    'U.S. Virgin Islands','Commonwealth of Northern Mariana Islands',
]
MAP_STATES = [s for s in STATE_LIST if s not in ("Puerto Rico", "Guam",
                                                   "American Samoa", "U.S. Virgin Islands",
                                                   "Commonwealth of Northern Mariana Islands")]
# ^ Includes "New York City" as its own trackable jurisdiction (see POPULATION note
#   below) — it just has no cell on the tile-grid map, since that's a physical-state
#   grid and NYC is a sub-state jurisdiction. It still appears in rankings, the state
#   selector, the state drawer, completeness tables, and every other list-based view.

# NNDSS reports New York City separately from the rest of New York State — the
# "New York" reporting area explicitly EXCLUDES NYC. Using the full NY state
# population as the denominator for "New York" incidence would therefore overstate
# its population (understate its per-capita incidence) and NYC wouldn't be
# represented at all. We split the population accordingly:
#   New York (state total, Vintage 2024): 19,867,248
#   New York City (Vintage 2024 estimate): 8,258,035
#   => "New York" (excl. NYC) for denominator purposes: 11,609,213
POPULATION = {
    'Alabama': 5157699, 'Alaska': 740133, 'Arizona': 7582384, 'Arkansas': 3088354, 'California': 39431263,
    'Colorado': 5957493, 'Connecticut': 3676546, 'Delaware': 1051917, 'District of Columbia': 702250,
    'Florida': 23372215, 'Georgia': 11180878, 'Hawaii': 1446146, 'Idaho': 2001619, 'Illinois': 12582032,
    'Indiana': 6924275, 'Iowa': 3241488, 'Kansas': 2970606, 'Kentucky': 4588372, 'Louisiana': 4597740,
    'Maine': 1395722, 'Maryland': 6263220, 'Massachusetts': 7136171, 'Michigan': 10140459, 'Minnesota': 5793151,
    'Mississippi': 2943045, 'Missouri': 6245466, 'Montana': 1137233, 'Nebraska': 2005465, 'Nevada': 3267467,
    'New Hampshire': 1409032, 'New Jersey': 9500851, 'New Mexico': 2130256,
    'New York': 11609213, 'New York City': 8258035,
    'North Carolina': 11046024, 'North Dakota': 796568, 'Ohio': 11883304, 'Oklahoma': 4095393, 'Oregon': 4272371,
    'Pennsylvania': 13078751, 'Rhode Island': 1112308, 'South Carolina': 5478831, 'South Dakota': 924669,
    'Tennessee': 7227750, 'Texas': 31290831, 'Utah': 3503613, 'Vermont': 648493, 'Virginia': 8811195,
    'Washington': 7958180, 'West Virginia': 1769979, 'Wisconsin': 5960975, 'Wyoming': 587618,
}

# --------------------------------------------------------------------------
# Disease-label normalization — a handful of labels changed casing/spacing
# between reporting years (verified by inspecting the raw file), which would
# otherwise silently split one disease's history into two separate series.
# These three are confirmed cosmetic-only variants (same condition, same
# case-count magnitude, contiguous year ranges) — not a change in what's
# being measured, so merging them is safe. Anything not in this list is left
# alone, i.e. treated as a distinct series, which is the conservative default.
# --------------------------------------------------------------------------
LABEL_ALIASES = {
    "Coccidioidomycosis, total": "Coccidioidomycosis, Total",
    "Hepatitis, B, acute": "Hepatitis B, acute",
    "SalmonellaParatyphi infection": "Salmonella Paratyphi infection",
}


def normalize_label(raw: str) -> str:
    if not isinstance(raw, str):
        return raw
    cleaned = re.sub(r"\s+", " ", raw.strip())
    return LABEL_ALIASES.get(cleaned, cleaned)

YEARS = [2024, 2025, 2026]
NWEEKS = 53


def canon_key(a: str) -> str:
    return re.sub(r"[^A-Z]", "", a.upper())


CANON_MAP = {canon_key(s): s for s in STATE_LIST}
CANON_MAP[canon_key("U.S. Residents")] = "US RESIDENTS"
CANON_MAP[canon_key("US Residents")] = "US RESIDENTS"


def to_canonical(raw):
    if not isinstance(raw, str):
        return None
    return CANON_MAP.get(canon_key(raw))


# --------------------------------------------------------------------------
# Tile-grid layout for the frontend's stylised choropleth (derived from real
# state centroids, with collisions resolved by nearest-free-cell search)
# --------------------------------------------------------------------------

def build_state_grid():
    centroids = {
        'Alabama': (32.8, -86.8), 'Alaska': (63.0, -153.0), 'Arizona': (34.2, -111.9), 'Arkansas': (34.9, -92.4),
        'California': (37.2, -119.6), 'Colorado': (39.0, -105.5), 'Connecticut': (41.6, -72.7), 'Delaware': (39.0, -75.5),
        'District of Columbia': (38.9, -77.0), 'Florida': (28.6, -82.4), 'Georgia': (32.6, -83.4), 'Hawaii': (20.5, -157.5),
        'Idaho': (44.3, -114.6), 'Illinois': (40.0, -89.2), 'Indiana': (39.9, -86.3), 'Iowa': (42.0, -93.5),
        'Kansas': (38.5, -98.4), 'Kentucky': (37.5, -85.3), 'Louisiana': (31.0, -92.0), 'Maine': (45.4, -69.2),
        'Maryland': (39.0, -76.7), 'Massachusetts': (42.3, -71.8), 'Michigan': (44.3, -85.4), 'Minnesota': (46.3, -94.3),
        'Mississippi': (32.7, -89.7), 'Missouri': (38.5, -92.5), 'Montana': (47.0, -109.6), 'Nebraska': (41.5, -99.8),
        'Nevada': (39.3, -116.6), 'New Hampshire': (43.7, -71.6), 'New Jersey': (40.1, -74.7), 'New Mexico': (34.4, -106.1),
        'New York': (42.9, -75.5), 'North Carolina': (35.6, -79.4), 'North Dakota': (47.5, -100.5), 'Ohio': (40.4, -82.8),
        'Oklahoma': (35.6, -97.5), 'Oregon': (44.0, -120.6), 'Pennsylvania': (40.9, -77.8), 'Rhode Island': (41.7, -71.5),
        'South Carolina': (33.9, -80.9), 'South Dakota': (44.4, -100.2), 'Tennessee': (35.9, -86.4), 'Texas': (31.5, -99.3),
        'Utah': (39.3, -111.7), 'Vermont': (44.0, -72.7), 'Virginia': (37.5, -78.9), 'Washington': (47.4, -120.5),
        'West Virginia': (38.6, -80.7), 'Wisconsin': (44.6, -89.9), 'Wyoming': (43.0, -107.5),
    }
    COLS, ROWS = 13, 8
    lonMin, lonMax = -125, -66
    latMin, latMax = 24, 49.5

    def to_cell(lat, lon):
        col = round((lon - lonMin) / (lonMax - lonMin) * (COLS - 1))
        row = (ROWS - 1) - round((lat - latMin) / (latMax - latMin) * (ROWS - 1))
        return col, row

    occupied = {}
    grid = {}
    for name, (lat, lon) in centroids.items():
        c, r = to_cell(lat, lon)
        c = max(0, min(COLS - 1, c))
        r = max(0, min(ROWS - 1, r))
        if (c, r) not in occupied:
            occupied[(c, r)] = name
            grid[name] = {"col": c, "row": r}
            continue
        placed = False
        for radius in range(1, COLS + ROWS):
            candidates = []
            for dc in range(-radius, radius + 1):
                for dr in range(-radius, radius + 1):
                    if max(abs(dc), abs(dr)) != radius:
                        continue
                    nc, nr = c + dc, r + dr
                    if 0 <= nc < COLS and 0 <= nr < ROWS and (nc, nr) not in occupied:
                        candidates.append((dc * dc * 1.3 + dr * dr, nc, nr))
            if candidates:
                candidates.sort()
                _, nc, nr = candidates[0]
                occupied[(nc, nr)] = name
                grid[name] = {"col": nc, "row": nr}
                placed = True
                break
        if not placed:
            raise RuntimeError(f"no free grid cell for {name}")
    return {"cols": COLS, "rows": ROWS, "grid": grid}


STATE_GRID = build_state_grid()

# --------------------------------------------------------------------------
# Load + aggregate the full dataset once at startup
# --------------------------------------------------------------------------

class Store:
    national_series: dict = {}
    state_series: dict = {}
    label_volume: dict = {}
    completeness_total: dict = {}      # denominator: weeks the condition is reportable in that area (excludes "N")
    completeness_reported: dict = {}   # numerator: weeks with an actual value or an explicit "-" (zero) observation
    labels_seen: list = []
    states_seen: list = []
    row_count: int = 0
    loaded_at: float = 0.0
    year_max_week: dict = {}   # last week index (1-based) with any reported national data, per year
    year_complete: dict = {}   # True if that year's national data extends through ~the full year


STORE = Store()


def clean_numeric(series: pd.Series) -> pd.Series:
    """Parse 'Current week' into floats, handling the CDC export's various
    thousands-separator characters: plain commas, regular spaces, non-breaking
    spaces (\u00A0), and narrow non-breaking spaces (\u202F) — e.g. "6\u00a0911" -> 6911.
    Values that still don't parse become NaN (handled by the flag-based fallback below)."""
    s = series.astype(str)
    for ch in (",", "\u00A0", "\u202F", " "):
        s = s.str.replace(ch, "", regex=False)
    return pd.to_numeric(s, errors="coerce")


def load_dataset():
    t0 = time.time()
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"Dataset not found at {CSV_PATH}. Place NNDSS_Weekly_Data_20260914.csv in backend/data/."
        )
    log.info("Loading %s ...", CSV_PATH)
    usecols = ["Reporting Area", "Current MMWR Year", "MMWR WEEK", "Label",
               "Current week", "Current week, flag"]

    dfs = []
    for chunk in pd.read_csv(CSV_PATH, usecols=usecols, chunksize=500_000, dtype=str,
                              keep_default_na=False, na_values=[""]):
        chunk = chunk.assign(Label=chunk["Label"].map(normalize_label))
        ak = chunk["Reporting Area"].str.upper().str.replace(r"[^A-Z]", "", regex=True)
        chunk = chunk.assign(area_c=ak.map(CANON_MAP))
        chunk = chunk[chunk["area_c"].notna()]
        dfs.append(chunk)
    df = pd.concat(dfs, ignore_index=True)
    del dfs
    STORE.row_count = len(df)
    log.info("Loaded %d rows in %.1fs", len(df), time.time() - t0)

    df["year"] = df["Current MMWR Year"].astype(int)
    df["week"] = df["MMWR WEEK"].astype(int)
    mask = df["year"].isin(YEARS) & (df["week"] >= 1) & (df["week"] <= NWEEKS)
    df = df[mask]

    dedup_cols = [
        "area_c",
        "year",
        "week",
        "Label",
        "Current week",
        "Current week, flag",
    ]

    before = len(df)
    df = df.drop_duplicates(subset=dedup_cols)
    log.info("Removed %d duplicate normalized observations", before - len(df))
    # --------------------------------------------------------------------
    # Value / status parsing — this is the core fix. Priority order:
    #   1. "Current week" parses to a number (after cleaning separators)  -> use it as-is
    #   2. otherwise, flag == "-"  -> zero reported cases (a real observation, not missing)
    #   3. otherwise, flag == "U"  -> unavailable -> missing (NaN, excluded from analysis)
    #   4. otherwise, flag == "N"  -> not reportable in that jurisdiction -> "not applicable"
    #      (NaN in the numeric series, and EXCLUDED from the completeness denominator —
    #       a jurisdiction that can't report a condition shouldn't be penalized for it)
    #   5. anything else unexpected -> treated as missing, conservatively
    # --------------------------------------------------------------------
    valnum = clean_numeric(df["Current week"])
    flag = df["Current week, flag"]
    has_value = valnum.notna()

    status = np.select(
        [has_value, flag == "-", flag == "U", flag == "N"],
        ["value", "zero", "missing", "not_applicable"],
        default="missing",
    )
    val = np.select(
        [has_value, status == "zero"],
        [valnum.to_numpy(dtype=float), 0.0],
        default=np.nan,
    )
    df["val"] = val
    df["status"] = status
    df["is_reportable"] = status != "not_applicable"          # completeness denominator
    df["is_valid_observation"] = np.isin(status, ["value", "zero"])  # completeness numerator

    is_national = df["area_c"] == "US RESIDENTS"
    df_nat = df[is_national]
    df_state = df[~is_national]

    national_series = {}
    g = df_nat.dropna(subset=["val"]).groupby(["Label", "year", "week"])["val"].sum()
    for (label, year, week), v in g.items():
        arr = national_series.setdefault(label, np.full((len(YEARS), NWEEKS), np.nan))
        arr[YEARS.index(year), week - 1] = v

    state_series = {}
    g2 = df_state.dropna(subset=["val"]).groupby(["Label", "area_c", "year", "week"])["val"].sum()
    for (label, area, year, week), v in g2.items():
        arr = state_series.setdefault((label, area), np.full((len(YEARS), NWEEKS), np.nan))
        arr[YEARS.index(year), week - 1] = v

    label_volume = df_nat.dropna(subset=["val"]).groupby("Label")["val"].sum().to_dict()

    comp_total = df_state[df_state["is_reportable"]].groupby(["area_c", "Label"]).size()
    comp_reported = df_state[df_state["is_valid_observation"]].groupby(["area_c", "Label"]).size()

    STORE.national_series = national_series
    STORE.state_series = state_series
    STORE.label_volume = label_volume
    STORE.completeness_total = {f"{a}||{l}": int(v) for (a, l), v in comp_total.items()}
    STORE.completeness_reported = {f"{a}||{l}": int(v) for (a, l), v in comp_reported.items()}
    STORE.labels_seen = sorted(df["Label"].unique().tolist())
    STORE.states_seen = sorted(df_state["area_c"].unique().tolist())
    STORE.loaded_at = time.time()

    # Per-year completeness, used by the frontend to avoid comparing a partial
    # current year against full historical years as if they were equivalent.
    year_max_week = {}
    for yi, y in enumerate(YEARS):
        max_w = 0
        for arr in national_series.values():
            row = arr[yi]
            nz = np.nonzero(~np.isnan(row))[0]
            if len(nz):
                max_w = max(max_w, int(nz.max()) + 1)
        year_max_week[y] = max_w
    STORE.year_max_week = year_max_week
    STORE.year_complete = {y: year_max_week[y] >= NWEEKS - 1 for y in YEARS}

    log.info("Aggregated %d labels / %d states in %.1fs total", len(STORE.labels_seen),
              len(STORE.states_seen), time.time() - t0)
    log.info("Year completeness: %s", STORE.year_complete)


def arr_to_list(arr: np.ndarray):
    out = []
    for row in arr.tolist():
        out.append([None if (v is None or (isinstance(v, float) and np.isnan(v))) else int(round(v)) for v in row])
    return out


def get_national_payload(label: str):
    arr = STORE.national_series.get(label)
    if arr is not None:
        return {"data": arr_to_list(arr), "synthetic": False}
    # fallback: synthesize from available state series so every disease has *some* national view
    acc = None
    cnt = None
    found = False
    for (l, st), sarr in STORE.state_series.items():
        if l != label:
            continue
        found = True
        if acc is None:
            acc = np.zeros_like(sarr)
            cnt = np.zeros_like(sarr)
        m = ~np.isnan(sarr)
        acc = np.where(m, np.nan_to_num(acc) + np.where(m, sarr, 0), acc)
        cnt = cnt + m.astype(int)
    if found:
        arr = np.where(cnt > 0, acc, np.nan)
        return {"data": arr_to_list(arr), "synthetic": True}
    return {"data": [[None] * NWEEKS for _ in YEARS], "synthetic": True}


def get_state_detail_payload(label: str):
    out = {}
    for st in MAP_STATES:
        arr = STORE.state_series.get((label, st))
        if arr is not None:
            out[st] = arr_to_list(arr)
    return out


def get_completeness_payload(label: str):
    out = {}
    for st in MAP_STATES:
        key = f"{st}||{label}"
        tot = STORE.completeness_total.get(key, 0)
        rep = STORE.completeness_reported.get(key, 0)
        if tot > 0:
            out[st] = round(rep / tot, 4)
    return out


# --------------------------------------------------------------------------
# FastAPI app
# --------------------------------------------------------------------------

app = FastAPI(title="Disease Radar API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    load_dataset()


@app.get("/api/health")
def health():
    return {
        "status": "ok" if STORE.row_count else "loading",
        "rows": STORE.row_count,
        "labels": len(STORE.labels_seen),
        "states": len(STORE.states_seen),
        "loadedAt": STORE.loaded_at,
    }


@app.get("/api/meta")
def meta():
    if not STORE.labels_seen:
        raise HTTPException(503, "Dataset still loading")
    labels_sorted = sorted(STORE.labels_seen, key=lambda l: -STORE.label_volume.get(l, 0))
    top_diseases = labels_sorted[:TOP_N_BOOTSTRAP]
    diseases = [
        {
            "label": l,
            "volume": int(STORE.label_volume.get(l, 0)),
            "hasStateDetail": l in top_diseases,
            "synthetic": l not in STORE.national_series,
        }
        for l in labels_sorted
    ]
    return {
        "years": YEARS,
        "weeksPerYear": NWEEKS,
        "mapStates": MAP_STATES,
        "topDiseases": top_diseases,
        "diseases": diseases,
        "population": POPULATION,
        "stateGrid": STATE_GRID,
        "yearMaxWeek": STORE.year_max_week,
        "yearComplete": STORE.year_complete,
        "labelAliases": LABEL_ALIASES,
        "source": "CDC NNDSS Weekly Tables (data.cdc.gov), loaded by the backend from the bundled CSV snapshot. ",
        "rowCount": STORE.row_count,
    }


@app.get("/api/bootstrap")
def bootstrap():
    """One call that returns everything the frontend needs to render Overview /
    Reports / Comparative Analysis without further round trips: metadata, national
    series for every disease, and state-level detail + completeness for the
    top-volume diseases. Anything outside that set is fetched on demand via
    /api/disease/{label}/states."""
    m = meta()
    national = {label: get_national_payload(label) for label in STORE.labels_seen}
    state_detail = {label: get_state_detail_payload(label) for label in m["topDiseases"]}
    completeness = {label: get_completeness_payload(label) for label in m["topDiseases"]}
    return {**m, "national": national, "stateDetail": state_detail, "completeness": completeness}


@app.get("/api/disease/states")
def disease_states(label: str):
    if label not in STORE.labels_seen:
        raise HTTPException(404, "Unknown disease label")
    return get_state_detail_payload(label)


@app.get("/api/disease/completeness")
def disease_completeness(label: str):
    if label not in STORE.labels_seen:
        raise HTTPException(404, "Unknown disease label")
    return get_completeness_payload(label)


@app.get("/api/disease/national")
def disease_national(label: str):
    if label not in STORE.labels_seen:
        raise HTTPException(404, "Unknown disease label")
    return get_national_payload(label)
