import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Briefcase, TrendingUp, CalendarClock, Award, BarChart3, History, Plus, ArrowRight } from 'lucide-react';
import { fetchSummary } from '../api/dashboard';
import { fetchActivity } from '../api/activity';
import { STATUSES } from '../lib/applicationStatus';
import ActivityRow from '../components/ActivityRow';
import ApplicationDrawer from '../components/ApplicationDrawer';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

const prettify = (s) => s.replace(/_/g, ' ');
const ACTIVE = ['Applied', 'HR_Screening', 'Technical_Interview', 'Final_Interview'];

const STATUS_BAR = {
  Draft: 'bg-slate-400', Applied: 'bg-sky-500', HR_Screening: 'bg-indigo-500',
  Technical_Interview: 'bg-violet-500', Final_Interview: 'bg-amber-500',
  Offer: 'bg-green-500', Accepted: 'bg-emerald-500', Rejected: 'bg-red-500', Withdrawn: 'bg-slate-400',
};

function Stat({ to, icon: Icon, label, value, accent }) {
  return (
    <Link to={to} className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm transition-colors hover:border-sky-300">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${accent}`}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </Link>
  );
}

function Panel({ title, icon: Icon, action, children }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Icon size={18} aria-hidden="true" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Pipeline({ byStatus }) {
  const rows = STATUSES.map((s) => ({ s, n: byStatus[s] || 0 })).filter((r) => r.n > 0);
  if (rows.length === 0) return <p className="text-sm text-slate-400">No applications yet.</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <div className="space-y-2.5">
      {rows.map(({ s, n }) => (
        <div key={s} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 text-slate-600">{prettify(s)}</span>
          <div className="h-2 flex-1 rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${STATUS_BAR[s] || 'bg-slate-400'}`} style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right font-semibold tabular-nums text-slate-900">{n}</span>
        </div>
      ))}
    </div>
  );
}

const viewAll = (to) => (
  <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline">
    View all <ArrowRight size={13} aria-hidden="true" />
  </Link>
);

export default function Dashboard() {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchSummary });
  const { data: activity } = useQuery({ queryKey: ['activity', 'recent'], queryFn: () => fetchActivity() });

  const get = (s) => (data?.byStatus?.[s] || 0);
  const inProgress = ACTIVE.reduce((n, s) => n + get(s), 0);
  const offers = get('Offer') + get('Accepted');
  const upcoming = data?.upcomingInterviews || [];
  const recent = (activity?.items || []).slice(0, 6);

  function closeDrawer() {
    setDrawerOpen(false);
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['activity'] });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <Button onClick={() => setDrawerOpen(true)}><Plus size={16} aria-hidden="true" /> New application</Button>
      </div>

      {isLoading || !data ? (
        <Spinner center />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat to="/applications" icon={Briefcase} accent="bg-sky-100 text-sky-700" label="Total applications" value={data.totalApplications} />
            <Stat to="/applications" icon={TrendingUp} accent="bg-violet-100 text-violet-700" label="In progress" value={inProgress} />
            <Stat to="/interviews" icon={CalendarClock} accent="bg-amber-100 text-amber-700" label="Upcoming interviews" value={upcoming.length} />
            <Stat to="/applications" icon={Award} accent="bg-emerald-100 text-emerald-700" label="Offers" value={offers} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="Pipeline" icon={BarChart3} action={viewAll('/analytics')}>
                <Pipeline byStatus={data.byStatus} />
              </Panel>
            </div>
            <Panel title="Upcoming interviews" icon={CalendarClock} action={viewAll('/interviews')}>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-400">None scheduled.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {upcoming.map((i) => (
                    <li key={i.id} className="flex items-center justify-between">
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{i.type}</span>
                      <span className="text-slate-500">{i.scheduledAt ? new Date(i.scheduledAt).toLocaleDateString() : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Recent activity" icon={History} action={viewAll('/activity')}>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-slate-50">{recent.map((item) => <ActivityRow key={item.id} item={item} />)}</ul>
            )}
          </Panel>
        </div>
      )}

      <ApplicationDrawer open={drawerOpen} application={null} onClose={closeDrawer} />
    </div>
  );
}
