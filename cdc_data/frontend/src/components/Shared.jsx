/* =========================================================================
   SHARED COMPONENTS — small building blocks used across every page.
   Moved verbatim from App.jsx during the modularization refactor (was the
   "SHARED SMALL COMPONENTS" section, plus ChartTooltip and MultiTooltip,
   which lived inside the Disease Explorer / Trend Analysis page sections
   respectively but are also used by other pages — moved here rather than
   duplicated, with no changes to their logic or output).
   ========================================================================= */

import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { fmt, pct } from "../utils/analytics.js";

export function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef();
  const startRef = useRef();
  useEffect(() => {
    startRef.current = null;
    const from = 0;
    const to = target == null || Number.isNaN(target) ? 0 : target;
    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

export function Glass({ children, className = "", style = {}, onClick, hover = true }) {
  return (
    <div
      onClick={onClick}
      className={`glass-card ${hover ? "glass-hover" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function Sparkline({ values, color = "#5eead4", height = 36 }) {
  const w = 120;
  const clean = values.map((v) => (v == null ? null : v));
  const nums = clean.filter((v) => v != null);
  if (nums.length < 2) return <svg width={w} height={height} />;
  const min = Math.min(...nums), max = Math.max(...nums);
  const span = max - min || 1;
  const step = w / (clean.length - 1);
  let d = "";
  clean.forEach((v, i) => {
    if (v == null) return;
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    d += (d ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
  });
  const lastX = (clean.length - 1) * step;
  const lastVIdx = [...clean].map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).pop();
  const lastV = clean[lastVIdx];
  const lastY = height - ((lastV - min) / span) * (height - 4) - 2;
  return (
    <svg width={w} height={height} className="sparkline-svg">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

export function TierDot({ tier }) {
  const color = tier === "outbreak" ? "#fb7185" : tier === "elevated" ? "#fbbf24" : "#34d399";
  return <span className="tier-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}

export function Trend({ value, digits = 1, invert = false }) {
  if (value == null || Number.isNaN(value)) return <span className="trend-flat">—</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`trend-pill ${up ? "trend-up" : "trend-down"}`}>
      <Icon size={12} strokeWidth={2.5} />
      {pct(value, digits)}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyNote({ children }) {
  return <div className="empty-note"><Info size={13} /> {children}</div>;
}

export function ChartTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="dr-tooltip">
      <div className="tt-title">Week {label}</div>
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div className="tt-row" key={i}><span style={{ color: p.color }}>{p.name || p.dataKey}</span><span>{typeof p.value === "number" ? fmt(p.value) : p.value}{suffix}</span></div>
      ))}
    </div>
  );
}

export function MultiTooltip({ active, payload, label, labels }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="dr-tooltip">
      <div className="tt-title">Week {label}</div>
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div className="tt-row" key={i}><span style={{ color: p.color }}>{p.name}</span><span>{fmt(p.value)}</span></div>
      ))}
    </div>
  );
}
