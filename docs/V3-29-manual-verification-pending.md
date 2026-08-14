# V3-29 — manual verification still outstanding

Two checks from the V3-29 plan (`docs/superpowers/plans/2026-08-14-fe-v2-pagination.md`, Task 10)
were **not performed**. They are recorded here rather than quietly dropped, because both are
things automated tests cannot fully stand in for.

Neither is a known failure. They are unverified.

## Prerequisites for both

1. **A local backend serving `/api/v2`.** The BE working tree already has `src/routes/v2.js`; a
   dev server started before that merge will answer v1 and 404 on v2, so restart it:

   ```bash
   cd ../SmartJobSearchCRM-BE && npm run dev
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/api/v2/applications
   # expect 401 (unauthenticated), not 404
   ```

2. **More than 25 rows** in Applications, Companies, Contacts, and Analysis history for the
   account you test with. 25 is the default page size, so a smaller dataset makes both checks
   vacuous. The seeded demo account has 10 applications — seed a separate local account rather
   than adding to the demo data, which is used for portfolio screenshots.

---

## Check 1 — the four dropdowns still receive every application

**What it verifies.** `listApplications()` is consumed by five pages under the shared react-query
key `['applications']`; four of them use it only to fill a "pick an application" `<select>`. If a
paginated subset ever reaches that key, those dropdowns silently show one page — the user cannot
find an application that exists, assumes it is missing, and creates a duplicate. It presents as
**missing data, not as a pagination bug**, which is why it needs a human to look at it.

`src/pages/applicationDropdowns.test.jsx` guards this in CI. That test renders each page in a
fresh `QueryClient`, so by construction it cannot catch a cache-ordering effect that only appears
in a real session — hence this pass.

**Steps.**

1. `npm run dev`, log in, and visit `/applications` in **List view** first, so the paginated
   `['applications', 'page', …]` query is warm alongside the bare key.
2. Open `/analysis`, `/interviews`, `/tailor`, and `/cover-letter` in turn. On each, open the
   "pick an application" dropdown and scan the options.
3. **Correct:** every application in the database appears in all four dropdowns, uncapped.
4. **Regression:** any dropdown stops at the page size. That means a paginated response reached
   the bare `['applications']` key. Treat it as a priority bug, and note that the guard test
   passing while this fails means the guard itself needs revisiting.

---

## Check 2 — 375px responsive pass (V3-27 rules)

**What it verifies.** Touch-target size and horizontal-pan behaviour are visual properties; a DOM
assertion can confirm an element exists but not that it is reachable or that a transition doesn't
flash.

**Steps.** At a 375px viewport (DevTools device toolbar), on `/applications` (List view),
`/companies`, `/contacts`, and `/analysis`:

1. The pager is reachable **without a horizontal pan of the page body**. The table itself may
   scroll sideways — that is existing, deliberate behaviour — but the pager must not require
   panning the whole page.
2. Page-number buttons and the rows-per-page `<select>` each compute to **≥44px** tall.
3. The count ("1–25 of 137") is visible and does not push a row off-screen.
4. Click to page 2 and back. The table body should never flash an empty state mid-transition —
   the previous page's rows stay until the new ones arrive (`placeholderData: keepPreviousData`).

**One thing to look at specifically.** `pageWindow` at `span=1` can yield seven entries
(`[1, null, 4, 5, 6, null, 10]`). With the previous/next chevrons that is 7 × 44px buttons plus
two ellipses and eight 4px gaps — roughly 372px before container padding, so at 375px it sits on
the wrap boundary. `Pager.jsx` uses `flex-wrap`, so it wraps rather than pans, which is the
correct behaviour; confirm it *looks* deliberate when it does.

---

## Deploy gate — cleared 2026-08-14

Both are now live: prod backend on `0197ec3`, `/api/v2/applications` → **401**. Since production
now carries real row counts, **both checks above are best run there** rather than against a local
seed — that was the blocker when they were first written.

It stalled once, and the reason is worth keeping. BE `main` was **fully pushed** (`842afd2` on
`origin`) while production still served `dd7d11f` with 16 days of uptime — Render had not
auto-deployed. **Pushed ≠ deployed.** Ask production what it is running rather than inferring it
from git:

```bash
curl -s https://smartjobsearch-api.onrender.com/api/v1/version
# {"version":"1.0.0","commit":"…","uptime":…}  ← commit + uptime is the truth
curl -s -o /dev/null -w '%{http_code}\n' https://smartjobsearch-api.onrender.com/api/v2/applications
# 401 = live. 404 = the build predates v2.
```

And on the frontend side: `.github/workflows/ci.yml` triggers on push to `main` and there is no
local `.vercel` directory, so **`git push origin main` *is* the FE deploy.** There is no separate
step — the push is the gate.
