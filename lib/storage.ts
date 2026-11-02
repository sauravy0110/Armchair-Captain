import { z } from "zod";
import { replay } from "./scoring";
import { BOWLERS } from "./simulation/players";
import { LANGS, sectionsSchema, type Lang, type Sections } from "./ai/prompt";
import type { Strategy } from "./simulation/types";
export const KEY = "armchair-captain:v1";
export type Step = "decide" | "reveal" | "sim" | "analysis" | "final";
export interface Receipt { id: string; over: number; bowler: string; strategy: string; score: string; seed: number; at: string }
export interface Session {
  v: 1; seed: number; lang: Lang; step: Step;
  decisions: { bowlerId: string; strategy: Strategy; receipt: Receipt }[];
  ai: Record<number, { sections: Sections; source: "ai" | "fallback" }>;
}
const receiptSchema = z.object({ id: z.string().max(40), over: z.number().int().min(1).max(4), bowler: z.string().max(60), strategy: z.enum(["ATTACK", "DEFEND"]),
  score: z.string().max(20), seed: z.number().int(), at: z.string().max(40) });
const sessionSchema = z.object({
  v: z.literal(1), seed: z.number().int().min(0).max(2 ** 32), lang: z.enum(LANGS),
  step: z.enum(["decide", "reveal", "sim", "analysis", "final"]),
  decisions: z.array(z.object({ bowlerId: z.enum(BOWLERS.map((b) => b.id) as [string, ...string[]]), strategy: z.enum(["ATTACK", "DEFEND"]), receipt: receiptSchema })).max(4),
  ai: z.record(z.string().regex(/^[1-4]$/), z.object({ sections: sectionsSchema, source: z.enum(["ai", "fallback"]) })),
});
export const newSession = (lang: Lang = "english"): Session => ({ v: 1, seed: Math.floor(Math.random() * 2 ** 31), lang, step: "decide", decisions: [], ai: {} });
/** Returns a session only if it is structurally valid AND replays legally; otherwise null. */
export function parseSession(raw: string | null): Session | null {
  try {
    if (!raw) return null;
    const r = sessionSchema.safeParse(JSON.parse(raw));
    if (!r.success) return null;
    const s = r.data as Session;
    if (s.step !== "decide" && s.decisions.length === 0) return null;
    const { state, resolutions } = replay(s.seed, s.decisions); // throws on illegal sequences
    if (resolutions.length !== s.decisions.length) return null;
    if (s.step === "final" && !state.done) return null;
    if (s.step === "decide" && state.done) return null;
    return s;
  } catch { return null; }
}
export const loadSession = () => (typeof window === "undefined" ? null : parseSession(window.localStorage.getItem(KEY)));
export const saveSession = (s: Session | null) => { try { s ? window.localStorage.setItem(KEY, JSON.stringify(s)) : window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
