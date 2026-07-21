# FE Web Analytics + Speed Insights — Design

**Date:** 2026-07-21
**Scope:** Frontend only (`jobtrail-fe`)
**Status:** Approved for planning
**Round:** Observability P3-adjacent — the "FE Web Analytics" item deferred by P1, P1.5, P2, and the log drain round

## Problem

`TASKS.md:76` has carried one unshipped observability item across four rounds: frontend Web Analytics. The app has backend error tracking (Sentry, P1), frontend error tracking (P1.5), structured logging (P2), and a Sentry-based log drain — but no traffic data and no field performance data. Core Web Vitals are entirely unmeasured in production.

The tracker text says "Vercel Web Analytics (Core Web Vitals)". This conflates two distinct Vercel products:

- **Web Analytics** (`@vercel/analytics`) — pageviews, referrers, custom events
- **Speed Insights** (`@vercel/speed-insights`) — Core Web Vitals field data (LCP, CLS, INP)

Core Web Vitals come from Speed Insights, not Web Analytics. This round ships **both** and corrects the tracker wording.

## Goals

1. Pageview analytics with readable route aggregation (no per-record-ID row explosion).
2. Core Web Vitals field data from real sessions.
3. Two product events: `ai_analysis_run`, `application_created`.
4. A user-facing privacy disclosure, since the app now collects analytics.
5. Zero regressions in the existing Vitest suite.

## Non-goals

- **P3 synthetic golden-path check** — still deferred, still optional.
- **Sentry Session Replay** — deferred since P1.5, unchanged.
- **Sentry performance tracing** — deliberately off (`tracesSampleRate: 0`). Speed Insights covers field performance; tracing is a separate, heavier decision documented in the learnings guide §5.
- **Consent gating / cookie banner.** Both products are cookieless and collect no PII. Disclosure is provided instead (see Privacy Modal).
- **`application_stage_changed`** — considered and dropped. Kanban drags are the highest-volume user action and would consume a disproportionate share of the free-tier event pool for low analytical value.

## Constraints

**Free tier is a hard constraint.** Vercel Hobby provides:

- **50,000 events/month**, shared across pageviews *and* custom events
- **1 month data retention**

Custom events are *not* plan-gated — `track()` works on Hobby. The quota, not the plan, is the limiting factor. This is why the event set is deliberately small.

**Stack facts that shape the design:**

- Vite 6 + React 18, **JS/JSX only — no TypeScript anywhere**
- `react-router-dom` 6.30.4, plain `<BrowserRouter>` (not a data router)
- `src/test/setup.js` runs MSW with `onUnhandledRequest: 'error'` — any un-mocked network call fails the test
- Deployed on Vercel (`vercel.json`, `framework: vite`, SPA catch-all rewrite)

## Architecture

### Mount point — a sibling of `<App/>` inside `<BrowserRouter>`

The analytics components mount in `src/main.jsx`, as a sibling of `<App/>`:

```jsx
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <WebVitals />
  <App />
</BrowserRouter>
```

