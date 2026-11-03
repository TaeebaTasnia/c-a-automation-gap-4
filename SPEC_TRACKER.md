# SPEC — Carrier Allocation & Utilization Tracker (build spec for implementers)

## >>> PLATFORM OVERRIDE (user instruction, supersedes "no build step", "File layout" and every `.html`/`.js` path below) <<<
The user said: **do not use plain HTML; use Next.js (and the usual modern stack) for the frontend**. So:
- One **Next.js (App Router) + TypeScript** app at the repo root. Routes: `/` = the Shore Ship landing page (ported to a client component, animation behaviour unchanged, plus an "Open tracker" button), `/tracker` = the dashboard.
- Styling: plain CSS (global CSS custom properties + CSS Modules), NOT Tailwind (we need exact pixel-art control). Fonts via `next/font/google` (pixel display face) with monospace fallback.
- Charts: hand-written React SVG components (`src/components/charts/*`), no chart library.
- Business logic stays pure and framework-free in `src/lib/` as TypeScript: port `js/tracker/logic.js` -> `src/lib/logic.ts`, `js/tracker/store.js` -> `src/lib/store.ts`, with the SAME API/semantics (types added). Tests with **Vitest** (`npm test`), porting `tests/logic.test.js` 1:1 (all 25 must still pass). The old `js/tracker/*.js` + `tests/logic.test.js` are deleted once ported (git history keeps them).
- State/UI: React client components with hooks (`useReducer`/context or a small `useTracker` hook wrapping the store). Autosave/dirty-state, numeric-only inputs, focus+caret preserved while typing (controlled inputs make this natural — do NOT remount inputs on every keystroke; stable `key`s), `beforeunload` guard, `prefers-color-scheme` + `prefers-reduced-motion`.
- `localStorage` access only inside effects / client components (SSR-safe; no hydration mismatches: render a loading skeleton until the store has loaded; date-dependent UI ("today", current week) computed on the client after mount).
- Static export is fine (`output: 'export'` in next.config) so the app can be hosted anywhere; do NOT add a server/API/database.
- Legacy files `index.html`, `css/shore-ship.css`, `js/shore-ship.js` are replaced by the Next.js landing (keep `js/shore-ship.js` logic verbatim inside `src/components/ShoreShip.tsx`; delete the legacy files after porting). `prev/` and `business_requirement_document/` stay untouched.
- Target layout: `src/app/{layout.tsx,globals.css,page.tsx,tracker/page.tsx}`, `src/components/{ShoreShip.tsx,tracker/*,charts/*}`, `src/lib/{logic.ts,store.ts}`, `src/lib/__tests__/*.test.ts`, `public/`.
- Everything else below (business rules, contracts' semantics, functional checklist, export, design brief, fixtures) still applies unchanged; read `index.html` as `ShoreShip.tsx`, `app.js` as the React components, `charts.js` as the chart components, `pixelsea.js` as a `PixelSea` client component (canvas in `useEffect`, cleanup on unmount).

Sources of truth
- **Business rules / functions**: `business_requirement_document/*.docx` (FR-01..30, BR-01..15, DR-*, NFR-*). Extracted rules are restated below. Ignore any UI/design decisions in the BRD.
- **Reference implementation (logic + export only, NOT design)**: `prev/Index.html`. Port its logic faithfully: `allocate`, `calcWeek`, `isoWeekOf`, `weekDates`, `exportData` (lines ~486-510), `weeklyRows`/`dailyRows` (~616-641), `loadSample` (~674-691), settings dialog behaviour, autosave behaviour.
- **Design identity**: `index.html` + `js/shore-ship.js` + `css/shore-ship.css` (the "Shore Ship" pixel-art landing page). Read them for the palette and the ordered-dither (Bayer 4x4) technique.

Deliverable = static site, **no build step, no CDN dependency for charts** (BRD NFR-08 flags the CDN as a risk): plain HTML/CSS/vanilla JS, opens from `file://` or any static server. Charts are hand-drawn inline SVG/canvas.

## File layout (exact)
```
tracker.html                 page shell (UI agent)
css/tracker.css              all styles (UI agent)
js/tracker/logic.js          PURE business logic, no DOM (logic agent)
js/tracker/store.js          persistence adapter + autosave controller (logic agent)
js/tracker/charts.js         SVG chart helpers (UI agent)
js/tracker/pixelsea.js       animated dithered sea header strip (UI agent)
js/tracker/app.js            state, rendering, events, export download/copy (UI agent)
tests/logic.test.js          node test (no deps) for logic.js + store.js (logic agent)
index.html                   landing page: ADD one pixel-styled "Open tracker" link to tracker.html (UI agent). Do not change the animation.
```
Load order in tracker.html: logic.js, store.js, charts.js, pixelsea.js, app.js (classic scripts, no modules, so `file://` works).

## Contract: `js/tracker/logic.js`
Browser: attaches `window.CAT`. Node: `module.exports = CAT` (use `typeof module !== 'undefined'`). All functions pure. Dates are `'yyyy-mm-dd'` strings.

```
CAT.CARRIERS   = [{id:'maersk',name:'MAERSK',color:'#3f7fa6'},{id:'hapag',name:'HAPAG',color:'#c9793f'},
                  {id:'hellman',name:'HELLMAN',color:'#4f8a6a'},{id:'one',name:'ONE',color:'#a8456f'},
                  {id:'fml',name:'FML',color:'#7d8590'}]
CAT.ALLOC      = first four carriers (they get a % of the forecast; FML does not — BR-02)
CAT.DEFAULT_CFG= {cbmPerTeu:33, fmlDefault:10, pct_maersk:30, pct_hapag:25, pct_hellman:20, pct_one:25}
CAT.WEEKLY_KEYS= ['year','week','forecast','fml_fcst', then for each carrier: id+'_conf', id+'_util']
CAT.num(v)                      '' / null / NaN -> 0
CAT.isoWeekOf(dateStr)          -> {year, week}
CAT.weekDates(year, week)       -> 7 date strings Mon..Sun (ISO)
CAT.dowName(dateStr)            'Mon'..; CAT.fmtDate(dateStr) '19-Oct-26'
CAT.newWeek(year, week, cfg)    -> weekly row; forecast '' ; fml_fcst = cfg.fmlDefault; all conf/util ''
CAT.allocate(total, cfg)        -> {maersk,hapag,hellman,one} each Math.round(total*pct/100)   (BR-01)
CAT.calcWeek(w, cfg, daily)     -> see below
CAT.yearSummary(weeks, cfg, daily) -> {rows:[{week:w, c:calcWeek}], total:{f,c,u,a,l,d}}  (BR-13 sums forecast, confirmed, utilized, toBeArrived, left, deficit)
CAT.status(deficit)             -> 'deficit' (< -0.5) | 'surplus' (> +0.5) | 'balanced'    (BR-11)
CAT.dayStats(row, cfg)          -> {dayTotal, fcstTeu, actTeu, hasAct, vs}  vs = actCbm/fcstCbm-1 only if fcstCbm>0 and hasAct else null (BR-15)
CAT.sampleData(cfg)             -> {weekly:[3 rows], daily:[7 rows]}  exactly the prev loadSample data (weeks 43-45 2026)
CAT.exportRange(weeks, cfg, daily)   -> {ws, wh, wr, dh, dr, rows}   port of prev exportData; `weeks` already filtered to range
CAT.weeklyRows(allWeeks, cfg, daily) -> array of arrays incl. header row   port of prev weeklyRows (all years)
CAT.dailyRows(daily, cfg)            -> array of arrays incl. header row   port of prev dailyRows (all years)
CAT.toCsv(rows)  -> '\uFEFF' + CRLF-joined, RFC4180 quoting (prev csvEsc)      CAT.toTsv(rows) -> tab/LF joined
```
`calcWeek(w, cfg, daily)` returns exactly prev's object: `dates, fc, conf, util, left, dsum, fromDaily, pct, share, totalConf, totalUtil, leftTotal, fcstCbm, actCbm, basis, actTeu, toBeArrived, deficit, cbmPlan, utilPct, vsForecast`. `daily` is a map `{ 'yyyy-mm-dd': {date,maersk,hapag,hellman,one,fml,fcstCbm,actCbm} }`. `cfg.cbmPerTeu <= 0` falls back to 33 inside calc (settings reject <=0 separately, FR-22).

Rules to implement (BRD section 7):
- BR-03 carrier utilized = sum of week's daily TEUs if > 0, else typed weekly `*_util`.
- BR-04 left = conf - util. BR-05 util% = util/conf, null if conf = 0. BR-06 share = util/total util, null if total 0.
- BR-07 basis = sum(daily fcstCbm)/cbm if any daily fcstCbm > 0 else weekly forecast. BR-08 actTeu = sum(actCbm)/cbm. BR-09 toBeArrived = max(0, basis - actTeu).
- BR-10 leftTotal = totalConf - totalUtil (all five carriers). BR-11 deficit = leftTotal - toBeArrived.
- BR-12 cbmPlan = forecast * cbm.
- Export column structure/rounding: identical to prev (headers, order, `%` strings, r1 rounding, BOM+CRLF CSV).

### Fixtures logic tests MUST assert (from sample data, cbm 33, default pcts)
- Week 43 (forecast 100, fml_fcst 10, conf 30/20/12/25/15): fc = 30/25/20/25 + fml 10; daily sums maersk 26, hapag 20, hellman 12, one 20, fml 10 => totalUtil 88, totalConf 102, leftTotal 14; fcstCbm 3575, actCbm 2235; basis 108.333; actTeu 67.727; toBeArrived 40.606; deficit -26.606 (status 'deficit'); pct maersk 26/30; fml 10/15.
- Week 44 (forecast 79, conf 25/20/10/0/0): allocate -> 24/20/16/20 (sum 80 != 79, BR-01), util 0, toBeArrived 79, leftTotal 55, deficit -24.
- Week 45 (forecast 54, no conf): toBeArrived 54, deficit -54, utilPct null.
- Zero-conf carrier pct null; `vs` for 2026-10-19 = 415/240-1; `vs` null when actCbm blank.
- isoWeekOf('2026-11-03') = {2026,45}; weekDates(2026,43)[0]='2026-10-19', [6]='2026-10-25'; isoWeekOf('2026-12-31') -> {2026,53}; isoWeekOf('2027-01-01') -> {2026,53}.
- exportRange for weeks 43-44: 2 weekly rows, 14 daily rows; first header cells 'Year','Week','Start','End'; CSV starts with BOM and `WEEKLY SUMMARY`.
- weeklyRows / dailyRows cover all weeks/dates sorted.

## Contract: `js/tracker/store.js`  -> `window.CAT.store` (+ node export on same object)
```
CAT.createStore({backend, delay=1100, onState}) -> store
  backend: {getAll(), saveConfig(cfg), saveWeekly(rows), deleteWeek(year, week), saveDaily(rows)}   (each returns Promise)
CAT.localBackend(storageLike, key='cat_db')  default backend over localStorage (inject a fake storageLike in tests). Upsert semantics: DR-01 (key year+week / date), rows kept sorted (year, week) / date. deleteWeek removes the weekly row ONLY, daily rows stay (DR-04).
  First run seeding (DR-05/FR-27): if BOTH weekly and daily are empty and no 'seeded' flag, seed CAT.sampleData and set the flag (so deleting everything later does not re-seed).
store.load()                -> Promise<{config, weekly, daily}> ; config = {...DEFAULT_CFG, ...saved}; weekly rows normalised to WEEKLY_KEYS ('' for missing, year/week Numbers); daily -> map by date
store.state                 -> 'loading'|'dirty'|'saving'|'saved'|'error'
store.markWeek(row) / store.markDaily(row)   queue a row; state 'dirty'; debounce `delay` ms (FR-23, ~1.1 s), then flush
store.flush()               serialises saves (no overlap — if saving, reschedule); on success state 'saved' (or 'dirty' if more queued); on failure state 'error', the rows STAY queued and retry on next edit (NFR-09)
store.hasUnsaved()          true if queued or saving (used by beforeunload, FR-24)
store.saveConfig(cfg) / store.deleteWeek(year,week) / store.refresh()    thin wrappers; saveConfig rejects (throws Error) when cbmPerTeu <= 0 (FR-22)
```
`onState(state, message)` fires on every state change. Tests must cover: debounce coalescing, failure keeps queue and error state then recovers, upsert/sort, delete keeps daily, seeding once.
Note in a header comment: swapping `backend` for a Google Apps Script `google.script.run` / Sheets backend is the intended production path (BRD platform); the shape is the same as prev's `api_*` functions.

## Contract: UI (`tracker.html`, `css/tracker.css`, `js/tracker/{charts,pixelsea,app}.js`)
UI reads ALL numbers from `CAT.calcWeek`/`CAT.yearSummary`/`CAT.dayStats` and ALL export content from `CAT.exportRange/weeklyRows/dailyRows/toCsv/toTsv`. No business arithmetic in the UI layer except pure layout maths (bar widths etc.). Charts, KPI cards and tables must be fed from the same `calcWeek` results.

### Functional checklist (every item is required; ids from BRD)
- FR-01 year + week selectors; opens on the current ISO week if it exists. FR-02 add week 1-53 for selected year, duplicates not created, invalid -> toast. FR-03 delete week: two-click confirm, button becomes "Sure?" for 3 s; toast says date-wise rows are kept. FR-04 header shows week date range (Mon-Sun) and "1 TEU = N CBM". FR-05 "Current week" button; if week not set up, toast says so.
- FR-06..10 weekly allocation table: total forecast input ("TEUs +25%"); Maersk/Hapag/Hellman/ONE forecast are calculated cells; FML forecast is an input; confirmed inputs for all five; utilized input per carrier which becomes a calculated cell when the carrier has daily data (BR-03). Row click selects the week.
- FR-11..14 date-wise table for the selected week (7 days): five carrier TEU inputs, forecast CBM, actual CBM inputs; calculated: day total, forecast TEUs, actual TEUs, actual-vs-forecast % (green positive / red negative; blank when not computable); footer rows: total utilized, confirmed, utilized, left (negative red), % utilized of confirmed, % share of total utilized; today's row highlighted + "today" chip.
- FR-15 KPI tiles: Forecast (+ CBM equivalent), Confirmed (+ signed vs forecast), Utilized (+ % of confirmed, % of forecast), Left in hand, To be arrived, Deficit/Surplus (red/green/neutral per `status`, with label "Deficit - more space needed" / "Surplus - space in hand" / "Balanced"), Today (TEU used + actual CBM vs forecast CBM) or "Week CBM" when today is outside the week.
- FR-16 carrier cards: utilization % (— when conf 0), progress bar that turns red above 100%, forecast, confirmed, utilized, left (red if negative), share of used (+ target % for the four allocated carriers), chip comparing confirmed vs forecast (negative = bad/red, positive = good, zero = "on forecast").
- FR-17 weekly bar chart (forecast / confirmed / utilized per week of selected year; clicking a week selects it). FR-18 per-carrier bar chart for the selected week. Both with hover tooltips (exact values), legend, keyboard-accessible labels (`<title>`/aria).
- FR-19 weekly summary table (every week of the year, columns as prev: week, forecast, total confirmed, total utilized, util %, to be arrived, to be utilized (= left in hand, show as "Left in hand / To be utilized"), deficit/surplus with word, CBM +25%, TEUs, per-carrier forecast) + YEAR TOTAL row when more than one week (BR-13).
- FR-20 deficit red, surplus green; progress bars red above 100%.
- FR-21/22 settings dialog: four allocation %, FML default forecast, CBM per TEU; live "Total: N%" green at exactly 100, red otherwise (does not block saving); CBM <= 0 rejected with toast. Includes "Load sample data".
- FR-23/24/25 save-state pill with labels exactly: Loading, Unsaved changes, Saving, All changes saved, Save failed; `beforeunload` warning when `store.hasUnsaved()`; Refresh button reloads from store.
- FR-26 numeric fields accept only digits and one decimal point (strip others on input, keep caret).
- FR-27 "Load sample data" (empty state button + settings); first run seeds automatically (store does this).
- NFR-06 calculations update on every keystroke and **focus + caret are preserved** while typing (prefer patching calculated cells in place; if re-rendering a table, restore focus/caret like prev's `renderAll`).
- NFR-07 responsive (works at 390 px wide: tables scroll horizontally with a sticky first column) and follows `prefers-color-scheme` (light "sand/sea" + dark "night sea" palettes).
- NFR-08 no external chart library. Fonts: may use Google Fonts for the pixel display face with a monospace fallback, but nothing may break if offline.

### Export (FR-28..30) — must not lose anything from prev
1. **Export panel (in-page)**: From/To week selectors (selected year), shows week count, **Download CSV** (`carrier-utilization_<year>_W<from>-W<to>.csv`, weekly summary block + blank row + `DATE-WISE DETAIL` block, via `CAT.exportRange` + `CAT.toCsv`) and **Copy for Excel / Sheets** (TSV of the same rows, clipboard API with `execCommand` fallback, toast on success/failure). From > To is auto-corrected.
2. **Header Export button -> dialog**: two datasets covering ALL years — Weekly report (`carrier-weekly-<yyyy-mm-dd>.csv`) and Daily data (`carrier-daily-<yyyy-mm-dd>.csv`) — each with Download CSV + Copy, plus "Download both" (second file delayed ~400 ms). Descriptions show live counts of weeks/days.
3. Exports must reflect the current in-memory data (including unsaved edits) and match the dashboard numbers (same `calcWeek`).

### Design brief (identity = "Shore Ship" pixel art, premium, purposeful)
Palette (from the landing page): sand `#f2f0ea`, wet sand `#e3e6df`, speck `#d8d2c4`, sea ramp `#e8eee9 #c3d6d3 #93b6b5 #64908f #41707a #2c555e`, hull navy `#24394a`/`#34506a`, funnel orange `#c26f3a`, red `#9b4a3a`. Semantic: good `#3f8a5a`, bad `#b4483a` (rust), warn `#d9a441`. Carrier colours in `CAT.CARRIERS`. Define all colours as CSS custom properties; provide a dark scheme (deep sea `#10202a`-ish background, same hues lifted) via `prefers-color-scheme`.
- **Pixel language**: hard edges, no soft shadows/gradients; 2 px solid borders with stepped ("notched") corners (clip-path polygon or box-shadow trick), offset hard drop-shadows (e.g. `4px 4px 0`), checker/Bayer dither patterns (CSS `conic-gradient`/`repeating` backgrounds at 2-4 px) for calculated cells, hatched "to be arrived" segments and section dividers. `image-rendering: pixelated` for canvases.
- **Typography**: pixel display face for title, section headers, KPI labels/numbers (suggest `Pixelify Sans` or `Silkscreen` from Google Fonts, fallback `ui-monospace, Menlo, Consolas, monospace`); body/table text in a clean legible system sans with `font-variant-numeric: tabular-nums`. Input cells must be highly legible. Consistent type scale, generous spacing, 8 px grid.
- **Header hero**: a short (about 110-150 px tall, full width) animated dithered sea strip (`pixelsea.js`) using the landing page's 4x4 Bayer technique and sea ramp, with a sand shoreline edge and 1-2 tiny pixel container ships drifting across; page title + week/CBM subtitle + save pill overlaid on a readable panel. Must pause when the tab is hidden and render one static frame under `prefers-reduced-motion`. Must not hurt performance (small offscreen buffer upscaled, ~30 fps cap).
- **Layout (top to bottom)**: hero strip; sticky toolbar (year, week chips/selector showing each week's deficit/surplus colour dot, Current week, Add week, Refresh, Export, Settings); KPI row with mini visuals (see below); carrier cards; two charts side by side; tabbed data area `Allocation | Date-wise | Summary` (segmented control, remembers last tab in `localStorage` in try/catch); export panel; footer line.
- **Purposeful visuals (every one must carry data)**: (a) a "Space vs demand" balance visual in the KPI area: pixel bars for Left in hand and To be arrived with the difference highlighted as deficit (red) / surplus (green) / balanced; (b) KPI tiles with a thin dithered sparkline or segmented bar where it adds meaning (e.g. Utilized vs Confirmed); (c) carrier cards use a segmented 20-block pixel progress bar, turning red beyond 100% with an overflow marker, plus a small marker for share-of-used vs target %; (d) charts: grouped pixel bars with crisp edges, hover tooltip, legend; the selected week is emphasised in the weekly chart; (e) allocation gap: stacked bar "Target share vs actual share of used" for the five carriers. Do not invent thresholds that are not in the BRD (no arbitrary "underutilized" cut-off). Over-utilization = above 100% of confirmed (FR-20); allocation gap = confirmed vs forecast chip (BR-14) and share vs target.
- **Motion**: subtle only: bars grow in on week change (stepped `steps()` easing for a pixel feel), number tick-ups under ~400 ms, hover lift on cards (hard shadow shifts 2 px), toast slide. All disabled under `prefers-reduced-motion`.
- Empty states are friendly and actionable (no weeks yet -> add week or load sample).
- Accessibility: visible focus rings (2 px), colour is never the only signal (words/icons for deficit/surplus), AA contrast for text, labels on inputs (`aria-label`), tables with proper `<th scope>`.
- Keep it intuitive. Avoid text-heavy panels; prefer visuals and short labels.

### Landing page
`index.html`: add a small pixel-styled link/button "Open tracker" to `tracker.html` (bottom-centre or bottom-right, above the canvas, readable on the sea/sand). Do not alter `js/shore-ship.js` behaviour. Make sure the button does not steal the canvas drag interactions (only the button area is clickable; `pointer-events` set on the button only).

## Verification (implementers must run; report real output)
- `node tests/logic.test.js` exits 0, prints pass count (logic agent).
- UI agent: open `tracker.html` in headless Chrome (find Chrome/Edge under `C:\Program Files*`), screenshots at 1440x900 and 390x844, light AND dark (`--force-dark-mode` or emulate), save under the scratchpad dir, LOOK at them and fix visual defects. Check the browser console has no errors (e.g. `--enable-logging=stderr --v=0` or `--dump-dom` with an inline error trap). Verify with a node/jsdom-free approach that export strings equal `CAT` output for the sample data.
- Do not commit. Do not touch `prev/`, the BRD, `CLAUDE_HANDOVER.md` or `claude.mistake` (the orchestrator owns those).
