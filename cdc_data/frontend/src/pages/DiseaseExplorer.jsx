/* =========================================================================
   PAGE 2 — DISEASE EXPLORER
   Moved verbatim from App.jsx during the modularization refactor. Note:
   this page originally also defined ChartTooltip, which moved to
   components/Shared.jsx because Geographic Analysis and Comparative
   Analysis use it too — imported from there instead of redefined here.
   ========================================================================= */

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ReferenceLine, ComposedChart,
} from "recharts";
import { Activity, Info } from "lucide-react";
import { YEARS, NWEEKS, MAP_STATES, DATA, useEnsureStateDetail, useEnsureCompleteness } from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import {
  ywIdx, yearWeekIndex, flattenSeries, seasonalRibbon, seasonalFingerprint, trendMomentum,
  forecastSeries, cumulativeThroughWeek, peakWeek, statesAffected, usableHistoricalYears,
  isYearComplete, yearMaxWeek, labelAliasNote, getNationalSeries, isSynthetic, getStateSeries,
  hasStateDetail, isStateDetailLoaded, shortLabel, fmt,
} from "../utils/analytics.js";
import { STATE_ABBR } from "../constants.js";
import { Glass, SectionHeading, EmptyNote, Trend, ChartTooltip } from "../components/Shared.jsx";

