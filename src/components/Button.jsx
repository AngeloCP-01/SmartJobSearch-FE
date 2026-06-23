const VARIANTS = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-500',
  subtle: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-sky-500',
  danger: 'text-red-600 hover:bg-red-50 focus-visible:ring-red-500',
};

export default function Button({ variant = 'primary', className = '', type = 'button', children, ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
