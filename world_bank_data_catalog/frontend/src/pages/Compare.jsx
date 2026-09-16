import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api } from "../api";
import TopBar from "../components/TopBar";
import SearchableSelect from "../components/SearchableSelect";
import { Card, PageSkeleton } from "../components/Card";
import { flagUrl } from "../utils/iso";
import { useSettings } from "../context/SettingsContext";

export default function Compare() {
  const { chart } = useTheme();
  const { settings } = useSettings();
  const [countries, setCountries] = useState([]);
  const [a, setA] = useState(settings.defaultCountry || "UKR");
  const [b, setB] = useState("POL");
  const [data, setData] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [chartIndicator, setChartIndicator] = useState("NY.GDP.PCAP.CD");
  const [seriesData, setSeriesData] = useState(null);

  useEffect(() => {
    api.countries().then(setCountries);
    api.allIndicators().then(setIndicators);
  }, []);

  useEffect(() => {
    if (a && b && a !== b) api.compare(a, b).then(setData);
  }, [a, b]);

  useEffect(() => {
    if (!a || !b || a === b || !chartIndicator) return;

    setSeriesData(null);

    api.compareSeries(a, b, chartIndicator)
      .then(setSeriesData)
      .catch(() => setSeriesData(false));
  }, [a, b, chartIndicator]);

  const options = countries.map((c) => ({ value: c.code, label: c.name }));
  const indicatorOptions = indicators.map((i) => ({
    value: i.code,
    label: i.name,
    sub: i.code,
  }));
  const nameA = countries.find((c) => c.code === a)?.name;
  const nameB = countries.find((c) => c.code === b)?.name;

  return (
    <div className="space-y-6">
      <TopBar title="Compare Countries" subtitle="Put two economies side by side across key indicators" />

      <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Country A</label>
          <SearchableSelect options={options} value={a} onChange={setA} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Country B</label>
          <SearchableSelect options={options} value={b} onChange={setB} />
        </div>
      </div>

      <div className="max-w-xl">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
          Time-series indicator
        </label>

        <SearchableSelect
          options={indicatorOptions}
          value={chartIndicator}
          onChange={setChartIndicator}
          placeholder="Search any World Bank indicator..."
          renderLabel={(option) => option?.label ?? "Select indicator"}
        />
      </div>

      {a === b && <p className="text-sm text-amber-600">Pick two different countries to compare.</p>}

      {data && a !== b && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <CountryHeader code={a} name={nameA} region={data.country_a.region} income={data.country_a.income_group} />
            <CountryHeader code={b} name={nameB} region={data.country_b.region} income={data.country_b.income_group} />
          </div>

          <Card title="Indicator comparison" subtitle="Each row uses the latest year both countries have data for" delay={0.1}>
            <div className="divide-y divide-slate-100">
              {data.rows.map((r) => (
                <div key={r.code} className="grid grid-cols-3 items-center py-3 text-sm gap-2">
                  <div className="text-right font-medium text-navy dark:text-white">{r.no_common_data ? "—" : fmt(r.a)}</div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400">{r.name}</div>
                    {r.no_common_data ? (
                      <div className="text-[11px] text-amber-600 mt-0.5">No comparable data</div>
                    ) : (
                      <>
                        <Delta a={r.a} b={r.b} />
                        <div className="text-[10px] text-slate-400 mt-0.5">{r.year}</div>
                      </>
                    )}
                  </div>
                  <div className="text-left font-medium text-navy dark:text-white">{r.no_common_data ? "—" : fmt(r.b)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title={
              seriesData && seriesData !== false
                ? `${seriesData.indicator.name} over time`
                : "Indicator over time"
            }
            subtitle={
              seriesData && seriesData !== false
                ? seriesData.indicator.unit
                : "Choose any World Bank indicator"
            }
            delay={0.15}
          >
            {seriesData === null ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">
                Loading indicator data...
              </div>
            ) : seriesData === false ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">
                Could not load this indicator.
              </div>
            ) : seriesData.a.length === 0 && seriesData.b.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">
                No historical data available for either country.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart margin={{ left: -10 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />

                  <XAxis
                    dataKey="year"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tick={{ fontSize: 11, fill: chart.axis }}
                    allowDuplicatedCategory={false}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: chart.axis }}
                    width={60}
                  />

                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number"
                        ? value.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : value
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${chart.tooltipBorder}`,
                      background: chart.tooltipBg,
                      color: chart.text,
                      fontSize: 12,
                    }}
                  />

                  <Legend />

                  <Line
                    data={seriesData.a}
                    dataKey="value"
                    name={nameA}
                    stroke="#2563EB"
                    dot={false}
                    strokeWidth={2.5}
                    connectNulls={false}
                  />

                  <Line
                    data={seriesData.b}
                    dataKey="value"
                    name={nameB}
                    stroke="#38BDF8"
                    dot={false}
                    strokeWidth={2.5}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function CountryHeader({ code, name, region, income }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 bg-white dark:bg-navy-800 rounded-card shadow-soft border border-slate-100/80 dark:border-white/10 p-4">
      <img src={flagUrl(code, 80)} className="h-10 w-14 rounded-lg object-cover shadow-sm" alt="" />
      <div>
        <div className="font-semibold text-navy dark:text-white">{name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{region} · {income}</div>
      </div>
    </motion.div>
  );
}

function Delta({ a, b }) {
  if (a == null || b == null) return <Minus size={13} className="text-slate-300 mx-auto mt-1" />;
  if (a === b) return <Minus size={13} className="text-slate-400 mx-auto mt-1" />;
  const aHigher = a > b;
  // Deliberately neutral (not green/red): whether a higher number is
  // "better" depends on the indicator (CO2, mortality, poverty are lower-
  // is-better), so color-coding this as good/bad would be misleading.
  return (
    <div className="flex items-center justify-center gap-1 text-[11px] font-medium mt-1 text-slate-500 dark:text-slate-400">
      {aHigher ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(((a - b) / (b || 1)) * 100).toFixed(0)}%
    </div>
  );
}

function fmt(v) {
  return v === null || v === undefined ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}


