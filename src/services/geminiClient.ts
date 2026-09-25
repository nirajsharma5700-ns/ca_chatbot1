import {
  CA_SYSTEM_INSTRUCTION,
  GEMINI_ENDPOINT,
  REQUEST_TIMEOUT_MS,
} from "../config/gemini";
import type { ChatError, ChatMessage } from "../types/chat";
import type { GeminiGenerateContentRequest } from "../types/gemini";

export class GeminiClientError extends Error {
  readonly kind: ChatError;

  constructor(kind: ChatError) {
    super("Request failed safely.");
    this.name = "GeminiClientError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractReply(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new Error("Gemini returned no usable response.");
  }

  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new GeminiClientError("service");
  }

  const candidate: unknown = candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content)) {
    throw new GeminiClientError("service");
  }

  const parts: unknown = candidate.content.parts;
  if (!Array.isArray(parts)) {
    throw new GeminiClientError("service");
  }

  let reply = "";
  for (const part of parts) {
    if (isRecord(part) && typeof part.text === "string") {
      reply += part.text;
    }
  }

  if (reply.trim().length === 0) {
    throw new GeminiClientError("service");
  }

  return reply;
}

export async function sendGeminiMessage(
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new GeminiClientError("configuration");
  }

  const request: GeminiGenerateContentRequest = {
    systemInstruction: {
      parts: [{ text: CA_SYSTEM_INSTRUCTION }],
    },
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text }],
    })),
  };

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new GeminiClientError("rate-limit");
    }
    if (!response.ok) {
      throw new GeminiClientError("service");
    }

    const payload: unknown = await response.json();
    return extractReply(payload);
  } catch (error: unknown) {
    if (error instanceof GeminiClientError) {
      throw error;
    }
    if (timedOut || (error instanceof DOMException && error.name === "AbortError")) {
      throw new GeminiClientError("timeout");
    }
    if (error instanceof TypeError) {
      throw new GeminiClientError("network");
    }
    throw new GeminiClientError("service");
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
