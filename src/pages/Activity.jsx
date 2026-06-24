import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { fetchActivity } from '../api/activity';
import { dayBucket } from '../lib/activityCopy';
import ActivityRow from '../components/ActivityRow';
import Button from '../components/Button';

export default function Activity() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey: ['activity'],
    queryFn: ({ pageParam }) => fetchActivity({ before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const groups = [];
  for (const item of items) {
    const bucket = dayBucket(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.bucket === bucket) last.items.push(item);
    else groups.push({ bucket, items: [item] });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Activity</h1>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load activity. Please try again.
        </div>
      )}

      {!isLoading && !isError && (items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
          <History className="mx-auto mb-2 text-slate-300" size={28} aria-hidden="true" />
          No activity yet. Your job-search timeline will show up here.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.bucket}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.bucket}</h2>
              <ul className="rounded-xl border border-sky-100 bg-white px-4 py-1 shadow-sm">
                {g.items.map((item) => <ActivityRow key={item.id} item={item} />)}
              </ul>
            </section>
          ))}
          {hasNextPage && (
            <div className="text-center">
              <Button variant="subtle" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
