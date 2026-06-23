import { useQuery } from '@tanstack/react-query';
import { Briefcase, BarChart3, CalendarClock } from 'lucide-react';
import { fetchSummary } from '../api/dashboard';

const prettify = (s) => s.replace(/_/g, ' ');

function Card({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Icon size={18} aria-hidden="true" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchSummary });

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Dashboard</h1>
      {isLoading || !data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Total applications" icon={Briefcase}>
            <div className="text-4xl font-bold tabular-nums text-slate-900">{data.totalApplications}</div>
          </Card>

          <Card title="By status" icon={BarChart3}>
            {Object.keys(data.byStatus).length === 0 ? (
              <p className="text-sm text-slate-400">No applications yet</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(data.byStatus).map(([s, n]) => (
                  <li key={s} className="flex justify-between">
                    <span className="text-slate-600">{prettify(s)}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Upcoming interviews" icon={CalendarClock}>
            {data.upcomingInterviews.length === 0 ? (
              <p className="text-sm text-slate-400">None scheduled</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.upcomingInterviews.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span className="text-slate-600">{i.type}</span>
                    <span className="text-slate-500">
                      {i.scheduledAt ? new Date(i.scheduledAt).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
