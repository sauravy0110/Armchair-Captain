import type { Batter, Bowler, MatchState } from "./types";
// FICTIONAL attributes for a prototype. Not real cricket statistics.
// XI: 4 wickets down => 2 at the crease + 5 waiting = 7 remaining batters.
export const BATTERS: Batter[] = [
  { id: "arjun", name: "Arjun Mehta", hand: "R", aggression: 0.8, style: "Right-handed aggressive batter" },
  { id: "rohan", name: "Rohan Iyer", hand: "L", aggression: 0.35, style: "Left-handed anchor" },
  { id: "vikram", name: "Vikram Shah", hand: "R", aggression: 0.95, style: "Right-handed power hitter" },
  { id: "neel", name: "Neel Kapoor", hand: "L", aggression: 0.7, style: "Left-handed finisher" },
  { id: "sameer", name: "Sameer Joshi", hand: "R", aggression: 0.5, style: "Right-handed tail-ender" },
  { id: "yash", name: "Yash Pillai", hand: "R", aggression: 0.45, style: "Right-handed tail-ender" },
  { id: "tanay", name: "Tanay Dube", hand: "L", aggression: 0.4, style: "Left-handed tail-ender" },
];
export const BOWLERS: Bowler[] = [
  { id: "aarav", name: "Aarav Malik", type: "Right-arm fast", kind: "pace", base: 7.6, death: -0.8, vsAggro: 0, vsLeft: 0, wicket: 0.065, variation: 0.5,
    strength: "Yorkers and death-over control", weakness: "Moderate variation, pricey early" },
  { id: "kabir", name: "Kabir Sen", type: "Leg spinner", kind: "spin", base: 7.9, death: 0, vsAggro: -1.0, vsLeft: 0.9, wicket: 0.075, variation: 0.9,
    strength: "Troubles aggressive right-handers", weakness: "Vulnerable to left-handers" },
  { id: "dev", name: "Dev Rao", type: "Medium-fast", kind: "pace", base: 7.1, death: 0.6, vsAggro: 0, vsLeft: 0, wicket: 0.045, variation: 0.2,
    strength: "Tight economy in middle overs", weakness: "Few breakthroughs, leaks at the death" },
];
export const TEAMS = { batting: "Mumbai Meteors", bowling: "Coastal Strikers" };
export function initialState(): MatchState {
  return { runs: 48, wickets: 4, balls: 0, target: 75, totalBalls: 24,
    striker: BATTERS[0], nonStriker: BATTERS[1], queue: BATTERS.slice(2),
    quota: { aarav: 0, kabir: 0, dev: 0 }, lastBowler: null, overIndex: 0, done: false };
}
export const bowlerById = (id: string) => BOWLERS.find((b) => b.id === id)!;
