/* =========================================================================
   ANALYTICS — pure analytical/helper functions, moved verbatim from
   App.jsx during the modularization refactor. This module combines what
   were three adjacent sections in the original file (low-level statistical
   primitives, the data-access layer over the api.js store, and the
   higher-level "engine" functions built on top of them) because splitting
   them further would have meant re-threading imports between files that
   otherwise have no reason to depend on each other — no logic changed.

   Arrays throughout are [yearIndex][weekIndex], weekIndex 0-based
   (week 1 => index 0). Missing/suppressed values are null.
   ========================================================================= */

import * as d3 from "d3";
import { DATA, YEARS, NWEEKS, ALL_DISEASES, TOP_DISEASES, MAP_STATES, POPULATION } from "../api.js";


/* ---------- statistical primitives ---------- */

export const EPS = 1e-9;

export function median(arr) {
  const v = arr.filter((x) => x != null && !Number.isNaN(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function mad(arr, med) {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  if (v.length === 0) return null;
  const m = med != null ? med : median(v);
  const devs = v.map((x) => Math.abs(x - m));
  return median(devs);
}

// Flatten [year][week] -> chronological array of {year, week, value}
export function flattenSeries(series, years, weeksPerYear) {
  const out = [];
  years.forEach((y, yi) => {
    for (let w = 0; w < weeksPerYear; w++) {
      out.push({ year: y, week: w + 1, value: series?.[yi]?.[w] ?? null });
    }
  });
  return out;
}

// Robust anomaly score for the most recent week in a chronological array.
// Baseline = rolling median of trailing window (excluding current week).
// Spread = MAD * 1.4826 (consistency constant approximating stdev).
export function robustAnomalyAt(flat, idx, window = 8) {
  const start = Math.max(0, idx - window);
  const trailing = flat.slice(start, idx).map((d) => d.value).filter((v) => v != null);
  if (trailing.length < 3) return { score: null, baseline: null, spread: null };
  const m = median(trailing);
  const spread = mad(trailing, m) * 1.4826;
  const current = flat[idx]?.value;
  if (current == null) return { score: null, baseline: m, spread };
  if (spread < EPS) {
    // A standardized anomaly score is undefined when the historical
    // baseline has zero variability. Do not manufacture a high score.
    return { score: null, baseline: m, spread: 0 };
  }
  return { score: (current - m) / spread, baseline: m, spread };
}

export function anomalyTier(score) {
  if (score == null) return "unknown";
  if (score > 3) return "outbreak";
  if (score > 2) return "elevated";
  return "normal";
}

// Growth index: week over week % change with guard for zero baseline.
export function growthIndex(prev, curr) {
  if (curr == null) return null;
  if (prev == null) return null;
  if (prev === 0) return curr > 0 ? { pct: null, newActivity: true } : { pct: 0, newActivity: false };
  return { pct: ((curr - prev) / prev) * 100, newActivity: false };
}

// Seasonal baseline ribbon: per week-of-year (1..52), min/median/max across the
// given set of years. `years` may be any subset of the full YEARS list (e.g.
// "historical, complete years only" — see completeYears() in the data layer) —
// each year is mapped to its real position in the underlying series array via
// YEARS.indexOf, so passing a subset doesn't misalign anything.
export function seasonalRibbon(series, years, weeksPerYear) {
  const ribbon = [];
  for (let w = 0; w < weeksPerYear; w++) {
    const vals = years.map((y) => series?.[YEARS.indexOf(y)]?.[w]).filter((v) => v != null);
    ribbon.push({
      week: w + 1,
      min: vals.length ? Math.min(...vals) : null,
      median: median(vals),
      max: vals.length ? Math.max(...vals) : null,
      n: vals.length,
    });
  }
  return ribbon;
}

// Seasonal fingerprint: average share of that YEAR'S total falling in each week,
// across the given set of years. Only pass complete years in — a partial year's
// "share of annual total" is meaningless (the denominator itself is incomplete),
// which is why callers restrict this to completeYears().
export function seasonalFingerprint(series, years, weeksPerYear) {
  const shares = [];

  years.forEach((y) => {
    const row = series[YEARS.indexOf(y)] || [];
    const observed = row.filter((v) => v != null);

    if (observed.length === 0) return;

    const total = observed.reduce((a, v) => a + v, 0);

    shares.push(
      row.map((v) => {
        if (v == null) return null;
        return total > 0 ? v / total : 0;
      })
    );
  });

  const fingerprint = [];

  for (let w = 0; w < weeksPerYear; w++) {
    const vals = shares
      .map((row) => row[w])
      .filter((v) => v != null && !Number.isNaN(v));

    fingerprint.push(
      vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : null
    );
  }

  return fingerprint;
}

// Trend momentum: rolling 4-week avg now vs rolling 4-week avg 4 weeks prior.
export function trendMomentum(flat, idx, window = 4) {
  const cur = flat.slice(Math.max(0, idx - window + 1), idx + 1).map((d) => d.value).filter((v) => v != null);
  const prior = flat.slice(Math.max(0, idx - 2 * window + 1), idx - window + 1).map((d) => d.value).filter((v) => v != null);
  if (cur.length === 0 || prior.length === 0) return null;
  const curAvg = cur.reduce((a, b) => a + b, 0) / cur.length;
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (priorAvg < EPS) return curAvg > 0 ? Infinity : 0;
  return ((curAvg - priorAvg) / priorAvg) * 100;
}

export function rollingAverage(values, window) {
  const out = [];

  for (let i = 0; i < values.length; i++) {
    // If the current week itself has no observation,
    // do not invent a moving-average point for it.
    if (values[i] == null) {
      out.push(null);
      continue;
    }

    const start = Math.max(0, i - window + 1);
    const slice = values
      .slice(start, i + 1)
      .filter((v) => v != null);

    out.push(
      slice.length
        ? slice.reduce((a, b) => a + b, 0) / slice.length
        : null
    );
  }

  return out;
}

// Pearson correlation between two equal-length arrays (nulls pairwise-dropped).
export function pearson(a, b) {
  const pairs = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] != null && b[i] != null) pairs.push([a[i], b[i]]);
  }
  if (pairs.length < 6) return null;
  const n = pairs.length;
  const meanA = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanB = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, da = 0, db = 0;
  pairs.forEach(([x, y]) => {
    num += (x - meanA) * (y - meanB);
    da += (x - meanA) ** 2;
    db += (y - meanB) ** 2;
  });
  if (da < EPS || db < EPS) return null;
  return num / Math.sqrt(da * db);
}

