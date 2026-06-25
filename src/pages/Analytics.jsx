import { useQuery } from '@tanstack/react-query';
import { Briefcase, Percent, Award, XCircle, BarChart3, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { fetchAnalytics } from '../api/analytics';
import Spinner from '../components/Spinner';

const pct = (r) => `${Math.round(r * 100)}%`;
const prettify = (s) => s.replace(/_/g, ' ');

const STATUS_COLORS = {
  Draft: '#94a3b8',               // slate-400
  Applied: '#0ea5e9',             // sky-500
  HR_Screening: '#6366f1',        // indigo-500
  Technical_Interview: '#8b5cf6', // violet-500
  Final_Interview: '#f59e0b',     // amber-500
  Offer: '#16a34a',               // green-600
  Accepted: '#10b981',            // emerald-500
  Rejected: '#dc2626',            // red-600
  Withdrawn: '#94a3b8',           // slate-400
};

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

      {isLoading && <Spinner center />}

      {isError && !data && (
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

          {data.metrics.totalApplications === 0 ? (
            <p className="mt-6 text-slate-500">Add applications to see analytics.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Pipeline" icon={BarChart3}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.funnel.map((f) => ({ ...f, label: prettify(f.status) }))}
                      margin={{ left: 24, right: 12, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#e0f2fe" />
                      <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={12} />
                      <YAxis type="category" dataKey="label" width={120} stroke="#64748b" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {data.funnel.map((f) => (
                          <Cell key={f.status} fill={STATUS_COLORS[f.status]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Applications over time" icon={TrendingUp}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.overTime} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                      <CartesianGrid stroke="#e0f2fe" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#0369a1" fill="#bae6fd" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
