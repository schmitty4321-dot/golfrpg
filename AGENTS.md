# Fairway Manager: notes for coding agents

This file is for any AI coding agent working on this repo (it is the same guidance `CLAUDE.md` gives
Claude, plus the decisions and working knowledge built up so far). Read `CLAUDE.md` and `README.md`
too: `README.md` describes every game system in detail.

Fairway Manager is a golf management RPG in the spirit of Football Manager and OOTP: you run an agency
of pro golfers through a simulated PGA TOUR season on the real 2026 schedule and real courses.
TypeScript, React + Vite in the browser, vitest for tests.

- Live site: https://schmitty4321-dot.github.io/golfrpg/ (GitHub Pages; every push to `main` deploys)
- Repo: https://github.com/schmitty4321-dot/golfrpg
- The owner is not a programmer: report in plain words, show results (screenshots, numbers), and ask
  before big or costly decisions.

## How we work

1. **One branch per feature**, cut from an up-to-date `main` (e.g. `feature/caddies`). Always `git fetch`
   first: work happens from more than one place.
2. **Check before reporting**: `npm test`, `npm run build`, and look at changed screens in a browser at
   desktop (1280px) and phone (390px) widths, light and dark. No horizontal overflow on phones.
3. Commit, push the branch, and report: what changed, what the player sees, anything left out or changed
   from the plan, and numbers that were measured (never guessed).
4. **Merge only when the owner says "merge it"**: fetch `main`, check the branch is ahead of it, then
   fast-forward merge and push. Every push to `main` goes live.
5. When asked for ideas or designs, give options with a recommendation (a page with mockups works well)
   and build only after the owner picks.
6. Never spend money (paid APIs, hosting upgrades) without the owner's explicit sign-off. Images and data
   must be freely licensed, with credits kept on screen.

## Commands

- `npm run dev` (play locally), `npm run build` (typecheck + build, what CI deploys), `npm test` (vitest;
  whole-season tests are slow, 60s per-test timeout).
- `npm run worldcheck -- 12 <seed>`: plays 12 seasons and prints tour strength, ages, injuries, winning
  score, field scoring to par, **scoring vs the real hole averages** and the course setup. Run it on
  seeds 5, 11 and 42 after any change to development, ageing, player generation or scoring, and compare
  with the numbers before the change.
- To measure the sim ad hoc, write a throwaway `tests/zz_*.test.ts` that writes numbers to a file, run
  it, and delete it.

## Rules for the simulation

- **Scoring stays calibrated.** Real courses play to their real field averages (`hole.adjust`,
  `hole.tourAverage`). Anything that makes the average player better or worse must be balanced so a whole
  field still scores the same (traits give back `TRAIT_BALANCE`, familiarity is relative to the field,
  archetype skews sum to zero across the golf skills, pins average out).
- **Course setup** (`src/season/courseSetup.ts`) moves each winter by however far the season scored from
  the real averages, so drift in player strength never shows up as easier courses. The owner chose to
  hold scoring at the real averages.
- **Old saves must keep loading.** New fields are optional and filled in on load (`ensureTraits` also
  fills archetypes; see `save.ts`). Bump `SAVE_VERSION` only for real migrations.
- **Determinism**: randomness comes from seeded RNGs (`createRng`, `mixSeed`, `traceSeed`), never
  `Math.random`. Don't add draws to a shared stream where a separate seeded stream would do; keep the
  number and order of draws the same when changing what a draw picks.
- Effects are small and situational: typically 0.05-0.4 strokes a round.

## Decisions the owner has made

- Nationalities follow the 2026 PGA TOUR media guide mix (about two-thirds American, 28 other countries
  and territories), in `src/engine/nations.ts`; amateurs follow the same mix.
- Mental "experience" attributes grow half as fast and stop at the player's ceiling.
- 20 player archetypes (`src/engine/archetypes.ts`), balanced to zero across golf skills; visible for
  clients always and for others at 40% scouting accuracy. Traits "Grinder" and "Wedge Wizard" were
  renamed "Scrapper" and "Inside 130" so no trait shares an archetype's name.
- **Every tournament gets a logo automatically** (`src/ui/components/TournamentLogo.tsx`): 45 hand-set
  for the real tour, and any new, renamed, moved or generated event gets one built from its venue.
  Keep it that way for anything that creates or edits events.
- Player portraits are illustrated SVG (`Portrait.tsx`), with flags and three-letter codes shown wherever
  a player's country appears (`Flag.tsx`).

## Work in progress: illustrated hole art (not committed)

On the owner's PC (`C:\Users\suzry\golfrpg`), the branch `claude/hole-art` has uncommitted files:

- `src/ui/holeArt.ts`: draws a hole as an illustrated SVG from the real outlines
  (`public/holes/<course>.json`, OpenStreetMap, yards frame: tee at 0,0, green up the y axis) and the
  summary in `src/engine/realHoles.json`. It draws a fairway along the line of play when the mapped
  fairways don't cover the hole, and by default cuts the hole out as a corridor (the owner wants **only
  the hole, fairway and green with the trees beside them**, not the surrounding course). `holeScene()`
  exports the geometry for 3D renderers.
- `scripts/art/renderHoles.ts` → `scripts/art/hole3d.py` → `scripts/art/compose.py`: renders each hole
  as a 3D diorama in **Blender 5.2** (installed at `C:\Program Files\Blender Foundation\Blender 5.2\`),
  Cycles at 48 samples (~20 s a hole), then adds the header bar with PIL. Usage:
  `npx tsx scripts/art/renderHoles.ts <outdir>` then
  `blender -b -P scripts/art/hole3d.py -- <outdir>/augusta/hole-02.json out.png` then
  `python scripts/art/compose.py hole-02.json out.png final.png`.
  Gotchas: build the soil edge by extruding the boundary edges (Blender's Solidify made spikes); snap
  only the outermost edge points to the cut-out outline; MuPDF can't rasterise these SVGs (use a browser).
- The owner likes the vibrant Blender look (sample renders of Augusta holes 1-9 were approved for
  direction, not yet final). Rendering every course (45 × 18 holes) takes 4-5 hours and adds tens of MB
  of images: confirm with the owner before doing it or committing images.

## What's next (owner's list)

1. Finish the hole art: agree the look, then decide how the images ship with the game.
2. **Shot tracer on an illustrated, tilted (isometric-style) view of each hole** as it's played
   (reference sheet panel 12): ball flights as arcs with height and a ground shadow over the hole art.
3. More graphics from the owner's 20-panel reference sheet: full-body golfer cards (2), weather (9) and
   course conditions (10).
4. Gamification ideas not built yet (next batch recommended: random events with choices, press
   conferences, sponsor exemptions, physio and nutritionist, achievements); the full list is in
   `CLAUDE.md` under "Ideas not built yet".
