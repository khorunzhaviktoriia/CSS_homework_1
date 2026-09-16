/* =========================================================================
   PAGE 3 — GEOGRAPHIC ANALYSIS
   Moved verbatim from App.jsx during the modularization refactor.
   ========================================================================= */

import React, { useState, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip } from "recharts";
import { X } from "lucide-react";
import { NWEEKS, MAP_STATES, TOP_DISEASES, useEnsureStateDetail, useEnsureCompleteness } from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import {
  ywIdx,
  getStateSeries,
  hasStateDetail,
  isStateDetailLoaded,
  incidenceRanking,
  cumulativeThroughWeek,
  getCompleteness,
  stateAnomaly,
  shortLabel,
  fmt,
  metricColor,
} from "../utils/analytics.js";
import { STATE_ABBR } from "../constants.js";
import { Glass, SectionHeading, EmptyNote, ChartTooltip } from "../components/Shared.jsx";
import { TileMap } from "../components/TileMap.jsx";

export default function GeographicAnalysisPage() {
  const f = useFilters();
  const [mapMetric, setMapMetric] = useState("cases");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [hotspotDiseaseCount, setHotspotDiseaseCount] = useState(12);

  const { loading: stateLoading } = useEnsureStateDetail(f.disease);
  useEnsureCompleteness(f.disease);
  const stateSeries = getStateSeries(f.disease, f.state);
  const hasDetail = hasStateDetail(f.disease);
  const detailKnown = isStateDetailLoaded(f.disease);

  return (
    <div className="page-wrap">
      <div className="hero">
        <h1>Geographic analysis</h1>
        <p>State-level detail is fetched from the backend on demand for whichever disease is selected — pick anything from search, not just the bootstrap's top {TOP_DISEASES.length}.</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading
            eyebrow="Map mode"
            title={shortLabel(f.disease)}
            action={
              <div className="pill-group">
                {[["cases", "Cases"], ["incidence", "Per 100k"], ["growth", "Growth"], ["anomaly", "Anomaly"]].map(([k, l]) => (
                  <button key={k} className={`pill-btn ${mapMetric === k ? "active" : ""}`} onClick={() => setMapMetric(k)}>{l}</button>
                ))}
              </div>
            }
          />
          <TileMap label={f.disease} year={f.year} week={f.week} metric={mapMetric} selectedState={f.state} onSelectState={(s) => { f.setState(s); setDrawerOpen(true); }} height={360} />
        </Glass>

        {drawerOpen && (
          <Glass hover={false}>
            <SectionHeading eyebrow="State drawer" title={f.state} action={<div className="icon-btn" onClick={() => setDrawerOpen(false)}><X size={14} /></div>} />
            <StateDrawerContent state={f.state} disease={f.disease} year={f.year} week={f.week} loading={stateLoading} />
          </Glass>
        )}
      </div>

      <Glass hover={false} style={{ marginBottom: 20 }}>
        <SectionHeading eyebrow="Small multiples" title={`${shortLabel(f.disease)} — every state, same scale`} />
        {stateLoading ? <div className="skeleton" style={{ height: 160 }} /> : !hasDetail ? <EmptyNote>No state-level detail reported for this disease.</EmptyNote> : <SmallMultiples label={f.disease} year={f.year} />}
      </Glass>

      <Glass hover={false}>
        <SectionHeading
          eyebrow="Hotspot matrix"
          title="Anomaly score — disease × state"
          action={
            <div className="flex-gap">
              <span className="text-faint" style={{ fontSize: 11.5 }}>Top diseases</span>
              <input type="range" min={5} max={TOP_DISEASES.length} value={hotspotDiseaseCount} onChange={(e) => setHotspotDiseaseCount(Number(e.target.value))} style={{ accentColor: "#a78bfa" }} />
              <span className="mono text-dim" style={{ fontSize: 11.5 }}>{hotspotDiseaseCount}</span>
            </div>
          }
        />
        <HotspotMatrix year={f.year} week={f.week} nDiseases={hotspotDiseaseCount} onSelect={(l, s) => { f.setDisease(l); f.setState(s); setDrawerOpen(true); }} />
      </Glass>
    </div>
  );
}

