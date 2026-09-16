import { NavLink } from "react-router-dom";
import {
  LayoutGrid, Globe2, GitCompareArrows, ListTree, Trophy, Sparkles,
  Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen, Sun, Moon, ScatterChart,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/countries", label: "Countries", icon: Globe2 },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/correlate", label: "Correlate", icon: ScatterChart },
  { to: "/indicators", label: "Indicators", icon: ListTree },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/insights", label: "Insights", icon: Sparkles },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { dark, toggleDark } = useTheme();

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 bg-navy-900 text-slate-200 transition-all duration-300 ${
        collapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand to-cyan grid place-items-center shrink-0">
          <Globe2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold tracking-tight text-white text-[15px] whitespace-nowrap">
            Global Development Atlas
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`
            }
            title={collapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <span
                  className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center transition-colors ${
                    isActive ? "bg-gradient-to-br from-brand to-cyan text-white" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  <Icon size={17} />
                </span>
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-colors"
        >
          <span className="h-8 w-8 shrink-0 rounded-lg grid place-items-center">
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </span>
          {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            }`
          }
        >
          <span className="h-8 w-8 shrink-0 rounded-lg grid place-items-center">
            <SettingsIcon size={17} />
          </span>
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors"
        >
          <span className="h-8 w-8 shrink-0 rounded-lg grid place-items-center">
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
