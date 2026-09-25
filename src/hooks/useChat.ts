import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  INITIAL_CONVERSATION,
  toNonEmptyText,
  type ChatError,
  type ChatMessage,
  type Conversation,
} from "../types/chat";
import {
  GeminiClientError,
  sendGeminiMessage,
} from "../services/geminiClient";

let messageSequence = 0;

function createMessageId(): string {
  messageSequence += 1;
  return `${Date.now().toString(36)}-${messageSequence.toString(36)}`;
}

export type ChatAction =
  | { readonly type: "submit"; readonly message: ChatMessage }
  | {
      readonly type: "success";
      readonly userMessageId: string;
      readonly message: ChatMessage;
    }
  | {
      readonly type: "failure";
      readonly userMessageId: string;
      readonly error: ChatError;
    }
  | { readonly type: "retry"; readonly userMessageId: string }
  | { readonly type: "new-chat" };

export function chatReducer(
  state: Conversation,
  action: ChatAction,
): Conversation {
  switch (action.type) {
    case "submit":
      if (state.request.status === "loading") {
        return state;
      }
      return {
        ...state,
        messages: [...state.messages, action.message],
        request: {
          status: "loading",
          userMessageId: action.message.id,
        },
      };
    case "success":
      if (
        state.request.status !== "loading" ||
        state.request.userMessageId !== action.userMessageId
      ) {
        return state;
      }
      return {
        ...state,
        messages: [...state.messages, action.message],
        request: { status: "idle" },
      };
    case "new-chat":
      return {
        generation: state.generation + 1,
        messages: [],
        request: { status: "idle" },
      };
    case "retry":
      if (
        state.request.status !== "error" ||
        state.request.userMessageId !== action.userMessageId
      ) {
        return state;
      }
      return {
        ...state,
        request: {
          status: "loading",
          userMessageId: action.userMessageId,
        },
      };
    case "failure":
      if (
        state.request.status !== "loading" ||
        state.request.userMessageId !== action.userMessageId
      ) {
        return state;
      }
      return {
        ...state,
        request: {
          status: "error",
          userMessageId: action.userMessageId,
          error: action.error,
        },
      };
  }
  return state;
}

export default function useChat() {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CONVERSATION);
  const stateRef = useRef(state);
  const generationRef = useRef(state.generation);
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
    generationRef.current = state.generation;
  }, [state]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    },
    [],
  );

  const performRequest = useCallback(
    async (
      messages: readonly ChatMessage[],
      userMessageId: string,
      generation: number,
    ) => {
      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;

      try {
        const replyText = await sendGeminiMessage(messages, controller.signal);
        if (generationRef.current !== generation) {
          return;
        }

        const text = toNonEmptyText(replyText);
        if (text === null) {
          dispatch({ type: "failure", userMessageId, error: "service" });
          return;
        }

        dispatch({
          type: "success",
          userMessageId,
          message: { id: createMessageId(), role: "assistant", text },
        });
      } catch (error: unknown) {
        if (generationRef.current !== generation) {
          return;
        }

        dispatch({
          type: "failure",
          userMessageId,
          error: error instanceof GeminiClientError ? error.kind : "service",
        });
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
      }
    },
    [],
  );

  const sendMessage = useCallback(
    (rawQuestion: string) => {
      const current = stateRef.current;
      if (current.request.status === "loading") {
        return;
      }

      const text = toNonEmptyText(rawQuestion);
      if (text === null) {
        return;
      }

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        text,
      };
      const pendingMessages = [...current.messages, userMessage];
      const generation = generationRef.current;
      stateRef.current = {
        ...current,
        messages: pendingMessages,
        request: { status: "loading", userMessageId: userMessage.id },
      };
      dispatch({ type: "submit", message: userMessage });
      void performRequest(pendingMessages, userMessage.id, generation);
    },
    [performRequest],
  );

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (current.request.status !== "error") {
      return;
    }

    const { userMessageId } = current.request;
    const generation = generationRef.current;
    stateRef.current = {
      ...current,
      request: { status: "loading", userMessageId },
    };
    dispatch({ type: "retry", userMessageId });
    void performRequest(current.messages, userMessageId, generation);
  }, [performRequest]);

  const startNewChat = useCallback(() => {
    generationRef.current += 1;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    stateRef.current = {
      generation: generationRef.current,
      messages: [],
      request: { status: "idle" },
    };
    dispatch({ type: "new-chat" });
  }, []);

  return { state, sendMessage, retry, startNewChat };
}
