import type { MatchState, OverResult, Strategy } from "../simulation/types";
import { STRATEGIES } from "../simulation/types";
import { BOWLERS, bowlerById, initialState } from "../simulation/players";
import { legalBowlers, simulateOver, TOTAL_OVERS, validateSelection } from "../simulation/engine";
import { captainPick } from "../simulation/captain-policy";
import { clamp, expectedRuns, requiredRate, tacticalUtility, wicketProb } from "../simulation/model";
import { overSeed } from "../simulation/random";

export const EXEC = { base: 0.65, scale: 14, wk: 0.09, wkCap: 3 };
export interface Option { bowlerId: string; strategy: Strategy; e: number; wp: number; u: number }
export const optionsFor = (s: MatchState): Option[] =>
  legalBowlers(s).flatMap((b) => STRATEGIES.map((st) => ({ bowlerId: b.id, strategy: st, e: expectedRuns(b, s, st), wp: wicketProb(b, s, st), u: tacticalUtility(b, s, st) })));

export function tacticalScore(fanE: number, best: number, worst: number) {
  if (worst - best < 1e-9) return 50;
  return clamp(50 * (1 - (fanE - best) / (worst - best)), 0, 50);
}
export function captainComparison(fanE: number, capE: number, range: number) {
  if (range < 1e-9) return 10;
  return 20 * clamp(0.5 + (capE - fanE) / (2 * range), 0, 1);
}
export function executionScore(expected: number, runs: number, wickets: number, expWk: number) {
  return 30 * clamp(EXEC.base + (expected - runs) / EXEC.scale + EXEC.wk * (Math.min(wickets, EXEC.wkCap) - expWk), 0, 1);
}
export interface Branch { bowlerId: string; strategy: Strategy; e: number; u: number; result: OverResult }
export interface Resolution {
  over: number; pre: MatchState; seed: number; options: Option[]; best: number; worst: number; uRange: number;
  fan: Branch; captain: Branch & { reason: string };
  tactical: number; outcome: number; comparison: number; total: number;
}
export function resolveOver(pre: MatchState, bowlerId: string, strat: Strategy, seed: number): Resolution {
  validateSelection(pre, bowlerId, strat);
  const options = optionsFor(pre);
  const es = options.map((o) => o.e), best = Math.min(...es), worst = Math.max(...es);
  const eOf = (id: string, st: Strategy) => expectedRuns(bowlerById(id), pre, st);
  const fanE = eOf(bowlerId, strat);
  const uOf = (id: string, st: Strategy) => tacticalUtility(bowlerById(id), pre, st);
  const us = options.map((o) => o.u), uRange = Math.max(...us) - Math.min(...us);
  const cap = captainPick(pre);
  const capE = eOf(cap.bowlerId, cap.strategy);
  const fanU = uOf(bowlerId, strat), capU = uOf(cap.bowlerId, cap.strategy);
  const fan = simulateOver(pre, bowlerId, strat, seed);
  const capRes = simulateOver(pre, cap.bowlerId, cap.strategy, seed); // same seed, benchmark only
  const tactical = tacticalScore(fanE, best, worst);
  // Expectations are pro-rated to the balls actually bowled (the over can end early on a chase win or all-out),
  // consistent with the constant per-ball probability model.
  const ballsBowled = fan.balls.length;
  const outcome = executionScore((fanE * ballsBowled) / 6, fan.runs, fan.wickets, wicketProb(bowlerById(bowlerId), pre, strat) * ballsBowled);
  const comparison = captainComparison(fanU, capU, uRange); // same utility the benchmark is judged on; pre-over info only
  return { over: pre.overIndex + 1, pre, seed, options, best, worst, uRange,
    fan: { bowlerId, strategy: strat, e: fanE, u: fanU, result: fan },
    captain: { bowlerId: cap.bowlerId, strategy: cap.strategy, e: capE, u: capU, result: capRes, reason: cap.reason },
    tactical, outcome, comparison, total: tactical + outcome + comparison };
}
export interface Decision { bowlerId: string; strategy: Strategy }
export function replay(seed: number, decisions: Decision[]) {
  let s = initialState(); const resolutions: Resolution[] = [];
  for (const d of decisions) { const r = resolveOver(s, d.bowlerId, d.strategy, overSeed(seed, s.overIndex)); resolutions.push(r); s = r.fan.result.after; }
  return { state: s, resolutions };
}
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function iqLabel(iq: number) {
  return iq >= 85 ? "Master Strategist" : iq >= 70 ? "Captain Material" : iq >= 55 ? "Tactical Thinker" : iq >= 40 ? "Armchair Observer" : "Needs Practice";
}
export interface Achievement { id: string; name: string; desc: string; earned: boolean }
export function sessionSummary(rs: Resolution[]) {
  const iq = avg(rs.map((r) => r.total));
  const idx = rs.map((r) => r.total);
  const chanakya = rs.some((_, i) => i >= 2 && rs.slice(i - 2, i + 1).every((r) => r.tactical >= 40));
  const late = rs.slice(2).map((r) => r.tactical), early = rs.slice(0, 2).map((r) => r.tactical);
  const death = late.length > 0 && Math.max(...late) >= 40 && Math.max(...late) >= Math.max(0, ...early);
  const twist = rs.some((r) => r.worst - r.best >= 0.6 && r.fan.e - r.best <= 0.1 && r.fan.u < r.captain.u - 1e-9);
  const risk = rs.some((r) => requiredRate(r.pre) >= 9 && r.fan.strategy === "ATTACK" && r.tactical >= 25);
  const achievements: Achievement[] = [
    { id: "chanakya", name: "Chanakya", desc: "Three straight strong tactical calls (40+/50)", earned: chanakya },
    { id: "death", name: "Death-over Specialist", desc: "Achieved your strongest tactical judgement in the final two overs (40+/50).", earned: death },
    { id: "twist", name: "Plot Twist", desc: "Took a near-best option in a high-impact over and beat the captain benchmark on tactical utility", earned: twist },
    { id: "legend", name: "Armchair Legend", desc: "Captaincy IQ above 80", earned: iq > 80 && rs.length === TOTAL_OVERS },
    { id: "risk", name: "Risk Taker", desc: "Attacked when the required rate hit 9+ and it was a sound call", earned: risk },
  ];
  const bestI = idx.indexOf(Math.max(...idx)), worstI = idx.indexOf(Math.min(...idx));
  return { iq, label: iqLabel(iq), tactical: avg(rs.map((r) => r.tactical)), outcome: avg(rs.map((r) => r.outcome)),
    comparison: avg(rs.map((r) => r.comparison)), best: rs[bestI], worst: rs[worstI],
    wickets: rs.reduce((a, r) => a + r.fan.result.wickets, 0), conceded: rs.reduce((a, r) => a + r.fan.result.runs, 0),
    beatCaptain: rs.filter((r) => r.fan.u < r.captain.u - 1e-9).length, achievements };
}
export { BOWLERS };
