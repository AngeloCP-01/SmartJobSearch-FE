import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Bell, LineChart, KanbanSquare, Building2, Users, FileText, History, ScanSearch, PenLine, CalendarClock, LogOut, Briefcase } from 'lucide-react';
import { useQuery, useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchReminders } from '../api/reminders';
import Spinner from './Spinner';

// A thin indeterminate bar pinned to the top whenever any query or mutation is
// in flight — one place that gives feedback for every API call across the app
// (especially Render's free-tier cold starts). Decorative: per-page Spinners
// handle screen-reader announcements where there's no content yet.
function TopProgressBar() {
  const active = useIsFetching() + useIsMutating();
  if (!active) return null;
  return (
    <div data-testid="top-progress" aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-sky-100">
      <div className="h-full w-1/3 bg-sky-600 animate-[indeterminate_1.1s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-pulse" />
    </div>
  );
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/applications', label: 'Applications', icon: KanbanSquare },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/activity', label: 'Activity', icon: History },
  { to: '/analysis', label: 'Analysis', icon: ScanSearch },
  { to: '/cover-letter', label: 'Cover Letter', icon: PenLine },
  { to: '/interviews', label: 'Interviews', icon: CalendarClock },
];

function navClass({ isActive }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
    focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500
    ${isActive ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-sky-50 hover:text-sky-800'}`;
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-700 text-white">
        <Briefcase size={18} aria-hidden="true" />
      </span>
      <span className="font-bold text-slate-900">Job Application Tracker</span>
    </div>
  );
}

function NavLinks({ onNavigate, reminderCount = 0 }) {
  return NAV.map(({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={navClass} onClick={onNavigate}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      {to === '/reminders' && reminderCount > 0 && (
        <span
          aria-label={`${reminderCount} reminders`}
          className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 text-xs font-semibold text-white"
        >
          {reminderCount}
        </span>
      )}
    </NavLink>
  ));
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { data: reminders } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders });
  const reminderCount = reminders?.counts?.total ?? 0;
  return (
    <div className="min-h-dvh md:flex">
      <TopProgressBar />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-sky-700 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col gap-1 border-r border-sky-100 bg-white p-3">
        <div className="mb-4"><Brand /></div>
        <nav className="flex flex-col gap-1" aria-label="Primary"><NavLinks reminderCount={reminderCount} /></nav>
        <div className="mt-auto border-t border-sky-100 pt-3">
          <p className="px-2 text-xs text-slate-500 truncate" title={user?.email}>{user?.email}</p>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600
              cursor-pointer transition-colors hover:bg-red-50 hover:text-red-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut size={18} aria-hidden="true" /> Log out
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-20 border-b border-sky-100 bg-white">
        <div className="flex items-center justify-between px-4 py-2">
          <Brand />
          <button onClick={logout} aria-label="Log out"
            className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 cursor-pointer">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Primary"><NavLinks reminderCount={reminderCount} /></nav>
      </header>

      <main id="main" className="flex-1 p-5 md:p-8">
        <Suspense fallback={<Spinner center />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
