/* =========================================================================
   PAGE 5 — COMPARATIVE ANALYSIS
   Moved verbatim from App.jsx during the modularization refactor.
   ========================================================================= */

import React, { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";
import * as d3 from "d3";
import {
  YEARS,
  NWEEKS,
  ALL_DISEASES,
  TOP_DISEASES,
  MAP_STATES,
  POPULATION,
  useEnsureStateDetail,
} from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import {
  ywIdx,
  getStateSeries,
  cumulativeForYear,
  cumulativeThroughWeek,
  getNationalSeries,
  flattenSeries,
  pearson,
  stateDiseaseShareVectors,
  cosineSimilarity,
  shortLabel,
  fmt,
  yearMaxWeek,
} from "../utils/analytics.js";
import { STATE_ABBR, PALETTE_5 } from "../constants.js";
import { Glass, SectionHeading, EmptyNote, MultiTooltip } from "../components/Shared.jsx";

export default function ComparativeAnalysisPage() {
  const f = useFilters();
  const [stateA, setStateA] = useState("California");
  const [stateB, setStateB] = useState("Texas");
  const [diseaseA, setDiseaseA] = useState(TOP_DISEASES[0]);
  const [diseaseB, setDiseaseB] = useState(TOP_DISEASES[1]);
  const [normalizeDiseases, setNormalizeDiseases] = useState(false);
  const [corrN, setCorrN] = useState(16);
  const [corrPair, setCorrPair] = useState(null);
  const [rankMetric, setRankMetric] = useState("cases");
  const [waterfallMode, setWaterfallMode] = useState("states"); // states | years

  return (
    <div className="page-wrap">
      <div className="hero"><h1>Comparative analysis</h1><p>Put two states or two diseases side by side, then look for structure across all of them at once.</p></div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          marginBottom: 20,
          alignItems: "start",
        }}
      >
        {/* Compare two states */}
        <Glass hover={false} style={{ minWidth: 0 }}>
          <SectionHeading eyebrow="Head to head" title="Compare two states" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              width: "100%",
            }}
          >
            <select
              className="topbar-select"
              style={{ width: "100%", minWidth: 0 }}
              value={stateA}
              onChange={(e) => setStateA(e.target.value)}
            >
              {MAP_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <span className="text-faint">vs</span>

            <select
              className="topbar-select"
              style={{ width: "100%", minWidth: 0 }}
              value={stateB}
              onChange={(e) => setStateB(e.target.value)}
            >
              {MAP_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: "100%", minWidth: 0 }}>
            <StateVsState
              a={stateA}
              b={stateB}
              disease={f.disease}
              year={f.year}
            />
          </div>
        </Glass>

        {/* Compare two diseases */}
        <Glass hover={false} style={{ minWidth: 0 }}>
          <SectionHeading
            eyebrow="Head to head"
            title="Compare two diseases"
            action={
              <button
                className={`pill-btn ${normalizeDiseases ? "active" : ""}`}
                style={{
                  background: normalizeDiseases
                    ? "linear-gradient(135deg,var(--purple-deep),var(--purple))"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onClick={() => setNormalizeDiseases((n) => !n)}
              >
                Index to 100
              </button>
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              width: "100%",
            }}
          >
            <select
              className="topbar-select"
              style={{ width: "100%", minWidth: 0 }}
              value={diseaseA}
              onChange={(e) => setDiseaseA(e.target.value)}
            >
              {ALL_DISEASES.map((d) => (
                <option key={d.label} value={d.label}>
                  {shortLabel(d.label)}
                </option>
              ))}
            </select>

            <span className="text-faint">vs</span>

            <select
              className="topbar-select"
              style={{ width: "100%", minWidth: 0 }}
              value={diseaseB}
              onChange={(e) => setDiseaseB(e.target.value)}
            >
              {ALL_DISEASES.map((d) => (
                <option key={d.label} value={d.label}>
                  {shortLabel(d.label)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: "100%", minWidth: 0 }}>
            <DiseaseVsDisease
              a={diseaseA}
              b={diseaseB}
              year={f.year}
              normalize={normalizeDiseases}
            />
          </div>
        </Glass>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading
            title="Disease correlation matrix"
            action={<div className="flex-gap"><span className="text-faint" style={{ fontSize: 11.5 }}>N diseases</span><input type="range" min={6} max={20} value={corrN} onChange={(e) => setCorrN(Number(e.target.value))} style={{ accentColor: "#a78bfa" }} /><span className="mono text-dim" style={{ fontSize: 11.5 }}>{corrN}</span></div>}
          />
          <CorrelationMatrix n={corrN} onSelect={(a, b) => setCorrPair([a, b])} />
          {corrPair && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-dim" style={{ fontSize: 12, marginBottom: 8 }}>{shortLabel(corrPair[0])} vs {shortLabel(corrPair[1])} — overlaid national weekly series</div>
              <PairOverlay a={corrPair[0]} b={corrPair[1]} />
            </div>
          )}
        </Glass>

        <Glass hover={false}>
          <SectionHeading  title="State similarity network" />
          <SimilarityNetwork year={f.year} selectedState={f.state} onSelectState={f.setState} />
          <div className="text-faint" style={{ fontSize: 11.5, marginTop: 8 }}>Cosine similarity of each state's disease-share vector (top {TOP_DISEASES.length} diseases, {f.year}). Closer / thicker edges = more similar disease profiles.</div>
        </Glass>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading eyebrow="Movement" title="Ranking changes over time" action={
            <div className="pill-group">
              <button className={`pill-btn ${rankMetric === "cases" ? "active" : ""}`} onClick={() => setRankMetric("cases")}>Cases</button>
              <button className={`pill-btn ${rankMetric === "incidence" ? "active" : ""}`} onClick={() => setRankMetric("incidence")}>Per 100k</button>
            </div>
          } />
          <BumpChart disease={f.disease} year={f.year} metric={rankMetric} />
        </Glass>

        <Glass hover={false}>
          <SectionHeading eyebrow="Difference" title="Waterfall" action={
            <div className="pill-group">
              <button className={`pill-btn ${waterfallMode === "states" ? "active" : ""}`} onClick={() => setWaterfallMode("states")}>{stateA} vs {stateB}</button>
              <button className={`pill-btn ${waterfallMode === "years" ? "active" : ""}`} onClick={() => setWaterfallMode("years")}>{f.year} vs {f.year - 1}</button>
            </div>
          } />
          <div className="text-faint" style={{ fontSize: 11, marginBottom: 8 }}>Each year is compared through the same week (week{f.week})</div>
          <WaterfallChart mode={waterfallMode} stateA={stateA} stateB={stateB} year={f.year} week={f.week} />
        </Glass>
      </div>
    </div>
  );
}

