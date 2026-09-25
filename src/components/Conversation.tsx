import type { ChatMessage } from "../types/chat";
import MessageBubble from "./MessageBubble";

interface ConversationProps {
  readonly isThinking: boolean;
  readonly messages: readonly ChatMessage[];
}

export default function Conversation({
  isThinking,
  messages,
}: ConversationProps) {
  return (
    <section aria-label="Conversation" className="conversation">
      {messages.length === 0 ? (
        <p className="conversation__empty">
          Ask a general question about Indian tax or accounting to get started.
        </p>
      ) : (
        null
      )}
      <div
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions text"
        className="conversation__messages"
        role="log"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      {isThinking ? (
        <p aria-live="polite" className="request-status" role="status">
          Thinking...
        </p>
      ) : null}
    </section>
  );
}
