import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Line, ComposedChart,
} from "recharts";
import { ArrowLeftRight } from "lucide-react";
import TopBar from "../components/TopBar";
import SearchableSelect from "../components/SearchableSelect";
import { Card, PageSkeleton } from "../components/Card";
import { api } from "../api";

const REGION_COLORS = {
  "East Asia & Pacific": "#2563EB",
  "Europe & Central Asia": "#38BDF8",
  "Latin America & Caribbean": "#22D3B6",
  "Middle East & North Africa": "#A78BFA",
  "North America": "#0F172A",
  "South Asia": "#FB923C",
  "Sub-Saharan Africa": "#F472B6",
};

export default function CorrelationExplorer() {
  const { chart } = useTheme();
  const [featured, setFeatured] = useState([]);
  const [x, setX] = useState("NY.GDP.PCAP.CD");
  const [y, setY] = useState("SP.DYN.LE00.IN");
  const [data, setData] = useState(null);

  useEffect(() => {
    api.featuredIndicators().then(setFeatured);
  }, []);

  useEffect(() => {
    setData(null);
    api.correlation({ x, y }).then(setData);
  }, [x, y]);

  const options = featured.map((f) => ({ value: f.code, label: f.label, sub: f.category }));

  const regression = useMemo(() => {
    if (!data || data.slope == null) return [];
    const xs = data.points.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return [
      { x: minX, y: data.slope * minX + data.intercept },
      { x: maxX, y: data.slope * maxX + data.intercept },
    ];
  }, [data]);

  const strength = data?.r == null ? null : Math.abs(data.r);
  const strengthLabel =
    strength == null ? "" : strength > 0.7 ? "strong" : strength > 0.4 ? "moderate" : strength > 0.2 ? "weak" : "very weak";
  const direction = data?.r > 0 ? "positive" : data?.r < 0 ? "negative" : "no";

  return (
    <div className="space-y-5">
      <TopBar title="Correlation Explorer" subtitle="Is there a real relationship between two indicators, or just a coincidence?" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">X axis</label>
          <SearchableSelect options={options} value={x} onChange={setX} />
        </div>
        <button
          onClick={() => {
            setX(y);
            setY(x);
          }}
          className="mb-0.5 h-10 w-10 rounded-xl border border-slate-200 dark:border-white/10 grid place-items-center text-slate-500 dark:text-slate-400 hover:border-brand/40 hover:text-brand-600 transition-colors"
          title="Swap axes"
        >
          <ArrowLeftRight size={15} />
        </button>
        <div className="w-64">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Y axis</label>
          <SearchableSelect options={options} value={y} onChange={setY} />
        </div>
      </div>

      {!data ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Correlation (r)" value={data.r ?? "—"} />
            <Stat label="R²" value={data.r2 ?? "—"} />
            <Stat label="Countries" value={data.n} />
            <Stat label="Year" value={data.year} />
          </div>

          <Card
            title={`${data.y.name} vs. ${data.x.name}`}
            subtitle={
              data.r == null
                ? "Not enough overlapping data to compute a correlation."
                : `${strengthLabel} ${direction} relationship — as ${data.x.name.toLowerCase()} rises, ${data.y.name.toLowerCase()} tends to ${
                    data.r > 0 ? "rise" : "fall"
                  } too.`
            }
          >
            <ResponsiveContainer width="100%" height={440}>
              <ComposedChart margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid stroke={chart.grid} />
                <XAxis
                  dataKey="x" type="number" name={data.x.name} domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: chart.axis }} label={{ value: data.x.name, position: "insideBottom", offset: -6, fontSize: 11, fill: chart.axis }}
                />
                <YAxis
                  dataKey="y" type="number" name={data.y.name} domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: chart.axis }} width={60}
                  label={{ value: data.y.name, angle: -90, position: "insideLeft", fontSize: 11, fill: chart.axis }}
                />
                <ZAxis range={[40, 41]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="glass rounded-xl px-3 py-2 shadow-soft text-xs">
                        <div className="font-semibold text-navy dark:text-white">{p.name}</div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {data.x.name}: {p.x?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {data.y.name}: {p.y?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={data.points} fillOpacity={0.75}>
                  {data.points.map((p, i) => (
                    <Cell key={i} fill={REGION_COLORS[p.region] ?? "#94A3B8"} />
                  ))}
                </Scatter>
                {regression.length === 2 && (
                  <Line
                    data={regression}
                    dataKey="y"
                    stroke={chart.text}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {Object.entries(REGION_COLORS).map(([name, color]) => (
                <span key={name} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          </Card>

          <p className="text-xs text-slate-400 max-w-2xl">
            Correlation shown here is a simple linear (Pearson) fit across countries in a single year — it describes
            association, not causation, and a low R² can still hide a real but non-linear relationship (income and
            life expectancy, for instance, are famously logarithmic rather than straight-line).
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white dark:bg-navy-800 rounded-card shadow-soft border border-slate-100/80 dark:border-white/10 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-semibold text-navy dark:text-white mt-1">{value}</div>
    </div>
  );
}
