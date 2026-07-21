import { useRef } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../hooks/useFocusTrap';

// Discloses what JobTrail collects. Cookieless analytics needs no consent
// banner, so this is disclosure rather than a gate. Follows the dialog pattern
// used by ContactDrawer/ApplicationDrawer (Escape + focus trap + aria-modal).
export default function PrivacyPolicyModal({ open, onClose }) {
  const ref = useRef(null);
  useFocusTrap(ref, open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <div className="grid h-full place-items-center p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Privacy policy"
          className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3">
            <h2 className="text-lg font-bold text-slate-900">Privacy</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4 text-sm text-slate-600">
            <p>
              JobTrail is a portfolio project. It collects the minimum needed to keep the app
              working and to understand how it performs. There are no advertising trackers.
            </p>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">Usage analytics</h3>
              <p>
                Vercel Web Analytics and Speed Insights record page views and page-load
                performance. Both are cookieless and aggregate — no personal data, no
                cross-site tracking, and no profile is built about you.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">Error reporting</h3>
              <p>
                When something breaks, Sentry receives the error and the page it happened on so
                it can be fixed. Authentication headers are stripped before the report is sent,
                and personally identifying data is not attached.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">AI features</h3>
              <p>
                Four features send your content to OpenRouter for AI processing: résumé analysis,
                cover letter generation, résumé tailoring, and job-posting auto-fill. Only résumé
                analysis has an AI toggle — the other three always use AI. Résumé analysis sends
                your résumé text and the job description; cover letter generation sends the
                company, role, job description, and résumé; résumé tailoring sends the job
                description, current résumé, and evidence drawn from your other documents; and
                auto-fill sends the posting text you paste, or a URL that the server fetches on
                your behalf. Free models may be served by providers that can use inputs for
                training — review your OpenRouter privacy settings.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-semibold text-slate-900">Your data</h3>
              <p>
                Applications, documents, and contacts you create are stored so the app can show
                them back to you. They are not sold or shared.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
