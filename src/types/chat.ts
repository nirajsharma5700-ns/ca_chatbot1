declare const nonEmptyTextBrand: unique symbol;

export type NonEmptyText = string & {
  readonly [nonEmptyTextBrand]: true;
};

export function toNonEmptyText(value: string): NonEmptyText | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? (trimmed as NonEmptyText) : null;
}

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly text: NonEmptyText;
}

export type ChatError =
  | "rate-limit"
  | "timeout"
  | "network"
  | "service"
  | "configuration";

export type RequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly userMessageId: string }
  | {
      readonly status: "error";
      readonly userMessageId: string;
      readonly error: ChatError;
    };

export interface Conversation {
  readonly generation: number;
  readonly messages: readonly ChatMessage[];
  readonly request: RequestState;
}

export const INITIAL_CONVERSATION: Conversation = {
  generation: 0,
  messages: [],
  request: { status: "idle" },
};
