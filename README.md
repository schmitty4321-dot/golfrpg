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
npm run worldcheck -- 12 5   # 12 seasons on seed 5: tour strength, ages, injuries, winning scores
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
  point at a time, and the Player and Training tabs show what moved this season. Each skill starts
  part-way to its next point, so a young player's gains come a point or two at a time through the
  season rather than in one burst.
- **Ageing:** after his peak (around 31, varies by player), distance, stamina and flexibility fade
  first, then the short putts. Course management, composure and nerve keep improving into the
  forties, up to his ceiling. A fitness trainer and a fitness focus slow the decline.
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
  new prospects arrive. `npm run worldcheck -- [seasons] [seed]` plays many seasons to confirm the
  tour stays stable (overall strength plateaus, average age about 33-34) and that scoring doesn't
  drift: it prints the main tour's average winning score and the field's average to par per round.
  Check a few seeds.
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

### Playing an event round by round

When you press **Play week** and any of your clients is in a field, the event opens on its own screen:
**Play round 1**, see his scorecard (click any score to watch the shots), where he stands and the leaderboard
with movement arrows, then **Play round 2**. After 36 holes the cut line is shown. If every client missed
it, **Sim the rest of the tournament** jumps to the final results; if anyone made it, play **rounds 3 and 4**.
**Skip to the final results** is always there, and with clients in different events you get a tab per event.
The week is simulated in one go and revealed a round at a time, so nothing you do on this screen changes
the outcome, and the save and the rest of the world stay consistent. The auto-sim buttons skip the screen.

### Hole by hole

When your client plays, each round can be simulated, or played **hole by hole** with you as his caddie.
You make the calls at the key moments; on the other holes he plays his own game.

| Moment | When it comes up | Choices |
|---|---|---|
| Off the tee | water, OB or a tight fairway, or a short par 4 | driver, 3-wood or a long iron |
| Par 5 | a par 5 he can reach in two | go for it, or lay up |
| Approach | a green guarded by water or bunkers | attack the pin, or the middle of the green |
| Putts | the closing holes, in contention or on the cut line | charge them, or lag them |

- **Odds:** each option shows its average score and the chances of birdie and of bogey or worse,
  from simulating the hole with his game today in today's conditions. Attacking gives more birdies
  and more disasters; the hazards on the hole decide whether that's worth it. On Sawgrass's 17th,
  attacking the island green raises his birdie chance from 8% to 13% and bogey-or-worse from 22% to 28%.
- **Replay:** each hole then plays out in the shot tracer, on the real hole map or aerial photo, and
  follows your calls. It shows the club you chose off the tee, going for it or laying up, the
  approach distance, and the pace of the putts.
- **Leaderboard:** the board shows everyone through the same hole as your client.
- **Pacing:** play one hole at a time, jump to the next decision, or finish the round.
- **Leaving his calls:** "his call" is the baseline the simulation is calibrated on. Leaving every call
  to him plays exactly like a simulated round.
- **The rest of the field:** it plays from the tournament's own random stream, and your client plays
  from his own, so your calls never change anyone else's scores. The week is recorded once every
  event is finished. Leaving the event screen plays the rest automatically.

### Nationalities and player pictures

- **Where players come from** follows the 2026 PGA TOUR's membership (the media guide lists 86
  international members from 27 countries and territories): about two-thirds American, then England,
  Canada, Sweden, Australia, Japan, South Korea, South Africa and so on down to single players from
  Fiji or Puerto Rico (`src/engine/nations.ts`). Each country has its own names, home greens and
  home tour region. Each year's amateurs follow the same mix, so it holds as the world turns over:
  over nine seasons Americans stayed at 64-66% of the pros, with 21-26 countries represented.