export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na < EPS || nb < EPS) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Short horizon forecast: linear regression on log1p of the trailing N weeks,
// projected forward `horizon` weeks, with a naive normal confidence band from
// residual std error. Returns {points:[{week,forecast,lo,hi}], slope, r2}
export function forecastSeries(values, horizon = 3, trailing = 10) {
  const n = values.length;
  const idxs = [];
  const ys = [];
  for (let i = Math.max(0, n - trailing); i < n; i++) {
    if (values[i] != null) { idxs.push(i); ys.push(Math.log1p(Math.max(0, values[i]))); }
  }
  if (idxs.length < 4) return null;
  const meanX = idxs.reduce((a, b) => a + b, 0) / idxs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  idxs.forEach((x, i) => { num += (x - meanX) * (ys[i] - meanY); den += (x - meanX) ** 2; });
  const slope = den < EPS ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const resid = idxs.map((x, i) => ys[i] - (intercept + slope * x));
  const sse = resid.reduce((a, r) => a + r * r, 0);
  const dof = Math.max(1, idxs.length - 2);
  const sigma = Math.sqrt(sse / dof);
  const sst = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const r2 = sst < EPS ? null : 1 - sse / sst;
  const points = [];
  for (let h = 1; h <= horizon; h++) {
    const x = n - 1 + h;
    const logPred = intercept + slope * x;
    const pred = Math.max(0, Math.expm1(logPred));
    const loLog = logPred - 1.96 * sigma;
    const hiLog = logPred + 1.96 * sigma;
    points.push({
      weekOffset: h,
      forecast: pred,
      lo: Math.max(0, Math.expm1(loLog)),
      hi: Math.max(0, Math.expm1(hiLog)),
    });
  }
  return { points, slope, r2, sigma };
}

// Peak detection: local maxima within `window` neighbors, above min prominence.
export function detectPeaks(values, window = 2, minProminence = 1) {
  const peaks = [];
  for (let i = window; i < values.length - window; i++) {
    const v = values[i];
    if (v == null) continue;
    let isPeak = true;
    for (let k = 1; k <= window; k++) {
      if ((values[i - k] != null && values[i - k] >= v) || (values[i + k] != null && values[i + k] >= v)) {
        isPeak = false; break;
      }
    }
    if (isPeak) {
      const neighborhood = values.slice(Math.max(0, i - 6), i).filter((x) => x != null);
      const base = neighborhood.length ? Math.min(...neighborhood) : 0;
      if (v - base >= minProminence) peaks.push({ index: i, value: v, prominence: v - base });
    }
  }
  return peaks;
}

