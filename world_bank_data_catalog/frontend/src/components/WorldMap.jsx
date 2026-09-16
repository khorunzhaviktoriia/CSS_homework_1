import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { motion } from "framer-motion";
import { numericToAlpha3 } from "i18n-iso-countries";

const GEO_URL = "/countries-110m.json";

export default function WorldMap({ values = {}, unit = "", onHoverCountry }) {
  const [tooltip, setTooltip] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const domain = useMemo(() => {
    const nums = Object.values(values).filter((v) => typeof v === "number");
    if (!nums.length) return [0, 1];
    return [Math.min(...nums), Math.max(...nums)];
  }, [values]);

  const colorScale = useMemo(
    () =>
      scaleLinear()
        .domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]])
        .range(["#DCE7FF", "#5B8DEF", "#0F2E9E"])
        .clamp(true),
    [domain]
  );

  return (
    <div className="relative w-full h-full">
      <ComposableMap
        projectionConfig={{ scale: 148, center: [12, 4] }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const code = numericToAlpha3(geo.id) || geo.id;
              const value = values[code];
              const fill = typeof value === "number" ? colorScale(value) : "#E7ECF3";
              const isHovered = hoveredId === geo.rsmKey;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered ? "#38BDF8" : fill}
                  stroke="#F8FAFC"
                  strokeWidth={0.5}
                  style={{ outline: "none", cursor: "pointer", transition: "fill 0.4s" }}
                  onMouseEnter={() => {
                    setHoveredId(geo.rsmKey);
                    setTooltip({ name: geo.properties?.name, value, code });
                    onHoverCountry?.(code);
                  }}
                  onMouseMove={(evt) =>
                    setTooltip((t) => (t ? { ...t, x: evt.clientX, y: evt.clientY } : t))
                  }
                  onMouseLeave={() => {
                    setHoveredId(null);
                    setTooltip(null);
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="pointer-events-none fixed z-50 glass rounded-xl px-3 py-2 shadow-soft text-xs"
          style={{ left: (tooltip.x ?? 0) + 14, top: (tooltip.y ?? 0) + 14 }}
        >
          <div className="font-semibold text-navy dark:text-white">{tooltip.name}</div>
          <div className="text-slate-500 dark:text-slate-300">
            {typeof tooltip.value === "number"
              ? `${tooltip.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`
              : "No data"}
          </div>
        </motion.div>
      )}
    </div>
  );
}
