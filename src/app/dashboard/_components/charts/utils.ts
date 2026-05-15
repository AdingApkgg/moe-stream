export function formatCompact(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 10_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

export function formatUSDT(num: number): string {
  if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(2) + "M";
  if (num >= 10_000) return "$" + (num / 1_000).toFixed(1) + "K";
  return "$" + num.toFixed(2);
}

export function formatPercent(num: number): string {
  return num.toFixed(2) + "%";
}
