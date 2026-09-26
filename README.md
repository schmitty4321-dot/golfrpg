# Fairway Manager

A golf management RPG in the spirit of Football Manager and OOTP Baseball.
You run a **player agency**: sign a stable of golfers (juniors, college players,
Monday qualifiers, fading veterans), then manage their schedules, sponsors,
coaches and money while taking your cut.

Golf is an individual sport, so the agency's client list plays the part of FM's squad.

## Getting started

You need [Node.js](https://nodejs.org) 20 or newer and [Git](https://git-scm.com).
On Windows, run these in PowerShell:

```bash
git clone https://github.com/schmitty4321-dot/golfrpg.git
cd golfrpg
npm install
npm run dev            # play in your browser: open the address it prints (http://localhost:5173)
```

`npm run play` runs the older terminal version of the same game.

Other commands:

```bash
npm run build          # build the browser game into dist/ (open with npm run preview)
npm test               # unit tests
npm run typecheck
npm run demo -- 42     # simulate one tournament (seed 42) and print the leaderboard
npm run calibrate      # 200 events per course vs. real tour reference numbers
```

## Status

- **Step 1 (done): the tournament engine** (`src/engine/`).
- **Step 2 (done): one season, one golfer** (`src/season/`).
- **Browser interface (done)** (`src/ui/`): React + Vite. It has a weekly "where does he play?"
  screen with entry status and course fit, leaderboards with hole-by-hole scorecards and a
  strokes-gained chart, points, world and money lists with the card lines, a season calendar
  with winners, the player card, finances, and an end-of-season review. It saves itself in
  the browser (IndexedDB), can export and import save files, and supports light and dark themes.

### Playing a season

Pick your first client:

| Scenario | Start |
|---|---|
| The Rookie | 23, just up from the developmental tour. Finish top 125 or lose the card. |
| The Journeyman | 32, conditional status: only gets in when fields are short. |
| The Monday Grinder | 21, no status. Every start comes through a Monday qualifier. |
| The Fading Veteran | 45, a former winner on the last year of his exemption. |

Each week you see the events on (a main event, sometimes an opposite-field
event), whether your client gets in (invited, in on status, alternate, or Monday
qualifier), and how well the course suits his game. Enter or rest; the whole
world plays out and you get the leaderboard and his strokes-gained breakdown.
The game autosaves to `saves/career.json` after every week.

How the season works:
- **Calendar:** 36 weeks: 4 majors, 8 signature events (72-player no-cut
  fields), regular events, opposite-field events on big weeks, and a Tour
  Championship for the top 30. Venues are generated per world, with the
  hand-built courses hosting two majors.
- **Getting in:** majors take the top 80 in the world, recent winners and last
  season's top 50, then fill by world ranking. Signature events take the top 50
  on the points list. Regular events fill by status (exempt, graduate,
  conditional), then points, with four spots for a one-round Monday qualifier.
- **Points and cards:** FedEx-style season points by finish. After the season
  the top 125 are fully exempt, 126-150 conditional, and winners exempt for two
  more seasons. Everyone else loses status, 30 players come up from the
  developmental tour, and some players retire.
- **World ranking:** points scaled by field strength (majors 100), counted in full for 13
  weeks and fading over two years, divided by events played (40-52).
- **Condition and form:** each start costs condition (more for majors and
  travel), and rest brings it back. Form follows results against expectation.
- **Money:** prize money, caddie pay (weekly fee plus 5/7/10% of winnings), travel
  by region, and your agency's 10% commission.
- **The world:** about 260 computer players schedule themselves. They always play majors
  and signature events, spread their other starts, favour courses that suit them,
  rest when worn out, and chase starts late in the season when their card is at risk.
  A silent warm-up season runs at creation so rankings and cards exist on day one.

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
2. ✅ **One season, one golfer**: a tour schedule, entering events, money,
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
src/engine/   attributes, types, rng, skill model, courses (+ generator), round & tournament sim, purse, players
src/season/   calendar, entries & fields, points & world ranking, weekly sim, world creation & season end, saves
src/ui/       browser game: App, screens/, components/, useGame (state + autosave)
scripts/      play.ts (terminal version), demo.ts, calibrate.ts
tests/        vitest suites
```
