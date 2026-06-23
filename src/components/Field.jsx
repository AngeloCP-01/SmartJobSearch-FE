export default function Field({ label, name, type = 'text', value, onChange, required, autoComplete }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900
          placeholder:text-slate-400 transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:border-sky-500"
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
      />
    </label>
  );
}