function StateVsState({ a, b, disease, year }) {
  const { loading } = useEnsureStateDetail(disease);
  if (loading) return <div className="skeleton" style={{ height: 220 }} />;
  const seriesA = getStateSeries(disease, a);
  const seriesB = getStateSeries(disease, b);
  if (!seriesA && !seriesB) return <EmptyNote>No state detail for {shortLabel(disease)}.</EmptyNote>;
  const { yi } = ywIdx(year, 1);
  const data = Array.from({ length: NWEEKS }).map((_, w) => ({ week: w + 1, [a]: seriesA?.[yi]?.[w] ?? null, [b]: seriesB?.[yi]?.[w] ?? null }));
  const cumA = cumulativeForYear(disease, year, a);
  const cumB = cumulativeForYear(disease, year, b);
  const incA = cumA != null && POPULATION[a] ? (cumA / POPULATION[a]) * 100000 : null;
  const incB = cumB != null && POPULATION[b] ? (cumB / POPULATION[b]) * 100000 : null;
  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="week" stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
          <RTooltip content={<MultiTooltip labels={[a, b]} />} />
          <Line dataKey={a} name={a} stroke="#a78bfa" dot={false} strokeWidth={2.2} connectNulls />
          <Line dataKey={b} name={b} stroke="#2dd4bf" dot={false} strokeWidth={2.2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="grid grid-2-even" style={{ gap: 10, marginTop: 10 }}>
        <div className="glass-card tight" style={{ padding: 10 }}><div className="kpi-label">{a}</div><div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(cumA)} cases</div><div className="text-faint" style={{ fontSize: 11 }}>{incA != null ? `${incA.toFixed(2)} /100k` : "—"}</div></div>
        <div className="glass-card tight" style={{ padding: 10 }}><div className="kpi-label">{b}</div><div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(cumB)} cases</div><div className="text-faint" style={{ fontSize: 11 }}>{incB != null ? `${incB.toFixed(2)} /100k` : "—"}</div></div>
      </div>
    </div>
  );
}