function StateDrawerContent({ state, disease, year, week, loading }) {
  const series = getStateSeries(disease, state);
  const nationalRank = useMemo(() => incidenceRanking(disease, year, week, true), [disease, year, week]);
  const rankPos = nationalRank.findIndex((r) => r.state === state);
  const cumulative = cumulativeThroughWeek(disease, year, week, state)
  const completeness = getCompleteness(disease, state);
  const { yi } = ywIdx(year, 1);

  const trendData = useMemo(() => {
    if (!series) return [];
    return Array.from({ length: NWEEKS }).map((_, w) => ({ week: w + 1, cases: series[yi]?.[w] ?? null }));
  }, [series, yi]);

  // disease mix donut: share of this state's cases across top diseases, current year
  const mix = useMemo(() => {
    return TOP_DISEASES.map((l) => {
      const s = getStateSeries(l, state);
      const total = (s?.[yi] || []).reduce((a, v) => a + (v || 0), 0);
      return { label: l, total };
    }).filter((m) => m.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [state, yi]);
  const mixTotal = mix.reduce((a, m) => a + m.total, 0);
  const DONUT_COLORS = ["#a78bfa", "#2dd4bf", "#38bdf8", "#fb7185", "#fbbf24", "#34d399"];

  if (loading) return <div className="skeleton" style={{ height: 220 }} />;
  if (!series) return <EmptyNote>No data for {disease} in {state}.</EmptyNote>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={trendData}>
          <defs><linearGradient id="drawerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="week" hide />
          <YAxis hide />
          <RTooltip content={<ChartTooltip />} />
          <Area dataKey="cases" stroke="#2dd4bf" fill="url(#drawerFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="grid grid-2-even" style={{ marginTop: 12, gap: 10 }}>
        <div className="glass-card tight" style={{ padding: 10 }}>
          <div className="kpi-label">Incidence rank</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{rankPos >= 0 ? `#${rankPos + 1} of ${nationalRank.length}` : "—"}</div>
        </div>
        <div className="glass-card tight" style={{ padding: 10 }}>
          <div className="kpi-label">Cumulative YTD</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(cumulative)}</div>
        </div>
      </div>
      <div className="hairline" />
      <div className="kpi-label" style={{ marginBottom: 8 }}>Disease mix (top diseases, this state, {year})</div>
      <div className="flex-gap" style={{ alignItems: "flex-start", gap: 16 }}>
        <svg width="90" height="90" viewBox="0 0 36 36">
          {(() => {
            let acc = 0;
            return mix.map((m, i) => {
              const frac = m.total / mixTotal;
              const dash = frac * 100;
              const el = <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="5"
                strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-acc} transform="rotate(-90 18 18)" />;
              acc += dash;
              return el;
            });
          })()}
        </svg>
        <div style={{ fontSize: 11.5, flex: 1 }}>
          {mix.map((m, i) => (
            <div key={i} className="flex-between" style={{ marginBottom: 4 }}>
              <span className="flex-gap"><span style={{ width: 8, height: 8, borderRadius: 4, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />{shortLabel(m.label)}</span>
              <span className="text-dim">{((m.total / mixTotal) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hairline" />
      <div className="flex-between">
        <span className="kpi-label">Reporting completeness</span>
        <span style={{ fontWeight: 700, color: completeness == null ? "var(--text-faint)" : completeness > 0.85 ? "var(--green)" : completeness > 0.6 ? "var(--amber)" : "var(--coral)" }}>
          {completeness != null ? `${(completeness * 100).toFixed(0)}%` : "n/a"}
        </span>
      </div>
      {completeness != null && completeness < 0.7 && (
        <EmptyNote>Low completeness — apparent activity here may reflect under-reporting rather than genuinely low case counts.</EmptyNote>
      )}
    </div>
  );
}

function SmallMultiples({ label, year }) {
  const { yi } = ywIdx(year, 1);
  const globalMax = useMemo(() => {
    let m = 1;
    MAP_STATES.forEach((s) => {
      const series = getStateSeries(label, s);
      (series?.[yi] || []).forEach((v) => { if (v != null && v > m) m = v; });
    });
    return m;
  }, [label, yi]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
      {MAP_STATES.map((state) => {
        const series = getStateSeries(label, state);
        const row = series?.[yi] || [];
        if (!row.some((v) => v != null)) return null;
        return (
          <div key={state} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 8px 4px 8px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 2 }}>{state}</div>
            <MiniTrend values={row} max={globalMax} />
          </div>
        );
      })}
    </div>
  );
}

function MiniTrend({ values, max, height = 34, color = "#a78bfa" }) {
  const w = 100;
  const step = w / (values.length - 1);
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    const x = i * step;
    const y = height - (v / max) * (height - 2);
    d += (d ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
  });
  return <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none"><path d={d} fill="none" stroke={color} strokeWidth="1.6" /></svg>;
}

function HotspotMatrix({ year, week, nDiseases, onSelect }) {
  const diseases = TOP_DISEASES.slice(0, nDiseases);
  const cells = useMemo(() => {
    return diseases.map((label) => ({
      label,
      row: MAP_STATES.map((state) => {
        const { score, tier } = stateAnomaly(label, state, year, week);
        return { state, score, tier };
      }),
    }));
  }, [diseases.join("|"), year, week]);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${MAP_STATES.length}, 14px)`, gap: 2, alignItems: "center" }}>
        <div />
        {MAP_STATES.map((s) => (
          <div key={s} style={{ writingMode: "vertical-rl", fontSize: 8, color: "var(--text-faint)", height: 60, textAlign: "left" }}>{STATE_ABBR[s]}</div>
        ))}
        {cells.map(({ label, row }) => (
          <React.Fragment key={label}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", paddingRight: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortLabel(label)}</div>
            {row.map(({ state, score, tier }) => (
              <div key={state} className="matrix-cell" title={`${shortLabel(label)} · ${state}: ${score != null ? "anomaly score " + score.toFixed(1) : "no data"}`}
                onClick={() => onSelect(label, state)}
                style={{ width: 14, height: 14, borderRadius: 3, background: score == null ? "rgba(255,255,255,0.03)" : metricColor(Math.min(score, 5), -1, 5, "heat") }} />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="legend-scale" style={{ marginTop: 12 }}>
        <span>Normal</span>
        <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${metricColor(-1,-1,5,"heat")}, ${metricColor(5,-1,5,"heat")})` }} />
        <span>High anomaly (score &gt; 3)</span>
      </div>
    </div>
  );
}
