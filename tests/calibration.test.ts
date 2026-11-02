import { describe, it, expect } from "vitest";
import { distribution } from "../lib/scoring/calibration";
// Same n and definitions as README. Seeds are fixed, so results are reproducible.
describe("calibration (indicative targets, not hardcoded scores)", () => {
  const d = Object.fromEntries((["random", "average", "strong", "greedy"] as const).map((p) => [p, distribution(p, 400)]));
  it("reproducible", () => { expect(distribution("random", 400).mean).toBe(d.random.mean); });
  it("random 40-55", () => { expect(d.random.mean).toBeGreaterThan(40); expect(d.random.mean).toBeLessThan(55); });
  it("average 55-75", () => { expect(d.average.mean).toBeGreaterThan(55); expect(d.average.mean).toBeLessThan(75); });
  it("strong 75-90", () => { expect(d.strong.mean).toBeGreaterThan(75); expect(d.strong.mean).toBeLessThan(90); });
  it("greedy one-over optimiser above 80, and ordering holds", () => { expect(d.greedy.mean).toBeGreaterThan(80); expect(d.greedy.mean).toBeGreaterThan(d.strong.mean); expect(d.strong.mean).toBeGreaterThan(d.average.mean); expect(d.average.mean).toBeGreaterThan(d.random.mean); });
});
