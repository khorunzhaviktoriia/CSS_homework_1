import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import TopBar from "../components/TopBar";
import SearchableSelect from "../components/SearchableSelect";
import { Card, PageSkeleton } from "../components/Card";
import { api } from "../api";
import { flagUrl } from "../utils/iso";
import { useSettings } from "../context/SettingsContext";
import { formatByIndicator } from "../utils/format";

const REGIONS = [
  { value: "", label: "All regions" },
  { value: "EAS", label: "East Asia & Pacific" },
  { value: "ECA", label: "Europe & Central Asia" },
  { value: "LCN", label: "Latin America & Caribbean" },
  { value: "MEA", label: "Middle East & North Africa" },
  { value: "NAC", label: "North America" },
  { value: "SAS", label: "South Asia" },
  { value: "SSF", label: "Sub-Saharan Africa" },
];

export default function Rankings() {
  const { chart } = useTheme();
  const { settings } = useSettings();
  const [featured, setFeatured] = useState([]);
  const [indicator, setIndicator] = useState("NY.GDP.PCAP.CD");
  const [region, setRegion] = useState(settings.defaultRegion || "");
  const [order, setOrder] = useState("desc");
  const [resp, setResp] = useState(null);

  useEffect(() => {
    api.featuredIndicators().then(setFeatured);
  }, []);

  useEffect(() => {
    api.rankings({ indicator, region: region || undefined, order, limit: 15 }).then(setResp);
  }, [indicator, region, order]);

  const currentIndicator = featured.find((f) => f.code === indicator);

  return (
    <div className="space-y-5">
      <TopBar title="Global Rankings" subtitle="Compare economies by indicator value and region." />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Indicator</label>
          <SearchableSelect
            options={featured.map((f) => ({ value: f.code, label: f.label, sub: f.category }))}
            value={indicator}
            onChange={setIndicator}
          />
        </div>
        <div className="w-56">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Region</label>
          <SearchableSelect options={REGIONS} value={region} onChange={setRegion} />
        </div>
        <div className="flex gap-1.5 pb-0.5">
          {[
            { v: "desc", l: "Highest" },
            { v: "asc", l: "Lowest" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setOrder(o.v)}
              className={`text-xs font-medium px-3.5 py-2.5 rounded-xl border transition-colors ${
                order === o.v ? "bg-navy text-white border-navy" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {!resp ? (
        <PageSkeleton />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title={`${order === "desc" ? "Highest" : "Lowest"} ${resp.results.length} — ${currentIndicator?.label}`} subtitle={`${resp.year}`}>
            {currentIndicator?.direction && currentIndicator.direction !== "neutral"
            }
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={resp.results} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} stroke={chart.grid} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: chart.axis }} />
                <Tooltip
                  formatter={(v) => formatByIndicator(v, currentIndicator)}
                  contentStyle={{ borderRadius: 12, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.text, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill={order === "desc" ? "#2563EB" : "#F97316"} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Ranked list">
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {resp.results.map((r) => (
                <motion.div
                  key={r.code}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="w-6 text-xs font-semibold text-slate-400">{r.rank}</span>
                  <img src={flagUrl(r.code)} className="h-4 w-6 rounded-sm object-cover" alt="" />
                  <span className="text-sm font-medium text-navy dark:text-white flex-1 truncate">{r.name}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{formatByIndicator(r.value, currentIndicator)}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
