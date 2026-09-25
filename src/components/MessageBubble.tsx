import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../types/chat";

const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="markdown-table-wrap" role="region" aria-label="Scrollable table">
      <table>{children}</table>
    </div>
  ),
};

interface MessageBubbleProps {
  readonly message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const label = message.role === "user" ? "You" : "CA Assist";

  return (
    <article className={`message message--${message.role}`}>
      <p className="message__speaker">{label}</p>
      <div className="message__body">
        {message.role === "assistant" ? (
          <div className="markdown-content">
            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
              {message.text}
            </ReactMarkdown>
          </div>
        ) : (
          <p>{message.text}</p>
        )}
      </div>
    </article>
  );
}
