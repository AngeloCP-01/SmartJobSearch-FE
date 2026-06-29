import { Link, Navigate } from 'react-router-dom';
import { Briefcase, KanbanSquare, ScanSearch, CalendarClock, FileText, Github, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useDemoLogin } from '../lib/demo';
import Button from '../components/Button';

const FE_REPO = 'https://github.com/AngeloCP-01/SmartJobSearch-FE';
const BE_REPO = 'https://github.com/AngeloCP-01/SmartJobSearch-BE';

const FEATURES = [
  { Icon: KanbanSquare, title: 'Kanban + List pipeline', text: 'Track every application from Draft to Offer with drag-to-update status, a sortable list view, and quick filters.' },
  { Icon: ScanSearch, title: 'AI résumé / ATS analysis', text: 'Score your résumé for ATS-friendliness and match against any job description, with keyword gaps and fixes.' },
  { Icon: CalendarClock, title: 'Interviews & reminders', text: 'Schedule interviews, record results, and never miss a follow-up with an upcoming/overdue reminders feed.' },
  { Icon: FileText, title: 'Documents & contacts', text: 'Store résumé and cover-letter versions, link them to applications, and keep recruiter contacts in one place.' },
];

export default function Landing() {
  const { status } = useAuth();
  const { tryDemo, demoBusy, demoError } = useDemoLogin();
  if (status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-700 text-white">
            <Briefcase size={18} aria-hidden="true" />
          </span>
          <span className="font-bold text-slate-900">JobTrail</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={FE_REPO} target="_blank" rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex">
            <Github size={16} aria-hidden="true" /> GitHub
          </a>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Log in</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-10 text-center md:pt-16">
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          Full-stack portfolio project
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
          Run your job search like a pipeline.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          A CRM for the whole job hunt — track applications on a Kanban board, schedule interviews,
          store résumés, and get an AI-assisted ATS analysis against every job description.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={tryDemo} loading={demoBusy} className="px-5 py-3 text-base">
            {demoBusy ? 'Loading demo…' : 'Try the live demo'} <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <Link to="/register"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            Create an account
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-500">No sign-up required — the demo opens a sample account with real data.</p>
        {demoError && <p role="alert" className="mt-3 text-sm text-red-600">{demoError}</p>}

        <div className="mt-12 overflow-hidden rounded-2xl border border-sky-100 shadow-xl">
          <img src="/screenshots/03-applications-board.png" alt="Applications Kanban board" className="w-full" />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-sky-100 text-sky-700">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI analysis showcase */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              The standout feature
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">AI résumé &amp; ATS analysis</h2>
            <p className="mt-3 text-slate-600">
              Pick an application and a résumé, and get an ATS-friendliness score, a job-description match score,
              the keywords you’re missing, and prioritized suggestions. Powered by an LLM with a deterministic
              fallback so it always returns something useful.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-sky-100 shadow-lg">
            <img src="/screenshots/05-analysis.png" alt="AI résumé analysis report" className="w-full" />
          </div>
        </div>
      </section>

      {/* Tech / CTA */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Built as a full-stack showcase</h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">
            React · Node · Express · PostgreSQL (Prisma) · Tailwind. Deployed on Vercel + Render + Neon,
            with 280+ automated tests and CI.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={tryDemo} loading={demoBusy} className="px-5 py-3 text-base">
              {demoBusy ? 'Loading demo…' : 'Try the live demo'} <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <a href={BE_REPO} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              <Github size={18} aria-hidden="true" /> View the code
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-center text-sm text-slate-400">
        JobTrail — a portfolio project.
      </footer>
    </div>
  );
}
