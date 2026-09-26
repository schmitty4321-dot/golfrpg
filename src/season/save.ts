import { createRng, type Player } from "../engine";
import { assignRivalAgents, emptyFinances, newAgency, newManagement } from "./agency";
import { newDevelopment } from "./development";
import { generateScouts } from "./scouting";
import { generateCoaches } from "./staff";
import { AMATEUR_CLASS_SIZE, generateAmateur } from "./amateurs";
import { buildDevTour } from "./calendar";
import { newHistory } from "./history";
import { makeAmateur } from "./world";
import { SAVE_VERSION, type World } from "./types";

export function serializeWorld(world: World): string {
  return JSON.stringify(world);
}

/** Loads a save, upgrading older versions step by step so no career is ever lost. */
export function deserializeWorld(json: string): World {
  // Older saves have shapes the current types don't describe, so migrations work on plain objects.
  const raw = JSON.parse(json) as Raw;
  if (raw.version === 1) migrateV1(raw);
  if (raw.version === 2) migrateV2(raw);
  if (raw.version === 3) migrateV3(raw);
  const world = raw as unknown as World;
  if (world.version !== SAVE_VERSION) throw new Error(`unsupported save version ${String(world.version)}`);
  if (!Array.isArray(world.clientIds) || world.clientIds.some((id) => !world.players[id]?.client)) {
    throw new Error("save has no valid client list");
  }
  return world;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Version 1 (before development): add ceilings, injuries, coaches and training. */
function migrateV1(raw: Raw): void {
  const rng = createRng(raw.seed ^ 0x2);
  for (const wp of Object.values(raw.players) as Raw[]) {
    wp.development = newDevelopment(wp.player as Player, rng);
    wp.injury = null;
    wp.rebuild = null;
  }
  raw.finances.coaching = 0;
  for (const s of raw.pastSeasons as Raw[]) s.client.finances.coaching ??= 0;
  raw.coaches = generateCoaches(raw.seed);
  raw.staff = {};
  raw.training = { focus: "balanced", intensity: "normal" };
  raw.version = 2;
}

/** Version 2 (one client): turn the single client into the first client of an agency. */
function migrateV2(raw: Raw): void {
  const id: string = raw.clientId;
  const agency = newAgency();
  agency.bank = raw.agencyBank ?? 0;
  agency.scouts = generateScouts(raw.seed);
  agency.knowledge[id] = { accuracy: 1, reports: 99, absWeek: 0 };
  agency.ledger.prizeCommission = raw.finances?.commission ?? 0;

  const m = newManagement(raw.season, raw.commissionRate ?? 0.1, 2);
  m.training = raw.training;
  m.staff = raw.staff ?? {};
  m.finances = { ...emptyFinances(), ...raw.finances };
  raw.players[id].client = m;
  for (const wp of Object.values(raw.players) as Raw[]) wp.agent ??= null;

  raw.pastSeasons = (raw.pastSeasons as Raw[]).map((s) => ({
    season: s.season,
    pointsLeaders: s.pointsLeaders,
    majors: s.majors,
    clients: [{ id, ...s.client, finances: { ...emptyFinances(), ...s.client.finances } }],
    agency: { reputationBefore: agency.reputation, reputationAfter: agency.reputation, ledger: { prizeCommission: s.client.finances.commission ?? 0, endorsementCommission: 0, office: 0, scouts: 0 }, departures: [] },
  }));
  raw.clientIds = [id];
  raw.agency = agency;
  for (const k of ["clientId", "commissionRate", "finances", "agencyBank", "staff", "training"]) delete raw[k];
  raw.version = 3;
  assignRivalAgents(raw as unknown as World, createRng(raw.seed ^ 0x3));
}

/** Version 3 (no pathways or history): add the developmental tour, amateurs, career counters and the record book. */
function migrateV3(raw: Raw): void {
  for (const wp of Object.values(raw.players) as Raw[]) {
    const c = wp.career;
    const results = c.results as Raw[];
    c.devPoints = 0;
    c.careerMajors = results.filter((r) => r.position === 1 && r.tier === "major").length;
    c.careerEvents = results.length;
    c.careerTop10s = results.filter((r) => r.madeCut && r.position <= 10).length;
    c.careerCuts = results.filter((r) => r.madeCut).length;
    c.pointsTitles = 0;
  }
  if (!(raw.schedule as Raw[]).some((e) => e.tier === "dev")) {
    const dev = buildDevTour(raw.seed);
    raw.courses.push(...dev.courses);
    raw.schedule.push(...dev.schedule);
  }
  raw.history = newHistory();
  const rng = createRng(raw.seed ^ 0x4);
  const used = new Set((Object.values(raw.players) as Raw[]).map((wp) => wp.player.name as string));
  for (let i = 0; i < AMATEUR_CLASS_SIZE * 3; i++) {
    const p = generateAmateur(rng, `m${raw.season}a${i + 1}`, 16 + (i % 6), used);
    raw.players[p.id] = makeAmateur(p, rng);
  }
  raw.version = 4;
}
