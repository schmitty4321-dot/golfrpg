# Fairway Manager

A golf management RPG in the spirit of Football Manager and OOTP Baseball.
You run a **player agency**: sign a stable of golfers (juniors, college players,
Monday qualifiers, fading veterans), then manage their schedules, sponsors,
coaches and money while taking your cut.

Golf is an individual sport, so the agency's client list plays the part of FM's squad.

## Getting started

**Play online:** https://schmitty4321-dot.github.io/golfrpg/ (rebuilt automatically on every push to `main`).

To run it on your own computer instead:

You need [Node.js](https://nodejs.org) 20 or newer and [Git](https://git-scm.com).
On Windows, run these in PowerShell:

```bash
git clone https://github.com/schmitty4321-dot/golfrpg.git
cd golfrpg
npm install
npm run dev            # play in your browser: open the address it prints (http://localhost:5173)
```


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
- **Step 3 (done): development and ageing** (`src/season/development.ts`, `staff.ts`, and the Training tab).

### Development, coaching and injuries

- **Growth:** every player has a hidden ceiling (young players have room to grow). Each week,
  attributes grow towards it, faster when young, with a strong work ethic (professionalism,
  coachability), good coaching and a training focus. Changes build up as progress and tick over a
  point at a time, and the Player and Training tabs show what moved this season.
- **Ageing:** after his peak (around 31, varies by player), distance, stamina and flexibility fade
  first, then the short putts. Course management, composure and nerve keep improving into the
  forties. A fitness trainer and a fitness focus slow the decline.
- **Training plan:** a focus (balanced, long game, approach, short game, putting, mental, fitness)
  and an intensity. Heavy training is faster, but tiring and doubles the injury risk.
- **Coaching staff:** a swing coach, short-game coach, putting coach, mental coach and fitness
  trainer, five of each on the market from journeymen to gurus. Wages come out of your client's
  winnings. Coach quality also sharpens the read on his ceiling.
- **Swing rebuild:** 16 weeks with the swing coach. He loses up to 0.9 strokes a round at first,
  easing week by week. If it works (the odds depend on coach quality and coachability), his
  ball-striking improves and his ceiling rises. Start one late in a season and the winter absorbs it.
- **Injuries:** weekly risk from injury proneness, competing, fatigue and heavy training. They
  last 1-14 weeks, and long ones can cost distance. Injured players withdraw, and majors take the next man in.
- **The world:** computer players develop and age by the same rules. Old players retire, and
  new prospects arrive. `npm run worldcheck` plays many seasons to confirm the tour stays stable
  (overall strength plateaus, average age about 33-34).
- Saves from before this update are upgraded automatically when loaded.
- **Step 4 (done): the agency** (`src/season/agency.ts`, `sponsors.ts`, `scouting.ts`, and the Agency and Scouting tabs).

### Running the agency

- **Clients:** you start with one client on a three-season deal and can sign more. Roster size grows
  with reputation (3 at the start, up to 8). Each client has his own schedule, training, coaches,
  finances, sponsors, contract and mood. Each week, pick an event or rest for each one, or leave it
  to "his call".
- **Rival agencies:** six of them represent most of the tour, the best players almost always.
  You can only approach a rival's player in the final season of his deal. Free agents can be approached any time.
- **Signing:** a player weighs your reputation against his standing (a world top-10 player expects an elite
  agency, and one far out of your league won't take the meeting), plus the commission (5-20%), the length,
  and his own ambition. A turn-down means a four-week wait. You only see a rough read of the odds.
- **Contracts and mood:** happiness moves with form, sponsor money, the commission he pays, and whether you
  kept him out of a big event he wanted to play. In a contract's final season, extend it or he leaves.
  Happier clients agree more readily.
- **Scouting:** other players' attributes are hidden. Hire scouts (better ones are more accurate) and queue
  players. Each scout files two reports a week. Reports show each attribute as a range that always
  contains the truth, and at 60%+ accuracy they reveal the ceiling, work ethic and other hidden traits.
- **Sponsors:** offers arrive at the start of a season and after strong weeks, sized by marketability
  (world ranking, recent wins, youth, home market, your reputation). One deal per category, paid weekly,
  with win and major bonuses. Your agency takes 20%.
- **Agency money and reputation:** commission on prize money and endorsements against office and scout
  costs. Reputation rises with wins, top-fives, top-tens and clients keeping their cards, and fades a
  little each winter. It decides who will sign, sponsor sizes and roster size.
- The terminal version has been retired; the browser game is the way to play.
- **Step 5 (done): pathways and history** (`src/season/amateurs.ts`, `history.ts`, the developmental
  tour in `calendar.ts`, and the History tab).

### Pathways into the tour

- **Developmental tour:** 24 events a season (144-player fields, about $1M purses) for professionals without a
  main-tour card. It has its own points list, and the **top 25 earn cards** for next season.
- **Q-School:** after the season, players who finished 126-200 on the points list, the developmental tour's
  next tier, your clients without a card, and a handful of hopefuls play 72 holes. The **top five (and ties)
  earn cards**.
- **Amateurs:** a new class of 24 arrives every year from around the world, and each country's golf culture
  shows (Scandinavian ball-strikers, Korean and Japanese touch on the greens, Australian and Irish
  wind players). They play college golf and develop every week, but never play professional events, except
  the amateur champion, who is invited to the next season's majors. They turn pro by 22 (earlier if they're
  top prospects), or when you tell them to if they're your client. They have no agents, so a young
  agency can sign one early, develop him, and choose when he turns pro. They can't take sponsor money.
- **A stable world:** new amateurs' ceilings come from a fixed spread, so the tour's talent level plateaus
  instead of drifting over the decades (`npm run worldcheck -- 20`).

### History

- **Season by season:** points champion, money leader, developmental tour champion, amateur champion,
  Q-School medallist and cards earned. The hidden warm-up season is kept as season 0.
- **Major champions** by year, with your clients' wins highlighted.
- **Record book:** lowest round, lowest 72 holes, biggest winning margin, most wins in a season, and youngest
  and oldest winners, all on the main tour.
- **Hall of Fame:** players are elected on retirement, on wins, majors and points titles, and there's a list of
  active players on course for it. Established pros start with a career behind them, sized to their standing.
- Courses play slightly harder than before, so scoring stays realistic once the world matures.
- **Editors (done)** (`src/season/editor.ts`, and More → Editor in the game).

### Editors

Changing anything marks the world **Edited**, like Football Manager's in-game editor. The editor shows true
values, not scouting reports.

- **Players:** edit anyone's name, nationality, age, peak age, status, ceiling, home greens, comfort on each
  style of course, and every attribute including the hidden ones. You can also create new players, who
  join the tour straight away. Invalid values are explained, not silently fixed.
- **Courses:** edit any course hole by hole (par, yards, fairway width, hazard, bunkers, wind exposure) and
  course-wide (style, grass, green speed, rough, wind, firmness). A live panel shows how it plays: expected
  score for a tour-average player, and what it rewards (length, accuracy, irons, short game, putting)
  compared with a typical venue. You can also design a new course from a generated layout of any style,
  or duplicate one.
- **Calendar:** rename events, change purses, and move any event to any venue. That's how you host your own event
  at a course you designed.
- **Sharing:** export the player database or courses as JSON files, import other people's courses, and
  start a new career from a player database (New Career → Player database). Hand-made player files only
  need names: missing attributes default to a tour average (12). Pros from the file fill the tour first,
  generated players top it up so every field is full, and players marked `"status": "amateur"` (or aged 21 and
  under) join the amateur ranks.

Minimal player database:

```json
{ "format": "fairway-manager-players", "version": 1, "players": [
  { "name": "Tiger Lawson", "nationality": "USA", "age": 29, "potential": 17,
    "attributes": { "drivingDistance": 18, "midIrons": 19, "shortPutts": 18, "sundayNerves": 20 } }
] }
```

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
3. ✅ **Development and ageing**: training plans, coaches, swing rebuilds (form
   dips now, higher ceiling later), peak age, decline, injuries.
4. ✅ **The agency**: multiple clients, scouting (reports as good as the scout,
   and hidden attributes seen only through them), contracts and commission, sponsors
   and equipment deals, caddies with their own attributes and chemistry,
   morale, media, rivalries and players wanting to leave.
5. ✅ **The world and its history**: pathways (amateur, college, Q-School,
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
scripts/      demo.ts, calibrate.ts, worldcheck.ts
tests/        vitest suites
```