- **Flags:** every golfer's flag and three-letter code (USA, ENG, KOR...) show wherever his name is
  listed: leaderboards, the points, money and world ranking lists, stats, scouting, the roster and
  history. The flags are simple SVG drawings (flag emoji don't show on Windows).
- **Player pictures** are illustrated head-and-shoulders portraits: most in a cap (some a visor, a
  bucket hat or bare-headed), a polo with collar and buttons, the course's tree line behind, and the
  flag and code underneath. Each is built from the player's id, so it never changes. Skin, hair and
  eye colours are drawn from likelihoods that fit his country, and hair greys with age. Only colours
  and styles vary; every face has the same proportions.
- Careers started before this change keep their players' nationalities; new players arrive with the
  new mix.

### Tournament logos

Every event has a logo (`src/ui/components/TournamentLogo.tsx`): a round emblem with a scene from its part
of the world (surf and palms for Hawaii and the Caribbean, saguaros for Scottsdale, a lighthouse for Hilton
Head and Sea Island, dunes and wind for the Scottish Open and The Open, a laurel crest for the majors and
playoffs) in its own colour, and a wordmark of its name. The emblem sits beside the event on the home screen,
the event screen and every calendar row; the calendar opens with this week's full card: emblem, wordmark,
venue, purse, winner's points and field. All 45 events on the real tour are hand-set.

Any other event gets a logo the moment it exists, built the same way: future seasons' calendars,
the developmental tour, and events renamed, moved or hosted at your own course in the editor. The scene
comes from the venue: its country (Japan the rising sun, Canada the maple leaf, the British Isles links, the
Caribbean and Mexico surf and palms), then words in the event, course and city names (lake, pines, oaks,
mountains, island, desert...), then Texas cities and other big cities, then the course's style; majors, the
playoffs and the finale take the laurel crest. The wordmark is set like the hand-set ones ("The" small, the
name large, "Championship" or "in ..." in italic). A real event renamed in the editor keeps its colour, and
its scene while it stays at its venue. Nothing is stored in the save: the same event always gets the same
logo, and it follows the event through any edit. The art is the game's own: only the event names
the schedule already uses appear, and no sponsor or tournament marks are reproduced.

### Player archetypes

Every player has one of 20 archetypes (`src/engine/archetypes.ts`): the shape of his game, meaning which
skills sit above or below his own overall level. Power Player, Precision Player, Ball-Striker, Shotmaker,
Wedge Wizard, Pin Seeker, Short-Game Wizard, Grinder, Improviser, Flatstick, Lag Master, Ice Man,
Riverboat Gambler, Closer, Wind Specialist, Athlete, Old Pro, Wunderkind, Range Rat and All-Rounder.

- **Never better or worse, only different:** each profile is balanced to zero across the 16 golf skills, so
  an archetype never changes a player's overall level. A Power Player hits it 3 points further than his level
  and 2 points less straight; the rest of his golf skills give back the difference.
- **Who gets which:** chosen when a player is generated, by age, tier and country. Old Pros only come at 38
  and over, Wunderkinds at 22 and under (with an extra point of ceiling), Athletes under 32. Ice Men and
  Closers are rarer below tour level, Wind Specialists commoner from the British Isles, Australia and New
  Zealand, Flatsticks from Japan and Korea.
- **What you see:** a round badge, with the name on the player card and the client screen, and beside the
  name on leaderboards, the roster and scouting lists. Your clients' are always shown; anyone else's once a
  scouting report reaches 40% accuracy.
- **Older saves:** players get the archetype their attributes fit best when the career is loaded; nothing
  about them changes. Players from a hand-made database or the editor are matched the same way.
- Two traits were renamed so no trait shares an archetype's name: Grinder is now **Scrapper** and Wedge
  Wizard is **Inside 130**. Their effects are unchanged.

### Player traits

Every player has one to three of 100 traits (`src/engine/traits.ts`), rolled once from who he is (a Links Lifer is likelier from Scotland, a Sand Saver from a good bunker player) and kept in the save. Rarity weights are 60% common, 28% uncommon, 10% rare and 2% legendary, and clashing traits (Loyal and Mercenary, say) never go together.

- **On the course** (shot-making, short game, mental, venue, legendary): small edges in the hole and round simulation, usually 0.05-0.4 strokes and only in the situation named: par 3s, bunkers, the rough, majors, Sunday in contention, rain, a links course, the hole after a double bogey. Some change what hole-by-hole calls do (a Driver Addict only half lays up). Because traits help the average player about 0.1 a round, every round gives that back, so a field still scores what the courses are calibrated to.
- **Off the course** (`src/season/traits.ts`): fatigue and travel, injuries, development (Late Bloomer, Plateau, Sponge...), mood (Diva, Homesick, Jealous Rival...), contract talks (Loyal, Hard Bargainer...) and sponsor offers (Sponsor Magnet, Box Office...).
- **They can change**: a season with a mental coach rated 14+ cures the chipping yips, a temper or major nerves; a first major win brings Major Mindset; the odd veteran's putting stroke goes.
- **Scouting**: you see all of a client's traits; for anyone else, a report at accuracy x spots each trait with chance x.

### Course familiarity

Every player has a 0-100 familiarity with each course (`src/engine/familiarity.ts`, `src/season/familiarity.ts`): 3 a round played there, plus 6 for a top 10, 12 for a top 5 or 20 for a win, with gains shrinking towards 100 (a Course Horse learns twice as fast), and 3 lost for each season he stays away. New worlds (and older saves) start veterans with what their years on tour would have earned. It is local knowledge measured against the field that week, so a field of veterans still plays a course to its real average: up to about a quarter of a stroke a round at the top (mostly on the greens), fewer big numbers on holes with trouble, and tucked pins costing less. A course debut costs 0.15 in round 1. Players lean towards courses they know when picking their schedule, and clients are happier at a course they know well. Familiarity shows on the player page, on this week's entry options, and as Debut / Course expert tags on leaderboards.

### Managing a client's week, team and kit

- **Weekly planner** (`src/season/planner.ts`): before an event his Monday to Wednesday, in a week off all seven days. Travel takes the first days (fewer with a better travel class or the agency jet); every free day gets an activity: rest (free), a practice round (familiarity before the event), range work (training +15%), gym (fitness +30%, fewer injuries), a sponsor day (an appearance fee, likelier offers) or a media day (agency reputation; some players hate it).
- **Practice trips**: a week learning any tour course instead of an event, for travel, fees and most of a week's rest.
- **Caddies** (`src/season/team.ts`): twelve for hire, rated on green reading, clubbing and calm, with a weekly fee and a share of winnings. Chemistry builds three points a week together; a good caddie is worth strokes and takes the edge off weekend pressure.
- **The bag** (`src/engine/equipment.ts`): driver, irons, wedges and putter, each with models that trade one thing for another (a longer, wilder driver; blades against game-improvement irons; a steadier mallet). Bought once, swapped freely. The field plays tour standard.
- **Travel**: economy, business or charter per client (cost against tiredness and travel days; charter ends jet lag), or an agency jet, leased by the week or bought outright, for every client.
- **Season goals** (`src/season/goals.ts`): four goals offered per client each season to suit where he stands; agree two by week 4. Met goals lift his mood and your reputation (more for a stretch), missed ones cost mood.

### Round stats and tendencies

Each round on the event screen shows your client's stats in the style of the tour's stats pages, each with
his **rank in the field**, the **field average** and his **event total so far**:
- **Scoring:** score to par, birdies or better, bogeys or worse.
- **Off the tee:** driving distance, driving accuracy, left and right rough tendency.
- **Approach:** greens in regulation, accuracy from the fairway and from the rough, proximity to the hole, going for par 5s in two.
- **Around the green:** scrambling, sand saves.
- **Putting:** putts, putts per green in regulation, one-putts, three-putts, average first-putt distance, average
  distance of putts made, and longest putt made.

Plus the round's leaders in driving distance, accuracy, greens, proximity, putts and scrambling. The stats
are counted from the same reconstructed shots the tracer replays, so stats, replays and scores always agree.
Across a field they come out tour-like: about 299-yard drives, 60% of fairways and greens, 76% of greens
from the fairway vs 43% from the rough, 54% scrambling, 29.5 putts.

Every player also has **tendencies**, shown on the Player tab (and on scouted players' profiles). They're
fixed per player and drive the replays and stats:
- **Miss bias:** his left/right split when he misses a fairway.
- **Shot shape:** draw or fade.
- **Ball flight:** low, medium or high.
- **Strategy:** aggressive players go for par 5s in two far more often.
- **Putting pace:** chargers leave longer comebacks, and diers leave tap-ins.

Four more change his scores, not just how the replays look:
- **Under pressure:** front-runners are about 0.4 a round better protecting a weekend lead, and chasers
  about 0.3 better hunting one down (each is worse in the other spot). Nerve makes front-runners likelier.
- **Week rhythm:** fast starters gain 0.3 a round on Thursday and Friday and give it back at the weekend;
  strong finishers do the reverse. Stamina tilts it toward finishing strong.
- **Weather:** bad-weather players (good wind tolerance and flight control) lose less to the wind than the
  field; fair-weather players lose more.
- **Consistency:** streaky players swing more from round to round, steady ones less (on top of focus).

These are balanced so a whole field scores the same on average; calibration is unchanged.

### Shot tracer

Click any score on a scorecard (Leaderboards → click a player), or press **Watch his final round**, to replay
it shot by shot on a top-down drawing of the hole: tee, fairway, rough, bunkers, water, trees, green and pin,
drawn from the course's own numbers (length, fairway width, bunkers, hazard, style). Shots animate one at
a time with commentary ("Driver, 302 yds, finds the fairway", "Sand wedge from 91 yds misses the green",
"Chip to 6 ft", "Holes the 6-footer"), and you can pick a round, jump to a hole, or show key holes only.

The simulation decides scores, not shots; that's what keeps it fast and calibrated. So the tracer
(`src/engine/tracer.ts`) works backwards: it plans a believable way to make that exact score (a two-putt
par, an up-and-down, a ball in the water and a drop) and places each shot using the player's game (long
hitters hit it further, good iron players hit it closer) and the hole's layout. A replay always adds up to
the real score, which is tested for every score on every hole, and the same round always replays the same way.

Minimal player database:

```json
{ "format": "fairway-manager-players", "version": 1, "players": [
  { "name": "Tiger Lawson", "nationality": "USA", "age": 29, "potential": 17,
    "attributes": { "drivingDistance": 18, "midIrons": 19, "shortPutts": 18, "sundayNerves": 20 } }
] }
```

### Real hole maps (OpenStreetMap)

On 35 of the real courses, the shot tracer draws each hole from its real outlines instead of a
generated layout. The outlines come from OpenStreetMap, where volunteers trace courses from aerial
photos: the hole's line from tee to green, tees, fairways, greens, bunkers, water, woods, trees
and cart paths. Neighbouring holes show around the edges, as they do from above.

- **Shots follow the real hole:** balls fly along the real line of play, bunker shots come out of
  the real bunkers, and a ball that finds the water lands in the real pond, such as the lake
  around Sawgrass's island green.
- **Fairway width:** the shot spread uses the real fairway width, measured from the map where
  the fairway is mapped.
- **Matching:** each scorecard hole is matched to a mapped hole by number, par and length. This
  copes with events that play the nines the other way round, and with areas that hold more than
  one course, such as Augusta's par-3 course or Sawgrass's Valley course.
- **Not mapped:** holes that aren't mapped (or don't match) keep the generated layout. Hurstbourne,
  Corales, Sedgefield, Vidanta Vallarta, the Dunes Club, Walnut Cove, El Cardonal and Yokohama
  have none yet.

