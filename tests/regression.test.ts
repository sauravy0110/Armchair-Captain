import { describe, it, expect } from "vitest";
import { outcomeDistribution } from "../lib/simulation/engine";
import { initialState, BOWLERS, bowlerById } from "../lib/simulation/players";
import { captainPick } from "../lib/simulation/captain-policy";
import { legalBowlers } from "../lib/simulation/engine";
import { tacticalUtility } from "../lib/simulation/model";
import { captainComparison, resolveOver, replay } from "../lib/scoring";
import { parseSession, newSession } from "../lib/storage";

const VALS = [0, 1, 2, 3, 4, 6];
const mean = (p: number[]) => p.reduce((a, x, i) => a + x * VALS[i], 0);
const variance = (p: number[]) => p.reduce((a, x, i) => a + x * (VALS[i] - mean(p)) ** 2, 0);

describe("bowler variation", () => {
  it("widens the outcome spread without changing the mean", () => {
    for (const st of ["ATTACK", "DEFEND"] as const) {
      const lo = outcomeDistribution(1.2, st, 0.2), hi = outcomeDistribution(1.2, st, 0.9);
      expect(mean(lo)).toBeCloseTo(1.2, 6); expect(mean(hi)).toBeCloseTo(1.2, 6);
      expect(variance(hi)).toBeGreaterThan(variance(lo));
    }
  });
  it("keeps seeded results deterministic", () => {
    const s = initialState();
    expect(resolveOver(s, "kabir", "ATTACK", 8).fan.result).toEqual(resolveOver(s, "kabir", "ATTACK", 8).fan.result);
  });
  it("expected-runs model is unaffected by variation", () => {
    const s = initialState();
    const a = tacticalUtility(bowlerById("kabir"), s, "DEFEND");
    const b = tacticalUtility({ ...bowlerById("kabir"), variation: 0 }, s, "DEFEND");
    expect(a).toBe(b);
  });
});

describe("captain policy / comparison consistency", () => {
  it("captain pick is legal, deterministic, rule-based", () => {
    const s = initialState(); const p = captainPick(s);
    expect(captainPick(s)).toEqual(p); expect(legalBowlers(s).map((b) => b.id)).toContain(p.bowlerId);
  });
  it("comparison uses the same utility the captain is judged on; fan can beat the heuristic", () => {
    const s = initialState();
    let beat = false;
    for (const b of BOWLERS) for (const st of ["ATTACK", "DEFEND"] as const) {
      const r = resolveOver(s, b.id, st, 5);
      expect(r.comparison).toBeCloseTo(captainComparison(r.fan.u, r.captain.u, r.uRange), 9);
      if (r.fan.u < r.captain.u - 1e-9) { beat = true; expect(r.comparison).toBeGreaterThan(10); }
    }
    expect(beat).toBe(true);
  });
  it("comparison is independent of the simulated outcome", () => {
    const s = initialState();
    expect(resolveOver(s, "dev", "ATTACK", 1).comparison).toBe(resolveOver(s, "dev", "ATTACK", 77).comparison);
  });
  it("matching the captain scores 10", () => {
    const s = initialState(); const c = captainPick(s);
    expect(resolveOver(s, c.bowlerId, c.strategy, 3).comparison).toBeCloseTo(10, 9);
  });
});

describe("storage validation", () => {
  const good = () => { const s = newSession(); const { state } = replay(s.seed, []); void state; return s; };
  const withDecision = () => {
    const s = good(); s.decisions = [{ bowlerId: "dev", strategy: "DEFEND", receipt: { id: "AC-1", over: 1, bowler: "Dev Rao", strategy: "DEFEND", score: "48/4", seed: 1, at: new Date().toISOString() } }];
    s.step = "reveal"; return s;
  };
  it("round-trips valid sessions", () => { const g = good(); expect(parseSession(JSON.stringify(g))).toEqual(g); expect(parseSession(JSON.stringify(withDecision()))).not.toBeNull(); });
  it("rejects malformed fields safely", () => {
    const bad = (f: (s: any) => void) => { const s: any = withDecision(); f(s); return parseSession(JSON.stringify(s)); };
    expect(bad((s) => { s.lang = "klingon"; })).toBeNull();
    expect(bad((s) => { s.decisions[0].bowlerId = "ghost"; })).toBeNull();
    expect(bad((s) => { s.decisions[0].strategy = "WILD"; })).toBeNull();
    expect(bad((s) => { delete s.decisions[0].receipt; })).toBeNull();
    expect(bad((s) => { s.seed = "x"; })).toBeNull();
    expect(bad((s) => { s.step = "nope"; })).toBeNull();
    expect(bad((s) => { s.ai = { 1: { sections: { call: 1 }, source: "ai" } }; })).toBeNull();
    expect(bad((s) => { s.decisions.push({ ...s.decisions[0] }); })).toBeNull(); // dev twice in a row is illegal
    expect(bad((s) => { s.step = "final"; })).toBeNull(); // not finished
    expect(parseSession("[1,2]")).toBeNull(); expect(parseSession("null")).toBeNull();
  });
});
