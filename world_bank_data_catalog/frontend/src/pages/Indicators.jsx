import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import TopBar from "../components/TopBar";
import { api } from "../api";
import { PageSkeleton } from "../components/Card";

export default function Indicators() {
  const [params] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState(params.get("q") || "");
  const [resp, setResp] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.indicatorCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, category]);

  useEffect(() => {
    api.indicators({ search: q || undefined, category, page, page_size: 24 }).then(setResp);
  }, [q, category, page]);

  return (
    <div className="space-y-5">
      <TopBar title="Indicator Explorer" subtitle="Browse the full World Bank WDI catalog" />

      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by keyword…"
          className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-3.5 py-2.5 text-sm outline-none focus:border-brand/50 shadow-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", ...categories.map((c) => c.name)].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              category === c ? "bg-navy text-white border-navy" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300"
            }`}
          >
            {c}
            {c !== "All" && (
              <span className="ml-1 opacity-60">
                {categories.find((x) => x.name === c)?.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {!resp ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resp.results.map((ind, i) => (
              <motion.div
                key={ind.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
                className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-100/80 dark:border-white/10 shadow-soft p-4"
              >
                <div className="text-[11px] font-medium text-brand-600 mb-1">{ind.category}</div>
                <div className="text-sm font-semibold text-navy dark:text-white leading-snug">{ind.name}</div>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{ind.unit || ind.code}</span>
                  <span>{ind.countries_covered} economies</span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {resp.total.toLocaleString()} indicators total
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page * 24 >= resp.total}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
