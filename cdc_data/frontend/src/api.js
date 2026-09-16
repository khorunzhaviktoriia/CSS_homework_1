import { useEffect, useReducer } from "react";

/* =========================================================================
   API CLIENT + REACTIVE DATA STORE

   The backend does the heavy lifting of loading and aggregating the full
   ~1.6M-row NNDSS CSV. This module fetches from it and exposes a small
   mutable store that the rest of the app reads synchronously (so the
   analytics code doesn't need to be async-aware), plus hooks that trigger
   on-demand fetches for diseases outside the bootstrap's top-N bundle.
   ========================================================================= */

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// Mutable module-level store. `DATA` starts null; DiseaseRadarRoot renders a
// loading screen until the bootstrap fetch populates it.
export let DATA = null;
export let YEARS = null;
export let NWEEKS = null;
export let ALL_DISEASES = null;
export let TOP_DISEASES = null;
export let MAP_STATES = null;
export let STATE_GRID = null;
export let POPULATION = null;

function applyBootstrap(json) {
  DATA = json;
  YEARS = json.years;
  NWEEKS = json.weeksPerYear;
  ALL_DISEASES = json.diseases;
  TOP_DISEASES = json.topDiseases;
  MAP_STATES = json.mapStates;
  STATE_GRID = json.stateGrid;
  POPULATION = json.population;
}

export async function fetchBootstrap() {
  const res = await fetch(`${API_BASE}/api/bootstrap`);
  if (!res.ok) throw new Error(`Backend returned ${res.status} for /api/bootstrap`);
  const json = await res.json();
  applyBootstrap(json);
  return json;
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Backend health check failed (${res.status})`);
  return res.json();
}

/* ---------- pub/sub so components can re-render when on-demand data arrives ---------- */

const listeners = new Set();
function notify() {
  listeners.forEach((l) => l());
}
export function useStoreVersion() {
  const [, forceTick] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(forceTick);
    return () => listeners.delete(forceTick);
  }, []);
}

/* ---------- on-demand per-disease state detail (for diseases outside the
   bootstrap's top-N bundle, e.g. found via search) ---------- */

const inFlight = new Set();

export function useEnsureStateDetail(label) {
  useStoreVersion();
  useEffect(() => {
    if (!label || !DATA) return;
    if (DATA.stateDetail[label] !== undefined) return;
    if (inFlight.has(label)) return;
    inFlight.add(label);
    fetch(`${API_BASE}/api/disease/states?label=${encodeURIComponent(label)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((states) => {
        DATA.stateDetail[label] = states || {};
      })
      .catch(() => {
        DATA.stateDetail[label] = {};
      })
      .finally(() => {
        inFlight.delete(label);
        notify();
      });
  }, [label]);

  const loaded = DATA && DATA.stateDetail[label] !== undefined;
  return { loading: !loaded, data: loaded ? DATA.stateDetail[label] : null };
}

export function useEnsureCompleteness(label) {
  useStoreVersion();
  useEffect(() => {
    if (!label || !DATA) return;
    if (DATA.completeness[label] !== undefined) return;
    const key = `completeness:${label}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    fetch(`${API_BASE}/api/disease/completeness?label=${encodeURIComponent(label)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((c) => {
        DATA.completeness[label] = c || {};
      })
      .catch(() => {
        DATA.completeness[label] = {};
      })
      .finally(() => {
        inFlight.delete(key);
        notify();
      });
  }, [label]);
}
