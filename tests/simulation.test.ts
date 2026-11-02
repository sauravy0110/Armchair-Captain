import { describe, it, expect } from "vitest";
import { initialState } from "../lib/simulation/players";
import { simulateOver, legalBowlers, validateSelection } from "../lib/simulation/engine";
import { captainPick } from "../lib/simulation/captain-policy";
import { resolveOver, replay } from "../lib/scoring";
import { parseSession, newSession } from "../lib/storage";

describe("simulation", () => {
  const s0 = initialState();
  it("is deterministic per seed, varies across seeds", () => {
    expect(simulateOver(s0, "aarav", "ATTACK", 5)).toEqual(simulateOver(s0, "aarav", "ATTACK", 5));
    const outs = new Set(Array.from({ length: 30 }, (_, i) => simulateOver(s0, "dev", "DEFEND", i + 1).runs));
    expect(outs.size).toBeGreaterThan(1);
  });
  it("fan choices change the continuing match", () => {
    const a = replay(11, [{ bowlerId: "aarav", strategy: "ATTACK" }]).state;
    const b = replay(11, [{ bowlerId: "dev", strategy: "DEFEND" }]).state;
    expect(a).not.toEqual(b);
  });
  it("captain branch never overwrites fan branch and uses same pre-state", () => {
    const r = resolveOver(s0, "dev", "DEFEND", 3);
    expect(r.fan.result.after.lastBowler).toBe("dev");
    expect(r.captain.result.after.lastBowler).toBe(r.captain.bowlerId);
    expect(s0.runs).toBe(48);
  });
  it("enforces quota and consecutive-over rules", () => {
    const s1 = simulateOver(s0, "aarav", "DEFEND", 1).after;
    expect(() => validateSelection(s1, "aarav", "DEFEND")).toThrow();
    expect(legalBowlers(s1).length).toBeGreaterThanOrEqual(2);
    const quotaed = { ...s1, lastBowler: "dev", quota: { ...s1.quota, aarav: 2 } };
    expect(() => validateSelection(quotaed, "aarav", "ATTACK")).toThrow();
    expect(() => validateSelection(s0, "nobody", "ATTACK")).toThrow();
    expect(() => validateSelection(s0, "dev", "WILD" as never)).toThrow();
  });
  it("always leaves >=2 legal options in every sequence", () => {
    const walk = (s = s0, d = 0) => { if (d === 4 || s.done) return; const l = legalBowlers(s); expect(l.length).toBeGreaterThanOrEqual(2); l.forEach((b) => walk(simulateOver(s, b.id, "DEFEND", 9 + d).after, d + 1)); };
    walk();
  });
  it("ends when target is reached and never exceeds ten wickets", () => {
    const near = { ...s0, runs: 74 };
    let seen = false;
    for (let i = 1; i < 60; i++) { const o = simulateOver(near, "dev", "DEFEND", i); if (o.after.runs >= 75) { seen = true; expect(o.after.done).toBe(true); expect(o.balls.length).toBeLessThanOrEqual(6); } }
    expect(seen).toBe(true);
    const fragile = { ...s0, wickets: 9, runs: 10 };
    for (let i = 1; i < 40; i++) { const o = simulateOver(fragile, "kabir", "ATTACK", i); expect(o.after.wickets).toBeLessThanOrEqual(10); if (o.after.wickets === 10) expect(o.after.done).toBe(true); }
  });
  it("captain policy is deterministic and legal", () => {
    const p = captainPick(s0); expect(captainPick(s0)).toEqual(p); expect(legalBowlers(s0).map((b) => b.id)).toContain(p.bowlerId);
  });
  it("session storage round-trips and rejects corrupt data", () => {
    const s = newSession(); expect(parseSession(JSON.stringify(s))).toEqual(s);
    expect(parseSession("{bad")).toBeNull(); expect(parseSession(JSON.stringify({ v: 0 }))).toBeNull(); expect(parseSession(null)).toBeNull();
  });
});
