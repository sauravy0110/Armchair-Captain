import type { MatchState, Strategy } from "./types";
import { legalBowlers } from "./engine";
import { expectedRuns, requiredRate } from "./model";

export interface CaptainPick { bowlerId: string; strategy: Strategy; reason: string }
/**
 * Deterministic RULE-BASED benchmark (a heuristic, not an optimiser, so a fan can genuinely out-think it):
 * 1. Final two overs: the death specialist (Aarav) if legal.
 * 2. Otherwise spin against an aggressive right-hander (Kabir) if legal.
 * 3. Otherwise the economical middle-overs option (Dev) if legal.
 * 4. Otherwise the legal bowler with the lowest expected runs.
 * Strategy: ATTACK when the required rate is 8+, else DEFEND.
 */
export function captainPick(s: MatchState): CaptainPick {
  const legal = legalBowlers(s), has = (id: string) => legal.some((b) => b.id === id);
  const rr = requiredRate(s);
  const strategy: Strategy = rr >= 8 ? "ATTACK" : "DEFEND";
  let id: string, why: string;
  if (s.overIndex >= 2 && has("aarav")) { id = "aarav"; why = "death-over specialist for the final overs"; }
  else if (has("kabir") && s.striker.hand === "R" && s.striker.aggression > 0.7) { id = "kabir"; why = `spin suits aggressive right-hander ${s.striker.name}`; }
  else if (has("dev")) { id = "dev"; why = "economical option in the middle overs"; }
  else { id = [...legal].sort((a, b) => expectedRuns(a, s, strategy) - expectedRuns(b, s, strategy))[0].id; why = "lowest expected runs among legal bowlers"; }
  const name = legal.find((b) => b.id === id)!.name;
  return { bowlerId: id, strategy, reason: `${name} (${strategy}): ${why}; ${strategy === "ATTACK" ? "required rate is high, so hunt wickets" : "required rate is manageable, so squeeze runs"}.` };
}
