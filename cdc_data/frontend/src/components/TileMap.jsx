/* =========================================================================
   TILE-GRID CHOROPLETH MAP (self-contained, no external geo data required)
   Moved verbatim from App.jsx during the modularization refactor. Used by
   the Overview and Geographic Analysis pages.
   ========================================================================= */

import { useState, useMemo } from "react";
import { YEARS, NWEEKS, MAP_STATES, STATE_GRID, POPULATION, useEnsureStateDetail } from "../api.js";
import {
  ywIdx, getStateSeries, flattenSeries, yearWeekIndex, growthIndex, robustAnomalyAt,
  hasStateDetail, metricColor, fmt, previousWeekValue,
} from "../utils/analytics.js";
import { STATE_ABBR } from "../constants.js";
import { EmptyNote } from "./Shared.jsx";

export function TileMap({ label, year, week, metric, selectedState, onSelectState, height = 340 }) {
  const { cols, rows } = STATE_GRID;
  const { yi, wi } = ywIdx(year, week);
  const { loading } = useEnsureStateDetail(label);

  const values = useMemo(() => {
    const out = {};
    MAP_STATES.forEach((state) => {
      const series = getStateSeries(label, state);
      if (!series) { out[state] = null; return; }
      if (metric === "cases") {
        out[state] = series[yi]?.[wi] ?? null;
      } else if (metric === "incidence") {
        const cases = series[yi]?.[wi];
        const pop = POPULATION[state];
        out[state] = cases != null && pop ? (cases / pop) * 100000 : null;
      } else if (metric === "growth") {
        const current = series?.[yi]?.[wi] ?? null;
        const previous = previousWeekValue(series, year, week);
        const g = growthIndex(previous, current);
        out[state] = g && g.pct != null ? g.pct : null;
      } else if (metric === "anomaly") {
        const flat = flattenSeries(series, YEARS, NWEEKS);
        const idx = yearWeekIndex(year, week);
        out[state] = robustAnomalyAt(flat, idx, 8).score;
      }
    });
    return out;
  }, [label, year, week, metric, loading]);

  const renderedStates = Object.keys(STATE_GRID.grid);

  const vals = renderedStates
    .map((state) => values[state])
    .filter((v) => v != null && Number.isFinite(v));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const palette = metric === "anomaly" ? "heat" : metric === "growth" ? "growth" : metric === "incidence" ? "teal" : "purple";

  const [hover, setHover] = useState(null);

  if (loading) {
    return <div className="skeleton" style={{ height }} />;
  }
  if (!hasStateDetail(label)) {
    return <EmptyNote>No state-level breakdown was reported for this disease/condition — the backend found no non-suppressed state rows for it.</EmptyNote>;
  }

  return (
    <div>
      <div className="tile-map" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, height }}
        onMouseLeave={() => setHover(null)}>
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const stateName = Object.keys(STATE_GRID.grid).find((s) => STATE_GRID.grid[s].col === c && STATE_GRID.grid[s].row === r);
            if (!stateName) return <div key={`${r}-${c}`} className="tile-cell tile-empty" />;
            const abbr = STATE_ABBR[stateName] || stateName.slice(0, 2).toUpperCase();
            const v = values[stateName];
            const color = metricColor(v, min, max, palette);
            return (
              <div
                key={stateName}
                className={`tile-cell ${selectedState === stateName ? "selected" : ""}`}
                style={{ background: color }}
                onClick={() => onSelectState && onSelectState(stateName)}
                onMouseEnter={() => setHover(stateName)}
              >
                {abbr}
              </div>
            );
          })
        )}
      </div>
      <div className="flex-between" style={{ marginTop: 12 }}>
        <div className="legend-scale">
          <span>{metric === "incidence" ? "Low /100k" : metric === "anomaly" ? "Baseline" : metric === "growth" ? "Decline" : "Fewer cases"}</span>
          <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${metricColor(min, min, max, palette)}, ${metricColor(max, min, max, palette)})` }} />
          <span>{metric === "incidence" ? "High /100k" : metric === "anomaly" ? "High anomaly" : metric === "growth" ? "Growth" : "More cases"}</span>
        </div>
        {hover && (
          <div className="dr-tooltip" style={{ position: "static", padding: "6px 12px" }}>
            <span className="tt-title" style={{ marginBottom: 0 }}>{hover}</span>
            <span className="text-dim" style={{ marginLeft: 8 }}>
              {values[hover] != null ? fmt(values[hover]) : "no data"}
              {metric === "incidence" ? " /100k" : metric === "growth" || metric === "anomaly" ? "" : " cases"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
