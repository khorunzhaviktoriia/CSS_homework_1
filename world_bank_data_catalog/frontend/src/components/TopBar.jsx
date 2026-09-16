import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { api } from "../api";

export default function TopBar({ title, subtitle }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults(null));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex items-center justify-between gap-6 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-navy dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-3.5 py-2.5 shadow-sm">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search countries or indicators…"
            className="w-full text-sm outline-none placeholder:text-slate-400 bg-transparent dark:text-white"
          />
          {q && (
            <button onClick={() => setQ("")}>
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>

        {results && (results.countries.length > 0 || results.indicators.length > 0) && (
          <div className="absolute z-40 mt-2 w-full rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-navy-800 shadow-soft overflow-hidden">
            {results.countries.length > 0 && (
              <div className="py-1.5">
                <div className="px-3.5 pt-1 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  Countries
                </div>
                {results.countries.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      navigate(`/countries/${c.code}`);
                      setQ("");
                      setResults(null);
                    }}
                    className="w-full text-left px-3.5 py-2 text-sm hover:bg-brand-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
                  >
                    {c.name} <span className="text-slate-400 text-xs">{c.region}</span>
                  </button>
                ))}
              </div>
            )}
            {results.indicators.length > 0 && (
              <div className="py-1.5 border-t border-slate-100">
                <div className="px-3.5 pt-1 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  Indicators
                </div>
                {results.indicators.map((i) => (
                  <button
                    key={i.code}
                    onClick={() => {
                      navigate(`/indicators?q=${encodeURIComponent(i.name)}`);
                      setQ("");
                      setResults(null);
                    }}
                    className="w-full text-left px-3.5 py-2 text-sm hover:bg-brand-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
                  >
                    {i.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
