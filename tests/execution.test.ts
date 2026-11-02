import { describe, it, expect } from "vitest";
import { initialState, BATTERS, bowlerById } from "../lib/simulation/players";
import { simulateOver } from "../lib/simulation/engine";
import { wicketProb } from "../lib/simulation/model";
import { executionScore, resolveOver } from "../lib/scoring";

const expected = (s: ReturnType<typeof initialState>, id: string, st: "ATTACK" | "DEFEND", seed: number) => {
  const r = resolveOver(s, id, st, seed); const n = r.fan.result.balls.length;
  return { r, n, calc: executionScore((r.fan.e * n) / 6, r.fan.result.runs, r.fan.result.wickets, wicketProb(bowlerById(id), s, st) * n) };
};
describe("execution score pro-rated for shortened overs", () => {
  it("chase ending before six balls", () => {
    const s = { ...initialState(), runs: 72 }; let hit = 0;
    for (let seed = 1; seed < 80; seed++) { const { r, n, calc } = expected(s, "dev", "ATTACK", seed);
      if (n < 6) { hit++; expect(r.fan.result.after.runs).toBeGreaterThanOrEqual(75); expect(r.outcome).toBeCloseTo(calc, 9); } }
    expect(hit).toBeGreaterThan(0);
  });
  it("all-out innings ending before six balls", () => {
    const s = { ...initialState(), wickets: 9, runs: 20 }; let hit = 0;
    for (let seed = 1; seed < 120; seed++) { const { r, n, calc } = expected(s, "kabir", "ATTACK", seed);
      if (n < 6) { hit++; expect(r.fan.result.after.wickets).toBe(10); expect(r.outcome).toBeCloseTo(calc, 9); } }
    expect(hit).toBeGreaterThan(0);
  });
  it("pro-rating changes the score versus the old full-over expectation for some shortened overs", () => {
    const s = { ...initialState(), wickets: 9, runs: 20 }; let differs = false;
    for (let seed = 1; seed < 200 && !differs; seed++) { const { r, n } = expected(s, "kabir", "ATTACK", seed);
      if (n < 6) { const res = r.fan.result; const old = executionScore(r.fan.e, res.runs, res.wickets, 6 * wicketProb(bowlerById("kabir"), s, "ATTACK")); differs = Math.abs(r.outcome - old) > 1e-6; } }
    expect(differs).toBe(true);
  });
  it("full six-ball overs keep the original calculation", () => {
    const s = initialState();
    for (let seed = 1; seed < 40; seed++) { const { r, n } = expected(s, "dev", "DEFEND", seed);
      expect(n).toBe(6);
      expect(r.outcome).toBeCloseTo(executionScore(r.fan.e, r.fan.result.runs, r.fan.result.wickets, 6 * wicketProb(bowlerById("dev"), s, "DEFEND")), 9); }
  });
  it("stays within 0..30 across states and seeds", () => {
    for (const s of [initialState(), { ...initialState(), runs: 73 }, { ...initialState(), wickets: 9 }])
      for (let seed = 1; seed < 60; seed++) for (const id of ["aarav", "kabir", "dev"]) { const o = resolveOver(s, id, "ATTACK", seed).outcome; expect(o).toBeGreaterThanOrEqual(0); expect(o).toBeLessThanOrEqual(30); }
  });
});
describe("roster is a consistent XI", () => {
  it("4 down = 2 at crease + 5 waiting", () => { const s = initialState(); expect(s.queue.length).toBe(5); expect(s.wickets + 2 + s.queue.length).toBe(11); expect(BATTERS.length).toBe(7); });
  it("a full collapse never runs out of batters", () => {
    for (let seed = 1; seed < 300; seed++) { let s = initialState(); try { while (!s.done) s = simulateOver(s, ["aarav", "kabir", "dev", "kabir"][s.overIndex] === s.lastBowler ? "dev" : ["aarav", "kabir", "dev", "kabir"][s.overIndex], "ATTACK", seed + s.overIndex).after; } catch (e) { throw e; }
      expect(s.wickets).toBeLessThanOrEqual(10); expect(s.striker).toBeDefined(); }
  });
});
