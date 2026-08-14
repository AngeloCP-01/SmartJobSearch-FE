import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Plus, Trash2, Building2 } from 'lucide-react';
import { listCompaniesPage, createCompany, deleteCompany } from '../api/companies';
import Button from '../components/Button';
import Pager from '../components/Pager';
import Spinner from '../components/Spinner';
import {
  DEFAULT_PAGE_SIZE, pageResetter, useClampedPage, useDebouncedValue,
} from '../lib/pagination';

export default function Companies() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Server-side search: filtering one page in memory would hide matching
  // companies sitting on every other page.
  const term = useDebouncedValue(search, 300).trim();

  // ['companies','page',…] is a distinct key from the bare ['companies'] the
  // drawers read, and a prefix match of it — so the invalidations below still
  // refresh both without naming them separately.
  const params = { page, pageSize, search: term, sort: 'createdAt', dir: 'desc' };
  const {
    data, isLoading, isPlaceholderData, isFetching,
  } = useQuery({
    queryKey: ['companies', 'page', params],
    queryFn: () => listCompaniesPage(params),
    placeholderData: keepPreviousData,
  });

  const companies = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const resetting = pageResetter(setPage);
  const onSearchChange = resetting(setSearch);
  const onPageSizeChange = resetting(setPageSize);
  useClampedPage(page, totalPages, setPage);

  const create = useMutation({
    mutationFn: createCompany,
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['companies'] }); },
  });
  const remove = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  // keepPreviousData means `data` is the PREVIOUS query's envelope while a
  // refetch is in flight, and isLoading is false because data already exists —
  // so `total` is stale until the fetch settles. Reading it anyway can tell a
  // user with hundreds of companies that they have none, mid-refetch (e.g.
  // right after clearing a search that matched nothing).
  const settled = !isPlaceholderData && !isFetching;
  const nothingYet = settled && total === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Companies</h1>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900
            focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate({ name: name.trim() }); }}
      >
        <input
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900
            focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          placeholder="Company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={create.isPending}><Plus size={16} aria-hidden="true" /> Add company</Button>
      </form>

      {isLoading ? (
        <Spinner center />
      ) : nothingYet ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <Building2 className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No companies yet. Add your first one above.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-sky-100 overflow-hidden rounded-xl border border-sky-100 bg-white">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {(c.industry || c.location) && (
                    <p className="text-sm text-slate-500">{[c.industry, c.location].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <Button variant="danger" aria-label={`Delete ${c.name}`} onClick={() => remove.mutate(c.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
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
    </div>
  );
}
