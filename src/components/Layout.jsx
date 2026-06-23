import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, Building2, Users, CalendarClock, LogOut, Briefcase } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/applications', label: 'Applications', icon: KanbanSquare },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
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
      <span className="font-bold text-slate-900">Job Search CRM</span>
    </div>
  );
}

function NavLinks({ onNavigate }) {
  return NAV.map(({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={navClass} onClick={onNavigate}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  ));
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col gap-1 border-r border-sky-100 bg-white p-3">
        <div className="mb-4"><Brand /></div>
        <nav className="flex flex-col gap-1" aria-label="Primary"><NavLinks /></nav>
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
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Primary"><NavLinks /></nav>
      </header>

      <main className="flex-1 p-5 md:p-8"><Outlet /></main>
    </div>
  );
}
