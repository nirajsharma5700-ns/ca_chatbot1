import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import useChat from "./hooks/useChat";

function responseWithText(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as Response;
}

function stubReply(text: string) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseWithText(text));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("CA Assist primary chat flow", () => {
  it("submits a supported question with the Send button and displays the reply", async () => {
    stubReply("The applicable due date can depend on current CBDT rules.");
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "What is the ITR due date?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("The applicable due date can depend on current CBDT rules."),
    ).toBeInTheDocument();
  });

  it("submits a question when Enter is pressed", async () => {
    stubReply("A general accounting answer.");
    const user = userEvent.setup();
    render(<App />);
    const composer = screen.getByRole("textbox", {
      name: "Ask your CA question",
    });

    await user.type(composer, "How is TDS on rent calculated?");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("A general accounting answer.")).toBeInTheDocument();
  });

  it("shows the Thinking status while a response is pending", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "What is GST?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("status")).toHaveTextContent("Thinking...");

    await act(async () => {
      resolveResponse?.({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "GST answer." }] } }] }),
      } as Response);
    });
    expect(await screen.findByText("GST answer.")).toBeInTheDocument();
  });

  it("renders assistant Markdown and redirects an off-topic request", async () => {
    stubReply("**Section 80C**\n\n- PPF\n- ELSS");
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "What deductions are available?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    const emphasizedHeading = await screen.findByText("Section 80C");
    expect(emphasizedHeading.tagName).toBe("STRONG");
    expect(screen.getByText("PPF")).toBeInTheDocument();

    stubReply("I can help with Indian tax, GST, TDS, ITR filing, or accounting instead.");
    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "Give me a pasta recipe.",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText(
        "I can help with Indian tax, GST, TDS, ITR filing, or accounting instead.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the exact general-information disclaimer visible", () => {
    render(<App />);

    expect(
      screen.getByText("For general information only. Consult a qualified CA for advice."),
    ).toBeInTheDocument();
  });

  it("includes earlier turns in the request for a follow-up", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(responseWithText("First answer."))
      .mockResolvedValueOnce(responseWithText("Follow-up answer."));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "What is GST registration?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("First answer.")).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "Does that apply to services?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Follow-up answer.")).toBeInTheDocument();

    const secondCall = fetchMock.mock.calls[1];
    if (secondCall === undefined) {
      throw new Error("Expected a second Gemini request for the follow-up.");
    }
    const secondBody: unknown = JSON.parse(String(secondCall[1]?.body));
    expect(secondBody).toEqual(
      expect.objectContaining({
        contents: [
          { role: "user", parts: [{ text: "What is GST registration?" }] },
          { role: "model", parts: [{ text: "First answer." }] },
          { role: "user", parts: [{ text: "Does that apply to services?" }] },
        ],
      }),
    );
  });

  it("clears messages when New chat is selected", async () => {
    stubReply("This belongs to the previous chat.");
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "A question for the old chat",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("This belongs to the previous chat."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(
      screen.queryByText("A question for the old chat"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("This belongs to the previous chat."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
    ).toHaveValue("");
  });

  it("clears a failed request state when New chat is selected", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("private network detail"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChat());

    act(() => result.current.sendMessage("Question that will fail"));
    await waitFor(() => expect(result.current.state.request.status).toBe("error"));

    act(() => result.current.startNewChat());

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.request).toEqual({ status: "idle" });
  });

  it("starts empty after the app is remounted", async () => {
    stubReply("A message from before reload.");
    const user = userEvent.setup();
    const app = render(<App />);
    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "Temporary question",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("A message from before reload.")).toBeInTheDocument();

    app.unmount();
    render(<App />);

    expect(screen.queryByText("Temporary question")).not.toBeInTheDocument();
    expect(screen.queryByText("A message from before reload.")).not.toBeInTheDocument();
  });

  it("does not display a late response after New chat", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValueOnce(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "Question from the previous chat",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("status")).toHaveTextContent("Thinking...");
    await user.click(screen.getByRole("button", { name: "New chat" }));

    await act(async () => {
      resolveResponse?.(responseWithText("Late answer from the previous chat."));
    });

    expect(
      screen.queryByText("Late answer from the previous chat."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Question from the previous chat"),
    ).not.toBeInTheDocument();
  });

  it("shows a safe error and retries the original question without duplication", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("private network detail"))
      .mockResolvedValueOnce(responseWithText("Retry succeeded."));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    const question = "How is TDS on rent calculated?";

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      question,
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect. Check your connection and try again.",
    );
    expect(screen.getByText(question)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Retry succeeded.")).toBeInTheDocument();
    expect(screen.getAllByText(question)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1];
    if (secondCall === undefined) {
      throw new Error("Expected the retry request.");
    }
    const retryBody: unknown = JSON.parse(String(secondCall[1]?.body));
    expect(retryBody).toEqual(
      expect.objectContaining({
        contents: [{ role: "user", parts: [{ text: question }] }],
      }),
    );
  });

  it("shows a distinct rate-limit message with Retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        status: 429,
      } as Response),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "When is my filing due?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CA Assist is temporarily busy. Please wait a moment and retry.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("announces pending work and newly-added replies through accessible regions", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockReturnValueOnce(pendingResponse),
    );
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument();
    expect(
      screen.getByRole("log", { name: "Conversation messages" }),
    ).toHaveAttribute("aria-live", "polite");

    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "What is ITR filing?",
    );
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Thinking...");

    await act(async () => {
      resolveResponse?.(responseWithText("ITR is an income tax return."));
    });
    expect(
      await screen.findByRole("log", { name: "Conversation messages" }),
    ).toHaveTextContent("ITR is an income tax return.");
    expect(screen.getByRole("textbox", { name: "Ask your CA question" })).toHaveFocus();
  });

  it("allows keyboard-only navigation to Retry and New chat", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("private network detail"))
      .mockResolvedValueOnce(responseWithText("Retry via keyboard worked."));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to your question" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "New chat" })).toHaveFocus();
    await user.tab();
    const composer = screen.getByRole("textbox", {
      name: "Ask your CA question",
    });
    expect(composer).toHaveFocus();

    await user.type(composer, "Keyboard recovery check");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText("Retry via keyboard worked."),
    ).toBeInTheDocument();
  });

  it("does not submit Enter while an input method is composing text", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const composer = screen.getByRole("textbox", {
      name: "Ask your CA question",
    });

    fireEvent.change(composer, { target: { value: "A composed question" } });
    fireEvent.keyDown(composer, {
      key: "Enter",
      code: "Enter",
      isComposing: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("A composed question")).not.toBeInTheDocument();
  });

  it("renders a Markdown table inside its own scrollable region", async () => {
    stubReply("| Form | Purpose |\n| --- | --- |\n| ITR-1 | Salary income |\n");
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByRole("textbox", { name: "Ask your CA question" }),
      "Show an example table",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    const tableRegion = await screen.findByRole("region", {
      name: "Scrollable table",
    });
    expect(tableRegion.querySelector("table")).toBeInTheDocument();
    expect(tableRegion).toHaveTextContent("ITR-1");
  });
});
