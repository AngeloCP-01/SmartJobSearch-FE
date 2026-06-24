import { activityCopy, relativeTime } from '../lib/activityCopy';

export default function ActivityRow({ item }) {
  const { icon: Icon, text } = activityCopy(item.action, item.metadata);
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{text}</p>
        <p className="text-xs text-slate-400">{relativeTime(item.createdAt)}</p>
      </div>
    </li>
  );
}
