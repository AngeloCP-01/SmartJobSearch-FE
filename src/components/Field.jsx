import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Field({ label, name, type = 'text', value, onChange, required, autoComplete, revealable }) {
  const [reveal, setReveal] = useState(false);
  const canReveal = revealable && type === 'password';
  const inputType = canReveal && reveal ? 'text' : type;

  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        <input
          className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 text-slate-900
            placeholder:text-slate-400 transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:border-sky-500
            ${canReveal ? 'pl-3 pr-10' : 'px-3'}`}
          name={name}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
        />
        {canReveal && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400
              hover:text-slate-600 focus:outline-none focus-visible:text-sky-600"
          >
            {reveal ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
    </label>
  );
}
