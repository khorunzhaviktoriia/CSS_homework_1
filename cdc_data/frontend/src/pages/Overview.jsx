/* =========================================================================
   PAGE 1 — OVERVIEW
   Moved verbatim from App.jsx during the modularization refactor.
   ========================================================================= */

import { useState, useMemo, useEffect } from "react";
import { Activity, TrendingUp, Flame, ShieldAlert, Play, Pause, Sparkles } from "lucide-react";
import {
  YEARS,
  NWEEKS,
  useEnsureStateDetail,
} from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import {
  ywIdx, yearWeekIndex, getNationalSeries, allOutbreakPairs, growthLeaders,
  incidenceRanking, generateInsights, shortLabel, fmt, yearMaxWeek,
} from "../utils/analytics.js";
import { Glass, Sparkline, TierDot, Trend, SectionHeading, EmptyNote, useCountUp } from "../components/Shared.jsx";
import { TileMap } from "../components/TileMap.jsx";


export default function OverviewPage() {
  const f = useFilters();
  const [mapMetric, setMapMetric] = useState("cases");
  const [playing, setPlaying] = useState(false);
  const [rankMetric, setRankMetric] = useState("incidence");
  const { loading: stateLoading } = useEnsureStateDetail(f.disease);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      f.setWeek((w) => (w >= yearMaxWeek(f.year) ? 1 : w + 1));
    }, 700);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [playing, f.year]);

  // --- KPI 1: national cases for the selected disease ---
  const totalCases = useMemo(() => {
    const { yi, wi } = ywIdx(f.year, f.week);
    return getNationalSeries(f.disease)?.[yi]?.[wi] ?? null;
  }, [f.disease, f.year, f.week]);

  const totalCasesPrevYear = useMemo(() => {
    if (!YEARS.includes(f.year - 1)) return null;

    const { wi } = ywIdx(f.year, f.week);
    const yi = YEARS.indexOf(f.year - 1);

    return getNationalSeries(f.disease)?.[yi]?.[wi] ?? null;
  }, [f.disease, f.year, f.week]);

  const totalTrend =
    totalCases != null &&
    totalCasesPrevYear != null &&
    totalCasesPrevYear !== 0
      ? ((totalCases - totalCasesPrevYear) / totalCasesPrevYear) * 100
      : null;

  const totalSparkline = useMemo(() => {
    const idx = yearWeekIndex(f.year, f.week);
    const series = getNationalSeries(f.disease);
    const out = [];

    for (let i = idx - 11; i <= idx; i++) {
      if (i < 0) {
        out.push(null);
        continue;
      }

      const yi = Math.floor(i / NWEEKS);
      const wi = i % NWEEKS;

      out.push(series?.[yi]?.[wi] ?? null);
    }

    return out;
  }, [f.disease, f.year, f.week]);

  // --- KPI 2: active outbreaks ---
  const outbreakPairs = useMemo(() => allOutbreakPairs(f.year, f.week), [f.year, f.week]);
  const outbreakCount = outbreakPairs.filter((p) => p.tier === "outbreak").length;
  const elevatedCount = outbreakPairs.filter((p) => p.tier === "elevated").length;

  const alertPairs = useMemo(
    () =>
      outbreakPairs
        .filter((p) => p.tier !== "normal")
        .sort((a, b) => b.score - a.score),
    [outbreakPairs]
  );

  // --- KPI 3: fastest growing disease ---
  const growth = useMemo(() => growthLeaders(f.year, f.week), [f.year, f.week]);
  const topGrowth = growth[0];

  // --- KPI 4: highest incidence state (for the currently selected disease) ---
  const incidence = useMemo(
    () => incidenceRanking(f.disease, f.year, f.week, true),
    [f.disease, f.year, f.week, stateLoading]
  );
  const topIncidenceState = incidence[0];

  const insights = useMemo(() => generateInsights(f.year, f.week), [f.year, f.week]);

  const rankingData = useMemo(() => {
    const raw = incidenceRanking(f.disease, f.year, f.week, rankMetric === "incidence");
    return raw.slice(0, 8);
  }, [f.disease, f.year, f.week, rankMetric, stateLoading]);
  const rankMax = Math.max(...rankingData.map((r) => r[rankMetric === "incidence" ? "incidence" : "cases"] || 0), 1);

  const totalCountUp = useCountUp(totalCases || 0);

  return (
    <div className="page-wrap">
      <div className="hero">
        <h1>Weekly infectious disease intelligence</h1>
        <p>
          Disease Radar helps public-health analysts explore weekly NNDSS surveillance data,
          identify unusual changes, compare jurisdictions, and prioritize patterns for further investigation.
          Current view: week {f.week}, {f.year}.
        </p>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 20 }}>
        <Glass className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="kpi-label">Selected disease cases</div>
              <div className="kpi-value">{totalCases == null ? "—" : fmt(Math.round(totalCountUp))}</div>
            </div>
            <div className="kpi-icon"><Activity size={17} /></div>
          </div>
          <div className="kpi-bottom">
            <Sparkline values={totalSparkline} color="#a78bfa" />
            <Trend value={totalTrend} />
          </div>
          <div className="kpi-sub">
            {shortLabel(f.disease)} · national · week {f.week}, {f.year}
          </div>
        </Glass>

        <Glass className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="kpi-label">High anomaly signals</div>
              <div className="kpi-value">{outbreakCount}</div>
            </div>
            <div className="kpi-icon" style={{ color: "var(--coral)" }}><ShieldAlert size={17} /></div>
          </div>
          <div className="kpi-bottom">
            <span className="text-faint" style={{ fontSize: 12 }}>{elevatedCount} elevated · {outbreakPairs.length} tracked pairs</span>
          </div>
          <div className="kpi-sub">Unusual increases vs the previous 8 weeks</div>
        </Glass>

        <Glass className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="kpi-label">Fastest growing</div>
              <div className="kpi-value" style={{ fontSize: 17, lineHeight: 1.3 }}>{topGrowth ? shortLabel(topGrowth.label) : "—"}</div>
            </div>
            <div className="kpi-icon" style={{ color: "var(--teal)" }}><TrendingUp size={17} /></div>
          </div>
          <div className="kpi-bottom">
            {topGrowth?.newActivity ? <span className="trend-pill trend-up">New activity</span> : <Trend value={topGrowth?.pct} />}
          </div>
          <div className="kpi-sub">Compared with the previous week</div>
        </Glass>

        <Glass className="kpi-card">
          <div className="kpi-top">
            <div>
              <div className="kpi-label">Highest incidence</div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{topIncidenceState?.state || "—"}</div>
            </div>
            <div className="kpi-icon" style={{ color: "var(--cyan)" }}><Flame size={17} /></div>
          </div>
          <div className="kpi-bottom">
            <span className="text-dim" style={{ fontSize: 12.5 }}>{topIncidenceState ? `${topIncidenceState.incidence.toFixed(2)} /100k` : "—"}</span>
          </div>
          <div className="kpi-sub">{shortLabel(f.disease)} · per 100k residents</div>
        </Glass>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading
            eyebrow="Choropleth"
            title={`${shortLabel(f.disease)} — ${mapMetric === "cases" ? "weekly cases" : mapMetric === "incidence" ? "incidence /100k" : mapMetric === "growth" ? "growth vs prior week" : "anomaly score"}`}
            action={
              <div className="pill-group">
                {[["cases", "Cases"], ["incidence", "Per 100k"], ["anomaly", "Anomaly"], ["growth", "Growth"]].map(([k, l]) => (
                  <button key={k} className={`pill-btn ${mapMetric === k ? "active" : ""}`} onClick={() => setMapMetric(k)}>{l}</button>
                ))}
              </div>
            }
          />
          <TileMap label={f.disease} year={f.year} week={f.week} metric={mapMetric} selectedState={f.state} onSelectState={f.setState} />
          <div className="flex-gap" style={{ marginTop: 14 }}>
            <button className="icon-btn" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
            <input type="range" min={1} max={yearMaxWeek(f.year)} value={f.week} onChange={(e) => f.setWeek(Number(e.target.value))} style={{ flex: 1, accentColor: "#a78bfa" }} />
            <span className="mono text-faint" style={{ fontSize: 11.5, width: 70 }}>Week {f.week}/{yearMaxWeek(f.year)}</span>
          </div>
        </Glass>

        <Glass hover={false} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHeading eyebrow="Selected week" title="Alert feed" />
          <div style={{ overflowY: "auto", maxHeight: 420 }}>
            {alertPairs.length === 0 && <EmptyNote>No elevated or high-anomaly signals this week.</EmptyNote>}
            {alertPairs.slice(0, 10).map((p, i) => (
              <div key={i} className={`alert-item ${p.tier === "outbreak" ? "alert-outbreak" : ""}`}>
                <TierDot tier={p.tier} />
                <div className="alert-text">
                  <b>{shortLabel(p.label)}</b> in <b>{p.state}</b> — week {f.week}: robust anomaly score {p.score.toFixed(1)} relative to its 8-week rolling baseline ({p.current ?? 0} vs baseline {p.baseline?.toFixed(1) ?? "—"}).
                </div>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading
            eyebrow="Ranking"
            title="Top states"
            action={
              <div className="pill-group">
                <button className={`pill-btn ${rankMetric === "incidence" ? "active" : ""}`} onClick={() => setRankMetric("incidence")}>Per 100k</button>
                <button className={`pill-btn ${rankMetric === "cases" ? "active" : ""}`} onClick={() => setRankMetric("cases")}>Cases</button>
              </div>
            }
          />
          {rankingData.length === 0 ? <EmptyNote>No state data for this disease/week.</EmptyNote> : rankingData.map((r, i) => (
            <div className="rank-row" key={r.state}>
              <span className="rank-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="rank-name">{r.state}</span>
              <div className="rank-track"><div className="rank-fill" style={{ width: `${((rankMetric === "incidence" ? r.incidence : r.cases) / rankMax) * 100}%`, background: "linear-gradient(90deg, var(--purple-deep), var(--teal))" }} /></div>
              <span className="rank-val">{rankMetric === "incidence" ? r.incidence.toFixed(2) : fmt(r.cases)}</span>
            </div>
          ))}
        </Glass>

        <Glass hover={false}>
          <SectionHeading eyebrow="Auto-generated" title="Key insights" action={<Sparkles size={15} color="var(--purple)" />} />
          {insights.length === 0 && <EmptyNote>No notable signals detected for this week.</EmptyNote>}
          {insights.map((ins, i) => (
            <div className="alert-item" key={i}>
              <TierDot tier={ins.tier === "info" ? "unknown" : ins.tier} />
              <div className="alert-text">{ins.text}</div>
            </div>
          ))}
        </Glass>
      </div>
    </div>
  );
}
