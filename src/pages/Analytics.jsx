import { useQuery } from '@tanstack/react-query';
import { Briefcase, Percent, Award, XCircle } from 'lucide-react';
import { fetchAnalytics } from '../api/analytics';

const pct = (r) => `${Math.round(r * 100)}%`;

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

function Metric({ title, icon, value }) {
  return (
    <Card title={title} icon={icon}>
      <div className="text-4xl font-bold tabular-nums text-slate-900">{value}</div>
    </Card>
  );
}

export default function Analytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
  });

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Analytics</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load analytics. Please try again.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title="Total applications" icon={Briefcase} value={data.metrics.totalApplications} />
            <Metric title="Interview rate" icon={Percent} value={pct(data.metrics.interviewRate)} />
            <Metric title="Offer rate" icon={Award} value={pct(data.metrics.offerRate)} />
            <Metric title="Rejection rate" icon={XCircle} value={pct(data.metrics.rejectionRate)} />
          </div>

          {data.metrics.totalApplications === 0 && (
            <p className="mt-6 text-slate-500">Add applications to see analytics.</p>
          )}
        </>
      )}
    </div>
  );
}
