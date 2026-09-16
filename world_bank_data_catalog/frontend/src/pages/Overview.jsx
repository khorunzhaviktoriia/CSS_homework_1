import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";
import { Globe2, Database, CalendarRange, ListTree, Clock } from "lucide-react";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import WorldMap from "../components/WorldMap";
import SearchableSelect from "../components/SearchableSelect";
import { Card, PageSkeleton } from "../components/Card";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { formatByIndicator } from "../utils/format";

const PIE_COLORS = ["#2563EB", "#38BDF8", "#22D3B6", "#A78BFA", "#FB923C", "#F472B6", "#94A3B8"];

export default function Overview() {
  const { chart } = useTheme();
  const [meta, setMeta] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [allIndicators, setAllIndicators] = useState([]);
  const [indicator, setIndicator] = useState("NY.GDP.PCAP.CD");
  const [year, setYear] = useState(null);
  const [mapResp, setMapResp] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.meta(), api.featuredIndicators(), api.allIndicators()]).then(([m, f, all]) => {
      setMeta(m);
      setFeatured(f);
      setAllIndicators(all);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // Reset to the backend's own best-year pick for this indicator instead
    // of carrying over whatever year was selected for the previous one.
    api.mapData(indicator).then((d) => {
      setMapResp(d);
      setYear(d.year);
      // Rankings use the SAME year the map just settled on, so the two
      // never silently show different years for the same indicator.
      api.rankings({ indicator, year: d.year, order: "desc", limit: 8 }).then(setRankings);
    });
  }, [indicator]);

  function onYearCommit(newYear) {
    api.mapData(indicator, newYear).then(setMapResp);
    api.rankings({ indicator, year: newYear, order: "desc", limit: 8 }).then(setRankings);
  }

  const years = useMemo(() => {
    if (!meta) return [];
    const arr = [];
    for (let y = meta.year_start; y <= meta.year_end; y++) arr.push(y);
    return arr;
  }, [meta]);

  const currentIndicator =
    featured.find((f) => f.code === indicator) ||
    allIndicators.find((f) => f.code === indicator);
  const currentLabel = currentIndicator?.label ?? currentIndicator?.name ?? indicator;

  const regionPie = useMemo(() => {
    if (!rankings) return [];
    const counts = {};
    rankings.results.forEach((r) => {
      counts[r.region] = (counts[r.region] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rankings]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-card bg-gradient-to-br from-navy-900 via-navy to-brand-700 text-white p-8 flex flex-col justify-between shadow-soft"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan bg-white/10 rounded-full px-3 py-1">
              World Bank · World Development Indicators
            </span>
            <h1 className="font-display text-3xl md:text-[2.4rem] leading-[1.15] mt-4 max-w-md">
              Benchmark countries, uncover development gaps.
            </h1>
            <p className="text-slate-300 mt-3 max-w-sm text-[15px]">
              {meta.countries} countries, {meta.indicators.toLocaleString()} World Bank indicators,{" "}
              {meta.year_start}–{meta.year_end}. Built for exploratory benchmarking, trend analysis and cross-country comparisons.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-8">
            {featured.slice(0, 5).map((f) => (
              <button
                key={f.code}
                onClick={() => setIndicator(f.code)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  indicator === f.code
                    ? "bg-white dark:bg-navy-800 text-navy dark:text-white border-white"
                    : "border-white/25 text-slate-200 hover:border-white/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-card bg-white dark:bg-navy-800 shadow-soft border border-slate-100/80 dark:border-white/10 p-4 flex flex-col"
        >
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="w-72">
              <SearchableSelect
                options={allIndicators.map((f) => ({ value: f.code, label: f.name, sub: f.category }))}
                value={indicator}
                onChange={setIndicator}
                placeholder="Search any of 1,498 indicators…"
              />
            </div>
            {mapResp && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing <span className="font-medium text-navy dark:text-white">{mapResp.year}</span> ·{" "}
                {currentIndicator?.unit}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-[280px]">
            {mapResp && <WorldMap values={mapResp.values} unit={currentIndicator?.unit ?? ""} />}
          </div>
          {years.length > 0 && (
            <div className="px-1 pt-2">
              <input
                type="range"
                min={meta.year_start}
                max={meta.year_end}
                value={year ?? meta.year_end}
                onChange={(e) => setYear(Number(e.target.value))}
                onMouseUp={(e) => onYearCommit(e.target.value)}
                onTouchEnd={(e) => onYearCommit(e.target.value)}
                className="w-full accent-brand"
              />
              <div className="flex justify-between text-[11px] text-slate-400 px-0.5">
                <span>{meta.year_start}</span>
                <span className="font-medium text-brand-700">{year}</span>
                <span>{meta.year_end}</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Countries" value={meta.countries} icon={Globe2} delay={0.05} />
        <KpiCard label="Indicators" value={meta.indicators} icon={ListTree} delay={0.1} />
        <KpiCard label="Years covered" value={meta.year_end - meta.year_start + 1} icon={CalendarRange} delay={0.15} />
        <KpiCard label="Dataset size" value={meta.dataset_size_mb} suffix=" MB" icon={Database} delay={0.2} />
        <KpiCard label="Data through" value={meta.latest_observation_year} icon={Clock} delay={0.25} plain />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={`Highest 8 — ${currentLabel}`} subtitle={rankings ? `${rankings.year}` : undefined} className="lg:col-span-2" delay={0.1}>
          {rankings && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rankings.results} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} stroke={chart.grid} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12, fill: chart.axis }} />
                <Tooltip
                  formatter={(v) => formatByIndicator(v, currentIndicator)}
                  contentStyle={{ borderRadius: 12, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.text, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#2563EB" animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Regional mix (highest 8)" subtitle="Regions represented among highest-value economies" delay={0.15}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={regionPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {regionPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.text, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
