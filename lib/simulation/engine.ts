import type { Bowler, MatchState, OverResult, Strategy, BallEvent } from "./types";
import { STRATEGIES } from "./types";
import { BOWLERS, bowlerById, initialState } from "./players";
import { expectedRuns, wicketProb } from "./model";
import { mulberry32 } from "./random";

export const MAX_OVERS_PER_BOWLER = 2;
export const TOTAL_OVERS = 4;
const VALS = [0, 1, 2, 3, 4, 6];
const BASE = [0.36, 0.34, 0.07, 0.01, 0.15, 0.07];

export function legalBowlers(s: MatchState): Bowler[] {
  return BOWLERS.filter((b) => s.quota[b.id] < MAX_OVERS_PER_BOWLER && b.id !== s.lastBowler);
}
export function validateSelection(s: MatchState, bowlerId: string, strat: string) {
  if (s.done) throw new Error("Match is over");
  if (!STRATEGIES.includes(strat as Strategy)) throw new Error("Invalid strategy");
  if (!BOWLERS.some((b) => b.id === bowlerId)) throw new Error("Unknown bowler");
  if (s.quota[bowlerId] >= MAX_OVERS_PER_BOWLER) throw new Error("Bowler has no overs left");
  if (s.lastBowler === bowlerId) throw new Error("Bowler cannot bowl consecutive overs");
}
/** Ball-outcome distribution with a fixed mean. Higher `variation` fattens dot/boundary mass and thins 1s/2s;
 *  the tilt solver then restores the requested mean, so variation changes spread, not expected runs. */
export function outcomeDistribution(meanNoWicket: number, strat: Strategy, variation = 0.5): number[] {
  const w = BASE.slice();
  w[0] *= 1 + 0.6 * variation; w[4] *= 1 + 0.6 * variation; w[5] *= 1 + 0.6 * variation;
  w[1] *= 1 - 0.35 * variation; w[2] *= 1 - 0.35 * variation;
  if (strat === "ATTACK") { w[0] *= 1.25; w[4] *= 1.3; w[5] *= 1.3; } else { w[1] *= 1.15; w[2] *= 1.2; w[4] *= 0.8; w[5] *= 0.75; }
  const at = (l: number) => { const p = w.map((x, i) => x * Math.exp(l * VALS[i])); const t = p.reduce((a, b) => a + b, 0); return { p: p.map((x) => x / t), m: p.reduce((a, x, i) => a + x * VALS[i], 0) / t }; };
  let lo = -3, hi = 3;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (at(mid).m < meanNoWicket) lo = mid; else hi = mid; }
  return at((lo + hi) / 2).p;
}
/** Deterministic: same state + bowler + strategy + seed => same over. */
export function simulateOver(state: MatchState, bowlerId: string, strat: Strategy, seed: number): OverResult {
  validateSelection(state, bowlerId, strat);
  const b = bowlerById(bowlerId);
  const rng = mulberry32(seed);
  const s: MatchState = { ...state, queue: [...state.queue], quota: { ...state.quota } };
  const E = expectedRuns(b, state, strat);
  const p = wicketProb(b, state, strat);
  const dist = outcomeDistribution(E / 6 / (1 - p), strat, b.variation);
  const balls: BallEvent[] = [];
  let runs = 0, wk = 0;
  for (let i = 1; i <= 6; i++) {
    if (s.runs >= s.target || s.wickets >= 10) break;
    const batter = s.striker.name;
    // Common random numbers: exactly two draws per ball, always, so branches sharing a seed stay aligned
    // ball-for-ball even when one gets a wicket and the other does not.
    const wicketRoll = rng(), runRoll = rng();
    let r = 0, out = false;
    if (wicketRoll < p) out = true;
    else { let u = runRoll, k = 0; while (k < dist.length - 1 && u > dist[k]) { u -= dist[k]; k++; } r = VALS[k]; }
    s.balls++;
    if (out) { s.wickets++; wk++; if (s.wickets < 10) s.striker = s.queue.shift()!; }
    else { s.runs += r; runs += r; if (r % 2 === 1) [s.striker, s.nonStriker] = [s.nonStriker, s.striker]; }
    balls.push({ ball: i, runs: r, wicket: out, batter, score: `${s.runs}/${s.wickets}` });
  }
  if (balls.length === 6) [s.striker, s.nonStriker] = [s.nonStriker, s.striker];
  s.quota[bowlerId]++; s.lastBowler = bowlerId; s.overIndex++;
  s.done = s.runs >= s.target || s.wickets >= 10 || s.overIndex >= TOTAL_OVERS;
  return { balls, runs, wickets: wk, after: s };
}
export { initialState };
