import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import TopBar from "../components/TopBar";
import { api } from "../api";
import { PageSkeleton } from "../components/Card";
import { flagUrl } from "../utils/iso";
import { useSettings } from "../context/SettingsContext";

const REGIONS = [
  { code: "", label: "All regions" },
  { code: "EAS", label: "East Asia & Pacific" },
  { code: "ECA", label: "Europe & Central Asia" },
  { code: "LCN", label: "Latin America & Caribbean" },
  { code: "MEA", label: "Middle East & North Africa" },
  { code: "NAC", label: "North America" },
  { code: "SAS", label: "South Asia" },
  { code: "SSF", label: "Sub-Saharan Africa" },
];

export default function CountriesList() {
  const { settings } = useSettings();
  const [countries, setCountries] = useState(null);
  const [region, setRegion] = useState(settings.defaultRegion || "");
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.countries({ region: region || undefined, search: q || undefined }).then(setCountries);
  }, [region, q]);

  if (!countries) return <PageSkeleton />;

  return (
    <div>
      <TopBar title="Countries" subtitle={`${countries.length} economies in the atlas`} />

      <div className="flex flex-wrap gap-2 mb-5">
        {REGIONS.map((r) => (
          <button
            key={r.code}
            onClick={() => setRegion(r.code)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              region === r.code
                ? "bg-navy text-white border-navy"
                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300"
            }`}
          >
            {r.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name…"
          className="ml-auto rounded-full border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-white px-3.5 py-1.5 text-xs outline-none focus:border-brand/50"
        />
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {countries.map((c, i) => (
          <motion.button
            key={c.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.4) }}
            whileHover={{ y: -3 }}
            onClick={() => navigate(`/countries/${c.code}`)}
            className="text-left bg-white dark:bg-navy-800 rounded-2xl border border-slate-100/80 dark:border-white/10 shadow-soft p-4 hover:shadow-glow transition-shadow"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <img
                src={flagUrl(c.code)}
                alt=""
                className="h-5 w-7 object-cover rounded-sm shadow-sm"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <span className="font-semibold text-navy dark:text-white text-sm truncate">{c.name}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.region}</div>
            <div className="text-[11px] mt-2 inline-block px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand/15 text-brand-700 dark:text-cyan font-medium">
              {c.income_group}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