export function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
export function pct(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/* ---------- data access layer over the api.js store ---------- */

export function getNationalSeries(label) {
  const rec = DATA?.national?.[label];
  return rec ? rec.data : null; // [year][week]
}
export function isSynthetic(label) {
  return DATA?.national?.[label]?.synthetic ?? true;
}
export function getStateSeries(label, state) {
  return DATA?.stateDetail?.[label]?.[state] ?? null;
}
// True once we've fetched state-level detail for this label AND it's non-empty.
// Components that need this to be reactive should call useEnsureStateDetail(label)
// themselves first (it triggers the fetch and re-renders when it lands).
export function hasStateDetail(label) {
  const d = DATA?.stateDetail?.[label];
  return !!d && Object.keys(d).length > 0;
}
export function isStateDetailLoaded(label) {
  return DATA?.stateDetail?.[label] !== undefined;
}
export function getCompleteness(label, state) {
  return DATA?.completeness?.[label]?.[state] ?? null;
}

// --- Year completeness (backend-derived) — see items 3/4 in the data-quality
// pass: 2026 in this export is a partial year (data through week 35 or so), and
// we must never silently compare it to a full 52-week historical year as if
// they were equivalent. ---
export function isYearComplete(year) {
  return DATA?.yearComplete?.[year] ?? true;
}
export function yearMaxWeek(year) {
  return DATA?.yearMaxWeek?.[year] ?? NWEEKS;
}
// Years suitable for use as a "historical baseline" — excludes any year the
// backend flagged as partial (currently just the in-progress current year).
export function completeYears() {
  return YEARS.filter((y) => isYearComplete(y));
}
export function usableHistoricalYears(series, beforeYear = Infinity) {
  return completeYears().filter((year) => {
    if (year >= beforeYear) return false;

    const yi = YEARS.indexOf(year);
    const expectedWeeks = yearMaxWeek(year);

    if (yi < 0 || expectedWeeks <= 0) return false;

    const row = (series?.[yi] || []).slice(0, expectedWeeks);
    const observedWeeks = row.filter((v) => v != null).length;

    // Require substantial disease-specific coverage.
    // This prevents a series introduced mid-year from being treated
    // as if it had a complete historical year.
    return observedWeeks / expectedWeeks >= 0.8;
  });
}

export function labelAliasNote(label) {
  const aliases = DATA?.labelAliases || {};
  const merged = Object.entries(aliases).filter(([, canon]) => canon === label).map(([raw]) => raw);
  return merged.length ? merged : null;
}

export const yearWeekIndex = (year, week) => YEARS.indexOf(year) * NWEEKS + (week - 1);

export function currentDefaultYearWeek() {
  // The backend already tells us, per year, the last week with any reported
  // national data — use that directly instead of re-deriving it by scanning.
  for (let yi = YEARS.length - 1; yi >= 0; yi--) {
    const y = YEARS[yi];
    const maxW = yearMaxWeek(y);
    if (maxW > 0) return { year: y, week: maxW };
  }
  return { year: YEARS[YEARS.length - 1], week: 1 };
}

/* ---------- engine: cross-cutting computed views used by multiple pages ---------- */

export function ywIdx(year, week) {
  return { yi: YEARS.indexOf(year), wi: week - 1 };
}

// National anomaly score for a disease at a given year/week.
export function nationalAnomaly(label, year, week) {
  const series = getNationalSeries(label);
  if (!series) return { score: null, tier: "unknown" };
  const flat = flattenSeries(series, YEARS, NWEEKS);
  const idx = yearWeekIndex(year, week);
  const { score, baseline, spread } = robustAnomalyAt(flat, idx, 8);
  return { score, tier: anomalyTier(score), baseline, spread, current: flat[idx]?.value };
}

// State-level anomaly score for a disease at a given year/week.
export function stateAnomaly(label, state, year, week) {
  const series = getStateSeries(label, state);
  if (!series) return { score: null, tier: "unknown" };
  const flat = flattenSeries(series, YEARS, NWEEKS);
  const idx = yearWeekIndex(year, week);
  const { score, baseline, spread } = robustAnomalyAt(flat, idx, 8);
  return { score, tier: anomalyTier(score), baseline, spread, current: flat[idx]?.value };
}

// All disease x state anomaly pairs for a given year/week (top diseases only,
// since that's where we have state-level detail).
export function allOutbreakPairs(year, week) {
  const out = [];
  TOP_DISEASES.forEach((label) => {
    MAP_STATES.forEach((state) => {
      const series = getStateSeries(label, state);
      if (!series) return;
      const { score, tier, current, baseline } = stateAnomaly(label, state, year, week);
      if (score != null) out.push({ label, state, score, tier, current, baseline });
    });
  });
  return out;
}

export function previousWeekValue(series, year, week) {
  const yi = YEARS.indexOf(year);
  const wi = week - 1;

  if (yi < 0) return null;

  if (wi > 0) {
    return series?.[yi]?.[wi - 1] ?? null;
  }

  if (yi === 0) return null;

  const previousYear = YEARS[yi - 1];
  const previousMaxWeek = yearMaxWeek(previousYear);

  return series?.[yi - 1]?.[previousMaxWeek - 1] ?? null;
}

// Growth leaders across ALL diseases (national) at a given week.
export function growthLeaders(year, week) {
  const out = [];
  ALL_DISEASES.forEach(({ label }) => {
    const series = getNationalSeries(label);
    if (!series) return;
    const { yi, wi } = ywIdx(year, week);
    const curr = series[yi]?.[wi];
    const prev = previousWeekValue(series, year, week);
    if (curr == null) return;
    const g = growthIndex(prev, curr);
    if (g && g.pct != null) out.push({ label, pct: g.pct, curr, prev });
    else if (g && g.newActivity) out.push({ label, pct: null, newActivity: true, curr, prev: 0 });
  });
  return out.sort((a, b) => {
    const av = a.newActivity ? 1e9 : a.pct ?? -1e9;
    const bv = b.newActivity ? 1e9 : b.pct ?? -1e9;
    return bv - av;
  });
}

// Incidence ranking for a disease at a given year/week across map states.
export function incidenceRanking(label, year, week, useIncidence = true) {
  const { yi, wi } = ywIdx(year, week);
  const out = [];
  MAP_STATES.forEach((state) => {
    const series = getStateSeries(label, state);
    const cases = series?.[yi]?.[wi];
    if (cases == null) return;
    const pop = POPULATION[state];
    const incidence = pop ? (cases / pop) * 100000 : null;
    out.push({ state, cases, incidence, pop });
  });
  const key = useIncidence ? "incidence" : "cases";
  return out.sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
}

// Cumulative case share per state for a set of diseases in a year (for similarity + donut + treemap)
export function stateDiseaseShareVectors(year, diseases = TOP_DISEASES) {
  const { yi } = ywIdx(year, 1);
  const vectors = {};
  MAP_STATES.forEach((state) => {
    vectors[state] = diseases.map((label) => {
      const series = getStateSeries(label, state);
      if (!series) return 0;
      const row = series[yi] || [];
      return row.reduce((a, v) => a + (v || 0), 0);
    });
    const total = vectors[state].reduce((a, b) => a + b, 0);
    vectors[state] = vectors[state].map((v) => (total > 0 ? v / total : 0));
  });
  return vectors;
}

export function cumulativeForYear(label, year, area = null) {
  const { yi } = ywIdx(year, 1);
  const series = area ? getStateSeries(label, area) : getNationalSeries(label);
  const row = series?.[yi] || [];

  const observed = row.filter((v) => v != null);

  if (observed.length === 0) return null;

  return observed.reduce((a, v) => a + v, 0);
}

// Cumulative cases for weeks 1..upToWeek of a given year — the fair comparison
// unit when one of the years involved might be partial. Always use this (not
// cumulativeForYear) when comparing across years/against a historical average.
export function cumulativeThroughWeek(label, year, upToWeek, area = null) {
  const { yi } = ywIdx(year, 1);
  const series = area ? getStateSeries(label, area) : getNationalSeries(label);
  const row = (series?.[yi] || []).slice(0, upToWeek);

  const observed = row.filter((v) => v != null);

  if (observed.length === 0) return null;

  return observed.reduce((a, v) => a + v, 0);
}

// Peak week (value + week number) for a disease/year.
export function peakWeek(label, year, area = null) {
  const { yi } = ywIdx(year, 1);
  const series = area ? getStateSeries(label, area) : getNationalSeries(label);
  const row = series?.[yi] || [];
  let best = { week: null, value: -Infinity };
  row.forEach((v, wi) => {
    if (v != null && v > best.value) best = { week: wi + 1, value: v };
  });
  return best.week ? best : null;
}

export function statesAffected(label, year) {
  const { yi } = ywIdx(year, 1);
  let count = 0;
  MAP_STATES.forEach((state) => {
    const series = getStateSeries(label, state);
    const row = series?.[yi] || [];
    if (row.some((v) => v != null && v > 0)) count++;
  });
  return count;
}

// Reporting completeness aggregated per state across top diseases.
export function completenessByState() {
  return MAP_STATES.map((state) => {
    const scores = TOP_DISEASES.map((label) => getCompleteness(label, state)).filter((v) => v != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { state, score: avg, n: scores.length };
  }).sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
}

/* --------- Key insight sentence generator — every sentence cites a real computed number --------- */
export function generateInsights(year, week, limit = 6) {
  const insights = [];

  // 1. Biggest state-level anomaly among top diseases
  const pairs = allOutbreakPairs(year, week).filter((p) => p.tier !== "normal");
  pairs.sort((a, b) => b.score - a.score);
  pairs.slice(0, 2).forEach((p) => {
    insights.push({
      text: `${shortLabel(p.label)} in ${p.state} has a robust anomaly score of ${p.score.toFixed(1)} relative to its 8-week rolling baseline (${p.tier === "outbreak" ? "high anomaly" : "elevated"}).`,
      tier: p.tier,
    });
  });

  // 2. Consecutive-week trend for a top disease nationally
  TOP_DISEASES.slice(0, 8).forEach((label) => {
    const series = getNationalSeries(label);
    if (!series) return;
    const flat = flattenSeries(series, YEARS, NWEEKS);
    const idx = yearWeekIndex(year, week);
    let streak = 0;
    for (let i = idx; i > idx - 6 && i >= 1; i--) {
      const a = robustAnomalyAt(flat, i, 8).score;
      const b = robustAnomalyAt(flat, i - 1, 8).score;
      if (a != null && b != null && a > b) streak++; else break;
    }
    if (streak >= 3) {
      insights.push({ text: `${shortLabel(label)}'s national anomaly score has increased for ${streak} consecutive weeks.`, tier: "elevated" });
    }
  });

  // 3. Seasonal timing shift for a disease with clear seasonality
  TOP_DISEASES.slice(0, 10).forEach((label) => {
    const series = getNationalSeries(label);
    if (!series) return;
    const baselineYears = usableHistoricalYears(series, year);
    if (baselineYears.length === 0) return;
    const fp = seasonalFingerprint(series, baselineYears, NWEEKS);
    const historicalPeakWeek = fp.indexOf(Math.max(...fp)) + 1;
    const thisYearPeak = peakWeek(label, year);
    if (thisYearPeak && Math.abs(thisYearPeak.week - historicalPeakWeek) >= 3 && thisYearPeak.week <= week) {
      const delta = historicalPeakWeek - thisYearPeak.week;
      insights.push({
        text: `${shortLabel(label)}'s peak week so far in ${year} (week ${thisYearPeak.week}) is ${Math.abs(delta)} weeks ${delta > 0 ? "earlier" : "later"} than its typical week ${historicalPeakWeek} historical peak.`,
        tier: "info",
      });
    }
  });

  // 4. Correlation between two top diseases
  const corrTop = TOP_DISEASES.slice(0, 8);
  outer: for (let i = 0; i < corrTop.length; i++) {
    for (let j = i + 1; j < corrTop.length; j++) {
      const a = getNationalSeries(corrTop[i]);
      const b = getNationalSeries(corrTop[j]);
      if (!a || !b) continue;
      const flatA = flattenSeries(a, YEARS, NWEEKS).map((d) => d.value);
      const flatB = flattenSeries(b, YEARS, NWEEKS).map((d) => d.value);
      const r = pearson(flatA, flatB);
      if (r != null && Math.abs(r) > 0.6) {
        insights.push({ text: `${shortLabel(corrTop[i])} and ${shortLabel(corrTop[j])} show a ${r.toFixed(2)} correlation in weekly national activity.`, tier: "info" });
        break outer;
      }
    }
  }

  return insights.slice(0, limit);
}
export function shortLabel(label) {
  return label.replace(/\s+/g, " ").trim();
}

/* ---------- color-scale helper shared by TileMap, HotspotMatrix, CalendarHeatmap ---------- */

export function metricColor(value, min, max, palette = "purple") {
  if (value == null) return "rgba(255,255,255,0.04)";
  const t = max > min ? (value - min) / (max - min) : 0;
  const clamped = Math.max(0, Math.min(1, t));
  const scales = {
    purple: d3.interpolateRgb("#231a3d", "#a78bfa"),
    heat: d3.interpolateRgb("#1a2e2b", "#fb7185"),
    teal: d3.interpolateRgb("#132522", "#2dd4bf"),
    growth: d3.interpolateRgb("#1a1f3d", "#38bdf8"),
  };
  return scales[palette](clamped);
}
