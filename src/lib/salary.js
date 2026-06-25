// Format a salary range for compact display (cards, chips).
// - values < 1000 show in full ($0, $500) instead of a misleading "$0k"
// - thousands abbreviate to "k", with one decimal only when not a round
//   thousand ($1k, $1.5k, $35k) — so 1400 never reads as the same "$1k" as 1000
// - an equal min/max collapses to a single value
const one = (n) => {
  if (n == null) return null;
  if (n < 1000) return `$${n}`;
  const v = n / 1000;
  return `$${Number.isInteger(v) ? v : v.toFixed(1)}k`;
};

export function formatSalaryRange(min, max) {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? one(min) : `${one(min)}–${one(max)}`;
  }
  return one(min ?? max);
}
