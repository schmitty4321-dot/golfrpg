# Fairway Manager

A golf management RPG in the spirit of Football Manager and OOTP Baseball.
You run a **player agency**: sign a stable of golfers (juniors, college players,
Monday qualifiers, fading veterans), then manage their schedules, sponsors,
coaches and money while taking your cut.

Golf is an individual sport, so the agency's client list plays the part of FM's squad.

## Status

**Step 1 of the build path: the tournament simulation engine** (`src/engine/`),
pure TypeScript with no UI, seeded and reproducible, with tests and a
calibration script.

```bash
npm install
npm test               # unit tests
npm run typecheck
npm run demo -- 42     # simulate one tournament (seed 42) and print the leaderboard
npm run calibrate      # 200 events per course vs. real tour reference numbers
```

## How the engine works

1. **Attributes (1-20, 12 = tour average).** Long game, approach, short game,
   putting, mental and physical groups, plus hidden ones (professionalism,
   ambition, coachability, wind tolerance, grass preference, comfort by course
   style, peak age). See `attributes.ts`.
2. **Strokes gained.** `skill.ts` turns attributes into expected strokes gained
   per round in the four standard categories (off the tee, approach, around
   the green, putting). Each course has *demands* derived from its holes (length,
   fairway width, rough, bunkers, green speed, firmness), so a bomber gains more
   at a long course and a plotter at a tight one. Grass preference, style
   comfort, form and condition are added on top.
3. **Rounds, hole by hole** (`round.ts`). Each round draws the player's
   category form for the day around that expectation, including a weekly hot or cold spell. Each hole's score is a
   baseline for its par and length plus wind (softened by wind tolerance and
   trajectory control), with blow-up holes driven by hazards and course
   management. Bounce-back, aggression on par 5s, Sunday-afternoon pressure
   (sundayNerves and composure, only in contention) and late-round fatigue
   (stamina and condition) are also modelled.
4. **Tournaments** (`tournament.ts`). AM/PM waves with afternoon wind, a
   top-65-and-ties cut, weekend pairings by score, sudden-death playoffs, a
   PGA-style purse table with tie splitting, and a per-player strokes-gained
   breakdown against the field.

Known simplification: weekend pressure uses the shots-behind at the start of
the round, not a live mid-round leaderboard.

### Calibration (300 events per course)

| | Harrow Pines | Kilbrannan Links | Saguaro Wells | Marisol Bay | Tour reference |
|---|---|---|---|---|---|
| Scoring avg vs par | -0.4 | +1.9 | +0.7 | -1.3 | ~0 to +0.8 (windy links +2) |
| Round SD, per player | 3.05 | 3.26 | 3.15 | 3.15 | 2.7-3.1 |
| Winning score | -19.8 | -11.2 | -16.0 | -23.6 | -12 to -22 |
| Birdies / round | 3.74 | 2.77 | 3.35 | 4.28 | 3.3-4.2 |
| Doubles+ / round | 0.26 | 0.36 | 0.39 | 0.30 | 0.25-0.45 |
| Best player wins | 10.7% | 11.7% | 11.7% | 10.7% | 10-25% |
| Winner ranked top 10 | 47% | 61% | 54% | 50% | 35-55% |
| Playoffs | 15% | 16% | 17% | 18% | ~10-15% |

Still worth tuning: favourites win slightly too often on the links course, and
playoffs are a little frequent.

## Roadmap

1. ✅ **Sim engine**, calibrated against tour scoring.
2. **One season, one golfer**: a tour schedule, entering events, money,
   world ranking points, keeping your card.
3. **Development and ageing**: training plans, coaches, swing rebuilds (form
   dips now, higher ceiling later), peak age, decline, injuries.
4. **The agency**: multiple clients, scouting (reports as good as the scout,
   and hidden attributes seen only through them), contracts and commission, sponsors
   and equipment deals, caddies with their own attributes and chemistry,
   morale, media, rivalries and players wanting to leave.
5. **The world and its history**: pathways (amateur, college, Q-School,
   developmental tour, main tour, exemptions, conditional status), a generated
   amateur class each year with regional strengths, records, major winners,
   Hall of Fame voting, head-to-head stats, and full database and course editors so the
   community can build real-player sets.

Features that could set it apart, to fold in along the way:
- A course designer: build a course, host an event there, and see how the field copes.
- A live leaderboard with a top-down 2D shot tracer for key holes.
- Women's and senior tours as full career paths.
- Betting-odds and fantasy layers.
- Ryder/Presidents Cup-style team events where you captain and pick pairings.
- Rule and equipment eras (ball rollback, distance changes) that shift which archetypes win.
- Scenario starts ("32-year-old journeyman, one year left on his card").

## Layout

```
src/engine/   attributes, types, rng, skill model, courses, round & tournament sim, purse, players
scripts/      demo.ts, calibrate.ts
tests/        vitest suites
```
