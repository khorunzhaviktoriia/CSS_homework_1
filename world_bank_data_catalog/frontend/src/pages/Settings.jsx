import { useEffect, useState } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import TopBar from "../components/TopBar";
import { Card } from "../components/Card";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { api } from "../api";

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

export default function Settings() {
  const { setAppearance } = useTheme();
  const { settings, setSettings } = useSettings();
  const [countries, setCountries] = useState([]);
  const [savedAppearance, setSavedAppearance] = useState(
    localStorage.getItem("gda:appearance") || "system"
  );

  useEffect(() => {
    api.countries().then(setCountries);
  }, []);

  function chooseAppearance(mode) {
    setAppearance(mode);
    setSavedAppearance(mode);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <TopBar title="Settings" subtitle="These preferences are saved in this browser and used across the app" />

      <Card title="Appearance">
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: "light", label: "Light", icon: Sun },
            { v: "dark", label: "Dark", icon: Moon },
            { v: "system", label: "System", icon: Laptop },
          ].map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => chooseAppearance(v)}
              className={`flex flex-col items-center gap-2 rounded-xl border py-4 transition-colors ${
                savedAppearance === v
                  ? "border-brand bg-brand-50 dark:bg-brand/10 text-brand-700 dark:text-cyan"
                  : "border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              <Icon size={18} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Default comparison group" subtitle="Used to pre-filter Rankings and Countries">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Default region</label>
        <select
          value={settings.defaultRegion}
          onChange={(e) => setSettings({ defaultRegion: e.target.value })}
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 dark:bg-navy-900 dark:text-white px-3.5 py-2.5 text-sm outline-none focus:border-brand/50"
        >
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </Card>

      <Card title="Default country" subtitle="Pre-filled as “Country A” on the Compare page">
        <select
          value={settings.defaultCountry}
          onChange={(e) => setSettings({ defaultCountry: e.target.value })}
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 dark:bg-navy-900 dark:text-white px-3.5 py-2.5 text-sm outline-none focus:border-brand/50"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </Card>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Check size={13} className="text-emerald-500" />
        Changes save automatically to this browser (localStorage) — no account needed.
      </div>
    </div>
  );
}
