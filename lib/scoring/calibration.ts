import { mulberry32 } from "../simulation/random";
import { initialState } from "../simulation/players";
import { overSeed } from "../simulation/random";
import { optionsFor, resolveOver, sessionSummary, avg, type Resolution } from "./index";

/** random: uniform legal choice. average: best-E 55% else random. strong: best-E 85% else 2nd best.
 *  greedy: ALWAYS the lowest immediate expected-runs option (one-over greedy; NOT a full four-over optimiser). */
export type Persona = "random" | "average" | "strong" | "greedy";
export function playSession(seed: number, persona: Persona): Resolution[] {
  const rng = mulberry32(seed ^ 0xabcdef);
  let s = initialState(); const rs: Resolution[] = [];
  while (!s.done) {
    const opts = optionsFor(s).sort((a, b) => a.e - b.e);
    let pick = opts[0];
    if (persona === "random") pick = opts[Math.floor(rng() * opts.length)];
    else if (persona === "average") pick = rng() < 0.55 ? opts[0] : opts[Math.floor(rng() * opts.length)];
    else if (persona === "strong") pick = rng() < 0.85 ? opts[0] : opts[1];
    const r = resolveOver(s, pick.bowlerId, pick.strategy, overSeed(seed, s.overIndex));
    rs.push(r); s = r.fan.result.after;
  }
  return rs;
}
export function distribution(persona: Persona, n = 400) {
  const iqs: number[] = [];
  for (let i = 1; i <= n; i++) iqs.push(sessionSummary(playSession(i * 7919, persona)).iq);
  iqs.sort((a, b) => a - b);
  return { persona, n, mean: avg(iqs), p10: iqs[Math.floor(n * 0.1)], p90: iqs[Math.floor(n * 0.9)], min: iqs[0], max: iqs[n - 1] };
}
