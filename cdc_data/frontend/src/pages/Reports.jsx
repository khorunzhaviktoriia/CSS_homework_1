/* =========================================================================
   PAGE 6 — REPORTS & INSIGHTS
   Moved verbatim from App.jsx during the modularization refactor. The CSV
   export helpers at the bottom are page-local (only Reports uses them).
   ========================================================================= */

import { useMemo } from "react";
import { Sparkles, Download } from "lucide-react";
import { YEARS, NWEEKS, ALL_DISEASES, TOP_DISEASES, DATA } from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import {
  ywIdx,
  flattenSeries,
  robustAnomalyAt,
  growthLeaders,
  allOutbreakPairs,
  completenessByState,
  generateInsights,
  getNationalSeries,
  shortLabel,
  fmt,
} from "../utils/analytics.js";
import { Glass, SectionHeading, EmptyNote, TierDot, Trend } from "../components/Shared.jsx";

export default function ReportsPage() {
  const f = useFilters();
  const growth = useMemo(() => growthLeaders(f.year, f.week), [f.year, f.week]);
  const emerging = growth.filter((g) => (g.newActivity || (g.pct != null && g.pct > 0))).slice(0, 8);
  const outbreakPairs = useMemo(() => allOutbreakPairs(f.year, f.week), [f.year, f.week]);
  const completeness = useMemo(() => completenessByState(), []);
  const insights = useMemo(() => generateInsights(f.year, f.week, 8), [f.year, f.week]);

  const totalCases = useMemo(() => {
    const { yi, wi } = ywIdx(f.year, f.week);
    return getNationalSeries(f.disease)?.[yi]?.[wi] ?? null;
  }, [f.disease, f.year, f.week]);

  // outbreak timeline: weeks in this year where any top disease crossed outbreak threshold nationally
  const outbreakTimeline = useMemo(() => {
    const events = [];
    TOP_DISEASES.forEach((label) => {
      const series = getNationalSeries(label);
      if (!series) return;
      const flat = flattenSeries(series, YEARS, NWEEKS);
      const { yi } = ywIdx(f.year, 1);
      for (let w = 0; w < NWEEKS; w++) {
        const idx = yi * NWEEKS + w;
        const { score } = robustAnomalyAt(flat, idx, 8);
        if (score != null && score > 3) events.push({ label, week: w + 1, score });
      }
    });
    return events.sort((a, b) => a.week - b.week);
  }, [f.year]);

  return (
    <div className="page-wrap">
      <div className="hero"><h1>Reports & insights</h1><p>A shareable snapshot of national activity, emerging signals, and data quality for week {f.week}, {f.year}.</p></div>

      <div className="grid grid-kpi" style={{ marginBottom: 20 }}>
        <Glass className="kpi-card">
          <div className="kpi-label">Selected disease cases</div>
          <div className="kpi-value">{fmt(totalCases)}</div>
          <div className="kpi-sub">{shortLabel(f.disease)} · week {f.week}, {f.year}</div>
        </Glass>
        <Glass className="kpi-card"><div className="kpi-label">High anomaly signals</div><div className="kpi-value">{outbreakPairs.filter(p=>p.tier==="outbreak").length}</div><div className="kpi-sub">disease × state, this week</div></Glass>
        <Glass className="kpi-card"><div className="kpi-label">Emerging diseases</div><div className="kpi-value">{emerging.length}</div><div className="kpi-sub">positive growth index</div></Glass>
        <Glass className="kpi-card"><div className="kpi-label">Jurisdictions below 70% reporting</div><div className="kpi-value">{completeness.filter(c => c.score != null && c.score < 0.7).length}</div><div className="kpi-sub">avg across top diseases</div></Glass>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading  title="Top emerging diseases" />
          {emerging.length === 0 ? <EmptyNote>No diseases show positive growth this week.</EmptyNote> : emerging.map((g, i) => (
            <div className="rank-row" key={g.label} style={{ gridTemplateColumns: "22px 1fr 90px" }}>
              <span className="rank-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="rank-name">{shortLabel(g.label)}</span>
              {g.newActivity ? <span className="trend-pill trend-up">New activity</span> : <Trend value={g.pct} />}
            </div>
          ))}
          <div className="text-faint" style={{ fontSize: 11, marginTop: 10 }}>Ranked by Growth Index, not raw volume — a disease moving from 2→8 cases outranks a stable disease with hundreds.</div>
        </Glass>

        <Glass hover={false}>
          <SectionHeading eyebrow="Automated Insights" title="Data-driven narrative cards" action={<Sparkles size={15} color="var(--purple)" />} />
          {insights.length === 0 ? <EmptyNote>No notable signals this week.</EmptyNote> : insights.map((ins, i) => (
            <div className="alert-item" key={i}><TierDot tier={ins.tier === "info" ? "unknown" : ins.tier} /><div className="alert-text">{ins.text}</div></div>
          ))}
        </Glass>
      </div>

      <Glass hover={false} style={{ marginBottom: 20 }}>
        <SectionHeading eyebrow="Timeline" title={`High anomaly crossings, ${f.year}`} />
        {outbreakTimeline.length === 0 ? <EmptyNote>No high-anomaly weeks (robust score &gt; 3) detected this year among tracked diseases.</EmptyNote> : (
          <div style={{ position: "relative", paddingLeft: 18 }}>
            <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 2, background: "linear-gradient(180deg, var(--coral), transparent)" }} />
            {outbreakTimeline.slice(0, 20).map((e, i) => (
              <div key={i} style={{ position: "relative", marginBottom: 14 }}>
                <div style={{ position: "absolute", left: -18, top: 2, width: 10, height: 10, borderRadius: "50%", background: "var(--coral)", boxShadow: "0 0 8px var(--coral)" }} />
                <div style={{ fontSize: 12.5 }}><b>Week {e.week}</b> · {shortLabel(e.label)} <span className="text-faint">— robust anomaly score {e.score.toFixed(1)}</span></div>
              </div>
            ))}
          </div>
        )}
      </Glass>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <Glass hover={false}>
          <SectionHeading eyebrow="Analytics §8" title="Reporting completeness" />
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            <table className="dr-table">
              <thead><tr><th>State</th><th>Completeness</th><th></th></tr></thead>
              <tbody>
                {completeness.map((c) => (
                  <tr key={c.state}>
                    <td>{c.state}</td>
                    <td>{c.score != null ? `${(c.score * 100).toFixed(0)}%` : "n/a"}</td>
                    <td style={{ width: 120 }}>
                      <div className="rank-track"><div className="rank-fill" style={{ width: `${(c.score || 0) * 100}%`, background: c.score < 0.6 ? "var(--coral)" : c.score < 0.85 ? "var(--amber)" : "var(--green)" }} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-faint" style={{ fontSize: 11, marginTop: 10 }}>% of expected weeks with a non-suppressed, non-null value, averaged across the top {TOP_DISEASES.length} diseases. Low scores may mean under-reporting, not low disease activity.</div>
        </Glass>


      </div>
    </div>
  );
}

/* ---------- real, working CSV exports (client-side, no fake buttons) ---------- */

function triggerCSVDownload(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportNationalSnapshotCSV(year) {
  const rows = [["disease", "week", "year", "cases", "synthetic_estimate"]];
  ALL_DISEASES.forEach(({ label }) => {
    const rec = DATA.national[label];
    if (!rec) return;
    const yi = YEARS.indexOf(year);
    const row = rec.data[yi] || [];
    row.forEach((v, wi) => {
      if (v == null) return;
      rows.push([label, wi + 1, year, v, rec.synthetic ? "yes" : "no"]);
    });
  });
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  triggerCSVDownload(`disease-radar_national-snapshot_${year}.csv`, csv);
}

function exportCompletenessCSV(rows) {
  const out = [["state", "completeness_pct", "diseases_averaged"]];
  rows.forEach((c) => out.push([c.state, c.score != null ? (c.score * 100).toFixed(1) : "n/a", c.n]));
  const csv = out.map((r) => r.map(csvEscape).join(",")).join("\n");
  triggerCSVDownload(`disease-radar_reporting-completeness.csv`, csv);
}
