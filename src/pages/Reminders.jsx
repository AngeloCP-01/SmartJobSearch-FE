import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, Users, CheckCircle2 } from 'lucide-react';
import { fetchReminders } from '../api/reminders';
import { updateContact } from '../api/contacts';
import Button from '../components/Button';

const fmt = (v) => new Date(v).toLocaleDateString();
const sub = (a, b) => [a, b].filter(Boolean).join(' · ');

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

function Pill({ tone, children }) {
  const cls = tone === 'overdue' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function InterviewRow({ item, overdue }) {
  return (
    <Link
      to="/interviews"
      className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2 hover:bg-sky-50
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{item.type}</p>
        <p className="text-sm text-slate-500">{sub(item.application?.position, item.application?.company?.name)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
        <span>{fmt(item.scheduledAt)}</span>
        {overdue && <Pill tone="overdue">overdue</Pill>}
      </div>
    </Link>
  );
}

export default function Reminders() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders });
  const markDone = useMutation({
    mutationFn: (id) => updateContact(id, { followUpDate: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const FollowUpRow = ({ contact, tone }) => (
    <li className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-2">
      <div className="min-w-0">
        <Link to="/contacts" className="font-medium text-slate-900 hover:underline">{contact.name}</Link>
        <p className="text-sm text-slate-500">{sub(contact.position, contact.company?.name)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
        <span>{fmt(contact.followUpDate)}</span>
        <Pill tone={tone}>{tone === 'overdue' ? 'due' : 'upcoming'}</Pill>
        <Button
          variant="subtle"
          aria-label={`Mark follow-up with ${contact.name} done`}
          onClick={() => markDone.mutate(contact.id)}
        >
          <CheckCircle2 size={16} aria-hidden="true" /> Mark done
        </Button>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Reminders</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && !data && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load reminders. Please try again.
        </div>
      )}

      {data && (
        data.counts.total === 0 ? (
          <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
            <Bell className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
            You’re all caught up — no reminders right now.
          </div>
        ) : (
          <div className="space-y-4">
            {data.counts.interviews > 0 && (
              <Card title="Interviews" icon={CalendarClock}>
                <div className="space-y-2">
                  {data.interviews.overdue.map((i) => <InterviewRow key={i.id} item={i} overdue />)}
                  {data.interviews.upcoming.map((i) => <InterviewRow key={i.id} item={i} />)}
                </div>
              </Card>
            )}
            {data.counts.followUps > 0 && (
              <Card title="Follow-ups" icon={Users}>
                <ul className="space-y-2">
                  {data.followUps.due.map((c) => <FollowUpRow key={c.id} contact={c} tone="overdue" />)}
                  {data.followUps.upcoming.map((c) => <FollowUpRow key={c.id} contact={c} tone="upcoming" />)}
                </ul>
              </Card>
            )}
          </div>
        )
      )}
    </div>
  );
}
