import { motion } from "framer-motion";
import { useCountUp } from "../hooks/useCountUp";
import { compact } from "../utils/format";

export default function KpiCard({ label, value, suffix = "", icon: Icon, delay = 0, plain = false }) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  const display =
    typeof value === "number" ? (plain ? Math.round(animated).toString() : compact(Math.round(animated))) : value ?? "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -3 }}
      className="glass rounded-card shadow-soft px-5 py-4 flex flex-col gap-2 min-w-[150px]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <span className="h-7 w-7 rounded-lg grid place-items-center bg-brand-50 dark:bg-brand/15 text-brand-600 dark:text-cyan">
            <Icon size={14} />
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-navy dark:text-white">
        {display}
        {suffix}
      </div>
    </motion.div>
  );
}
