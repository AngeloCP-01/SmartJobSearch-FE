// Turn an axios error into a user-facing message. Surfaces the backend's
// Zod validation details (`error.details`) so a save shows *which* field failed
// (e.g. "source: String must contain at most 2000 character(s)") instead of a
// generic "Validation failed".
export function apiErrorMessage(e, fallback = 'Something went wrong') {
  const err = e?.response?.data?.error;
  const detail = err?.details?.[0];
  if (detail) return detail.path ? `${detail.path}: ${detail.message}` : detail.message;
  return err?.message || fallback;
}