**Aerial photos:** on the 31 real courses in the US and Puerto Rico, the replay shows the hole on a real
aerial photo by default. Switch between **Photo** and **Map** under the drawing. The photos are
USDA NAIP imagery from the USGS National Map, which is public domain. There's one photo per course
(about 1 pixel per yard, `public/aerial/`), rotated and scaled under each hole by the same transform
as its outlines (`scripts/osm/aerial.py`).

The shot logic uses a compact summary bundled with the game (`src/engine/realHoles.json`). The
full outlines load one course at a time, when a replay opens (`public/holes/`). To rebuild both:
`python3 scripts/osm/fetch.py && python3 scripts/osm/buildholes.py && python3 scripts/osm/aerial.py`. The course list is in
`scripts/osm/courses.json`. Map data © OpenStreetMap contributors, under the ODbL.

### Player stats

The **Stats** tab ranks every main-tour player on any stat. Click a column header to sort, and
click it again to reverse the order. The stat groups are:

| Group | Stats |
|---|---|
| Results | events, rounds, wins, top 10s, cuts made, earnings, points, scoring average |
| Strokes gained | total, off the tee, approach, around the green and putting, per round against the field |
| Off the tee | distance, fairways hit, misses left and right |
| Approach | greens in regulation, from the fairway and from the rough, proximity, going for it |
| Around the green | scrambling, sand saves |
| Putting | putts per round and per green in regulation, one-putts, three-putts, first-putt distance, distance of putts made, longest putt made |
| Scoring | birdies, eagles, pars, bogeys, doubles, penalties |

