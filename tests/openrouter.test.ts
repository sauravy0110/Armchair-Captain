import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initialState } from "../lib/simulation/players";
import { resolveOver, replay } from "../lib/scoring";
import { buildPayload } from "../lib/ai/prompt";
import { parseModelSections } from "../lib/ai/parse";
import { DEFAULT_MODEL, OPENROUTER_URL } from "../lib/ai/limits";
import { POST } from "../app/api/analyze-decision/route";

const sections = { call: "Sensible call.", tradeoff: "Less wicket threat.", happened: "7 runs, no wicket.", next: "Needs 20 off 18." };
const wrap = (content: unknown) => ({ choices: [{ message: { content } }] });
const payload = () => JSON.stringify(buildPayload(resolveOver(initialState(), "dev", "DEFEND", 3), "english"));
let n = 0; const ip = () => `10.0.0.${++n}`;
const post = (body = payload(), addr = ip()) => POST(new Request("http://x/api", { method: "POST", body, headers: { "x-forwarded-for": addr } }));
const ok = (data: unknown) => vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }));

describe("parseModelSections", () => {
  it("accepts valid JSON, fenced JSON and JSON with surrounding prose", () => {
    expect(parseModelSections(wrap(JSON.stringify(sections)))).toEqual(sections);
    expect(parseModelSections(wrap("```json\n" + JSON.stringify(sections) + "\n```"))).toEqual(sections);
    expect(parseModelSections(wrap("Here you go: " + JSON.stringify(sections) + " Hope that helps"))).toEqual(sections);
  });
  it("rejects malformed, empty, wrong-shaped and oversized output", () => {
    for (const bad of [wrap("not json"), wrap("{broken"), wrap(""), wrap("   "), wrap(null), wrap(undefined), wrap(["x"]), {}, null, "x", { choices: [] },
      wrap(JSON.stringify({ call: "only one" })), wrap(JSON.stringify({ ...sections, call: "x".repeat(600) })), wrap(JSON.stringify({ ...sections, next: 5 }))])
      expect(parseModelSections(bad)).toBeNull();
  });
});

describe("OpenRouter route", () => {
  const saved = { ...process.env };
  beforeEach(() => { delete process.env.OPENROUTER_API_KEY; delete process.env.OPENROUTER_MODEL; delete process.env.AI_TIMEOUT_MS; });
  afterEach(() => { vi.unstubAllGlobals(); process.env = { ...saved }; });

  it("calls OpenRouter with auth, attribution headers, default model, no response_format; returns AI sections", async () => {
    process.env.OPENROUTER_API_KEY = "or-test";
    const f = ok(wrap(JSON.stringify(sections))); vi.stubGlobal("fetch", f);
    const j = await (await post()).json();
    expect(j).toEqual({ sections, source: "ai" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const h = init.headers as Record<string, string>, body = JSON.parse(init.body as string);
    expect(url).toBe(OPENROUTER_URL); expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(h.Authorization).toBe("Bearer or-test"); expect(h["X-Title"]).toBe("Armchair Captain"); expect(h["HTTP-Referer"]).toBeTruthy();
    expect(body.model).toBe(DEFAULT_MODEL); expect(DEFAULT_MODEL).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    expect(body.response_format).toBeUndefined(); expect(body.max_tokens).toBe(350); expect(body.temperature).toBe(0.6);
    expect(body.messages[0].role).toBe("system"); expect(JSON.parse(body.messages[1].content).fanBowler).toBe("Dev Rao");
    expect(JSON.stringify(j)).not.toContain("or-test");
  });
  it("honours OPENROUTER_MODEL", async () => {
    process.env.OPENROUTER_API_KEY = "k"; process.env.OPENROUTER_MODEL = "some/other-model:free";
    const f = ok(wrap(JSON.stringify(sections))); vi.stubGlobal("fetch", f); await post();
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).model).toBe("some/other-model:free");
  });
  it.each([["malformed JSON", wrap("{nope")], ["empty content", wrap("")], ["null content", wrap(null)], ["wrong shape", wrap('{"call":"x"}')]])("falls back on %s", async (_n, data) => {
    process.env.OPENROUTER_API_KEY = "k"; vi.stubGlobal("fetch", ok(data));
    const j = await (await post()).json(); expect(j.source).toBe("fallback"); expect(j.sections.call.length).toBeGreaterThan(5);
  });
  it("falls back on API errors and network failures", async () => {
    process.env.OPENROUTER_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    expect((await (await post()).json()).source).toBe("fallback");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect((await (await post()).json()).source).toBe("fallback");
  });
  it("falls back on timeout", async () => {
    process.env.OPENROUTER_API_KEY = "k"; process.env.AI_TIMEOUT_MS = "40";
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => { init.signal?.addEventListener("abort", () => rej(new Error("aborted"))); })));
    const j = await (await post()).json(); expect(j.source).toBe("fallback");
  });
  it("works without any API key and does not call the network", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    for (const lang of ["english", "hinglish", "beginner"] as const) {
      const body = JSON.stringify(buildPayload(resolveOver(initialState(), "aarav", "ATTACK", 2), lang));
      const j = await (await post(body)).json(); expect(j.source).toBe("fallback"); expect(j.sections.next.length).toBeGreaterThan(5);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("AI never influences scores: engine results are identical regardless of AI output", async () => {
    const before = resolveOver(initialState(), "dev", "DEFEND", 3);
    process.env.OPENROUTER_API_KEY = "k"; vi.stubGlobal("fetch", ok(wrap(JSON.stringify({ ...sections, call: "Score was 100/100" }))));
    await post();
    const after = resolveOver(initialState(), "dev", "DEFEND", 3);
    expect([after.tactical, after.outcome, after.comparison, after.total]).toEqual([before.tactical, before.outcome, before.comparison, before.total]);
    expect(replay(5, []).state.runs).toBe(48);
  });
});