function DiseaseVsDisease({ a, b, year, normalize }) {
  const seriesA = getNationalSeries(a);
  const seriesB = getNationalSeries(b);
  if (!seriesA || !seriesB) return <EmptyNote>Missing national data for one of these diseases.</EmptyNote>;
  const { yi } = ywIdx(year, 1);
  let data = Array.from({ length: NWEEKS }).map((_, w) => ({ week: w + 1, [a]: seriesA[yi]?.[w] ?? null, [b]: seriesB[yi]?.[w] ?? null }));
  if (normalize) {
    const baseA = data.find((d) => d[a] > 0)?.[a];
    const baseB = data.find((d) => d[b] > 0)?.[b];
    data = data.map((d) => ({ week: d.week, [a]: d[a] != null && baseA ? (d[a] / baseA) * 100 : null, [b]: d[b] != null && baseB ? (d[b] / baseB) * 100 : null }));
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="week" stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#8892b8" fontSize={11} tickLine={false} axisLine={false} />
        <RTooltip content={<MultiTooltip labels={[a, b]} />} />
        <Line dataKey={a} name={shortLabel(a)} stroke="#fb7185" dot={false} strokeWidth={2.2} connectNulls />
        <Line dataKey={b} name={shortLabel(b)} stroke="#fbbf24" dot={false} strokeWidth={2.2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CorrelationMatrix({ n, onSelect }) {
  const diseases = TOP_DISEASES.slice(0, n);
  const flats = useMemo(() => diseases.map((l) => {
    const s = getNationalSeries(l);
    return s ? flattenSeries(s, YEARS, NWEEKS).map((d) => d.value) : null;
  }), [diseases.join("|")]);

  const matrix = useMemo(() => diseases.map((_, i) => diseases.map((__, j) => (flats[i] && flats[j] ? pearson(flats[i], flats[j]) : null))), [flats]);

  const cell = 20;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${diseases.length}, ${cell}px)`, gap: 1 }}>
        <div />
        {diseases.map((l, i) => <div key={i} style={{ writingMode: "vertical-rl", fontSize: 8, color: "var(--text-faint)", height: 90 }}>{shortLabel(l)}</div>)}
        {diseases.map((l, i) => (
          <React.Fragment key={i}>
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 6 }}>{shortLabel(l)}</div>
            {diseases.map((l2, j) => {
              const r = matrix[i][j];
              const bg = r == null ? "rgba(255,255,255,0.03)" : r >= 0 ? d3.interpolateRgb("#0a0f24", "#2dd4bf")(Math.abs(r)) : d3.interpolateRgb("#0a0f24", "#fb7185")(Math.abs(r));
              return <div key={j} className="matrix-cell" title={`${shortLabel(l)} × ${shortLabel(l2)}: r = ${r != null ? r.toFixed(2) : "n/a"}`}
                onClick={() => i !== j && onSelect(l, l2)}
                style={{ width: cell, height: cell, background: bg, borderRadius: 3 }} />;
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="legend-scale" style={{ marginTop: 12 }}>
        <span>−1 (inverse)</span>
        <div className="legend-bar" style={{ background: "linear-gradient(90deg, #fb7185, #0a0f24, #2dd4bf)" }} />
        <span>+1 (correlated)</span>
      </div>
    </div>
  );
}

function PairOverlay({ a, b }) {
  const seriesA = getNationalSeries(a), seriesB = getNationalSeries(b);
  const flatA = flattenSeries(seriesA, YEARS, NWEEKS);
  const data = flatA.map((d, i) => ({ idx: i, [a]: d.value, [b]: flattenSeries(seriesB, YEARS, NWEEKS)[i]?.value ?? null }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>
        <XAxis dataKey="idx" hide />
        <YAxis stroke="#8892b8" fontSize={10} tickLine={false} axisLine={false} />
        <RTooltip content={<MultiTooltip labels={[a, b]} />} />
        <Line dataKey={a} name={shortLabel(a)} stroke="#a78bfa" dot={false} strokeWidth={1.6} connectNulls />
        <Line dataKey={b} name={shortLabel(b)} stroke="#2dd4bf" dot={false} strokeWidth={1.6} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SimilarityNetwork({ year, selectedState, onSelectState }) {
  const width = 460, height = 320;
  const nodes = useMemo(() => {
    const vectors = stateDiseaseShareVectors(year);
    const states = MAP_STATES.filter((s) => vectors[s].some((v) => v > 0));
    const sim = {};
    states.forEach((s1) => { sim[s1] = {}; states.forEach((s2) => { if (s1 !== s2) sim[s1][s2] = cosineSimilarity(vectors[s1], vectors[s2]); }); });

    const simNodes = states.map((s) => ({ id: s, x: width / 2 + (Math.random() - 0.5) * 40, y: height / 2 + (Math.random() - 0.5) * 40 }));
    const links = [];
    states.forEach((s1, i) => {
      // connect to top-3 most similar states to keep graph legible
      const sims = states.filter((s2) => s2 !== s1).map((s2) => ({ s2, v: sim[s1][s2] })).sort((a, b) => b.v - a.v).slice(0, 3);
      sims.forEach(({ s2, v }) => { if (v > 0.4) links.push({ source: s1, target: s2, value: v }); });
    });

    const sim3 = d3.forceSimulation(simNodes)
      .force("charge", d3.forceManyBody().strength(-70))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("link", d3.forceLink(links).id((d) => d.id).distance((l) => 140 * (1 - l.value)).strength(0.5))
      .force("collide", d3.forceCollide(14))
      .stop();
    for (let i = 0; i < 220; i++) sim3.tick();

    return { nodes: simNodes, links };
  }, [year]);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {nodes.links.map((l, i) => {
        const s = typeof l.source === "object" ? l.source : nodes.nodes.find((n) => n.id === l.source);
        const t = typeof l.target === "object" ? l.target : nodes.nodes.find((n) => n.id === l.target);
        if (!s || !t) return null;
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#a78bfa" strokeOpacity={l.value * 0.5} strokeWidth={l.value * 2.5} />;
      })}
      {nodes.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => onSelectState(n.id)} style={{ cursor: "pointer" }}>
          <circle className="network-node" r={n.id === selectedState ? 8 : 5.5} fill={n.id === selectedState ? "#fb7185" : "#2dd4bf"} stroke="#050816" strokeWidth={1.5} />
          <text x={8} y={3} fontSize={8.5} fill="#9ba3c4">{STATE_ABBR[n.id]}</text>
        </g>
      ))}
    </svg>
  );
}

function BumpChart({ disease, year, metric }) {
  const weeks = [4, 12, 20, 28, 36, 44, 52].filter((w) => w <= yearMaxWeek(year));
  const { yi } = ywIdx(year, 1);
  const ranks = useMemo(() => {
    return weeks.map((w) => {
      const rows = MAP_STATES.map((state) => {
        const series = getStateSeries(disease, state);
        const cases = series?.[yi]?.[w - 1];
        if (cases == null) return null;
        const val = metric === "incidence" && POPULATION[state] ? (cases / POPULATION[state]) * 100000 : cases;
        return { state, val };
      }).filter(Boolean).sort((a, b) => b.val - a.val).slice(0, 8);
      const rankMap = {};
      rows.forEach((r, i) => { rankMap[r.state] = i + 1; });
      return { week: w, rankMap };
    });
  }, [disease, year, metric]);

  const topStates = useMemo(() => {
    const set = new Set();
    ranks.forEach((r) => Object.keys(r.rankMap).forEach((s) => set.add(s)));
    return Array.from(set).slice(0, 8);
  }, [ranks]);

  if (topStates.length === 0) return <EmptyNote>No state detail for {shortLabel(disease)}.</EmptyNote>;

  const w = 480, h = 260, padL = 90, padR = 20, padT = 10, padB = 24;
  const xStep = (w - padL - padR) / (weeks.length - 1 || 1);
  const yStep = (h - padT - padB) / 8;
  const colorFor = (i) => PALETTE_5[i % PALETTE_5.length];

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      {weeks.map((wk, i) => <text key={i} x={padL + i * xStep} y={h - 6} fontSize={9} fill="#656d94" textAnchor="middle">W{wk}</text>)}
      {topStates.map((state, si) => {
        const pts = ranks.map((r, i) => ({ x: padL + i * xStep, y: padT + ((r.rankMap[state] || 9) - 1) * yStep, rank: r.rankMap[state] }));
        const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x + "," + p.y).join(" ");
        return (
          <g key={state}>
            <path d={d} fill="none" stroke={colorFor(si)} strokeWidth={2} opacity={0.85} />
            {pts.map((p, i) => p.rank <= 8 && <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colorFor(si)} />)}
            <text x={padL - 8} y={padT + ((ranks[0].rankMap[state] || 9) - 1) * yStep + 3} fontSize={9} fill={colorFor(si)} textAnchor="end">{STATE_ABBR[state]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function WaterfallChart({ mode, stateA, stateB, year, week }) {
  const diseases = TOP_DISEASES.slice(0, 8);
  const data = useMemo(() => {
    return diseases.map((label) => {
      let a, b, name;
      if (mode === "states") {
        a = cumulativeThroughWeek(label, year, week, stateA);
        b = cumulativeThroughWeek(label, year, week, stateB);
        name = shortLabel(label);
      } else {
        a = cumulativeThroughWeek(label, year - 1, week);
        b = cumulativeThroughWeek(label, year, week);
        name = shortLabel(label);
      }
      return {
        name,
        diff: a != null && b != null ? b - a : null,
      };
    }).filter((d) => d.diff != null && d.diff !== 0)
  }, [mode, stateA, stateB, year, week]);

  if (!YEARS.includes(year - 1) && mode === "years") return <EmptyNote>No prior year to compare.</EmptyNote>;
  if (data.length === 0) return <EmptyNote>No difference to show.</EmptyNote>;

  let running = 0;
  const bars = data.map((d) => {
    const start = running;
    running += d.diff;
    return { ...d, start, end: running };
  });
  const allVals = bars.flatMap((b) => [b.start, b.end]);
  const min = Math.min(0, ...allVals), max = Math.max(0, ...allVals);
  const span = max - min || 1;
  const w = 480, h = 260, padL = 10, padR = 10, padT = 10, padB = 60;
  const barW = (w - padL - padR) / bars.length - 6;
  const yFor = (v) => padT + (1 - (v - min) / span) * (h - padT - padB);

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={padL} x2={w - padR} y1={yFor(0)} y2={yFor(0)} stroke="rgba(255,255,255,0.2)" />
      {bars.map((b, i) => {
        const x = padL + i * (barW + 6);
        const y = yFor(Math.max(b.start, b.end));
        const barH = Math.abs(yFor(b.start) - yFor(b.end));
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(2, barH)} fill={b.diff >= 0 ? "#34d399" : "#fb7185"} rx={3} />
            <text x={x + barW / 2} y={h - padB + 14} fontSize={8} fill="#656d94" textAnchor="middle" transform={`rotate(28, ${x + barW/2}, ${h - padB + 14})`}>{b.name}</text>
            <text x={x + barW / 2} y={y - 4} fontSize={8.5} fill="#9ba3c4" textAnchor="middle">{b.diff > 0 ? "+" : ""}{fmt(b.diff)}</text>
          </g>
        );
      })}
    </svg>
  );
}
