import { Loader2 } from 'lucide-react';

// Reusable loading indicator. Inline by default; pass `center` to drop it into a
// padded, centered block (for full-section/page placeholders).
export default function Spinner({ size = 18, label = 'Loading…', center = false, className = '' }) {
  const node = (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-slate-500 ${className}`}>
      <Loader2 size={size} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
  return center ? <div className="grid place-items-center py-12">{node}</div> : node;
}
