// v2 validates query parameters rather than coercing them: `search` is
// z.string().trim().min(1).optional(), `companyId` is a uuid, `status` an enum.
// Axios serialises `{ search: '' }` as `?search=`, which is a 400 — not "no
// filter" — so blanks have to be dropped before the request, not after.
export function compactParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
}
