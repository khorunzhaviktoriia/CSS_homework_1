/* =========================================================================
   GLOBAL STYLES — the app's single CSS string, injected via a <style> tag
   in App.jsx. Moved verbatim from App.jsx during the modularization
   refactor; no rules were changed.
   ========================================================================= */

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #050816;
  --bg-elev: #0a0f24;
  --card: rgba(255,255,255,0.045);
  --card-border: rgba(255,255,255,0.09);
  --card-border-hover: rgba(167,139,250,0.35);
  --purple: #a78bfa;
  --purple-deep: #7c3aed;
  --teal: #2dd4bf;
  --cyan: #38bdf8;
  --coral: #fb7185;
  --amber: #fbbf24;
  --green: #34d399;
  --text: #eef1fb;
  --text-dim: #9ba3c4;
  --text-faint: #656d94;
  --radius: 26px;
  --radius-sm: 16px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
  color-scheme: dark;
}

* { box-sizing: border-box; }

/* Prevent a page-level horizontal scrollbar without putting overflow on
   .dr-root itself — overflow on that ancestor is what breaks the topbar's
   position: sticky (it silently becomes the sticky containing block instead
   of the real viewport). Wide widgets (matrices, bump/waterfall charts) each
   scroll horizontally on their own via their own overflow-x: auto wrapper. */
html, body, #root {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color-scheme: dark;
  background: #050816;
}
.dr-root {
  font-family: var(--font);
  background:
    radial-gradient(ellipse 900px 500px at 12% -8%, rgba(124,58,237,0.20), transparent 60%),
    radial-gradient(ellipse 800px 600px at 100% 0%, rgba(45,212,191,0.14), transparent 55%),
    radial-gradient(ellipse 700px 700px at 90% 90%, rgba(251,113,133,0.08), transparent 55%),
    var(--bg);

  color: var(--text);
  width: 100%;
  height: 100vh;
  min-height: 0;

  display: flex;
  align-items: stretch;

  position: relative;
  overflow: hidden;
}

.dr-root ::selection { background: rgba(167,139,250,0.35); }

/* ---------- scrollbars ---------- */
.dr-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.dr-root ::-webkit-scrollbar-track { background: transparent; }
.dr-root ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.25); border-radius: 8px; }
.dr-root ::-webkit-scrollbar-thumb:hover { background: rgba(167,139,250,0.45); }

/* ---------- sidebar ---------- */
.sidebar {
  width: 232px;
  flex-shrink: 0;
  height: 100vh;
  padding: 22px 14px;

  display: flex;
  flex-direction: column;
  gap: 4px;

  border-right: 1px solid rgba(255,255,255,0.06);

  overflow-y: auto;
  position: relative;
}
.sidebar.collapsed { width: 76px; }
.sidebar-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px 22px 10px;
}
.brand-mark {
  width: 34px; height: 34px; border-radius: 10px;
  background: conic-gradient(from 220deg, var(--purple-deep), var(--cyan), var(--coral), var(--purple-deep));
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 0 22px rgba(124,58,237,0.45);
}
.brand-mark::after {
  content: ''; position: absolute; inset: 3px; border-radius: 7px; background: var(--bg-elev);
}
.brand-mark::before {
  content: ''; position: absolute; width: 6px; height: 6px; border-radius: 50%;
  background: var(--teal); top: 50%; left: 50%; transform: translate(-50%,-50%);
  box-shadow: 0 0 10px var(--teal), 0 0 2px #fff;
  animation: radarPing 2.2s ease-out infinite;
}
@keyframes radarPing {
  0% { box-shadow: 0 0 0px var(--teal); }
  50% { box-shadow: 0 0 14px var(--teal); }
  100% { box-shadow: 0 0 0px var(--teal); }
}
.brand-name { font-weight: 700; font-size: 15.5px; letter-spacing: -0.01em; white-space: nowrap; }
.brand-sub { font-size: 10.5px; color: var(--text-faint); white-space: nowrap; margin-top: 1px; }

.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 12px; cursor: pointer;
  color: var(--text-dim); font-size: 13.5px; font-weight: 500;
  transition: background 0.18s, color 0.18s;
  white-space: nowrap; overflow: hidden;
  position: relative;
}
.nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text); }
.nav-item.active {
  background: linear-gradient(90deg, rgba(167,139,250,0.16), rgba(45,212,191,0.06));
  color: #fff;
}
.nav-item.active::before {
  content: ''; position: absolute; left: -14px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 60%; border-radius: 3px;
  background: linear-gradient(180deg, var(--purple), var(--teal));
}
.nav-item svg { flex-shrink: 0; }

.sidebar-footer { margin-top: auto; padding: 10px; font-size: 10.5px; color: var(--text-faint); line-height: 1.5; }

