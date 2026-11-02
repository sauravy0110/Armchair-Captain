import { createLimiter } from "./rate-limit";
export const MAX_BODY_BYTES = 4096;
export const MAX_OUTPUT_TOKENS = 350;
export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Per client: 12 AI explanations / 10 min (a full game uses 4). Global: daily budget guard for the API key.
export const perClient = createLimiter({ limit: Number(process.env.AI_RATE_LIMIT) || 12, windowMs: 10 * 60_000 });
export const globalCap = createLimiter({ limit: Number(process.env.AI_DAILY_CAP) || 500, windowMs: 24 * 3_600_000, maxKeys: 1 });