export default function DiseaseExplorerPage() {
  const f = useFilters();
  const label = f.disease;
  const nationalSeries = getNationalSeries(label);
  const synthetic = isSynthetic(label);
  const { loading: stateLoading } = useEnsureStateDetail(label);
  useEnsureCompleteness(label);
  const hasDetail = hasStateDetail(label);
  const detailKnown = isStateDetailLoaded(label);

  // Historical baseline (ribbon + seasonal fingerprint) is built only from
  // complete years, excluding the currently-viewed year itself — otherwise a
  // partial current year would distort both the min/max band and the "share
  // of annual total" fingerprint (see data-quality fix #3).
  const historicalYears = useMemo(
    () => nationalSeries ? usableHistoricalYears(nationalSeries, f.year) : [],
    [label, f.year]
  );
  const yearIsPartial = !isYearComplete(f.year);
  const maxWeekThisYear = yearMaxWeek(f.year);

  const ribbon = useMemo(() => nationalSeries ? seasonalRibbon(nationalSeries, historicalYears, NWEEKS) : [], [label, historicalYears.join("|")]);
  const fingerprint = useMemo(() => nationalSeries ? seasonalFingerprint(nationalSeries, historicalYears, NWEEKS) : [], [label, historicalYears.join("|")]);

  const curveData = useMemo(() => {
    if (!nationalSeries) return [];
    const yi = YEARS.indexOf(f.year);
    const prevYi = YEARS.indexOf(f.year - 1);
    return Array.from({ length: NWEEKS }).map((_, w) => ({
      week: w + 1,
      current: nationalSeries[yi]?.[w] ?? null,
      previous: prevYi >= 0 ? nationalSeries[prevYi]?.[w] ?? null : null,
      median: ribbon[w]?.median ?? null,
      min: ribbon[w]?.min ?? null,
      max: ribbon[w]?.max ?? null,
      band: ribbon[w]?.max != null && ribbon[w]?.min != null ? ribbon[w].max - ribbon[w].min : null,
    }));
  }, [label, f.year, ribbon]);

  const radarData = fingerprint.map((v, i) => ({
    week: i + 1,
    share: v == null ? null : +(v * 100).toFixed(3),
  }));

  // Cumulative KPI + its comparison baseline are both bounded to the same
  // week cutoff, so a partial year is never compared to a full year's total
  // (data-quality fix #3).
  const cumulative = cumulativeThroughWeek(label, f.year, f.week);
  const peak = peakWeek(label, f.year);
  const affected = statesAffected(label, f.year);
  const momentum = useMemo(() => {
    if (!nationalSeries) return null;

    const flat = flattenSeries(nationalSeries, YEARS, NWEEKS);

    return trendMomentum(
      flat,
      yearWeekIndex(f.year, f.week)
    );
  }, [label, f.year, f.week]);

  const comparisonYears = historicalYears.slice(-3);

  const threeYearAvgCumulative = useMemo(() => {
    if (comparisonYears.length === 0) return null;

    const vals = comparisonYears
      .map((y) => cumulativeThroughWeek(label, y, f.week))
      .filter((v) => v != null);

    return vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  }, [label, f.week, comparisonYears.join("|")]);

  const forecast = useMemo(() => {
    if (!nationalSeries) return null;
    const flat = flattenSeries(nationalSeries, YEARS, NWEEKS).map((d) => d.value);
    const idx = yearWeekIndex(f.year, f.week);
    return forecastSeries(flat.slice(0, idx + 1), 4, 12);
  }, [label, f.year, f.week]);

  // backtest: forecast made 3 weeks ago vs what actually happened
  const backtest = useMemo(() => {
    if (!nationalSeries) return null;
    const flat = flattenSeries(nationalSeries, YEARS, NWEEKS).map((d) => d.value);
    const idx = yearWeekIndex(f.year, f.week);
    const pastIdx = idx - 3;
    if (pastIdx < 12) return null;
    const fc = forecastSeries(flat.slice(0, pastIdx + 1), 3, 12);
    if (!fc) return null;
    const errs = [];
    fc.points.forEach((p, i) => {
      const actual = flat[pastIdx + p.weekOffset];
      if (actual != null) errs.push({ week: pastIdx + p.weekOffset, forecast: p.forecast, actual });
    });
    if (errs.length === 0) return null;
    const mae = errs.reduce((a, e) => a + Math.abs(e.forecast - e.actual), 0) / errs.length;
    return { errs, mae };
  }, [label, f.year, f.week]);

  const forecastChartData = useMemo(() => {
    if (!nationalSeries) return [];
    const flat = flattenSeries(nationalSeries, YEARS, NWEEKS).map((d) => d.value);
    const idx = yearWeekIndex(f.year, f.week);
    const history = [];
    for (let i = Math.max(0, idx - 10); i <= idx; i++) {
      history.push({ w: i - idx, actual: flat[i], forecast: null, lo: null, hi: null });
    }
    if (forecast) {
      forecast.points.forEach((p) => history.push({ w: p.weekOffset, actual: null, forecast: p.forecast, lo: p.lo, hi: p.hi }));
      // bridge the connecting point
      if (history.length) {
        const last = history.find((h) => h.w === 0);
        if (last) { last.forecast = last.actual; last.lo = last.actual; last.hi = last.actual; }
      }
    }
    return history;
  }, [label, f.year, f.week, forecast]);

  const regionShare = useMemo(() => {
    if (!hasDetail) return [];
    const { yi } = ywIdx(f.year, 1);
    return MAP_STATES.map((state) => {
      const series = getStateSeries(label, state);
      const total = (series?.[yi] || []).reduce((a, v) => a + (v || 0), 0);
      return { state, total };
    }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 15);
  }, [label, f.year, hasDetail]);
  const regionMax = Math.max(...regionShare.map((r) => r.total), 1);

  const fingerprintValues = fingerprint.filter(
    (v) => v != null && Number.isFinite(v)
  );

  const historicalPeakValue = fingerprintValues.length
    ? Math.max(...fingerprintValues)
    : null;

  const historicalPeakWeek =
    historicalPeakValue != null && historicalPeakValue > 0
      ? fingerprint.indexOf(historicalPeakValue) + 1
      : null;

  return (
    <div className="page-wrap">
      <div className="flex-between" style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div className="disease-badge"><Activity size={16} color="var(--purple)" />{label}</div>
        {synthetic && <span className="chip"><Info size={12} /> national total estimated from available state reports</span>}
        {!synthetic && !detailKnown && <span className="chip"><Info size={12} /> loading state-level detail…</span>}
        {detailKnown && !hasDetail && <span className="chip"><Info size={12} /> national-only — no state-level rows reported</span>}
        {yearIsPartial && <span className="chip"><Info size={12} /> {f.year} is a partial year — data through week {maxWeekThisYear} of {NWEEKS}</span>}
        {labelAliasNote(label) && <span className="chip" title={`Merged from: ${labelAliasNote(label).join(", ")}`}><Info size={12} /> label normalized across years</span>}
      </div>

      {!nationalSeries ? (
        <Glass><EmptyNote>No case data reported for this disease/condition in the available window — all weeks are flagged as suppressed or not reportable.</EmptyNote></Glass>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
            <Glass hover={false}>
              <SectionHeading eyebrow="Epidemic curve" title={`Weekly cases — ${f.year}${yearIsPartial ? " (partial)" : ""}`} />
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={curveData}>
                  <defs>
                    <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="week" stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Area
                    dataKey="min"
                    stackId="band"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />

                  <Area
                    dataKey="band"
                    stackId="band"
                    stroke="none"
                    fill="url(#bandFill)"
                    isAnimationActive={false}
                  />
                  <Line dataKey="median" stroke="#8892b8" strokeDasharray="4 3" dot={false} strokeWidth={1.5} name="Historical median" />
                  <Line dataKey="previous" stroke="#38bdf8" dot={false} strokeWidth={1.5} name={`${f.year - 1}`} />
                  <Line dataKey="current" stroke="#a78bfa" dot={false} strokeWidth={2.5} name={`${f.year}`} />
                  {yearIsPartial && <ReferenceLine x={maxWeekThisYear} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" label={{ value: "data ends here", fill: "#656d94", fontSize: 9.5, position: "insideTopRight" }} />}
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex-gap" style={{ fontSize: 11.5, marginTop: 8 }} >
                <LegendDot color="#a78bfa" label={`${f.year}`} /><LegendDot color="#38bdf8" label={`${f.year - 1}`} /><LegendDot color="#656d94" label={`Historical median (${historicalYears.length} complete yrs)`} dashed /><LegendDot color="rgba(167,139,250,0.3)" label="Min–max range" />
              </div>
            </Glass>

            <Glass hover={false}>
              <SectionHeading eyebrow="Seasonal fingerprint" title="Average share of annual cases by week" />
              {historicalYears.length === 0 ? <EmptyNote>Not enough complete historical years yet to build a seasonal baseline.</EmptyNote> : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="week" tick={{ fill: "#656d94", fontSize: 9 }} tickFormatter={(w) => (w % 8 === 0 ? `W${w}` : "")} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar dataKey="share" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.28} isAnimationActive={true} />
                      <RTooltip content={<ChartTooltip suffix="%" />} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="text-faint" style={{ fontSize: 11.5, textAlign: "center" }}>
                    {historicalPeakWeek ? `Historically peaks around week ${historicalPeakWeek} — ${seasonLabelFor(historicalPeakWeek)}` : "No consistent seasonal signal"}
                    {" · based on "}{historicalYears.length} complete year{historicalYears.length !== 1 ? "s" : ""} ({historicalYears.join(", ")})
                  </div>
                </>
              )}
            </Glass>
          </div>

          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            <Glass className="tight">
              <div className="kpi-label">Cumulative cases, {f.year} (through wk {f.week})</div>
              <div className="kpi-value" style={{ fontSize: 22, margin: "6px 0" }}>{fmt(cumulative)}</div>
              <Trend
                value={
                  cumulative != null &&
                  threeYearAvgCumulative != null &&
                  threeYearAvgCumulative !== 0
                    ? ((cumulative - threeYearAvgCumulative) / threeYearAvgCumulative) * 100
                    : null
                }
              />
              <div className="text-faint" style={{ fontSize: 11, marginTop: 4 }}>
                {threeYearAvgCumulative == null
                  ? "No comparable historical baseline"
                  : `vs same-period ${comparisonYears.length}-yr avg (${fmt(Math.round(threeYearAvgCumulative))})`}
              </div>
            </Glass>
            <Glass className="tight">
              <div className="kpi-label">Peak week</div>
              <div className="kpi-value" style={{ fontSize: 22, margin: "6px 0" }}>{peak ? `Week ${peak.week}` : "—"}</div>
              <div className="text-dim" style={{ fontSize: 12.5 }}>{peak ? `${fmt(peak.value)} cases` : "no data"}</div>
            </Glass>
            <Glass className="tight">
              <div className="kpi-label">Jurisdictions affected</div>
              <div className="kpi-value" style={{ fontSize: 22, margin: "6px 0" }}>{!detailKnown ? "…" : hasDetail ? affected : "—"}</div>
              <div className="text-faint" style={{ fontSize: 11 }}>{!detailKnown ? "loading" : hasDetail ? `of ${MAP_STATES.length} tracked` : "no state detail reported"}</div>
            </Glass>
            <Glass className="tight">
              <div className="kpi-label">Trend momentum</div>
              <div className="kpi-value" style={{ fontSize: 22, margin: "6px 0" }}>
                {momentum == null ? "—" : momentum === Infinity ? "New" : `${momentum > 0 ? "+" : ""}${momentum.toFixed(0)}%`}
              </div>
              <div className="text-faint" style={{ fontSize: 11 }}>4-wk avg vs prior 4-wk avg</div>
            </Glass>
            <Glass className="tight">
              <div className="kpi-label">Historical trend</div>
              <div className="kpi-value" style={{ fontSize: 18, margin: "6px 0" }}>
                {cumulative == null || threeYearAvgCumulative == null
                  ? "—"
                  : cumulative > threeYearAvgCumulative
                    ? "Above average"
                    : cumulative < threeYearAvgCumulative
                      ? "Below average"
                      : "At average"}
              </div>
              <div className="text-faint" style={{ fontSize: 11 }}>vs same-period {comparisonYears.length}-yr cumulative avg</div>
            </Glass>
            <Glass className="tight">
              <div className="kpi-label">Data completeness</div>
              <div className="kpi-value" style={{ fontSize: 18, margin: "6px 0" }}>
                {(() => {
                  const comp = DATA.completeness[label];
                  if (!comp) return "—";
                  const vals = Object.values(comp);
                  if (!vals.length) return "—";
                  return `${Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)}%`;
                })()}
              </div>
              <div className="text-faint" style={{ fontSize: 11 }}>avg reporting completeness across states</div>
            </Glass>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
            <Glass hover={false}>
              <SectionHeading eyebrow="" title="Short-horizon forecast" />
              {!forecast ? <EmptyNote>Not enough recent weeks with data to fit a forecast.</EmptyNote> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={forecastChartData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="w" stroke="#8892b8" fontSize={11} tickFormatter={(w) => (w === 0 ? "now" : w > 0 ? `+${w}w` : `${w}w`)} tickLine={false} axisLine={false} />
                      <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                      <RTooltip content={<ChartTooltip />} />
                      <Area dataKey="hi" stroke="none" fill="#38bdf8" fillOpacity={0.1} isAnimationActive={false} />
                      <Area dataKey="lo" stroke="none" fill="#050816" fillOpacity={1} isAnimationActive={false} />
                      <Line dataKey="actual" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 2 }} name="Actual" />
                      <Line dataKey="forecast" stroke="#38bdf8" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2 }} name="Forecast" />
                      <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="text-faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                    Log-linear regression on trailing 12 weeks · slope {forecast.slope.toFixed(3)}/wk · fit R² {forecast.r2 != null ? forecast.r2.toFixed(2) : "n/a"}. Shaded band = approximate ±1.96σ residual range.
                  </div>
                </>
              )}
              {backtest && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex-between">
                    <span className="text-dim" style={{ fontSize: 12 }}>Backtest — forecast made 3 weeks ago vs actual</span>
                    <span className="mono" style={{ fontSize: 12 }}>MAE {backtest.mae.toFixed(1)}</span>
                  </div>
                  <div className="flex-gap" style={{ marginTop: 8, gap: 14 }}>
                    {backtest.errs.map((e, i) => (
                      <div key={i} style={{ fontSize: 11.5 }} className="text-faint">w{e.week - yearWeekIndex(f.year,f.week) + f.week}: fc {e.forecast.toFixed(0)} vs actual {e.actual}</div>
                    ))}
                  </div>
                </div>
              )}
            </Glass>

            <Glass hover={false}>
              <SectionHeading eyebrow="Distribution" title="Case share by state (top 15)" />
              {regionShare.length === 0 ? <EmptyNote>{!detailKnown ? "Loading state-level detail…" : "No state-level detail reported for this disease."}</EmptyNote> : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                  {regionShare.map((r) => {
                    const size = 34 + (r.total / regionMax) * 92;
                    return (
                      <div key={r.state} title={`${r.state}: ${fmt(r.total)}`}
                        style={{
                          width: size, height: size, borderRadius: 12, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", fontSize: Math.max(9, size / 7),
                          background: `linear-gradient(135deg, rgba(167,139,250,${0.15 + 0.5 * (r.total/regionMax)}), rgba(45,212,191,${0.08 + 0.3*(r.total/regionMax)}))`,
                          border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer",
                        }}
                        onClick={() => f.setState(r.state)}
                      >
                        <span>{STATE_ABBR[r.state]}</span>
                        <span style={{ fontSize: Math.max(8, size/10), fontWeight: 500, opacity: 0.75 }}>{fmt(r.total)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Glass>
          </div>
        </>
      )}
    </div>
  );
}

function seasonLabelFor(week) {
  if (week <= 8 || week >= 49) return "winter";
  if (week <= 21) return "spring";
  if (week <= 35) return "summer";
  return "fall";
}

function LegendDot({ color, label, dashed }) {
  return (
    <span className="flex-gap" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
      <span style={{ width: 14, height: dashed ? 2 : 8, background: color, borderRadius: dashed ? 0 : 4, display: "inline-block" }} />
      {label}
    </span>
  );
}
