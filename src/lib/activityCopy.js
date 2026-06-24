import { FilePlus2, ArrowRightLeft, Trash2, CalendarClock, CheckCircle2, FileText, UserPlus, Activity } from 'lucide-react';

const STATUS_LABEL = {
  Draft: 'Draft', Applied: 'Applied', HR_Screening: 'HR Screening',
  Technical_Interview: 'Technical Interview', Final_Interview: 'Final Interview',
  Offer: 'Offer', Accepted: 'Accepted', Rejected: 'Rejected', Withdrawn: 'Withdrawn',
};
const label = (s) => STATUS_LABEL[s] || s;

export function activityCopy(action, metadata = {}) {
  const pos = metadata.position || 'an application';
  switch (action) {
    case 'ApplicationCreated': return { icon: FilePlus2, text: `Created ${pos}` };
    case 'ApplicationStatusChanged': return { icon: ArrowRightLeft, text: `Moved ${pos} from ${label(metadata.from)} to ${label(metadata.to)}` };
    case 'ApplicationDeleted': return { icon: Trash2, text: `Deleted ${pos}` };
    case 'InterviewScheduled': return { icon: CalendarClock, text: `Scheduled a ${metadata.type} interview for ${pos}` };
    case 'InterviewResultRecorded': return { icon: CheckCircle2, text: `Recorded ${metadata.result} for the ${metadata.type} interview (${pos})` };
    case 'DocumentLinked': return { icon: FileText, text: `Attached ${metadata.name} to ${pos}` };
    case 'ContactLinked': return { icon: UserPlus, text: `Added ${metadata.name} to ${pos}` };
    default: return { icon: Activity, text: 'Activity' };
  }
}

export function relativeTime(iso, now = Date.now()) {
  const sec = Math.round((now - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function dayBucket(iso, now = new Date()) {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(new Date(iso))) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString();
}
