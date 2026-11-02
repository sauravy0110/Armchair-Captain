import { describe, it, expect } from "vitest";
import { tacticalScore, captainComparison, executionScore, resolveOver } from "../lib/scoring";
import { initialState } from "../lib/simulation/players";
import { fallbackSections } from "../lib/ai/fallback";
import { buildPayload } from "../lib/ai/prompt";

describe("scoring", () => {
  it("tactical bounds, ties and independence from outcome", () => {
    expect(tacticalScore(7, 7, 9)).toBe(50); expect(tacticalScore(9, 7, 9)).toBe(0); expect(tacticalScore(5, 7, 9)).toBe(50); expect(tacticalScore(8, 8, 8)).toBe(50);
  });
  it("captain comparison: equal=10, bounds, ties", () => {
    expect(captainComparison(7, 7, 2)).toBe(10); expect(captainComparison(7, 9, 2)).toBe(20); expect(captainComparison(9, 7, 2)).toBe(0); expect(captainComparison(7, 7, 0)).toBe(10);
  });
  it("execution depends on outcome and stays in 0..30", () => {
    expect(executionScore(7.5, 3, 2, 0.4)).toBeGreaterThan(executionScore(7.5, 15, 0, 0.4));
    for (const r of [0, 8, 40]) for (const w of [0, 5]) { const x = executionScore(7.5, r, w, 0.4); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(30); }
  });
  it("tactical and comparison are identical across seeds (pre-over info only); outcome varies", () => {
    const s = initialState(); const a = resolveOver(s, "kabir", "ATTACK", 1), b = resolveOver(s, "kabir", "ATTACK", 99);
    expect(a.tactical).toBe(b.tactical); expect(a.comparison).toBe(b.comparison);
    const outs = new Set(Array.from({ length: 25 }, (_, i) => resolveOver(s, "kabir", "ATTACK", i + 1).outcome)); expect(outs.size).toBeGreaterThan(1);
    expect(a.total).toBeLessThanOrEqual(100);
  });
  it("AI fallback works with no API key (pure function)", () => {
    const r = resolveOver(initialState(), "dev", "DEFEND", 4);
    for (const l of ["english", "hinglish", "beginner"] as const) { const t = fallbackSections(buildPayload(r, l)); expect(t.call.length).toBeGreaterThan(10); expect(t.next.length).toBeGreaterThan(5); }
  });
});
