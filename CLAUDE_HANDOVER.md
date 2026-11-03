# Claude Handover

> Keep this current. If an agent stops, the next one resumes from here.

## Goal
Build the first page (the landing page) using the animation from the Claude Design project
https://claude.ai/design/p/180462e0-7e74-4ba9-88eb-4046ed10404c — files `Shore Ship.dc.html` and the `support.js` it imports.

## Current status
Animation ported and working (checked with headless Chrome screenshots). The rest of the landing page (headline, call to action, sections) is not built yet.

## Done so far
- 2026-11-03: Set up handover file, mistake log, and global rules (`~/.claude/CLAUDE.md`).

- 2026-11-03: Imported `Shore Ship.dc.html` from Claude Design and ported it to plain HTML/CSS/JS (no React, no dc-runtime `support.js`).

- 2026-11-03: Fleet DONE (Sonnet). Tidewell (green, left to right, lane 0.25H, on screen at load) and Kestrel (grey, mirrored, right to left, lane 0.36H). The user skipped the Opus review for this animation. Known: on phone width, Kestrel starts partly cut off at the right edge (not investigated).

## In progress
- (done) Adding a fleet of 2 extra ships with fictional company liveries, so a ship is visible right away. Opus planned it (spec below); a Sonnet subagent is implementing it.
  Spec: in `js/shore-ship.js`, refactor the sprite builder to take a livery; add `this.fleet` of cruising ships (own lane, speed, start phase, direction, wake); one ship starts on screen at load; one sails right to left; draw ships in order of y; leave the original ship and its pieces logic unchanged.

## Next steps
- Add landing-page content (copy, call to action) on top of the canvas. The user hasn't specified it yet.
- Possibly start the ship partway across the screen. It currently starts off-screen and takes about 10 seconds to appear.

## Key files & decisions
- `index.html`: the landing page.
- `js/shore-ship.js`: the `ShoreShip` canvas class, a 1:1 port of the design's script.
- `css/shore-ship.css`: full-screen stage styles.
- Decision: we don't use `support.js`. It is only the Claude Design runtime, and the animation code is self-contained.

## Open questions
