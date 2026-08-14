import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Plus, Trash2, Pencil, Users, Mail, Linkedin, CalendarClock } from 'lucide-react';
import { listContactsPage, deleteContact } from '../api/contacts';
import ContactDrawer from '../components/ContactDrawer';
import Button from '../components/Button';
import Pager from '../components/Pager';
import Spinner from '../components/Spinner';
import {
  DEFAULT_PAGE_SIZE, pageResetter, useClampedPage, useDebouncedValue,
} from '../lib/pagination';

const toDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const isOverdue = (v) => Boolean(v) && new Date(v) < new Date(new Date().toDateString());

export default function Contacts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Server-side search: filtering one page in memory would hide matching
  // contacts sitting on every other page.
  const term = useDebouncedValue(search, 300).trim();

  // ['contacts','page',…] is distinct from the bare ['contacts'] the
  // ApplicationDrawer reads, and a prefix match of it — so the invalidation
  // below still refreshes both.
  const params = { page, pageSize, search: term, sort: 'createdAt', dir: 'desc' };
  const {
    data, isLoading, isPlaceholderData, isFetching,
  } = useQuery({
    queryKey: ['contacts', 'page', params],
    queryFn: () => listContactsPage(params),
    placeholderData: keepPreviousData,
  });

  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const resetting = pageResetter(setPage);
  const onSearchChange = resetting(setSearch);
  const onPageSizeChange = resetting(setPageSize);
  useClampedPage(page, totalPages, setPage);

  const remove = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (c) => { setEditing(c); setDrawerOpen(true); };
  const onDelete = (c) => { if (window.confirm(`Delete ${c.name}?`)) remove.mutate(c.id); };

  // keepPreviousData means `data` is the PREVIOUS query's envelope while a
  // refetch is in flight, and isLoading is false because data already exists —
  // so `total` is stale until the fetch settles. Reading it anyway can tell a
  // user with hundreds of contacts that they have none, mid-refetch.
  const settled = !isPlaceholderData && !isFetching;
  const nothingYet = settled && total === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <Button onClick={openCreate}><Plus size={16} aria-hidden="true" /> Add contact</Button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner center />
      ) : nothingYet ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <Users className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No contacts yet. Add a recruiter or interviewer above.
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-start justify-between rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {(c.position || c.company) && (
                    <p className="text-sm text-slate-500">{[c.position, c.company?.name].filter(Boolean).join(' · ')}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                        <Mail size={14} aria-hidden="true" /> {c.email}
                      </a>
                    )}
                    {c.linkedinUrl && (
                      <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                        <Linkedin size={14} aria-hidden="true" /> LinkedIn
                      </a>
                    )}
                    {c.followUpDate && (
                      <span
                        aria-label={`Follow-up ${toDate(c.followUpDate)}${isOverdue(c.followUpDate) ? ' (overdue)' : ''}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${isOverdue(c.followUpDate) ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}
                      >
                        <CalendarClock size={12} aria-hidden="true" /> {toDate(c.followUpDate)}{isOverdue(c.followUpDate) ? ' · overdue' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="subtle" aria-label={`Edit ${c.name}`} onClick={() => openEdit(c)}>
                    <Pencil size={16} aria-hidden="true" />
                  </Button>
                  <Button variant="danger" aria-label={`Delete ${c.name}`} onClick={() => onDelete(c)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}

      <ContactDrawer open={drawerOpen} contact={editing} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