/* ---------- main ---------- */
.main-area {
  flex: 1;
  min-width: 0;
  height: 100vh;

  display: flex;
  flex-direction: column;

  overflow-y: auto;
  overflow-x: clip;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  gap: 12px;

  padding: 14px 28px;

  background: rgba(7,10,26,0.92);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);

  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-wrap: wrap;
}
.topbar-search {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 8px 12px; min-width: 220px; flex: 1; max-width: 340px;
  color: var(--text-dim); transition: border-color 0.2s;
}
.topbar-search:focus-within { border-color: var(--purple); }
.topbar-search input {
  background: none; border: none; outline: none; color: var(--text); font-size: 13px; width: 100%; font-family: var(--font);
}
.topbar-search input::placeholder { color: var(--text-faint); }
.topbar-select, select, input[type="text"], input[type="search"] {
  color-scheme: dark;
}
.topbar-select {
  background-color: var(--bg-elev); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; padding: 8px 12px; color: var(--text); font-size: 13px; font-family: var(--font);
  cursor: pointer; outline: none; appearance: none; padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ba3c4' stroke-width='1.4' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center;
  transition: border-color 0.18s, background-color 0.18s;
}
.topbar-select:hover { border-color: rgba(167,139,250,0.45); background-color: rgba(255,255,255,0.06); }
.topbar-select:focus { border-color: var(--purple); box-shadow: 0 0 0 3px rgba(167,139,250,0.15); }
.topbar-select option {
  background-color: var(--bg-elev);
  color: var(--text);
}
.topbar-spacer { flex: 1; }
.week-pill {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-dim);
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 8px 12px;
}
.week-pill b { color: var(--text); font-weight: 600; }

.page-wrap { padding: 26px 28px 60px 28px; max-width: 1560px; width: 100%; margin: 0 auto; animation: pageIn 0.4s cubic-bezier(.16,1,.3,1); }
@keyframes pageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* ---------- hero ---------- */
.hero { margin-bottom: 26px; }
.hero h1 {
  font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px 0;
  background: linear-gradient(90deg, #fff 30%, #c4b5fd 75%, #5eead4 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero p { color: var(--text-dim); font-size: 14px; margin: 0; max-width: 620px; line-height: 1.5; }

/* ---------- glass card ---------- */
.glass-card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  backdrop-filter: blur(18px);
  padding: 20px;
  position: relative;
  transition: transform 0.22s cubic-bezier(.2,.8,.2,1), border-color 0.22s, box-shadow 0.22s;
}
.glass-hover:hover {
  transform: translateY(-3px);
  border-color: var(--card-border-hover);
  box-shadow: 0 16px 40px -18px rgba(124,58,237,0.35);
}
.glass-card.tight { border-radius: var(--radius-sm); padding: 14px; }

/* ---------- grids ---------- */
.grid { display: grid; gap: 18px; }
.grid-kpi { grid-template-columns: repeat(4, 1fr); }
.grid-2 {
  grid-template-columns: 1.35fr 0.85fr;
}

.grid-2-even {
  grid-template-columns: 1fr 1fr;
}
.grid-3 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 1200px) { .grid-kpi { grid-template-columns: repeat(2,1fr); } .grid-2 { grid-template-columns: 1fr; } .grid-3 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) { .grid-kpi { grid-template-columns: 1fr; } .grid-3 { grid-template-columns: 1fr; } .grid-2-even { grid-template-columns: 1fr; } }

/* ---------- KPI card ---------- */
.kpi-card { display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
.kpi-top { display: flex; align-items: flex-start; justify-content: space-between; }
.kpi-icon {
  width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(167,139,250,0.22), rgba(45,212,191,0.12));
  color: var(--purple);
}
.kpi-label { font-size: 12px; color: var(--text-dim); font-weight: 500; }
.kpi-value { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.kpi-sub { font-size: 11.5px; color: var(--text-faint); }
.kpi-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }

