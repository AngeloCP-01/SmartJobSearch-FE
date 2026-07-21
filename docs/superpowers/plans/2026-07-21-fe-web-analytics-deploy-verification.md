# V3-22 Deploy Verification — FE Web Analytics + Speed Insights

Run this after merging `feat/observability-fe-web-analytics` and deploying. Analytics cannot be verified locally — both products only report from a Vercel deployment.

Related: [spec](../specs/2026-07-21-fe-web-analytics-speed-insights-design.md) · [plan](2026-07-21-fe-web-analytics-speed-insights.md)

## What shipped

| | |
|---|---|
| Packages | `@vercel/analytics`, `@vercel/speed-insights` |
| Module | `src/observability/analytics.jsx` — `WebVitals`, `trackEvent`, `normalizeRoute`, `normalizeAnalyticsUrl` |
| Mount | `src/main.jsx`, inside `<BrowserRouter>`, sibling of `<App/>` |
| Events | `ai_analysis_run` (`src/pages/Analysis.jsx`), `application_created` (`src/components/ApplicationDrawer.jsx`) |
| Privacy modal | `src/components/PrivacyPolicyModal.jsx` — triggers on Landing header, Login footer, Layout footer |

State at merge: 297 tests passing across 53 files, clean build.

## Pre-deploy

- [ ] `npm test` — 297 passing
- [ ] `npm run build` — clean
- [ ] Merge to `main` and push

## Enable in Vercel

- [ ] Project → Analytics → enable **Web Analytics**
- [ ] Project → Speed Insights → enable **Speed Insights**

Both are separate toggles. Enabling one does not enable the other.

## Verify after deploy

**Beacons fire.** Open the deployed site with the Network tab open.

- [ ] `/_vercel/insights/*` requests appear (Web Analytics)
- [ ] `/_vercel/speed-insights/*` requests appear (Speed Insights)

If nothing fires, check an ad-blocker first — it is the most common cause and it suppresses these silently. Confirm in a clean profile before assuming the code is broken.

**Route normalization.**

- [ ] Visit `/editor/<some-real-id>`, then navigate to another page and back
- [ ] Dashboard shows **`/editor/[id]`**, not the raw document ID

A raw ID here means `normalizeRoute` is not reaching the vendor components. Both the `route` prop (Speed Insights) and `beforeSend` (Analytics) must be wired — a swap between them fails silently, which is why `src/observability/analytics.test.jsx` asserts the wiring.

**Custom events.**

- [ ] Run one résumé analysis → `ai_analysis_run` appears
- [ ] Create one application → `application_created` appears
- [ ] **Edit an existing application → NO `application_created` fires**

That last check is the important one. The `save` mutation in `ApplicationDrawer.jsx` handles both create and update, so without the `!isEdit` guard the event fires on edits too and silently inflates the metric — and the dashboard would still look entirely plausible.

Also note `ai_analysis_run` fires on *attempt*, not success, so a failed analysis still counts. Given past OpenRouter free-tier flakiness, a gap between event count and successful analyses is expected, not a bug.

**Privacy modal.**

- [ ] Opens from the Landing header (`/welcome`)
- [ ] Opens from the Login footer (`/login`)
- [ ] Opens from the Layout footer while logged in
- [ ] Closes via the X, the backdrop, and Escape

**Core Web Vitals.**

- [ ] Wait ~24h, then confirm LCP / CLS / INP have a usable sample

Field data needs real traffic. An empty chart on day one is normal.

## Update docs after deploying

These live at the **project root**, which is not a git repo — edit them directly, nothing to commit.

- [ ] `TRACKER.md:6` — currently says V3-22 is "built and tested on `feat/observability-fe-web-analytics`, not yet merged/deployed". Update to deployed once it is.
- [ ] `TRACKER.md` V3-22 entry — same correction
- [ ] `TASKS.md` — the FE item says "built as V3-22 … not yet merged/deployed"; match the convention used by V3-18 through V3-21 once merged

## Known gaps and deferred items

Not blocking, recorded so they are not rediscovered later.

**Free tier: 50,000 events/month**, shared between page views and custom events, with 1-month retention. `application_stage_changed` was deliberately dropped — kanban drags are high-volume and low-signal.

**Ad-blockers undercount.** Same limitation already documented for Sentry in the P1.5 learnings. Client-side RUM is directional, not exact.

**No catch-all `*` route** in `src/App.jsx`, so unmatched URLs render nothing and produce no page view. A small 404-page task if you want it.

**`normalizeRoute` strips trailing slashes generically**, not just under `/editor`. This is intentional — it merges `/applications/` and `/applications` into one row — and it cannot affect the root path.

**Privacy claim needing periodic recheck:** the modal states that only résumé analysis has an AI toggle, and that cover-letter generation, résumé tailoring, and posting auto-fill always use AI. Verified against `SmartJobSearchCRM-BE` (`analysis.service.js:58`, `:176`, `:253`; `postings.service.js:78`) at time of writing. **If a new feature sends user content to OpenRouter, update `PrivacyPolicyModal.jsx` in the same change** — the modal is the only place this is disclosed outside `Analysis.jsx`.

## Next in the observability programme

**P3 (optional):** scheduled synthetic golden-path check — log in as demo, run an analysis — to catch breakage the shallow health check misses.
