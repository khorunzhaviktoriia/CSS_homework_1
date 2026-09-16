const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path, params = {}) {
  const usp = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const qs = usp.toString();
  const res = await fetch(`${BASE_URL}${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  meta: () => get("/api/meta"),
  countries: (params) => get("/api/countries", params),
  featuredIndicators: () => get("/api/featured-indicators"),
  allIndicators: () => get("/api/all-indicators"),
  indicators: (params) => get("/api/indicators", params),
  indicatorCategories: () => get("/api/indicator-categories"),
  mapData: (indicator, year) => get("/api/map-data", { indicator, year }),
  countryDetail: (code) => get(`/api/country/${code}`),
  countrySeries: (code, indicator) => get(`/api/country/${code}/series`, { indicator }),
  compare: (a, b, indicators) => get("/api/compare", { a, b, indicators }),
  compareSeries: (a, b, indicator) => get("/api/compare-series", { a, b, indicator }),
  rankings: (params) => get("/api/rankings", params),
  search: (q) => get("/api/search", { q }),
  insights: (params) => get("/api/insights", params),
  correlation: (params) => get("/api/correlation", params),
  convergence: (params) => get("/api/convergence", params),
};

export { BASE_URL };
