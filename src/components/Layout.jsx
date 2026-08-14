import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import AppErrorBoundary from './AppErrorBoundary';
import { LayoutDashboard, Bell, LineChart, KanbanSquare, Building2, Users, FileText, History, ScanSearch, PenLine, SquarePen, CalendarClock, LogOut, Briefcase, Wand2, Menu, X } from 'lucide-react';
import { useQuery, useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchReminders } from '../api/reminders';
import useFocusTrap from '../hooks/useFocusTrap';
import Spinner from './Spinner';
import PrivacyPolicyModal from './PrivacyPolicyModal';

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
  { to: '/applications', label: 'Applications', icon: KanbanSquare },
  { to: '/analysis', label: 'Analysis', icon: ScanSearch },
  { to: '/cover-letter', label: 'Cover Letter', icon: PenLine },
  { to: '/interviews', label: 'Interviews', icon: CalendarClock },
  { to: '/tailor', label: 'Tailor Résumé', icon: Wand2 },
  { to: '/editor', label: 'Editor', icon: SquarePen },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/activity', label: 'Activity', icon: History },
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
      <span className="font-bold text-slate-900">JobTrail</span>
    </div>
  );
}

function LogoutButton({ onLogout }) {
  return (
    <button
      onClick={onLogout}
      className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600
        cursor-pointer transition-colors hover:bg-red-50 hover:text-red-600
        focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <LogOut size={18} aria-hidden="true" /> Log out
    </button>
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

// Mobile primary navigation. The nav is 13 items deep — too many to lay out as
// a horizontal strip without either shrinking targets below 44px or hiding most
// of them behind a sideways scroll, so on small screens it becomes the same
// vertical list the desktop sidebar uses, in a slide-over drawer.
function MobileNav({ open, onClose, reminderCount, user, onLogout }) {
  const ref = useRef(null);
  useFocusTrap(ref, open, onClose);

  // Callers pass an inline arrow, so hold it in a ref to keep the effects below
  // from re-running on every parent render (same reasoning as useFocusTrap).
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  // Lock the page behind the drawer so a scroll gesture over the scrim doesn't
  // move the content underneath it.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // The drawer is display:none from md up, where the persistent sidebar takes
  // over. Without this, rotating a phone to landscape or resizing past the
  // breakpoint leaves it open-but-invisible — still holding the scroll lock and
  // the focus trap, with no visible control to dismiss it.
  useEffect(() => {
    if (!open) return undefined;
    const desktop = window.matchMedia('(min-width: 48rem)');
    const sync = () => { if (desktop.matches) closeRef.current(); };
    sync();
    desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/40 animate-[scrim-in_150ms_ease-out] motion-reduce:animate-none"
      />
      {/* h-dvh, not h-full: `fixed inset-0` resolves against the *layout*
          viewport, which on mobile is taller than the visible area while the
          URL bar is showing — the bottom of the panel ends up behind browser
          chrome. dvh tracks the visible area instead. */}
      <div
        ref={ref}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        className="relative flex h-dvh w-72 max-w-[85%] flex-col border-r border-sky-100
          bg-white animate-[drawer-in_180ms_ease-out] motion-reduce:animate-none"
      >
        <div className="flex shrink-0 items-center justify-between p-3 pb-2">
          <Brand />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 cursor-pointer
              transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {/* Only the link list scrolls. min-h-0 is required — without it this
            flex item refuses to shrink below its content and overflows the
            panel instead of scrolling. py-3 puts each row at a 44px target. */}
        <nav
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 [&>a]:py-3"
          aria-label="Primary"
        >
          <NavLinks reminderCount={reminderCount} onNavigate={onClose} />
        </nav>
        {/* Pinned, never scrolled away: on a short screen the 13-item list
            pushed Log out past the bottom edge and out of reach. The bottom
            padding clears the iOS home indicator. */}
        <div className="shrink-0 border-t border-sky-100 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="px-2 text-xs text-slate-500 truncate" title={user?.email}>{user?.email}</p>
          <LogoutButton onLogout={onLogout} />
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { data: reminders } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders });
  const reminderCount = reminders?.counts?.total ?? 0;
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Backstop for navigation that doesn't come from a drawer link (redirects,
  // back/forward) — the drawer should never outlive the page it opened over.
  useEffect(() => { setNavOpen(false); }, [pathname]);
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
      {/* The shell is a flex row, so a plain aside stretches to the height of
          <main> — on a long page that pushes Log out a full page-scroll below
          the fold. `sticky top-0` + an explicit viewport height detaches the
          sidebar from content length: it stays put while main scrolls, and the
          account block sits at the bottom of the *viewport*, not the document.
          `self-start` stops the row's default stretch from re-inflating it. */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:self-start gap-1 border-r border-sky-100 bg-white p-3">
        <div className="mb-4 shrink-0"><Brand /></div>
        {/* min-h-0 matters: without it a flex item refuses to shrink below its
            content, so a nav taller than the viewport would overflow the sidebar
            instead of scrolling inside it. Same pattern as the mobile drawer. */}
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Primary">
          <NavLinks reminderCount={reminderCount} />
        </nav>
        <div className="shrink-0 border-t border-sky-100 pt-3">
          <p className="px-2 text-xs text-slate-500 truncate" title={user?.email}>{user?.email}</p>
          <LogoutButton onLogout={logout} />
        </div>
      </aside>

      {/* Top bar (mobile) — just the drawer trigger and the brand. Log out lives
          inside the drawer, next to the account it signs out of. */}
      <header className="md:hidden sticky top-0 z-20 border-b border-sky-100 bg-white">
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            className="relative grid h-11 w-11 place-items-center rounded-lg text-slate-600 cursor-pointer
              transition-colors hover:bg-sky-50 hover:text-sky-800
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Menu size={22} aria-hidden="true" />
            {/* The count itself is on the Reminders row inside the drawer; out
                here a dot is enough to say "something is waiting". */}
            {reminderCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-600 ring-2 ring-white" aria-hidden="true" />
            )}
          </button>
          <Brand />
        </div>
      </header>

      <MobileNav
        open={navOpen}
        onClose={() => setNavOpen(false)}
        reminderCount={reminderCount}
        user={user}
        onLogout={logout}
      />

      {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto and
          refuses to shrink below its content, so the Kanban board (9 columns,
          ~2256px) and the List view's min-w-[44rem] table made *main* grow and
          the whole document pan sideways — carrying the sidebar off-screen —
          instead of scrolling inside their own overflow-x-auto containers. */}
      <main id="main" className="min-w-0 flex-1 p-5 md:p-8">
        <AppErrorBoundary key={pathname} variant="page">
          <Suspense fallback={<Spinner center />}>
            <Outlet />
          </Suspense>
        </AppErrorBoundary>
        <footer className="mt-8 border-t border-sky-100 pt-3 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="rounded-lg cursor-pointer text-slate-500 hover:text-slate-600 hover:underline
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Privacy
          </button>
        </footer>
      </main>
      <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
