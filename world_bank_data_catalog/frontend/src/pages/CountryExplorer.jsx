import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ArrowLeft, Info } from "lucide-react";
import { api } from "../api";
import { Card, PageSkeleton } from "../components/Card";
import SearchableSelect from "../components/SearchableSelect";
import { flagUrl } from "../utils/iso";

export default function CountryExplorer() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [selectedIndicator, setSelectedIndicator] = useState("EG.ELC.ACCS.ZS");
  const [customSeries, setCustomSeries] = useState(null);

  useEffect(() => {
    setData(null);
    api.countryDetail(code).then(setData).catch(() => setData(false));
  }, [code]);

  useEffect(() => {
    api.allIndicators().then(setIndicators);
  }, []);

  useEffect(() => {
    if (!code || !selectedIndicator) return;

    setCustomSeries(null);

    api.countrySeries(code, selectedIndicator)
      .then(setCustomSeries)
      .catch(() => setCustomSeries(false));
  }, [code, selectedIndicator]);


  if (data === false) return <div className="text-slate-500 dark:text-slate-400">Country not found.</div>;
  if (!data) return <PageSkeleton />;

  const { country, kpis, charts } = data;
  const indicatorOptions = indicators.map((i) => ({
    value: i.code,
    label: i.name,
    sub: i.code,
  }));

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/countries")}
        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-navy dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} /> All countries
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-card bg-gradient-to-br from-navy-900 to-brand-700 text-white p-7 flex items-center gap-5"
      >
        <img src={flagUrl(country.code, 80)} alt="" className="h-14 w-20 object-cover rounded-lg shadow-lg" />
        <div>
          <h1 className="font-display text-2xl">{country.name}</h1>
          <p className="text-slate-300 text-sm mt-1">
            {country.region} · {country.income_group}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.values(kpis).map((k, i) => (
          <motion.div
            key={k.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-white dark:bg-navy-800 rounded-card shadow-soft border border-slate-100/80 dark:border-white/10 p-4"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
              <span className="truncate">{k.name}</span>

              {(k.footnote || k.source) && (
                <span
                  title={[k.footnote, k.source && `Source: ${k.source}`]
                    .filter(Boolean)
                    .join("\n")}
                  className="text-slate-300 hover:text-brand-600 shrink-0 cursor-help"
                >
                  <Info size={11} />
                </span>
              )}
            </div>

            <div className="text-xl font-semibold text-navy dark:text-white mt-1">
              {k.latest
                ? k.latest.value.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })
                : "—"}
            </div>

            {k.latest && (
              <div className="text-[11px] text-slate-400">
                {k.latest.year}
              </div>
            )}
          </motion.div>
        ))}
      </div>


      <Card title="GDP per capita over time" delay={0.1}>
        <MiniLine data={charts.gdp_per_capita} color="#2563EB" />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Population over time" delay={0.1}>
          <MiniLine data={charts.population} color="#38BDF8" />
        </Card>
        <Card title="Life expectancy" delay={0.15}>
          <MiniLine data={charts.life_expectancy} color="#22D3B6" />
        </Card>

        <Card
          title={
            customSeries && customSeries !== false
              ? customSeries.indicator.name
              : "Explore another indicator"
          }
          subtitle={
            customSeries && customSeries !== false
              ? customSeries.indicator.unit
              : "Choose any World Bank indicator to explore for this country"
          }
          delay={0.2}
        >
          <div className="max-w-xl mb-5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
              Indicator
            </label>

            <SearchableSelect
              options={indicatorOptions}
              value={selectedIndicator}
              onChange={setSelectedIndicator}
              placeholder="Search any World Bank indicator..."
              renderLabel={(option) => option?.label ?? "Select indicator"}
            />
          </div>

          {customSeries === null ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              Loading indicator data...
            </div>
          ) : customSeries === false ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              Could not load this indicator.
            </div>
          ) : customSeries.series.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              No historical data available for {country.name}.
            </div>
          ) : (
            <MiniLine
              data={customSeries.series}
              color="#8B5CF6"
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniLine({ data, color }) {
  const { chart } = useTheme();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0 }}>
        <CartesianGrid stroke={chart.grid} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: chart.axis }} tickLine={false} axisLine={false}
               minTickGap={40} />
        <YAxis
          tick={{ fontSize: 11, fill: chart.axis }}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v) => {
            if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
            if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
            return v;
          }}
        />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v)}
          contentStyle={{ borderRadius: 12, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.text, fontSize: 12 }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false}
              animationDuration={1000} />
      </LineChart>
    </ResponsiveContainer>
  );
}