.trend-pill { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; font-weight: 600; padding: 2px 7px; border-radius: 8px; }
.trend-up { color: #34d399; background: rgba(52,211,153,0.12); }
.trend-down { color: #fb7185; background: rgba(251,113,133,0.12); }
.trend-flat { color: var(--text-faint); font-size: 11.5px; }

.tier-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

/* ---------- section heading ---------- */
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.section-heading h2 { font-size: 17px; font-weight: 700; margin: 2px 0 0 0; letter-spacing: -0.01em; }
.eyebrow { font-size: 11px; color: var(--teal); font-weight: 600; }

.empty-note { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-faint); padding: 10px 0; }

/* ---------- pill toggle group ---------- */
.pill-group { display: flex; gap: 4px; background: rgba(255,255,255,0.04); padding: 4px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
.pill-btn { border: none; background: none; color: var(--text-dim); font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 9px; cursor: pointer; transition: all 0.18s; font-family: var(--font); white-space: nowrap; }
.pill-btn:hover { color: var(--text); }
.pill-btn.active { background: linear-gradient(135deg, var(--purple-deep), var(--purple)); color: #fff; box-shadow: 0 4px 14px -4px rgba(124,58,237,0.6); }

/* ---------- alert feed ---------- */
.alert-item { display: flex; gap: 10px; padding: 11px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.alert-item:last-child { border-bottom: none; }
.alert-text { font-size: 12.5px; line-height: 1.45; color: var(--text-dim); }
.alert-text b { color: var(--text); font-weight: 600; }
.alert-outbreak .tier-dot { animation: pulseDot 1.6s ease-in-out infinite; }
@keyframes pulseDot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.4); } }

/* ---------- ranking bars ---------- */
.rank-row { display: grid; grid-template-columns: 22px 110px 1fr 60px; align-items: center; gap: 10px; padding: 7px 0; font-size: 12.5px; }
.rank-num { color: var(--text-faint); font-family: var(--mono); font-size: 11px; }
.rank-name { color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-track { height: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); overflow: hidden; }
.rank-fill { height: 100%; border-radius: 6px; transition: width 0.6s cubic-bezier(.16,1,.3,1); }
.rank-val { text-align: right; font-variant-numeric: tabular-nums; color: var(--text); font-weight: 600; }

/* ---------- tile grid map ---------- */
.tile-map { display: grid; gap: 4px; }
.tile-cell {
  aspect-ratio: 1.35; border-radius: 7px; position: relative; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,255,255,0.06);
  transition: transform 0.18s, box-shadow 0.18s, outline 0.18s;
}
.tile-cell:hover { transform: scale(1.12); z-index: 5; box-shadow: 0 6px 18px -4px rgba(0,0,0,0.6); }
.tile-cell.selected { outline: 2px solid #fff; outline-offset: 1px; }
.tile-empty { visibility: hidden; }

/* ---------- tooltip ---------- */
.dr-tooltip {
  background: rgba(10,14,32,0.96); border: 1px solid rgba(167,139,250,0.3); border-radius: 12px;
  padding: 10px 13px; font-size: 12px; color: var(--text); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.6);
  backdrop-filter: blur(10px);
}
.dr-tooltip .tt-title { font-weight: 700; margin-bottom: 4px; }
.dr-tooltip .tt-row { color: var(--text-dim); display: flex; justify-content: space-between; gap: 14px; }

/* ---------- legend ---------- */
.legend-scale { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-faint); }
.legend-bar { height: 8px; width: 120px; border-radius: 6px; }

/* ---------- table ---------- */
.dr-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.dr-table th { text-align: left; color: var(--text-faint); font-weight: 600; font-size: 11px; text-transform: none; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; background: var(--bg-elev); }
.dr-table td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text-dim); }
.dr-table tr:hover td { background: rgba(255,255,255,0.025); color: var(--text); }

/* ---------- forms ---------- */
.field-label { font-size: 11.5px; color: var(--text-faint); margin-bottom: 6px; font-weight: 600; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: var(--text-dim); cursor: pointer; transition: all 0.18s; }
.chip:hover { border-color: rgba(167,139,250,0.4); color: var(--text); }
.chip.active { background: rgba(167,139,250,0.16); border-color: rgba(167,139,250,0.5); color: #fff; }
.chip .dot { width: 8px; height: 8px; border-radius: 50%; }

.btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, var(--purple-deep), var(--purple)); color: #fff; font-weight: 600; font-size: 12.5px;
  cursor: pointer; font-family: var(--font); transition: transform 0.15s, box-shadow 0.15s;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px -6px rgba(124,58,237,0.55); }
.btn.secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); }
.btn.secondary:hover { border-color: rgba(167,139,250,0.4); }

/* ---------- skeleton ---------- */
.skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 12px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ---------- misc ---------- */
.hairline { height: 1px; background: rgba(255,255,255,0.07); margin: 16px 0; }
.text-dim { color: var(--text-dim); }
.text-faint { color: var(--text-faint); }
.mono { font-family: var(--mono); }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-gap { display: flex; align-items: center; gap: 8px; }
.disease-badge {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 10px; border-radius: 12px;
  background: linear-gradient(135deg, rgba(167,139,250,0.18), rgba(45,212,191,0.10)); border: 1px solid rgba(167,139,250,0.25);
  font-weight: 700; font-size: 14px;
}
.icon-btn { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: var(--text-dim); cursor: pointer; transition: all 0.18s; }
.icon-btn:hover { color: #fff; border-color: rgba(167,139,250,0.4); }
.mobile-menu-btn {
  display: none;
}

.matrix-cell { transition: transform 0.15s; cursor: pointer; }
.matrix-cell:hover { transform: scale(1.15); }

.network-node { cursor: pointer; transition: r 0.15s; }
.network-node:hover { r: 9; }

@media (max-width: 900px) {
  .sidebar { position: fixed; z-index: 50; left: 0; background: rgba(5,8,22,0.98); backdrop-filter: blur(20px); }
  .sidebar:not(.mobile-open) { display: none; }
  .mobile-menu-btn {
    display: flex;
  }
  .page-wrap { padding: 18px 14px 50px 14px; }
  .topbar { padding: 12px 14px; }
}

`;