It covers this season or last season. You can search by name, show only your clients, or show
only qualified players (40% of the most rounds anyone has played). Click a name to open that
player's profile. Shot stats come from the same replays as the round stats and the shot tracer,
added up event by event (`src/season/stats.ts`). Developmental tour events aren't counted.

The **Player** tab shows current ability and potential as bars on the 1-20 attribute scale.
Current ability is the exact average of his golf attributes. Potential is his coaches' estimate
of his ceiling, the same one the Training tab shows as stars, and it gets more accurate with
better coaches.

### Real courses

Every tour stop is played on its real course (`src/engine/realCourses.json`). The par and
yardage of every hole come from the PGA TOUR's course stats (pgatour.com, 2026 where the
event has been played, 2025 for the fall events). Each hole also carries the real field's
scoring average, and `scripts/fitRealCourses.ts` tunes the hole so a simulated tour field
plays it to that average. The hardest hole at each venue ends up the hardest in the game, and
Shinnecock plays about 5 shots harder than TPC River Highlands.

- **Estimated:** fairway widths, greenside bunkers, wind exposure, green speed and rough
  aren't on a scorecard, so they're estimated from the style of course and what each venue is
  known for. You can change them in the course editor.
- **Grass, designer and year:** these come from the PGA TOUR's course overview.
- **Austin:** the Austin Championship is new and hasn't been played, so Barton Creek uses a
  stand-in layout until real numbers exist.

