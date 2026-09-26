/**
 * Play a season in the terminal:   npm run play
 *
 * You're the agent; your client is a pro golfer. Each week, choose which
 * event to enter or rest, then watch the results come in. The game autosaves
 * to saves/career.json after every week.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, coursePar, courseYards, type TournamentResult } from "../src/engine";
import {
  REGION_NAMES,
  SCENARIOS,
  SEASON_WEEKS,
  STATUS_LABELS,
  clientOptions,
  createWorld,
  deserializeWorld,
  eventsInWeek,
  finishSeason,
  playWeek,
  pointsList,
  rankMap,
  serializeWorld,
  theEvent,
  worldRanking,
  FULL_CARD,
  CONDITIONAL_CARD,
  type ClientChoice,
  type Scenario,
  type SeasonSummary,
  type World,
} from "../src/season";

const SAVE = "saves/career.json";
const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
// Queue lines as they arrive so piped (scripted) input isn't lost between prompts.
const lines: string[] = [];
const waiting: ((line: string) => void)[] = [];
let inputClosed = false;
rl.on("line", (line) => {
  const w = waiting.shift();
  if (w) w(line);
  else lines.push(line);
});
rl.on("close", () => {
  inputClosed = true;
  for (const w of waiting.splice(0)) w("q");
});

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const millions = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const toPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const signed = (n: number, d = 1) => (n >= 0 ? "+" : "") + n.toFixed(d);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const hr = () => console.log("─".repeat(78));

function save(world: World): void {
  mkdirSync("saves", { recursive: true });
  writeFileSync(SAVE, serializeWorld(world));
}

async function ask(q: string): Promise<string> {
  stdout.write(q);
  const queued = lines.shift();
  if (queued !== undefined) return queued.trim().toLowerCase();
  if (inputClosed) return "q";
  return new Promise((resolve) => waiting.push((line) => resolve(line.trim().toLowerCase())));
}

async function start(): Promise<World> {
  if (existsSync(SAVE)) {
    const a = await ask("Continue your saved career? (Y/n) ");
    if (a !== "n") return deserializeWorld(readFileSync(SAVE, "utf8"));
  }
  console.log("\nChoose your first client:\n");
  const keys = Object.keys(SCENARIOS) as Scenario[];
  keys.forEach((k, i) => console.log(`  ${i + 1}) ${SCENARIOS[k].title}\n     ${SCENARIOS[k].blurb}\n`));
  let scenario: Scenario | undefined;
  while (!scenario) scenario = keys[Number(await ask("> ")) - 1];
  const seedText = await ask("World seed (Enter for random): ");
  const seed = seedText ? Number(seedText) || hash(seedText) : Math.floor(Math.random() * 1e9);
  console.log("\nBuilding the golf world and playing a warm-up season...");
  const world = createWorld({ seed, scenario });
  const c = world.players[world.clientId]!;
  console.log(`\nYou've signed ${c.player.name}, ${c.player.age}, from the ${c.player.nationality}. Status: ${STATUS_LABELS[c.career.status]}.`);
  console.log(`Your agency takes ${Math.round(world.commissionRate * 100)}% of his prize money.`);
  save(world);
  return world;
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

function header(world: World): void {
  const c = world.players[world.clientId]!;
  const pr = pointsList(world).indexOf(world.clientId) + 1;
  const wr = rankMap(world).get(world.clientId) ?? 0;
  hr();
  console.log(`Season ${world.season} · Week ${world.week} of ${SEASON_WEEKS}`);
  console.log(
    `${c.player.name} (${c.player.age}) · ${STATUS_LABELS[c.career.status]} · Points ${pr ? `#${pr}` : "—"} (${Math.round(c.career.seasonPoints)}) · World #${wr}`,
  );
  console.log(
    `Condition ${Math.round(c.player.condition)}% · Form ${formWord(c.player.form)} · Season ${money(c.career.seasonEarnings)} · Agency bank ${money(world.agencyBank)}`,
  );
  hr();
}

function formWord(f: number): string {
  if (f > 0.5) return "on fire";
  if (f > 0.2) return "good";
  if (f > -0.2) return "steady";
  if (f > -0.5) return "poor";
  return "slump";
}

function fitWord(fit: number): string {
  if (fit > 0.2) return "great fit";
  if (fit > 0.05) return "good fit";
  if (fit > -0.05) return "neutral";
  if (fit > -0.2) return "poor fit";
  return "bad fit";
}

async function weekMenu(world: World): Promise<ClientChoice | "quit" | { auto: number }> {
  while (true) {
    header(world);
    const options = clientOptions(world);
    console.log("This week:");
    options.forEach((o, i) => {
      const e = o.event;
      console.log(
        `  ${i + 1}) ${e.name} [${e.tier}] · ${millions(e.purse)} · ${REGION_NAMES[e.region]}\n` +
          `     ${o.course.name} (${o.course.style}, par ${coursePar(o.course)}, ${courseYards(o.course).toLocaleString("en-US")} yds, ${o.course.grass} greens)\n` +
          `     ${o.detail} Course: ${fitWord(o.fit)} (${signed(o.fit, 2)}/round).`,
      );
    });
    console.log(`  r) Rest this week (recover condition)`);
    console.log(`\n  s) standings  w) world ranking  p) player card  h) results  n) news  c) calendar  a) auto-sim  q) save & quit`);
    const a = await ask("> ");
    const n = Number(a);
    if (n >= 1 && n <= options.length) {
      const o = options[n - 1]!;
      if (o.access === "not-invited") {
        console.log(`\nNot in the field: ${o.detail}`);
        await ask("(Enter)");
        continue;
      }
      return { kind: "enter", eventId: o.event.id };
    }
    if (a === "r") return { kind: "rest" };
    if (a === "q") return "quit";
    if (a === "a") {
      const weeks = Number(await ask(`How many weeks? (1-${SEASON_WEEKS - world.week + 1}, Enter = rest of season) `)) || SEASON_WEEKS;
      return { auto: weeks };
    }
    if (a === "s") standings(world);
    else if (a === "w") ranking(world);
    else if (a === "p") playerCard(world);
    else if (a === "h") results(world);
    else if (a === "n") world.news.slice(0, 12).forEach((x) => console.log(`  ${x}`));
    else if (a === "c") calendar(world);
    else continue;
    await ask("\n(Enter to go back)");
  }
}

function standings(world: World): void {
  const list = pointsList(world);
  console.log(`\nSeason points (top ${FULL_CARD} keep their card, ${FULL_CARD + 1}-${CONDITIONAL_CARD} get conditional status)`);
  const me = list.indexOf(world.clientId);
  const rows = new Set([...list.slice(0, 15).keys(), ...[me - 2, me - 1, me, me + 1, me + 2].filter((i) => i >= 0 && i < list.length)]);
  for (const i of [...rows].sort((a, b) => a - b)) {
    const wp = world.players[list[i]!]!;
    const mark = wp.player.id === world.clientId ? "►" : " ";
    if (i === FULL_CARD) console.log("  ───── card line ─────");
    console.log(`${mark}${String(i + 1).padStart(4)}. ${wp.player.name.padEnd(26)} ${String(Math.round(wp.career.seasonPoints)).padStart(6)} pts  ${String(wp.career.seasonWins).padStart(2)} wins  ${money(wp.career.seasonEarnings).padStart(12)}`);
  }
}

function ranking(world: World): void {
  const rows = worldRanking(world);
  console.log("\nWorld ranking");
  const me = rows.findIndex((r) => r.id === world.clientId);
  for (const i of new Set([...Array(15).keys(), me])) {
    const r = rows[i];
    if (!r) continue;
    const wp = world.players[r.id]!;
    console.log(`${r.id === world.clientId ? "►" : " "}${String(i + 1).padStart(4)}. ${wp.player.name.padEnd(26)} ${wp.player.nationality.padEnd(13)} avg ${r.average.toFixed(2)}`);
  }
}

function playerCard(world: World): void {
  const c = world.players[world.clientId]!;
  const p = c.player;
  console.log(`\n${p.name} · ${p.age} · ${p.nationality} · career wins ${c.career.careerWins} · career earnings ${money(c.career.careerEarnings)}`);
  for (const [group, keys] of Object.entries(ATTRIBUTE_GROUPS)) {
    const label = group.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
    console.log(`\n  ${label}`);
    for (const k of keys) console.log(`    ${ATTRIBUTE_LABELS[k].padEnd(20)} ${"█".repeat(p.attributes[k])}${"░".repeat(20 - p.attributes[k])} ${p.attributes[k]}`);
  }
  console.log("\n  (Hidden attributes such as wind tolerance and grass preference show up only in results. Scouting comes later.)");
}

function results(world: World): void {
  const c = world.players[world.clientId]!;
  const rows = c.career.results.filter((r) => r.season === world.season);
  if (rows.length === 0) return void console.log("\nNo starts yet this season.");
  console.log(`\n${"Wk".padEnd(4)}${"Event".padEnd(36)}${"Pos".padEnd(6)}${"Score".padEnd(7)}${"Money".padStart(12)}${"Pts".padStart(8)}${"SG/rd".padStart(8)}`);
  for (const r of rows) {
    console.log(`${String(r.week).padEnd(4)}${(r.eventName + (r.via === "monday" ? " (MQ)" : "")).slice(0, 34).padEnd(36)}${r.label.padEnd(6)}${toPar(r.toPar).padEnd(7)}${money(r.earnings).padStart(12)}${r.seasonPoints.toFixed(0).padStart(8)}${signed(r.sgPerRound, 2).padStart(8)}`);
  }
}

function calendar(world: World): void {
  console.log("");
  for (let w = world.week; w <= SEASON_WEEKS; w++) {
    const ev = eventsInWeek(world, w).map((e) => `${e.name} [${e.tier}]`).join("  +  ");
    console.log(`  Week ${String(w).padStart(2)}: ${ev}`);
  }
}

function leaderboard(result: TournamentResult, clientId: string): void {
  console.log(`\n${result.name} — final leaderboard${result.playoff ? ` (won in a ${result.playoff.holesPlayed}-hole playoff)` : ""}`);
  const me = result.leaderboard.findIndex((r) => r.player.id === clientId);
  for (const i of new Set([...Array(8).keys(), me])) {
    const r = result.leaderboard[i];
    if (!r) continue;
    const mark = r.player.id === clientId ? "►" : " ";
    console.log(`${mark} ${r.positionLabel.padEnd(5)} ${r.player.name.padEnd(26)} ${toPar(r.toPar).padStart(4)}  ${r.rounds.join("-").padEnd(12)} ${money(r.earnings).padStart(11)}`);
  }
  const mine = result.leaderboard[me];
  if (mine) {
    const sg = mine.sg;
    const n = mine.rounds.length;
    console.log(`\n  Strokes gained per round vs the field: off the tee ${signed(sg.offTheTee / n, 2)} · approach ${signed(sg.approach / n, 2)} · around the green ${signed(sg.aroundTheGreen / n, 2)} · putting ${signed(sg.putting / n, 2)}`);
  }
}

function showSeasonEnd(s: SeasonSummary): void {
  hr();
  console.log(`SEASON ${s.season} REVIEW`);
  hr();
  const c = s.client;
  console.log(`${c.name}: ${plural(c.events, "start")}, ${plural(c.cutsMade, "cut")} made, ${plural(c.top10s, "top-10")}, ${plural(c.wins, "win")}`);
  console.log(`Points list: ${c.pointsRank ? `#${c.pointsRank}` : "not ranked"} (${c.points} pts) · World #${c.owgrRank} · Earnings ${money(c.earnings)}`);
  console.log(`Expenses: caddie ${money(c.finances.caddie)}, travel ${money(c.finances.travel)} · Agency commission ${money(c.finances.commission)}`);
  console.log(`\nNext season: ${STATUS_LABELS[c.statusAfter]}${c.statusAfter === "none" ? ". He's lost his card and will have to Monday qualify." : "."}`);
  console.log("\nPoints leaders:");
  s.pointsLeaders.forEach((l, i) => console.log(`  ${i + 1}. ${l.name} — ${l.points} pts, ${plural(l.wins, "win")}`));
  console.log("\nMajor champions:");
  s.majors.forEach((m) => console.log(`  ${m.event}: ${m.winner} (${toPar(m.toPar)})`));
}

async function main(): Promise<void> {
  console.log("\n  FAIRWAY MANAGER — the golf agency game\n");
  const world = await start();
  let autoWeeks = 0;
  while (true) {
    if (world.week > SEASON_WEEKS) {
      const summary = finishSeason(world);
      if (summary) showSeasonEnd(summary);
      save(world);
      const a = await ask(`\nStart season ${world.season}? (Y/n) `);
      if (a === "n") break;
      continue;
    }
    let choice: ClientChoice;
    if (autoWeeks > 0) {
      choice = { kind: "auto" };
      autoWeeks--;
    } else {
      const m = await weekMenu(world);
      if (m === "quit") break;
      if ("auto" in m) {
        autoWeeks = m.auto - 1;
        choice = { kind: "auto" };
      } else choice = m;
    }
    const report = playWeek(world, choice);
    console.log(`\nWeek ${report.week}: ${report.client.summary}`);
    if (autoWeeks === 0 && report.client.result) leaderboard(report.client.result, world.clientId);
    for (const r of report.results) {
      if (r.result === report.client.result) continue;
      const w = r.result.leaderboard[0]!;
      console.log(`  Elsewhere: ${w.player.name} won ${theEvent(r.event.name)} (${toPar(w.toPar)}).`);
    }
    save(world);
    if (autoWeeks === 0) await ask("\n(Enter to continue)");
  }
  save(world);
  console.log(`\nSaved to ${SAVE}. See you next time.`);
  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