**Why not inside `App.jsx`** (the Vercel docs' default): `App.jsx` is rendered by many component tests. With MSW in `onUnhandledRequest: 'error'` mode, the analytics beacon would fail every one of those tests, forcing a global `vi.mock` in `src/test/setup.js`. `main.jsx` has no unit tests, so this placement keeps the test setup untouched.

**Why inside `BrowserRouter`**: route normalization needs `useLocation()`.

**Why no env gate**: the established codebase idiom is env-var *presence* (`VITE_SENTRY_DSN`), but there is no analogous var here — both packages self-disable outside Vercel. A gate would invent an env var for no behavior change. Rejected as ceremony.

### New module — `src/observability/analytics.jsx`

Lives alongside `sentry.js` and `chunkReload.js`, following the existing `src/observability/` convention. Exports:

| Export | Purpose |
|---|---|
| `<WebVitals />` | Renders `<Analytics/>` + `<SpeedInsights/>`, both with the normalized `route` |
| `trackEvent(name, props)` | Thin wrapper over `track()` |
| `normalizeRoute(pathname)` | Pure function, exported for testing |

`trackEvent` mirrors the indirection `captureError` already provides over Sentry: call sites never import the vendor SDK directly, so the analytics provider stays swappable and the call sites stay testable.

### Route normalization

`/editor/:id` is the **only** parameterized route in the app — verified across every `path` in `src/App.jsx:33-50`.

For React/Vite, Vercel does **not** auto-populate the `route` prop (it does for Next.js, Nuxt, SvelteKit, and Remix). Without it, every document ID becomes its own dashboard row and burns quota.

`normalizeRoute` maps `/editor/<anything>` → `/editor/[id]` and passes everything else through unchanged. A pure `pathname → string` function, kept separate from the component so it can be unit-tested without rendering.

Two notes:
- The layout route at `App.jsx:36` is pathless, not parameterized — it needs no handling.
- There is no catch-all `*` route, so unmatched URLs render nothing and produce no pageview. Out of scope here; worth noting as a gap.

### Custom events

Two events, both fired through `trackEvent`.

**`ai_analysis_run`** — `src/pages/Analysis.jsx`

Fires in the `onRun` submit handler (line 51), *not* in `onSuccess`. Rationale: we want to measure analysis *attempts*, including failures — an analysis that errors is exactly the signal worth having. `onRun` already returns early on validation failure, so it fires only on genuine submits.

Property: `{ ai: useAi && aiAvailable }` — distinguishes AI-backed runs from deterministic ones.

Do **not** hook the sibling mutations on this page (`openHistory` line 38, `remove` line 43) — those are history viewing and deletion, not runs.

**`application_created`** — `src/components/ApplicationDrawer.jsx`

Fires in the `save` mutation's existing `onSuccess` (line 171), **guarded on `!isEdit`**.

This guard is essential and is the main correctness risk in this round. The `save` mutation is create-and-update combined, branching on `isEdit` inside `mutationFn` (line 170). Its `onSuccess` takes no arguments. An unguarded `trackEvent` there would fire on every application *edit* as well as every creation, silently inflating the metric — and because the dashboard would still look plausible, the error would be hard to notice later.

`createApplication` (`src/api/applications.js:11-13`) has exactly one call site, so this single mutation is the complete insertion surface.

### Privacy modal

New component `src/components/PrivacyPolicyModal.jsx`. A modal, not a route — no router changes.

Content covers what the app actually collects:

- **Vercel Web Analytics / Speed Insights** — cookieless, aggregate, no PII
- **Sentry** — error reports; `Authorization` headers scrubbed before send (already implemented in `sentry.js:scrub`), `sendDefaultPii: false`
- **OpenRouter** — résumé and job-description text is sent to a third party for AI analysis. This disclosure currently exists only as inline copy at `Analysis.jsx:87`; the modal makes it discoverable before a user reaches that page.

Two triggers:

1. **`src/pages/Login.jsx`** — link in the card footer, after line 68, matching existing `text-sm text-slate-600` styling.
2. **`src/pages/Landing.jsx`** — button in the header group (lines 32–38), alongside the GitHub link and Log in. Note the GitHub `<a>` is mobile-hidden (`hidden ... sm:inline-flex`) while Log in is always visible; the privacy trigger follows the always-visible pattern.

## Testing

| Target | Test |
|---|---|
| `normalizeRoute` | Unit — `/editor/abc123` → `/editor/[id]`; `/applications` unchanged; `/editor` (no ID) unchanged; trailing-slash and nested-segment cases |
| `trackEvent` | Unit — delegates to `track` with correct name/props; does not throw when the SDK is unavailable |
| `PrivacyPolicyModal` | Render — opens on trigger, closes, content present |
| Trigger wiring | Render — Login and Landing each expose a working trigger |

**No changes to `src/test/setup.js`.** Keeping `<WebVitals/>` out of `App.jsx` is what buys this; if a future change moves it into the component tree, a `vi.mock` for both packages becomes mandatory or the suite breaks under `onUnhandledRequest: 'error'`.

Existing precedent to follow: Sentry tests mock the SDK locally (`src/observability/sentry.test.js`), not globally.

## Verification

Analytics cannot be verified locally — both products only report from a Vercel deployment.

1. `npm test` — full suite green
2. `npm run build` — clean
3. Deploy to Vercel
4. Confirm `/_vercel/insights/*` and `/_vercel/speed-insights/*` beacons fire in the Network tab
5. Visit `/editor/<some-id>`; confirm the dashboard shows `/editor/[id]`, not the raw ID
6. Trigger one analysis and create one application; confirm both events land
7. Edit an existing application; **confirm no `application_created` event fires** — this directly verifies the `isEdit` guard
8. Allow ~24h for Core Web Vitals to accumulate a usable sample

## Documentation updates

- `TASKS.md:76-78` — mark FE Web Analytics done; fix the Web Analytics / Core Web Vitals conflation; leave P3 open
- `TRACKER.md:6` and the V3-21 entry — update the current-phase line; add a V3-22 entry
- `docs/learnings/production-observability-101.md` — new section on Real User Monitoring, covering the Web Analytics vs. Speed Insights distinction, why RUM differs from synthetic (Lighthouse) measurement, and the framework-specific `route` gap that makes SPA route normalization a manual step

Note: the learnings guide stays at the project root, since it spans both BE and FE. This spec and its plan live in the FE repo, where they are version-controlled — a deliberate divergence from P1/P1.5, whose root-level docs are unversioned.

## Risks

| Risk | Mitigation |
|---|---|
| `application_created` fires on edits | `!isEdit` guard; verification step 7 tests it explicitly |
| Analytics beacons break the test suite | Mount in `main.jsx`, outside the tested component tree |
| Free-tier quota exhaustion | Two events only; `application_stage_changed` dropped; 50k/mo headroom is ample at portfolio traffic |
| Ad-blockers suppress beacons | Accepted and expected — same limitation already documented for Sentry in learnings §P1.5. Analytics undercounts; this is inherent to client-side RUM, not a defect |
| Raw IDs leak into the dashboard | `normalizeRoute` + unit tests + verification step 5 |
