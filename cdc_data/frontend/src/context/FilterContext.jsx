/* =========================================================================
   APP CONTEXT — shared filter state across all pages.
   Moved verbatim from App.jsx during the modularization refactor (was the
   "APP CONTEXT" section). Kept as its own module — rather than folded into
   App.jsx — specifically to avoid a circular import: App.jsx composes the
   pages, and every page (plus Layout.jsx) needs useFilters(), so the
   context itself has to live somewhere neither of those import from.
   No state shape, initial values, or behavior were changed.
   ========================================================================= */

import { useState, useEffect, createContext, useContext } from "react";
import { TOP_DISEASES } from "../api.js";
import { currentDefaultYearWeek, yearMaxWeek } from "../utils/analytics.js";

const FilterContext = createContext(null);
export function useFilters() {
  return useContext(FilterContext);
}

export function FilterProvider({ children }) {
  // Lazy initializers run once, on first mount — by then bootstrap has resolved
  // (DiseaseRadarRoot only mounts FilterProvider after DATA is populated).
  const [disease, setDisease] = useState(TOP_DISEASES[0]);
  const [year, setYear] = useState(() => currentDefaultYearWeek().year);
  const [week, setWeek] = useState(() => currentDefaultYearWeek().week);
  const [state, setState] = useState("California");
  const [metric, setMetric] = useState("cases"); // cases | incidence | anomaly | growth

  const [page, setPage] = useState("overview");

  useEffect(() => {
    const maxWeek = yearMaxWeek(year);
    if (week > maxWeek) {
      setWeek(maxWeek);
    }
  }, [year, week]);

  const value = {
    disease, setDisease, year, setYear, week, setWeek, state, setState,
    metric, setMetric, page, setPage,
  };
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}
