# Fairway Manager: notes for Claude

A golf management RPG in the spirit of Football Manager and OOTP: you run an agency of pro golfers through
a simulated PGA Tour season (the real 2026 schedule and real courses). `README.md` describes every system in
detail; read it before changing one.

Live site: https://schmitty4321-dot.github.io/golfrpg/ (GitHub Pages; every push to `main` deploys).

## How we work

1. **One branch per feature**, named `claude/<feature>` (e.g. `claude/caddies`), cut from an up-to-date `main`.
2. Build it, then **check it before reporting**: `npm test`, `npm run build`, and look at the screens in a
   browser at desktop (1280px) and phone (390px) widths, light and dark. No horizontal overflow on phones.
3. Commit, push the branch, and report in plain words: what changed, what the player sees, anything
   deliberately left out or changed from the plan, and numbers that were measured (not guessed).
4. **Merge only when the owner says "merge it"**: `git fetch origin main`, check the branch is ahead of it
   (`git merge-base --is-ancestor origin/main <branch>`), then
   `git checkout main && git merge --ff-only <branch> && git push origin main`.
5. When asked for ideas or designs, give options with a recommendation (a page with mockups works well) and
   build only after the owner picks.

## Commands

- `npm run dev`: play locally. `npm run build`: typecheck and build (what CI deploys). `npm test`: vitest.
- Tests that simulate whole seasons are slow; the suite has a 60s per-test timeout (vite.config.ts).
- To measure the sim, write a throwaway test under `tests/zz_*.test.ts` that writes numbers to a file,
  run it, and delete it. Don't leave these behind.

## Code layout

- `src/engine/`: the golf. `round.ts` (hole and round scoring), `tournament.ts` (events, live hole-by-hole
  play), `calls.ts` (strategy calls), `tracer.ts` (shots reconstructed from scores, hole layouts),
  `pins.ts`, `traits.ts`, `familiarity.ts`, `equipment.ts` (clubs and caddie effects), `tendencies.ts`.
- `src/season/`: the career. `week.ts` (a week of the season), `world.ts` (creating a world, season end),
  `entries.ts` (who plays where), `agency.ts` (contracts, mood, reputation), `sponsors.ts`, `staff.ts`
  (coaches, injuries, weekly development), `development.ts`, `traits.ts`, `familiarity.ts`, `practice.ts`,
  `planner.ts` (the weekly day planner), `team.ts` (caddies, travel, jet, buying clubs), `goals.ts`,
  `save.ts` (loading and migrating saves).
- `src/ui/`: React screens (`screens/`) and components; `nav.ts` holds the five sections and their tabs;
  `styles.css` holds all styling.

## Rules for the simulation

- **Keep scoring calibrated.** Real courses play to their real field averages (`hole.adjust`). Anything that
  makes the average player better or worse must be balanced so a whole field still scores the same:
  traits give back `TRAIT_BALANCE` each round, familiarity is measured against the field's average that
  week, a hole's four pins average out, and the field plays tour-standard clubs with an ordinary caddie.
  After a change to scoring, measure the field's average to par before and after.
- **Course setup holds the real averages over time** (`courseSetup.ts`): each winter every course's setup
  moves by however far the season scored from the real averages. It corrects slow drift in player
  strength, not a scoring change you make now: measure those with the setup held fixed.
- **Effects are small and situational**: typically 0.05-0.4 strokes a round, only where they apply.
- **Old saves must keep loading.** New fields are optional and filled in on load (`ensureTraits`,
  `ensureFamiliarity`, `ensureGoals`, caddies in `save.ts`); bump `SAVE_VERSION` only for real migrations.
- **Determinism**: randomness comes from seeded RNGs (`createRng`, `mixSeed`, `traceSeed`), never
  `Math.random`. Don't add draws to a shared stream where a separate seeded stream would do; it changes
  every later result.

## Rules for the project

- **Never spend money** (paid APIs, map services, hosting upgrades) without the owner's explicit sign-off.
- **Images and data must be freely licensed** (Wikimedia Commons with credit, USGS public-domain aerials,
  OpenStreetMap with attribution). Keep the credits on screen.
- UI copy is plain words, short, and consistent with what's already there. Every screen works on phones
  (the bottom bar replaces the top sections under 700px) and in dark mode (colour tokens in `styles.css`).
- Commit messages explain what changed and why, in plain words. Don't put model names in commits or code.

## Ideas not built yet

From the 25-idea list: pre-tournament routines, winter training camps, sponsor exemptions, coach
specialties, a sports psychologist, physio and nutritionist, an agency performance center, golf ball choice,
the putter swap, equipment deals that require the sponsor's clubs, a home base, family on tour, an analytics
department, player businesses, contract bonus clauses, random events with choices, press conferences,
achievements, and an agency perk tree. Also still to do: photos for the 11 courses without one (see README).
