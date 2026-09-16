import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export default function SearchableSelect({ options, value, onChange, placeholder = "Search…", renderLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-3.5 py-2.5 text-sm font-medium text-navy dark:text-white hover:border-brand/40 transition-colors shadow-sm"
      >
        <span className="truncate">{renderLabel ? renderLabel(selected) : selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full min-w-[240px] rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-navy-800 shadow-soft overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/10 px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm outline-none placeholder:text-slate-400 bg-transparent dark:text-white"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">No matches</div>
            )}
            {filtered.slice(0, 200).map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full text-left px-3.5 py-2 text-sm hover:bg-brand-50 dark:hover:bg-white/5 transition-colors ${
                  o.value === value ? "text-brand-700 dark:text-cyan font-medium bg-brand-50/60 dark:bg-white/5" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {o.label}
                {o.sub && <span className="text-slate-400 ml-1.5 text-xs">{o.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
