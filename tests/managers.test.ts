import { describe, expect, it } from "vitest";
import {
  MANAGER_SKILLS,
  availableManagers,
  createWorld,
  deserializeWorld,
  generateManagers,
  hireCoach,
  hireManager,
  manageStaff,
  playWeek,
  readNoise,
  serializeWorld,
  setAutoHire,
  weeklyStaffCost,
  type Manager,
  type World,
} from "../src/season";

const base = createWorld({ seed: 21, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const director = (over: Partial<Manager>): Manager => ({ id: "t", name: "Test Director", quality: 20, skills: ["good-eye"], weeklyFee: 0, ...over });
/** A fresh world with one director already on the client's books. */
const withDirector = (m: Manager): World => {
  const w = fresh();
  w.managers = [m];
  w.players.client!.client!.manager = m.id;
  return w;
};
const staffOf = (w: World) => w.players.client!.client!.staff;
const ROLES = ["swing", "shortGame", "putting", "mental", "fitness"] as const;

describe("development directors", () => {
  it("come in a pool of 50, with one to three skills each, and the better ones carry more and cost more", () => {
    const pool = generateManagers(21);
    expect(pool).toHaveLength(50);
    expect(new Set(pool.map((m) => m.name)).size).toBe(50);
    for (const m of pool) {
      expect(m.quality).toBeGreaterThanOrEqual(1);
      expect(m.quality).toBeLessThanOrEqual(20);
      expect(m.skills).toHaveLength(m.quality >= 16 ? 3 : m.quality >= 10 ? 2 : 1);
      expect(new Set(m.skills).size).toBe(m.skills.length);
      for (const s of m.skills) expect(MANAGER_SKILLS[s]).toBeDefined();
    }
    const byQuality = [...pool].sort((a, b) => a.quality - b.quality);
    expect(byQuality.at(-1)!.weeklyFee).toBeGreaterThan(byQuality[0]!.weeklyFee * 3);
    // The save carries the pool through a round trip.
    expect(fresh().managers).toHaveLength(50);
  });

  it("have twenty skill traits, each with a name, what it does and an effect", () => {
    expect(Object.keys(MANAGER_SKILLS)).toHaveLength(20);
    for (const s of Object.values(MANAGER_SKILLS)) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.fx.length).toBeGreaterThan(0);
    }
  });

  it("can't be let loose on a client who has none, and does nothing on his own", () => {
    const w = fresh();
    expect(() => setAutoHire(w, "client", true)).toThrow(/no development director/);
    expect(manageStaff(w, "client")).toBe(0);
    expect(ROLES.filter((r) => staffOf(w)[r])).toHaveLength(0);
  });

  it("with the box ticked, fills every empty coach slot with the coach he reads best", () => {
    const w = withDirector(director({ quality: 20, skills: ["data-driven"] }));
    setAutoHire(w, "client", true);
    for (const role of ROLES) {
      const best = Math.max(...w.coaches.filter((c) => c.role === role).map((c) => c.quality));
      const hired = w.coaches.find((c) => c.id === staffOf(w)[role])!;
      expect(hired.quality).toBeGreaterThanOrEqual(best - 1);
    }
  });

  it("reads coaches more truly the sharper his eye", () => {
    const coach = base.coaches.find((c) => c.role === "swing")!;
    const sharp = director({ quality: 20, skills: ["good-eye"] });
    const dull = director({ quality: 1, skills: ["good-eye"] });
    expect(readNoise(sharp, coach)).toBeLessThan(readNoise(dull, coach));
    const swingEye = director({ quality: 10, skills: ["swing-eye"] });
    const noSpecialty = director({ quality: 10, skills: ["haggler"] });
    expect(readNoise(swingEye, coach)).toBeLessThan(readNoise(noSpecialty, coach));
  });

  it("a steady hand never swaps a coach, but a go-getter swaps for a two-point step up", () => {
    const weak = base.coaches.filter((c) => c.role === "swing").sort((a, b) => a.quality - b.quality)[0]!;
    const steady = withDirector(director({ quality: 20, skills: ["steady-hand"] }));
    hireCoach(steady, "client", weak.id);
    setAutoHire(steady, "client", true);
    expect(staffOf(steady).swing).toBe(weak.id);

    const eager = withDirector(director({ quality: 20, skills: ["go-getter"] }));
    hireCoach(eager, "client", weak.id);
    setAutoHire(eager, "client", true);
    expect(staffOf(eager).swing).not.toBe(weak.id);
  });

  it("a rebuild-first director fills one vacancy a week, swing first", () => {
    const w = withDirector(director({ quality: 20, skills: ["rebuild-first"] }));
    w.players.client!.client!.autoHire = true;
    expect(manageStaff(w, "client")).toBe(1);
    expect(staffOf(w).swing).toBeDefined();
    expect(staffOf(w).shortGame).toBeUndefined();
    expect(manageStaff(w, "client")).toBe(1);
    expect(staffOf(w).shortGame).toBeDefined();
  });

  it("a budget keeper never hires anyone rated above 15", () => {
    const w = withDirector(director({ quality: 20, skills: ["budget-keeper"] }));
    setAutoHire(w, "client", true);
    for (const role of ROLES) {
      const hired = w.coaches.find((c) => c.id === staffOf(w)[role])!;
      expect(hired.quality).toBeLessThanOrEqual(15);
    }
  });

  it("a haggler takes 10% off the coaches' retainers, and his own fee is charged on top", () => {
    const w = withDirector(director({ quality: 12, skills: ["haggler"], weeklyFee: 500 }));
    const coach = w.coaches.find((c) => c.role === "putting")!;
    hireCoach(w, "client", coach.id);
    expect(weeklyStaffCost(w, "client")).toBe(Math.round(coach.weeklyFee * 0.9) + 500);
  });

  it("a director works for one client at a time", () => {
    const w = fresh();
    w.clientIds.push("ghost");
    w.players.ghost = { ...w.players.client!, client: { ...w.players.client!.client!, manager: "d7" } };
    expect(availableManagers(w, "client").some((m) => m.id === "d7")).toBe(false);
    expect(() => hireManager(w, "client", "d7")).toThrow(/another client/);
    expect(availableManagers(w, "client").length).toBe(49);
  });

  it("a week's turn fills the staff for a client with a director on the books", () => {
    const w = withDirector(director({ quality: 20, skills: ["data-driven"], weeklyFee: 400 }));
    w.players.client!.client!.autoHire = true;
    playWeek(w);
    expect(ROLES.filter((r) => staffOf(w)[r])).toHaveLength(5);
    expect(weeklyStaffCost(w, "client")).toBeGreaterThan(400);
  });
});
