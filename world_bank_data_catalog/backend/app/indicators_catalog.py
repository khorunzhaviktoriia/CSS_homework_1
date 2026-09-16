"""
Curated set of 'featured' indicators used to drive the map, KPI cards,
rankings/correlation selectors and insights (out of the ~1,498 indicators
in the raw file). Category and unit are NOT hardcoded here — they are
looked up live from the official WDISeries.csv via series_meta.py. What
IS hand-picked here: which indicators are convenient shortcuts, the
`format` hint (currency/percent/number) used purely for number formatting
in the UI, and `direction` — whether a higher or lower value is generally
considered "better" for that indicator, used so rankings/radar/percentile
wording doesn't call a high unemployment or CO2 figure a "leader". This
is only defined for the ~25 featured indicators, not attempted for the
full 1,498 — see README for why.
"""

from .series_meta import get_series_meta

# code, label, number format, direction ("higher" | "lower" | "neutral")
FEATURED_CODES = [
    ("NY.GDP.PCAP.CD", "GDP per capita", "currency", "higher"),
    ("NY.GDP.MKTP.CD", "GDP (total)", "currency", "neutral"),
    ("NY.GDP.MKTP.KD.ZG", "GDP growth", "percent", "higher"),
    ("FP.CPI.TOTL.ZG", "Inflation", "percent", "neutral"),
    ("SL.UEM.TOTL.ZS", "Unemployment", "percent", "lower"),
    ("NE.EXP.GNFS.ZS", "Exports", "percent", "neutral"),
    ("GC.DOD.TOTL.GD.ZS", "Government debt", "percent", "lower"),
    ("SP.POP.TOTL", "Population", "number", "neutral"),
    ("SP.POP.GROW", "Population growth", "percent", "neutral"),
    ("SP.URB.TOTL.IN.ZS", "Urban population", "percent", "neutral"),
    ("SP.DYN.LE00.IN", "Life expectancy", "number", "higher"),
    ("SH.DYN.MORT", "Under-5 mortality", "number", "lower"),
    ("SH.XPD.CHEX.GD.ZS", "Health expenditure", "percent", "neutral"),
    ("SE.PRM.ENRR", "Primary school enrollment", "percent", "neutral"),
    ("SE.ADT.LITR.ZS", "Adult literacy", "percent", "higher"),
    ("SE.XPD.TOTL.GD.ZS", "Education expenditure", "percent", "neutral"),
    ("EG.ELC.ACCS.ZS", "Access to electricity", "percent", "higher"),
    ("EG.FEC.RNEW.ZS", "Renewable energy use", "percent", "higher"),
    ("EG.USE.PCAP.KG.OE", "Energy use per capita", "number", "neutral"),
    ("EN.GHG.CO2.PC.CE.AR5", "CO2 emissions per capita", "number", "lower"),
    ("AG.LND.FRST.ZS", "Forest area", "percent", "higher"),
    ("SI.POV.DDAY", "Poverty rate", "percent", "lower"),
    ("SI.POV.GINI", "Gini index (inequality)", "number", "lower"),
    ("IT.NET.USER.ZS", "Internet users", "percent", "higher"),
    ("IT.CEL.SETS.P2", "Mobile subscriptions", "number", "neutral"),
    # constant-price / PPP GDP variants, used for growth & convergence math
    # (not shown as their own map/selector entries, but need labels+format)
    ("NY.GDP.PCAP.KD", "GDP per capita (constant 2015 US$)", "currency", "higher"),
    ("NY.GDP.PCAP.PP.KD", "GDP per capita, PPP (constant 2021 intl $)", "currency", "higher"),
]

DIRECTIONS = {code: direction for code, _, _, direction in FEATURED_CODES}


def get_direction(code: str) -> str:
    return DIRECTIONS.get(code, "neutral")


def _build_featured():
    out = []
    for code, label, fmt, direction in FEATURED_CODES:
        meta = get_series_meta(code)
        out.append({
            "code": code, "label": label, "format": fmt, "direction": direction,
            "unit": meta["unit"], "category": meta["category"],
        })
    return out


FEATURED_INDICATORS = _build_featured()
FEATURED_BY_CODE = {i["code"]: i for i in FEATURED_INDICATORS}

MAP_DEFAULT_INDICATOR = "NY.GDP.PCAP.CD"

# Real (inflation-adjusted) and PPP-adjusted GDP per capita, used instead of
# the nominal current-US$ series for growth-rate and convergence math, since
# nominal USD figures conflate real growth with inflation/exchange-rate
# movement (see README).
GDP_REAL_PER_CAPITA = "NY.GDP.PCAP.KD"
GDP_PPP_PER_CAPITA = "NY.GDP.PCAP.PP.KD"

COUNTRY_KPI_CODES = [
    "SP.POP.TOTL", "NY.GDP.MKTP.CD", "NY.GDP.PCAP.CD", "SP.DYN.LE00.IN",
    "SE.PRM.ENRR", "EN.GHG.CO2.PC.CE.AR5", "SI.POV.DDAY",
]

COMPARE_CODES = [
    "NY.GDP.PCAP.CD",
    "SP.DYN.LE00.IN",
    "SH.DYN.MORT",
    "EG.ELC.ACCS.ZS",
    "IT.NET.USER.ZS",
    "EN.GHG.CO2.PC.CE.AR5",
]
