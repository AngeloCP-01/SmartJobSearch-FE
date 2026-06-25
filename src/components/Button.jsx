import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-500',
  subtle: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-sky-500',
  danger: 'text-red-600 hover:bg-red-50 focus-visible:ring-red-500',
};

export default function Button({ variant = 'primary', className = '', type = 'button', loading = false, disabled = false, children, ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  );
}
