/**
 * Turning numbers into terminal text.
 *
 * Pure and boring on purpose. Every function here is one someone will
 * eventually stare at while wondering why a readout looks wrong, so they are
 * each small enough to check by eye and each tested.
 */

/** Native-unit amounts, with enough precision to be honest and not more. */
export function formatAmount(value: number, symbol: string): string {
  if (!Number.isFinite(value)) return `?? ${symbol}`;
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${symbol}`;
  if (abs < 0.0001) return `<0.0001 ${symbol}`;
  if (abs < 1) return `${value.toFixed(4)} ${symbol}`;
  if (abs < 1000) return `${value.toFixed(3)} ${symbol}`;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${symbol}`;
}

/** Days into something a person reads without doing arithmetic. */
export function formatDuration(days: number): string {
  if (days < 1) return "less than a day";
  if (days < 60) return `${Math.round(days)} days`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

/** Shorten an address the way every explorer does, because people expect it. */
export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * An ASCII bar, because a CRT cannot draw an SVG.
 *
 * Uses block characters rather than '#' so the bar reads as a solid mass at
 * terminal font sizes. Clamped, because a metric that overruns its own bar is
 * the sort of thing that ships.
 */
export function bar(score: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const filled = Math.round((clamped / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** Pad a label so a column of them lines up. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padEnd(width, " ");
}

/** A metric row: LABEL ████░░░░ 42  value */
export function metricRow(label: string, score: number, display: string): string {
  return `${pad(label, 16)} ${bar(score)} ${pad(String(Math.round(score)), 3)} ${display}`;
}

/** UTC hour as a two-digit string, for the night-owl readout. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
