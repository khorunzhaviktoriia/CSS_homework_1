/* =========================================================================
   PAGE 4 — TREND ANALYSIS
   Moved verbatim from App.jsx during the modularization refactor. Note:
   this page originally also defined MultiTooltip and PALETTE_5, which moved
   to components/Shared.jsx and constants.js respectively because
   Comparative Analysis uses them too — imported from there instead.
   ========================================================================= */

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine,
} from "recharts";
import { YEARS, NWEEKS, TOP_DISEASES } from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import {
  ywIdx,
  getNationalSeries,
  rollingAverage,
  detectPeaks,
  flattenSeries,
  robustAnomalyAt,
  shortLabel,
  fmt,
  metricColor,
} from "../utils/analytics.js";
import { PALETTE_5 } from "../constants.js";
import { Glass, SectionHeading, EmptyNote, ChartTooltip, MultiTooltip } from "../components/Shared.jsx";

export default function TrendAnalysisPage() {
  const f = useFilters();
  const [selected, setSelected] = useState([TOP_DISEASES[0], TOP_DISEASES[1], TOP_DISEASES[2]]);
  const [normalize, setNormalize] = useState(false);
  const [maWindow, setMaWindow] = useState(4);
  const [showSmoothed, setShowSmoothed] = useState(true);
  const [calendarMetric, setCalendarMetric] = useState("cases");

  function toggleDisease(label) {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((l) => l !== label);
      if (prev.length >= 5) return prev;
      return [...prev, label];
    });
  }

  const multiData = useMemo(() => {
    const rows = [];
    for (let w = 0; w < NWEEKS; w++) {
      const row = { week: w + 1 };
      selected.forEach((label) => {
        const series = getNationalSeries(label);
        const { yi } = ywIdx(f.year, 1);
        const v = series?.[yi]?.[w] ?? null;
        row[label] = v;
      });
      rows.push(row);
    }
    if (!normalize) return rows;
    const bases = {};
    selected.forEach((label) => {
      const firstVal = rows.find((r) => r[label] != null && r[label] > 0);
      bases[label] = firstVal ? firstVal[label] : null;
    });
    return rows.map((r) => {
      const nr = { week: r.week };
      selected.forEach((label) => {
        nr[label] = r[label] != null && bases[label] ? (r[label] / bases[label]) * 100 : null;
      });
      return nr;
    });
  }, [selected.join("|"), f.year, normalize]);

  const smoothedData = useMemo(() => {
    const cols = {};
    selected.forEach((label) => {
      const vals = multiData.map((r) => r[label]);
      cols[label] = rollingAverage(vals, maWindow);
    });
    return multiData.map((r, i) => {
      const nr = { week: r.week };
      selected.forEach((label) => { nr[label] = cols[label][i]; });
      return nr;
    });
  }, [multiData, maWindow, selected.join("|")]);

  const displayData = showSmoothed ? smoothedData : multiData;

  // YoY difference chart (for f.disease)
  const yoyData = useMemo(() => {
    const series = getNationalSeries(f.disease);
    if (!series) return [];
    const { yi } = ywIdx(f.year, 1);
    const prevYi = YEARS.indexOf(f.year - 1);
    if (prevYi < 0) return [];
    return Array.from({ length: NWEEKS }).map((_, w) => {
      const cur = series[yi]?.[w], prev = series[prevYi]?.[w];
      return { week: w + 1, diff: cur != null && prev != null ? cur - prev : null };
    });
  }, [f.disease, f.year]);

  // Peak detection on smoothed national series for f.disease
  const peakData = useMemo(() => {
    const series = getNationalSeries(f.disease);
    if (!series) return { data: [], peaks: [] };
    const { yi } = ywIdx(f.year, 1);
    const raw = series[yi] || [];
    const smoothed = rollingAverage(raw, 3);
    const peaks = detectPeaks(smoothed, 2, Math.max(1, (Math.max(...raw.filter(v=>v!=null), 1)) * 0.08));
    const data = smoothed.map((v, i) => ({ week: i + 1, value: v }));
    return { data, peaks };
  }, [f.disease, f.year]);

  // Calendar heatmap: weeks x years
  const calendarData = useMemo(() => {
    const series = getNationalSeries(f.disease);
    if (!series) return { grid: [], max: 1 };
    let max = 1;
    const grid = YEARS.map((y, yi) => {
      return Array.from({ length: NWEEKS }).map((_, w) => {
        let val = series[yi]?.[w] ?? null;
        if (calendarMetric === "anomaly") {
          const flat = flattenSeries(series, YEARS, NWEEKS);
          val = robustAnomalyAt(flat, yi * NWEEKS + w, 8).score;
        }
        if (val != null && Number.isFinite(val) && Math.abs(val) > max) max = Math.abs(val);
        return val;
      });
    });
    return { grid, max };
  }, [f.disease, calendarMetric]);

  return (
    <div className="page-wrap">
      <div className="hero"><h1>Trend analysis</h1><p>Overlay diseases, smooth noise, and surface directional change across the {f.year} season.</p></div>

      <Glass hover={false} style={{ marginBottom: 20 }}>
        <SectionHeading
          eyebrow="Up to 5 diseases"
          title="Multi-line comparison"
          action={
            <div className="flex-gap">
              <button className={`pill-btn ${normalize ? "active" : ""}`} style={{ background: normalize ? "linear-gradient(135deg,var(--purple-deep),var(--purple))" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} onClick={() => setNormalize((n) => !n)}>Index to 100</button>
              <button className={`pill-btn ${showSmoothed ? "active" : ""}`} style={{ background: showSmoothed ? "linear-gradient(135deg,var(--purple-deep),var(--purple))" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} onClick={() => setShowSmoothed((s) => !s)}>Smoothed</button>
            </div>
          }
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TOP_DISEASES.slice(0, 16).map((label) => (
            <div key={label} className={`chip ${selected.includes(label) ? "active" : ""}`} onClick={() => toggleDisease(label)}>
              <span className="dot" style={{ background: selected.includes(label) ? PALETTE_5[selected.indexOf(label)] : "var(--text-faint)" }} />
              {shortLabel(label)}
            </div>
          ))}
        </div>
        {showSmoothed && (
          <div className="flex-gap" style={{ marginBottom: 10 }}>
            <span className="text-faint" style={{ fontSize: 11.5 }}>Rolling window</span>
            <input type="range" min={2} max={8} value={maWindow} onChange={(e) => setMaWindow(Number(e.target.value))} style={{ accentColor: "#a78bfa" }} />
            <span className="mono text-dim" style={{ fontSize: 11.5 }}>{maWindow} weeks</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={displayData}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="week" stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
            <RTooltip content={<MultiTooltip labels={selected} />} />
            {selected.map((label, i) => (
              <Line key={label} dataKey={label} name={shortLabel(label)} stroke={PALETTE_5[i]} dot={false} strokeWidth={2.2} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Glass>

      <div className="grid grid-2-even" style={{ marginBottom: 20, alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading eyebrow="Year-over-year" title={`${shortLabel(f.disease)} — ${f.year} minus ${f.year - 1}`} />
          {yoyData.length === 0 ? <EmptyNote>No prior-year data available for comparison.</EmptyNote> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={yoyData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="week" stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
                <defs>
                  <linearGradient id="yoyPos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.5} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.05} /></linearGradient>
                </defs>
                <Area dataKey="diff" stroke="#34d399" fill="url(#yoyPos)" strokeWidth={1.6} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Glass>

        <Glass hover={false}>
          <SectionHeading eyebrow="Peak detection" title={`${shortLabel(f.disease)} — local maxima, ${f.year}`} />
          {peakData.data.length === 0 ? <EmptyNote>No data.</EmptyNote> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={peakData.data}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="week" stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip content={<ChartTooltip />} />
                <Line dataKey="value" stroke="#38bdf8" dot={false} strokeWidth={2} />
                {peakData.peaks.map((p, i) => (
                  <ReferenceLine key={i} x={p.index + 1} stroke="#fb7185" strokeDasharray="3 3" label={{ value: `W${p.index + 1}`, fill: "#fb7185", fontSize: 10, position: "top" }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="text-faint" style={{ fontSize: 11.5 }}>{peakData.peaks.length} peak{peakData.peaks.length !== 1 ? "s" : ""} detected on the 3-week smoothed series, minimum prominence ~8% of yearly max.</div>
        </Glass>
      </div>

      <Glass hover={false}>
        <SectionHeading
          eyebrow="Multi-year"
          title={`Calendar heatmap — ${shortLabel(f.disease)}`}
          action={
            <div className="pill-group">
              <button className={`pill-btn ${calendarMetric === "cases" ? "active" : ""}`} onClick={() => setCalendarMetric("cases")}>Cases</button>
              <button className={`pill-btn ${calendarMetric === "anomaly" ? "active" : ""}`} onClick={() => setCalendarMetric("anomaly")}>Anomaly</button>
            </div>
          }
        />
        <CalendarHeatmap grid={calendarData.grid} max={calendarData.max} metric={calendarMetric} />
      </Glass>
    </div>
  );
}

function CalendarHeatmap({ grid, max, metric }) {
  if (!grid.length) return <EmptyNote>No data.</EmptyNote>;
  const palette = metric === "anomaly" ? "heat" : "purple";
  const colorFor = (v) => {
    if (v == null) return "rgba(255,255,255,0.03)";
    if (metric === "anomaly") return metricColor(Math.min(Math.max(v, -1), 5), -1, 5, "heat");
    return metricColor(v, 0, max, "purple");
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `50px repeat(${NWEEKS}, 12px)`, gap: 2 }}>
        <div />
        {Array.from({ length: NWEEKS }).map((_, w) => (
          <div key={w} style={{ fontSize: 7, color: "var(--text-faint)", textAlign: "center" }}>{(w + 1) % 4 === 0 ? w + 1 : ""}</div>
        ))}
        {grid.map((row, yi) => (
          <React.Fragment key={yi}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center" }}>{YEARS[yi]}</div>
            {row.map((v, w) => (
              <div key={w} title={`Week ${w + 1}, ${YEARS[yi]}: ${v != null ? fmt(v) : "no data"}`}
                style={{ width: 12, height: 12, borderRadius: 3, background: colorFor(v) }} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
