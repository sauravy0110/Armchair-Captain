import type { Batter, Bowler, MatchState, Strategy } from "./types";
/** Tunable prototype coefficients (fictional; not statistically validated). */
export const COEF = {
  aggr: 2.4, striker: 0.6, pressureHigh: 0.3, pressureLow: -0.3, wicketsLost: -0.1,
  attackRuns: 0.4, attackRunsHighRRR: -0.3, defendRuns: -0.4, defendRunsHighRRR: 0.3, highRRR: 8,
  attackWk: 0.02, defendWk: -0.015, batterWk: 0.02, pressureWk: 0.015, minE: 4, maxE: 13,
};
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const requiredRate = (s: MatchState) => {
  const left = s.totalBalls - s.balls;
  return left > 0 ? ((s.target - s.runs) / left) * 6 : 99;
};
/** expectedRuns = base + batter aggression + handedness matchup + phase + strategy + pressure */
export function expectedRuns(b: Bowler, s: MatchState, strat: Strategy): number {
  const rr = requiredRate(s);
  const per = (bat: Batter) =>
    (bat.aggression - 0.5) * COEF.aggr + (bat.hand === "L" ? b.vsLeft : b.vsAggro * bat.aggression);
  const batterAdj = COEF.striker * per(s.striker) + (1 - COEF.striker) * per(s.nonStriker);
  const phase = s.overIndex >= 2 ? b.death : 0;
  const high = rr >= COEF.highRRR;
  const strategy = strat === "ATTACK" ? (high ? COEF.attackRunsHighRRR : COEF.attackRuns) : high ? COEF.defendRunsHighRRR : COEF.defendRuns;
  const pressure = (rr > 9 ? COEF.pressureHigh : rr < 6 ? COEF.pressureLow : 0) + COEF.wicketsLost * (s.wickets - 4);
  return clamp(b.base + batterAdj + phase + strategy + pressure, COEF.minE, COEF.maxE);
}
/** Per-ball wicket probability. */
export function wicketProb(b: Bowler, s: MatchState, strat: Strategy): number {
  const agg = COEF.striker * s.striker.aggression + (1 - COEF.striker) * s.nonStriker.aggression;
  return clamp(b.wicket + (strat === "ATTACK" ? COEF.attackWk : COEF.defendWk) + COEF.batterWk * agg + (requiredRate(s) > 9 ? COEF.pressureWk : 0), 0.02, 0.16);
}

/** Wicket value (runs-equivalent per wicket) for the fielding side; higher when the chase is steep. */
export const wicketValue = (s: MatchState) => { const rr = requiredRate(s); return rr > 9 ? 4 : rr < 6.5 ? 1 : 2.2; };
/** Tactical utility (lower is better for the bowling side): expected runs minus value of expected wickets.
 *  Used by BOTH the captain benchmark's yardstick and the Captain Comparison score, so they cannot disagree. */
export function tacticalUtility(b: Bowler, s: MatchState, strat: Strategy): number {
  return expectedRuns(b, s, strat) - wicketValue(s) * 6 * wicketProb(b, s, strat);
}
