/* =========================================================================
   APP — top-level state and page composition.
   This is the file left over after splitting App.jsx into a conventional
   structure: analytics/data logic in utils/analytics.js, static config in
   constants.js and styles.js, shared UI in components/, the six pages in
   pages/, and filter state in context/FilterContext.jsx (kept separate from
   this file specifically to avoid a circular import, since both App.jsx and
   every page need it). What's left here is exactly "top-level state and
   page composition": AppShell (renders Sidebar/Topbar + whichever page is
   active) and DiseaseRadarRoot (waits for the backend before mounting
   anything, shown below). No logic was changed from the original.
   ========================================================================= */

import { useState, useEffect } from "react";
import { ServerCog, WifiOff } from "lucide-react";
import { fetchBootstrap, checkHealth } from "./api.js";
import { GLOBAL_CSS } from "./styles.js";
import { FilterProvider, useFilters } from "./context/FilterContext.jsx";
import { Sidebar, Topbar } from "./components/Layout.jsx";
import OverviewPage from "./pages/Overview.jsx";
import DiseaseExplorerPage from "./pages/DiseaseExplorer.jsx";
import GeographicAnalysisPage from "./pages/GeographicAnalysis.jsx";
import TrendAnalysisPage from "./pages/TrendAnalysis.jsx";
import ComparativeAnalysisPage from "./pages/ComparativeAnalysis.jsx";
import ReportsPage from "./pages/Reports.jsx";

/* =========================================================================
   APP ROOT
   ========================================================================= */

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { page } = useFilters();

  const pages = {
    overview: OverviewPage,
    explorer: DiseaseExplorerPage,
    geo: GeographicAnalysisPage,
    trend: TrendAnalysisPage,
    compare: ComparativeAnalysisPage,
    reports: ReportsPage,
  };
  const Page = pages[page] || OverviewPage;

  return (
    <div className="dr-root">
      <style>{GLOBAL_CSS}</style>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="main-area">
        <Topbar onMenuClick={() => setMobileOpen((o) => !o)} />
        <Page />
      </div>
    </div>
  );
}

function DiseaseRadarApp() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}

/* =========================================================================
   ROOT — waits for the backend's /api/bootstrap before mounting the app
   ========================================================================= */

function LoadingScreen({ detail }) {
  return (
    <div className="dr-root" style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18 }}>
      <style>{GLOBAL_CSS}</style>
      <div className="brand-mark" style={{ width: 54, height: 54, borderRadius: 16 }} />
      <div style={{ fontWeight: 700, fontSize: 15 }}>Disease Radar</div>
      <div className="skeleton" style={{ width: 260, height: 8 }} />
      <div className="text-faint" style={{ fontSize: 12.5, maxWidth: 340, textAlign: "center" }}>
        {detail || "Connecting to the backend and loading the NNDSS dataset…"}
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="dr-root" style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
      <style>{GLOBAL_CSS}</style>
      <WifiOff size={30} color="var(--coral)" />
      <div style={{ fontWeight: 700, fontSize: 16 }}>Can't reach the backend</div>
      <div className="text-dim" style={{ fontSize: 13, maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
        {message}
      </div>
      <div className="text-faint" style={{ fontSize: 12, maxWidth: 420, textAlign: "center" }}>
        Make sure the FastAPI backend is running (<span className="mono">uvicorn main:app --port 8000</span> from{" "}
        <span className="mono">backend/</span>) and that <span className="mono">VITE_API_BASE</span> in the frontend
        points at it (defaults to <span className="mono">http://localhost:8000</span>).
      </div>
      <button className="btn" onClick={onRetry}><ServerCog size={14} /> Retry connection</button>
    </div>
  );
}

export default function DiseaseRadarRoot() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState("Connecting to the backend…");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDetail("Connecting to the backend…");

    async function go() {
      try {
        await checkHealth();
        if (cancelled) return;
        setDetail("Loading and aggregating the NNDSS dataset (~1.6M rows)…");
        await fetchBootstrap();
        if (cancelled) return;
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e.message || String(e));
        setStatus("error");
      }
    }
    go();
    return () => { cancelled = true; };
  }, [attempt]);

  if (status === "error") return <ErrorScreen message={error} onRetry={() => setAttempt((a) => a + 1)} />;
  if (status !== "ready") return <LoadingScreen detail={detail} />;
  return <DiseaseRadarApp />;
}
