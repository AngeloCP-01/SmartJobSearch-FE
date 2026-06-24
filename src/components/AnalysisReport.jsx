import { AlertTriangle } from 'lucide-react';
import ScoreBadge from './ScoreBadge';

const SUB_LABELS = {
  parseability: 'Parseability', sections: 'Sections', contactInfo: 'Contact', formatting: 'Formatting', length: 'Length',
};
const sevClass = { high: 'bg-amber-100 text-amber-800', medium: 'bg-sky-100 text-sky-800', low: 'bg-slate-100 text-slate-600' };

function Chip({ entry, missing }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
      ${missing ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'} ${entry.type === 'hard' ? 'font-semibold ring-1 ring-inset ring-current/20' : ''}`}>
      {entry.term}{missing && entry.jdCount > 1 ? ` ·${entry.jdCount}` : ''}
    </span>
  );
}

export default function AnalysisReport({ report, atsScore, matchScore }) {
  if (!report) return null;
  const { meta, atsSubScores, matched = [], missing = [], suggestions = [] } = report;

  return (
    <div className="space-y-5">
      {meta?.extractionOk === false && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} aria-hidden="true" />
          We couldn’t read text from this file — it may be image-based or an unsupported format, which an ATS can’t parse.
        </div>
      )}

      <div className="flex items-center justify-center gap-10 rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <ScoreBadge label="ATS-friendliness score" value={atsScore} />
        <ScoreBadge label="Match score" value={matchScore} />
      </div>
      <p className="text-center text-xs text-slate-400">Guidance only — not a guaranteed ATS pass.</p>

      <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">ATS checks</h3>
        <div className="space-y-2">
          {Object.entries(SUB_LABELS).map(([k, lbl]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-24 text-xs text-slate-500">{lbl}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${atsSubScores?.[k] ?? 0}%` }} />
              </div>
              <span className="w-8 text-right text-xs text-slate-500">{atsSubScores?.[k] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {(matched.length > 0 || missing.length > 0) && (
        <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Keywords</h3>
          {matched.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-slate-500">Matched</p>
              <div className="mb-3 flex flex-wrap gap-1.5">{matched.map((e) => <Chip key={e.term} entry={e} />)}</div>
            </>
          )}
          {missing.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-slate-500">Missing from your résumé</p>
              <div className="flex flex-wrap gap-1.5">{missing.map((e) => <Chip key={e.term} entry={e} missing />)}</div>
            </>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Suggestions</h3>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${sevClass[s.severity] || sevClass.low}`}>{s.severity}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
