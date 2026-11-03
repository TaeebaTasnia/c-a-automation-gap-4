# Claude Handover

> Keep this current. If an agent stops, the next one resumes from here.

## Goal (PHASE 2 — current)
**Build the Carrier Allocation & Utilization Tracker** (`tracker.html`): a new polished pixel-art ("Shore Ship" look) dashboard satisfying the BRD (`business_requirement_document/*.docx`: source of truth for business rules only, not design) and keeping/improving the export features of `prev/Index.html` (reference for logic + export only). Full build spec, contracts and test fixtures: **`SPEC_TRACKER.md`** — read it first.

## Goal (PHASE 1 — done)
Build the first page (the landing page) using the animation from the Claude Design project
https://claude.ai/design/p/180462e0-7e74-4ba9-88eb-4046ed10404c — files `Shore Ship.dc.html` and the `support.js` it imports.

## Current status
Phase 2 BUILT and Opus-reviewed 2026-11-03: Next.js app with `/` landing and `/tracker` dashboard; typecheck, lint, 38 Vitest tests and static build pass; settled-state screenshot checked. Remaining: user acceptance, possible Apps Script/Sheets backend, extra review items below.
Animation ported and working (checked with headless Chrome screenshots). The rest of the landing page (headline, call to action, sections) is not built yet.

## Done so far
- 2026-11-03: Set up handover file, mistake log, and global rules (`~/.claude/CLAUDE.md`).

- 2026-11-03: Imported `Shore Ship.dc.html` from Claude Design and ported it to plain HTML/CSS/JS (no React, no dc-runtime `support.js`).

- 2026-11-03: Fleet DONE (Sonnet). Tidewell (green, left to right, lane 0.25H, on screen at load) and Kestrel (grey, mirrored, right to left, lane 0.36H). The user skipped the Opus review for this animation. Known: on phone width, Kestrel starts partly cut off at the right edge (not investigated).

- 2026-11-03: Created private GitHub repo https://github.com/TaeebaTasnia/c-a-automation-gap-4 (branch `main`) and pushed everything. `.claude-flow/` is gitignored.

## In progress
- (done) Adding a fleet of 2 extra ships with fictional company liveries, so a ship is visible right away. Opus planned it (spec below); a Sonnet subagent is implementing it.
  Spec: in `js/shore-ship.js`, refactor the sprite builder to take a livery; add `this.fleet` of cruising ships (own lane, speed, start phase, direction, wake); one ship starts on screen at load; one sails right to left; draw ships in order of y; leave the original ship and its pieces logic unchanged.

- 2026-11-03: Read BRD + `prev/Index.html`; wrote `SPEC_TRACKER.md`. Decisions: persistence = localStorage behind a swappable backend adapter (Apps Script/Sheets is the BRD's production platform); charts hand-drawn SVG (no CDN, BRD NFR-08); allocation % total != 100 only warns (BRD lists blocking as a suggestion, not a requirement); no invented "underutilized" threshold; year-total deficit sums weeks per BR-13; header Export (2 CSVs, all years) and in-page range export (CSV + copy) both kept from prev; landing page gets an "Open tracker" button.

- 2026-11-03: Agent A (Sonnet) DONE: `js/tracker/logic.js`, `js/tracker/store.js`, `tests/logic.test.js` (25 tests pass, re-run and logic reviewed by Opus: matches BRD BR-01..15 and prev export structure). Agent B (UI) still running.

- 2026-11-03: USER CHANGED PLATFORM: no plain HTML, use Next.js. Stopped the HTML UI agent (B), deleted its partial `tracker.html`. Spec got a "PLATFORM OVERRIDE" section (Next.js App Router + TS, plain CSS/CSS Modules, Vitest, static export, `/` landing + `/tracker`). Agent C (Sonnet) now scaffolds Next.js at repo root, ports logic/store to `src/lib/*.ts` + Vitest, ports the Shore Ship landing to `src/components/ShoreShip.tsx`, deletes legacy html/js/css. Then Agent D builds the tracker UI.

- 2026-11-03: Agent C DONE and Opus-verified (typecheck, lint, 25 Vitest tests, build OK; landing screenshot OK): Next.js 16.4.4 + React 19.3 + TS 6 + Vitest 5 at repo root; `src/lib/{logic,store}.ts`; `src/components/ShoreShip.tsx`; `/` landing with "Open tracker" button; legacy html/js/css deleted. NOTE: repo path contains `&` so use `npm run <script>` (never npx / .cmd shims); big bash heredocs fail, use the Write tool.
- 2026-11-03: Agents D1 (visual components in `src/components/tracker/visuals/`: PixelSea, KpiRow, CarrierCards, WeeklyChart, CarrierChart, ShareBar, format.ts) and D2 (useTracker hook, `/tracker` page, toolbar/tabs/tables/dialogs/export, `src/lib/exports.ts`, `sanitize.ts`) running in parallel. D1 leaves a TEMP page `src/app/dev-visuals/page.tsx` that Opus must delete after review.

- 2026-11-03: D1 (visuals) and D2 (shell, tables, dialogs, export, `useTracker`, `exports.ts`, `sanitize.ts`) DONE. Opus: deleted temp `src/app/dev-visuals`, cleared stale `.next`, clean `npm run typecheck/lint/test(38)/build` OK, viewed screenshots (light/dark/390). D2 browser e2e (CDP, 51 checks) reported pass incl. export CSV == `toCsv(exportRange)`. Committed + pushed.
- Known gaps (from agents): WeeklyChart doesn't scroll selected week into view for 53-week years; toolbar not sticky below 640px; daily-table footer shows signed actual-vs-forecast delta instead of prev's ratio; keyboard-only paths (arrow-key tabs, week chips) untested; KPI number tick-up shows intermediate values for ~400ms; storage is localStorage only (BRD platform = Apps Script + Sheets; swap `Backend` in `src/lib/store.ts`).

## Next steps
- (Phase 2 done) Await user feedback; consider Apps Script/Sheets backend and the known gaps above.
- (revised) C scaffold -> D tracker UI (`src/components/tracker/*`, `charts/*`, `src/app/tracker/page.tsx`) -> Opus review -> commit/push. Ignore the older Phase 2 step list below where it mentions html/js files.
- Phase 2: (1) Sonnet agent A -> logic.js/store.js/tests; (2) Sonnet agent B -> tracker UI; (3) Opus review vs BRD + screenshots + export check; (4) commit/push.
- Add landing-page content (copy, call to action) on top of the canvas. The user hasn't specified it yet (only the "Open tracker" button is planned).
- Possibly start the ship partway across the screen. It currently starts off-screen and takes about 10 seconds to appear.

## Key files & decisions
- `index.html`: the landing page.
- `js/shore-ship.js`: the `ShoreShip` canvas class, a 1:1 port of the design's script.
- `css/shore-ship.css`: full-screen stage styles.
- Decision: we don't use `support.js`. It is only the Claude Design runtime, and the animation code is self-contained.

## Open questions
