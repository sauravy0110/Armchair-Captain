export type Hand = "R" | "L";
export type Strategy = "ATTACK" | "DEFEND";
export const STRATEGIES: Strategy[] = ["ATTACK", "DEFEND"];
export interface Batter { id: string; name: string; hand: Hand; aggression: number; style: string }
export interface Bowler {
  id: string; name: string; type: string; kind: "pace" | "spin";
  base: number; death: number; vsAggro: number; vsLeft: number; wicket: number; variation: number;
  strength: string; weakness: string;
}
export interface MatchState {
  runs: number; wickets: number; balls: number; target: number; totalBalls: number;
  striker: Batter; nonStriker: Batter; queue: Batter[];
  quota: Record<string, number>; lastBowler: string | null; overIndex: number; done: boolean;
}
export interface BallEvent { ball: number; runs: number; wicket: boolean; batter: string; score: string }
export interface OverResult { balls: BallEvent[]; runs: number; wickets: number; after: MatchState }
