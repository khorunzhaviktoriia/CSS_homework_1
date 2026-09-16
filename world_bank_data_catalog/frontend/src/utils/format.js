export function formatValue(value, format = "number") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (format) {
    case "currency":
      return `$${compact(value)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    default:
      return compact(value);
  }
}

export function compact(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function formatByIndicator(value, indicator) {
  if (!indicator) return formatValue(value);
  return formatValue(value, indicator.format);
}
