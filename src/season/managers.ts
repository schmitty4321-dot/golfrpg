/**
 * Development directors: one per client, optional, and each on one client at a
 * time. With the "let him hire" box ticked, he fills the client's empty coaching
 * slots with the coaches he rates best, and swaps one out only for a clear step
 * up. His read is a guess: the better his eye, the closer it sits to the truth.
 */
import { clamp, createRng } from "../engine";
import { COACH_ROLES, coachFee, hireCoach } from "./staff";
import { MANAGER_SKILLS, maxQualityOf, paceOf, perceivedQuality, swapMargin } from "./managerFx";
import type { Coach, Manager, World } from "./types";

/** What the job is called in the UI. */
export const MANAGER_LABEL = "Development director";

/** The directors on the market: a trainee at the bottom, a sharp veteran at the top. */
export const MANAGER_POOL_SIZE = 50;

const FIRST = ["Ray", "Vince", "Dana", "Greg", "Lou", "Helen", "Carmen", "Owen", "Nadia", "Tobias", "Brian", "Marcus", "Elise", "Frank", "Ines", "Russ", "Joan", "Kenji", "Paula", "Walt", "Sara", "Hugo", "Maya", "Neil", "Gwen"];
const LAST = ["Abbott", "Brennan", "Castellanos", "Dunmore", "Eriksen", "Fairbairn", "Galloway", "Hollis", "Iverson", "Jessop", "Kowalczyk", "Lindqvist", "Mercer", "Nakamura", "Okafor", "Pemberton", "Quint", "Rasmussen", "Sayer", "Thorne", "Upton", "Vasquez", "Whitlock", "Yoder", "Zeller"];

/** The market of directors: 50 of them, one to three skills each (more for the better ones), dearer as they get better. */
export function generateManagers(seed: number): Manager[] {
  const rng = createRng(seed ^ 0x3a9e);
  const keys = Object.keys(MANAGER_SKILLS);
  const used = new Set<string>();
  const managers: Manager[] = [];
  for (let tier = 0; tier < MANAGER_POOL_SIZE; tier++) {
    let name = "";
    do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    const quality = clamp(1 + Math.round((tier / (MANAGER_POOL_SIZE - 1)) * 19) + rng.int(-1, 1), 1, 20);
    const count = quality >= 16 ? 3 : quality >= 10 ? 2 : 1;
    const pool = [...keys];
    const skills: string[] = [];
    for (let i = 0; i < count; i++) skills.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
    // A director costs about 60% of a coach of his own rating.
    managers.push({ id: `d${tier + 1}`, name, quality, skills, weeklyFee: Math.round((coachFee(quality) * 0.6) / 100) * 100 });
  }
  return managers;
}

const dirOf = (world: World, id: string | undefined): Manager | undefined => (id ? world.managers?.find((m) => m.id === id) : undefined);

function clientOf(world: World, clientId: string) {
  const wp = world.players[clientId];
  if (!wp?.client) throw new Error(`${clientId} is not your client`);
  return { wp, c: wp.client };
}

/** The directors free to take this client: not on another client's books (his own counts as free). */
export function availableManagers(world: World, clientId: string): Manager[] {
  const taken = new Set(world.clientIds.flatMap((id) => (world.players[id]?.client?.manager ? [world.players[id]!.client!.manager!] : [])));
  const mine = world.players[clientId]?.client?.manager;
  return (world.managers ?? []).filter((m) => !taken.has(m.id) || m.id === mine);
}

/**
 * His week with one client's staff: fill each empty slot with the coach he reads
 * best, and swap the coach he has only for a clear step up. Returns the hires made.
 */
export function manageStaff(world: World, clientId: string): number {
  const c = world.players[clientId]?.client;
  const dir = dirOf(world, c?.manager);
  if (!c || !dir || !c.autoHire) return 0;
  const { perWeek, roles } = paceOf(dir);
  const margin = swapMargin(dir);
  const cap = maxQualityOf(dir);
  const read = (x: Coach) => perceivedQuality(world, dir, x);
  let hires = 0;
  for (const role of roles ?? COACH_ROLES) {
    if (hires >= perWeek) break;
    const current = world.coaches.find((x) => x.id === c.staff[role]);
    const options = world.coaches.filter((x) => x.role === role && x.quality <= cap);
    if (options.length === 0) continue;
    const best = options.reduce((a, b) => (read(b) > read(a) ? b : a));
    if (current && (best.id === current.id || read(best) - read(current) < margin)) continue;
    hireCoach(world, clientId, best.id);
    hires++;
  }
  return hires;
}

export function hireManager(world: World, clientId: string, managerId: string): void {
  const { wp, c } = clientOf(world, clientId);
  const dir = dirOf(world, managerId);
  if (!dir) throw new Error(`unknown director ${managerId}`);
  if (!availableManagers(world, clientId).some((m) => m.id === managerId)) throw new Error(`${dir.name} already works for another client`);
  c.manager = dir.id;
  world.news.unshift(`${dir.name} takes charge of ${wp.player.name}'s coaching staff.`);
  if (c.autoHire) manageStaff(world, clientId);
}

export function releaseManager(world: World, clientId: string): void {
  const { wp, c } = clientOf(world, clientId);
  const dir = dirOf(world, c.manager);
  delete c.manager;
  c.autoHire = false;
  if (dir) world.news.unshift(`${dir.name} leaves ${wp.player.name}'s coaching staff.`);
}

/** The "let him hire the best coaches" box. Ticking it has him act straight away. */
export function setAutoHire(world: World, clientId: string, on: boolean): void {
  const { wp, c } = clientOf(world, clientId);
  if (on && !dirOf(world, c.manager)) throw new Error(`${wp.player.name} has no ${MANAGER_LABEL.toLowerCase()}`);
  c.autoHire = on;
  if (on) manageStaff(world, clientId);
}
