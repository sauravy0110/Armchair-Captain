# Armchair Captain — "Aap hote toh?"

A simulated four-over T20 chase (fictional teams and players). You captain the bowling side: pick a bowler and a strategy, lock the call, see a rule-based benchmark captain's pick, watch a seeded ball-by-ball over, and get three separate scores plus a short AI tactical explanation.

## Run
```bash
npm install
cp .env.example .env.local   # optional: add OPENROUTER_API_KEY
npm run dev                  # http://localhost:3000
npm test && npm run typecheck && npm run lint && npm run build
npm run calibrate            # prints IQ distributions for 4 simulated personas
```
### AI setup (OpenRouter, optional)
1. Create an account at https://openrouter.ai and create a key under *Keys*.
2. Put it in `.env.local`: `OPENROUTER_API_KEY=...`. Optional: `OPENROUTER_MODEL` (default `nvidia/nemotron-3-ultra-550b-a55b`), `OPENROUTER_SITE_URL` (your site URL, sent as `HTTP-Referer`), `AI_RATE_LIMIT=12`, `AI_DAILY_CAP=500`, `AI_TIMEOUT_MS` (default 9000).
3. These are server-only variables; never use a `NEXT_PUBLIC_` prefix.

Without a key, or on any AI failure, a deterministic fallback explainer is used and the game stays fully playable. Availability, quotas and rate limits of the free model are controlled by OpenRouter and can change or be exhausted at any time; the app then silently uses the fallback (the UI labels which one answered). The model's output budget is capped at 350 tokens; if a reasoning-heavy model spends it before emitting JSON, the fallback answers.

## Deploy (Vercel)
Push to GitHub, import the repo in Vercel (Next.js is auto-detected), add `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`, `OPENROUTER_SITE_URL`, `AI_RATE_LIMIT`, `AI_DAILY_CAP`) under Environment Variables, deploy. The app is fully playable without the key.

## Architecture
- `lib/simulation/` pure, React-free engine: `model.ts` (expected runs / wicket probability, tunable `COEF`), `engine.ts` (seeded over simulation, legality rules), `captain-policy.ts`, `random.ts` (mulberry32).
- `lib/scoring/` scoring, branch resolution, replay, achievements, calibration personas.
- `lib/ai/` prompt, payload validation (zod), fallback explainer. `app/api/analyze-decision/route.ts` calls OpenRouter server-side only.
- `components/Game.tsx` UI state machine: decide → reveal → sim → analysis → final.
- Persistence: localStorage stores only `seed + decisions + step`; match state is rebuilt by deterministic replay. On load the whole structure is validated with zod (decisions, receipts, language, step, AI text) and test-replayed; anything malformed or illegal is discarded and the app starts fresh.

## Simulation assumptions (fictional, tunable, not validated cricket data)
`expectedRuns = clamp(base + batter aggression + handedness matchup + phase + strategy + pressure)`, weighting striker 60% / non-striker 40%. ATTACK adds wicket probability and variance; it costs runs when the chase is comfortable and saves them when the required rate is 8+. DEFEND is the reverse. Ball outcomes (0,1,2,3,4,6,W) come from a base distribution reshaped by the bowler's `variation` (more dots and boundaries, fewer 1s/2s) and then tilted so the mean equals the expected runs: variation widens spread without changing expected runs. Strike rotates on odd runs and at over end. Each bowler bowls max 2 overs, never consecutively; at least two legal bowlers always exist (tested).
Both branches (fan and benchmark) start from the same pre-over state and the same per-over seed. Only the fan branch carries forward.

## Scoring (100 per over)
- Tactical (50) = `50 × (1 − (fanE − bestE) / (worstE − bestE))`, clamped; 50 if all equal. Options are all legal bowler × strategy pairs. Pre-over info only.
- Execution (30) = `30 × clamp(0.65 + (E − runs)/14 + 0.09 × (min(wkts,3) − expectedWkts), 0, 1)`. Uses the simulated result.
- Captain comparison (20) = `20 × clamp(0.5 + (capU − fanU)/(2 × uRange), 0, 1)`; 10 if range is 0. Pre-over info only. `U = expectedRuns − wicketValue × 6 × wicketProb` (wicketValue 1 / 2.2 / 4 for required rate <6.5 / mid / >9). Tactical Judgement still uses expected runs alone; the comparison uses U so it rewards the same trade-off (economy vs breakthroughs) the benchmark is built around. The benchmark itself is a rule-based heuristic (death specialist late, spin vs aggressive right-hander, economical Dev otherwise; ATTACK at required rate 8+), not an optimiser, so a fan can beat it.
Captaincy IQ = mean of the over totals. Calibration (`npm run calibrate`, n=400, fixed seeds, same as `tests/calibration.test.ts`): random ≈ 49 (target 40–55), average ≈ 66 (55–75), strong ≈ 77 (75–90), greedy ≈ 80.2 (above 80, a very narrow margin). "Greedy" always takes the lowest immediate expected-runs option; it is a one-over optimiser, NOT a four-over optimal player (no look-ahead on bowler quotas). Execution-score constants were tuned so these ranges hold, so treat the targets as soft design goals.

## AI
The route validates a structured payload built from engine output and asks the model for four sections (your call, the trade-off, what happened, next over) in English, Hinglish or beginner English. The model never computes scores. On any error, timeout or missing key, a template fallback answers; the UI labels which one was used.

## Common random numbers
Every ball consumes exactly two draws (wicket roll, run roll) whether or not a wicket falls, so the fan and benchmark branches stay aligned ball-for-ball on the same seed.

## Public endpoint hardening
`/api/analyze-decision` uses a strict zod schema (unknown keys rejected, bounded numbers, names limited to the fictional roster, score strings pattern-checked), a 4 KB body cap, `max_tokens` 350 and validated model output. Rate limits (`AI_RATE_LIMIT` per client per 10 min, `AI_DAILY_CAP` global per 24 h) are only consumed when the OpenRouter key would be used; over the limit, or on any failure, the deterministic fallback answers. The limiter is in-memory and per server instance, so on serverless it is best-effort: use a shared store (Upstash/Vercel KV) or WAF rules for hard guarantees. Client IP comes from `x-forwarded-for`, which a client can spoof when not behind a trusted proxy.

## Limitations
Fictional model, not validated; the captain is a heuristic, not a real captain; receipts use client time and local storage and are not tamper-proof; the share action shares text only (no image export).
