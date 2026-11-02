
import { sectionsSchema, type Sections } from "./prompt";

/**
 * Safely extracts and validates the four explanation sections
 * from an OpenRouter chat completion.
 *
 * Returns null if the response is missing, malformed,
 * truncated, or does not satisfy the schema.
 */

type ModelMessage = {
  content?: unknown;
};

type ModelResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: ModelMessage;
  }>;
};

function extractText(content: unknown): string | null {
  if (typeof content === "string") {
    return content.trim() || null;
  }

  // Support providers returning content as text blocks.
  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text;
        }

        return "";
      })
      .filter(Boolean);

    return parts.length ? parts.join("\n").trim() : null;
  }

  return null;
}

function extractJSON(text: string): unknown | null {
  let cleaned = text.trim();

  // Remove Markdown JSON fences if present.
  const fence = cleaned.match(
    /```(?:json)?\s*([\s\S]*?)```/i
  );

  if (fence) {
    cleaned = fence[1].trim();
  }

  // Extract the JSON object.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseModelSections(
  data: unknown
): Sections | null {
  try {
    if (!data || typeof data !== "object") {
      return null;
    }

    const response = data as ModelResponse;
    const choice = response.choices?.[0];

    if (!choice?.message) {
      return null;
    }

    // A length finish reason may indicate truncated output.
    if (choice.finish_reason === "length") {
      console.warn("[AI Parser] Response was truncated");
      return null;
    }

    const content = extractText(choice.message.content);

    if (!content) {
      console.warn("[AI Parser] Response content is empty");
      return null;
    }

    const parsedJSON = extractJSON(content);

    if (!parsedJSON) {
      console.warn("[AI Parser] Could not extract valid JSON");
      return null;
    }

    const validated = sectionsSchema.safeParse(parsedJSON);

    if (!validated.success) {
      console.warn("[AI Parser] Invalid explanation sections:", {
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });

      return null;
    }

    // Return only the four validated fields.
    return {
      call: validated.data.call.trim(),
      tradeoff: validated.data.tradeoff.trim(),
      happened: validated.data.happened.trim(),
      next: validated.data.next.trim(),
    };
  } catch (error) {
    console.error(
      "[AI Parser] Unexpected parsing error:",
      error instanceof Error ? error.message : String(error)
    );

    return null;
  }
}
