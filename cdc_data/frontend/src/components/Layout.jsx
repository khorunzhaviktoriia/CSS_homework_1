/* =========================================================================
   SHELL — Sidebar + Topbar
   Moved verbatim from App.jsx during the modularization refactor (was the
   "SHELL" section). No logic, markup, or styling changed.
   ========================================================================= */

import { useState, useMemo } from "react";
import {
  Activity, Map as MapIcon, LineChart as LineChartIcon, GitCompare, FileText, Search,
  ChevronLeft, ChevronRight, Radio, Menu,
} from "lucide-react";
import { ALL_DISEASES, YEARS, NWEEKS, MAP_STATES } from "../api.js";
import { useFilters } from "../context/FilterContext.jsx";
import { yearMaxWeek } from "../utils/analytics.js";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Radio },
  { id: "explorer", label: "Disease Explorer", icon: Activity },
  { id: "geo", label: "Geographic Analysis", icon: MapIcon },
  { id: "trend", label: "Trend Analysis", icon: LineChartIcon },
  { id: "compare", label: "Comparative Analysis", icon: GitCompare },
  { id: "reports", label: "Reports", icon: FileText },
];

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { page, setPage } = useFilters();
  return (
    <nav className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark" />
        {!collapsed && (
          <div>
            <div className="brand-name">Disease Radar</div>
            <div className="brand-sub">NNDSS Intelligence</div>
          </div>
        )}
      </div>
      {NAV_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${page === item.id ? "active" : ""}`}
          onClick={() => { setPage(item.id); setMobileOpen(false); }}
          title={item.label}
        >
          <item.icon size={17} strokeWidth={2} />
          {!collapsed && <span>{item.label}</span>}
        </div>
      ))}
      <div className="sidebar-footer">
        {!collapsed && <>Source: CDC NNDSS Weekly Tables<br />data.cdc.gov</>}
      </div>
      <div className="nav-item" onClick={() => setCollapsed(!collapsed)} style={{ marginTop: 4 }}>
        {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        {!collapsed && <span>Collapse</span>}
      </div>
    </nav>
  );
}

export function Topbar({ onMenuClick }) {
  const f = useFilters();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_DISEASES.filter((d) => d.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  return (
    <div className="topbar">
      <div className="icon-btn mobile-menu-btn" onClick={onMenuClick}>
        <Menu size={16} />
      </div>
      <div className="topbar-search" style={{ position: "relative" }}>
        <Search size={14} />
        <input
          placeholder="Search diseases…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
        />
        {showResults && matches.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
            background: "rgba(10,14,32,0.98)", border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 12, padding: 6, zIndex: 100, boxShadow: "0 16px 40px -12px rgba(0,0,0,0.7)",
            maxHeight: 280, overflowY: "auto",
          }}>
            {matches.map((d) => (
              <div key={d.label}
                style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", color: "var(--text-dim)" }}
                onMouseDown={() => { f.setDisease(d.label); setQuery(""); setShowResults(false); f.setPage("explorer"); }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {d.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <select className="topbar-select" value={f.disease} onChange={(e) => f.setDisease(e.target.value)}>
        {ALL_DISEASES.map((d) => <option key={d.label} value={d.label}>{d.label.length > 42 ? d.label.slice(0, 42) + "…" : d.label}</option>)}
      </select>

      <select className="topbar-select" value={f.year} onChange={(e) => f.setYear(Number(e.target.value))}>
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <select className="topbar-select" value={f.state} onChange={(e) => f.setState(e.target.value)}>
        {MAP_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="topbar-spacer" />

      <div className="week-pill">
        <span>Week</span><b>{f.week}</b>
        <input type="range" min={1} max={yearMaxWeek(f.year)} value={f.week}
          onChange={(e) => f.setWeek(Number(e.target.value))}
          style={{ width: 90, accentColor: "#a78bfa" }} />
      </div>
    </div>
  );
}
