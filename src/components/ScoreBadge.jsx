function band(value) {
  if (value == null) return 'bg-slate-100 text-slate-500';
  if (value >= 75) return 'bg-emerald-100 text-emerald-800';
  if (value >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

export default function ScoreBadge({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <div
        aria-label={`${label}: ${value == null ? 'N/A' : value}`}
        className={`grid h-20 w-20 place-items-center rounded-full text-2xl font-bold ${band(value)}`}
      >
        {value == null ? 'N/A' : value}
      </div>
      <span className="mt-1 text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}