The event screen and leaderboards show a photo of the venue and a hole-by-hole card with the
tour's average on each hole. The photos come from Wikimedia Commons under free licences,
credited on each photo.

The hole-by-hole scoring mix matches the real tour closely. Per round, the game makes 3.89
birdies (real 3.81), 2.66 bogeys (real 2.53), 0.26 doubles (real 0.27) and 0.10 eagles (real
0.10). Holding the courses to their real averages (below) moved winning scores about 0.8 shots
closer to the real ones; they still run roughly 2 shots lower.

**Course setup.** Players improve over the years, so a fixed course would play easier every season.
Like the real tour lengthening courses and growing the rough, the game sets the courses up tougher
(or easier) each winter by however far the season's scoring on the real courses was from the real
averages, so they keep playing to those averages. It is the same for the whole field, so nobody's
standing changes; the season review says when it moves. A new career starts with the setup its
warm-up season called for. Over 12 seasons on three worlds (`npm run worldcheck -- 12 <seed>`), the
field stays within about 0.1 a round of the real averages while the setup settles 0.5 to 0.7 strokes
a round tougher, and winning scores hold around 20 under instead of sliding from 21 to 23 under
(`src/season/courseSetup.ts`).

Careers started before this change switch to the real tour at the start of their next season.

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
- **Calendar:** the real 2026 PGA TOUR season, 41 weeks from the Sony Open to the RSM
  Classic (off weeks closed up): the four majors, eight signature events, THE PLAYERS
  (worth major points), opposite-field events on the same weeks as the real ones, two
  playoff events (top 70, then top 50), the TOUR Championship for the top 30, and the
  fall events where players outside the top 50 chase their cards. Each event has its
  real purse and field size. The Zurich Classic is played as individual stroke play, and
  the Presidents Cup and December's unofficial events are left out.
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

### To do

- **Header photos for the last 11 courses.** 34 of the 45 venues now have one: freely licensed photos from
  Wikimedia Commons, or, for US courses with none, a public-domain aerial crop over the finishing green
  (USDA NAIP via the USGS National Map, `scripts/osm/banners.py`). Still missing: TPC Scottsdale (Stadium Course), TPC River Highlands, Royal Birkdale Golf Club, Puntacana (Corales Course), The Cliffs at Walnut Cove, Black Desert Resort, Yokohama Country Club, Port Royal Golf Course, Vidanta Vallarta, El Cardonal at Diamante, Barton Creek (Fazio Canyons). The US ones' aerial
  imagery is older than the course (Black Desert), mid-construction (TPC Scottsdale) or unusable, and the
  others are outside the US imagery. Use freely licensed photos only, check each is really the venue, and add it
  to `src/engine/realCoursePhotos.json` and `public/courses/`.

## Layout

```
src/engine/   attributes, types, rng, skill model, courses (+ generator), round & tournament sim, purse, players
src/season/   calendar, entries & fields, points & world ranking, weekly sim, world creation & season end, saves
src/ui/       browser game: App, screens/, components/, useGame (state + autosave)
scripts/      demo.ts, calibrate.ts, worldcheck.ts
tests/        vitest suites
```
