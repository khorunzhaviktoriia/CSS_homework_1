import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import TopBar from "../components/TopBar";
import { Card, PageSkeleton } from "../components/Card";
import { api } from "../api";
import { flagUrl } from "../utils/iso";

export default function Insights() {
  const { chart } = useTheme();
  const [data, setData] = useState(null);
  const [conv, setConv] = useState(null);

  useEffect(() => {
    api.insights({ base_year: 2000 }).then(setData);
    api.convergence().then(setConv);
  }, []);

  if (!data) return <PageSkeleton />;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <TopBar title="Insights" subtitle={`Story-driven highlights since ${data.base_year} — each card uses its own latest well-covered year`} />
      </div>
      <p className="text-xs text-slate-400 -mt-4 max-w-2xl">
        GDP per capita is ranked by <strong>% growth</strong>, not dollar amount — ranking by raw dollars would just
        surface already-rich micro-economies (Luxembourg, Ireland, Switzerland) getting richer, which isn't really a
        "fastest-growing" story. The other three cards use absolute change since their units (years, tCO2/capita,
        percentage points) are already directly comparable across countries.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {data.cards.map((card, ci) => (
          <Card key={card.id} title={card.title} subtitle={`${card.indicator.name} · ${card.base_year} → ${card.year}`} delay={ci * 0.05}>
            <div className="space-y-3">
              {card.items.map((item, i) => (
                <motion.div
                  key={item.code}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3"
                >
                  <img src={flagUrl(item.code)} className="h-4 w-6 rounded-sm object-cover" alt="" />
                  <span className="text-sm font-medium text-navy dark:text-white flex-1 truncate">{item.name}</span>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold ${
                      card.id === "co2_down"
                        ? item.delta <= 0
                          ? "text-emerald-600"
                          : "text-rose-500"
                        : item.delta >= 0
                          ? "text-emerald-600"
                          : "text-rose-500"
                    }`}
                  >
                    {item.delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {item.delta >= 0 ? "+" : ""}
                    {item.delta.toFixed(1)}
                    {card.mode === "percent" ? "%" : ""}
                  </span>
                </motion.div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {conv && (
        <Card
          title="Is cross-country income dispersion narrowing or widening?"
          subtitle={`${conv.indicator.name} across ${conv.series.at(-1)?.countries ?? ""} countries, ${conv.series[0]?.year ?? ""}–${conv.series.at(-1)?.year ?? ""}`}
          delay={0.2}
        >
          {conv.trend && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {conv.trend.statement}{" "}
              <span className={`font-semibold ${conv.trend.direction === "narrowing" ? "text-emerald-600" : "text-rose-500"}`}>
                Log-dispersion {conv.trend.direction} {Math.abs(conv.trend.log_dispersion_change_pct)}%
              </span>{" "}
              between {conv.trend.from_year} and {conv.trend.to_year}, using the {conv.trend.countries_in_sample}{" "}
              countries that reported in both years.
            </p>
          )}
          <p className="text-xs text-slate-400 mb-4">{conv.methodology}</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                std(log GDP per capita) — primary measure, robust to skew
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={conv.series} margin={{ left: -16 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: chart.axis }} tickLine={false} axisLine={false} minTickGap={50} />
                  <YAxis tick={{ fontSize: 10, fill: chart.axis }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.text, fontSize: 12 }} />
                  <Line type="monotone" dataKey="log_dispersion" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Coefficient of variation — secondary, more familiar measure
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={conv.series} margin={{ left: -16 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: chart.axis }} tickLine={false} axisLine={false} minTickGap={50} />
                  <YAxis tick={{ fontSize: 10, fill: chart.axis }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.text, fontSize: 12 }} />
                  <Line type="monotone" dataKey="coefficient_of_variation" stroke="#F97316" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
