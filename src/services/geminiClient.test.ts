import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CA_SYSTEM_INSTRUCTION,
  GEMINI_ENDPOINT,
  MODEL_ID,
} from "../config/gemini";
import { toNonEmptyText, type ChatMessage } from "../types/chat";
import { sendGeminiMessage } from "./geminiClient";

function message(id: string, role: ChatMessage["role"], value: string): ChatMessage {
  const text = toNonEmptyText(value);
  if (text === null) {
    throw new Error("Test messages must contain non-empty text.");
  }
  return { id, role, text };
}

function stubSuccessfulResponse(parts: readonly { readonly text: string }[]) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts } }] }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendGeminiMessage", () => {
  it("sends the fixed model request with system instruction and complete ordered history", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchMock = stubSuccessfulResponse([{ text: "General guidance." }]);
    const history = [
      message("user-1", "user", "What is GST registration?"),
      message("assistant-1", "assistant", "It depends on turnover and activity."),
      message("user-2", "user", "Does that change for services?"),
    ];

    await sendGeminiMessage(history);

    expect(GEMINI_ENDPOINT).toContain(MODEL_ID);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    if (call === undefined) {
      throw new Error("Expected the Gemini request to be sent.");
    }
    const [url, init] = call;
    expect(url).toBe(GEMINI_ENDPOINT);
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("test-key");
    const body: unknown = JSON.parse(String(init?.body));
    expect(body).toEqual({
      systemInstruction: { parts: [{ text: CA_SYSTEM_INSTRUCTION }] },
      contents: [
        { role: "user", parts: [{ text: "What is GST registration?" }] },
        {
          role: "model",
          parts: [{ text: "It depends on turnover and activity." }],
        },
        { role: "user", parts: [{ text: "Does that change for services?" }] },
      ],
    });
  });

  it("concatenates text parts from the first candidate in order", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    stubSuccessfulResponse([{ text: "Tax rules " }, { text: "can change." }]);

    const reply = await sendGeminiMessage([
      message("user-1", "user", "What should I check?"),
    ]);

    expect(reply).toBe("Tax rules can change.");
  });
});

describe("sendGeminiMessage error handling", () => {
  it("classifies HTTP 429 as a rate limit", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 429 } as Response),
    );

    await expect(
      sendGeminiMessage([message("user-1", "user", "Question?")]),
    ).rejects.toMatchObject({ kind: "rate-limit" });
  });

  it("classifies other HTTP errors as service failures", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 503 } as Response),
    );

    await expect(
      sendGeminiMessage([message("user-1", "user", "Question?")]),
    ).rejects.toMatchObject({ kind: "service" });
  });

  it("classifies a missing key as configuration failure before fetching", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendGeminiMessage([message("user-1", "user", "Question?")]),
    ).rejects.toMatchObject({ kind: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies malformed successful responses as service failures", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] }),
      } as Response),
    );

    await expect(
      sendGeminiMessage([message("user-1", "user", "Question?")]),
    ).rejects.toMatchObject({ kind: "service" });
  });

  it("classifies network failures without exposing the raw error", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("private network detail")),
    );

    await expect(
      sendGeminiMessage([message("user-1", "user", "Question?")]),
    ).rejects.toMatchObject({ kind: "network", message: "Request failed safely." });
  });

  it("aborts and classifies a request after 30 seconds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = sendGeminiMessage([
      message("user-1", "user", "Question?"),
    ]);
    const expectation = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(30_000);
    await expectation;

    const call = fetchMock.mock.calls[0];
    expect(call?.[1]?.signal?.aborted).toBe(true);
  });
});
