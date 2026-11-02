
import { NextResponse } from "next/server";
import { payloadSchema, SYSTEM_PROMPT } from "../../../lib/ai/prompt";
import { parseModelSections } from "../../../lib/ai/parse";
import { fallbackSections } from "../../../lib/ai/fallback";
import { clientKey } from "../../../lib/ai/rate-limit";
import {
  globalCap,
  MAX_BODY_BYTES,
  MAX_OUTPUT_TOKENS,
  OPENROUTER_URL,
  perClient,
} from "../../../lib/ai/limits";

const MODEL =
  process.env.OPENROUTER_MODEL ||
  "nvidia/nemotron-3-ultra-550b-a55b:free";

const MAX_ATTEMPTS = 2;
const DEFAULT_TIMEOUT_MS = 45000;
const RETRY_DELAY_MS = 1200;
const MAX_RETRY_AFTER_MS = 5000;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelay(retryAfter: string | null): number | null {
  if (!retryAfter) return RETRY_DELAY_MS;

  const seconds = Number(retryAfter);

  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(retryAfter) - Date.now();

  if (!Number.isFinite(delay) || delay < 0) {
    return RETRY_DELAY_MS;
  }

  // Avoid keeping the user's request waiting too long.
  if (delay > MAX_RETRY_AFTER_MS) {
    return null;
  }

  return delay;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.name === "TypeError"
  );
}

export async function POST(req: Request) {
  // 1. Validate request size.
  const declared = Number(req.headers.get("content-length") ?? 0);

  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Payload too large" },
      { status: 413 }
    );
  }

  const text = await req.text().catch(() => "");
  const actualBytes = new TextEncoder().encode(text).length;

  if (actualBytes > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Payload too large" },
      { status: 413 }
    );
  }

  // 2. Validate JSON.
  let body: unknown;

  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // 3. Validate payload schema.
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const fallback = (reason?: string) =>
    NextResponse.json({
      sections: fallbackSections(payload),
      source: "fallback",
      ...(reason ? { reason } : {}),
    });

  // 4. Check API key.
  const key = process.env.OPENROUTER_API_KEY?.trim();

  if (!key) {
    console.error("[AI] OPENROUTER_API_KEY is missing");
    return fallback("missing_api_key");
  }

  // 5. Apply rate limits once per incoming request.
  if (!perClient.check(clientKey(req))) {
    console.warn("[AI] Per-client rate limit reached");
    return fallback("rate_limited");
  }

  if (!globalCap.check("global")) {
    console.warn("[AI] Global daily API cap reached");
    return fallback("daily_cap");
  }

  // 6. Configure request.
  const timeoutMs = Math.max(
    1000,
    Number(process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  );

  const requestBody = JSON.stringify({
    model: MODEL,
    temperature: 0.6,
    max_tokens: Math.max(MAX_OUTPUT_TOKENS, 1600),
    reasoning: {
      effort: "none",
    },
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  let response: Response | null = null;
  let responseText = "";

  console.log("[AI] Calling OpenRouter", {
    model: MODEL,
    provider: "automatic",
    timeoutMs,
    maxAttempts: MAX_ATTEMPTS,
  });

  // 7. Try the provider, with one retry for temporary failures.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer":
            process.env.OPENROUTER_SITE_URL ||
            "http://localhost:3000",
          "X-Title": "Armchair Captain",
        },
        body: requestBody,
      });

      responseText = await response.text();

      if (response.ok) {
        break;
      }

      console.error("[AI] OpenRouter HTTP error:", {
        attempt,
        status: response.status,
        statusText: response.statusText,
        response: responseText.slice(0, 500),
      });

      const retryableStatus = [429, 502, 503, 504].includes(
        response.status
      );

      if (!retryableStatus || attempt === MAX_ATTEMPTS) {
        return fallback(`openrouter_http_${response.status}`);
      }

      const retryDelay = getRetryDelay(
        response.headers.get("retry-after")
      );

      if (retryDelay === null) {
        console.warn(
          "[AI] Retry-After exceeds allowed wait; using fallback"
        );
        return fallback(`openrouter_http_${response.status}`);
      }

      console.warn("[AI] Temporary provider error; retrying", {
        attempt,
        nextAttempt: attempt + 1,
        delayMs: retryDelay,
        status: response.status,
      });

      await sleep(retryDelay);

    } catch (error) {
      const retryable = isRetryableError(error);

      console.error("[AI] OpenRouter request failed:", {
        attempt,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      if (!retryable || attempt === MAX_ATTEMPTS) {
        return fallback(
          error instanceof Error &&
          (error.name === "AbortError" ||
            error.name === "TimeoutError")
            ? "request_timeout"
            : "request_failed"
        );
      }

      console.warn("[AI] Transient request failure; retrying", {
        attempt,
        nextAttempt: attempt + 1,
      });

      await sleep(RETRY_DELAY_MS);

    } finally {
      clearTimeout(timeout);
    }
  }

  // 8. Ensure a successful provider response exists.
  if (!response || !response.ok) {
    return fallback("provider_unavailable");
  }

  // 9. Parse provider JSON.
  let data: unknown;

  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("[AI] OpenRouter returned invalid JSON");
    return fallback("invalid_provider_json");
  }

  // 10. Inspect response metadata without logging reasoning.
  const result = data as {
    id?: string;
    model?: string;
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: unknown;
        reasoning?: unknown;
      };
    }>;
    usage?: {
      completion_tokens?: number;
      prompt_tokens?: number;
      completion_tokens_details?: {
        reasoning_tokens?: number;
      };
    };
  };

  const message = result.choices?.[0]?.message;
  const content = message?.content;

  console.log("[AI] Response metadata:", {
    responseId: result.id,
    returnedModel: result.model,
    hasChoices: Array.isArray(result.choices),
    contentType: typeof content,
    contentLength:
      typeof content === "string" ? content.length : 0,
    hasReasoning: Boolean(message?.reasoning),
    finishReason: result.choices?.[0]?.finish_reason,
    usage: result.usage,
  });

  // 11. Validate generated explanation sections.
  const sections = parseModelSections(data);

  if (sections) {
    console.log(
      "[AI] OpenRouter explanation generated successfully"
    );

    return NextResponse.json({
      sections,
      source: "ai",
    });
  }

  console.error(
    "[AI] Model response did not match expected sections"
  );

  return fallback("invalid_model_output");
}
