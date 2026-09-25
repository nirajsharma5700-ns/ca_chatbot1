import { useState, type FormEvent } from "react";
import type { KeyboardEvent } from "react";

interface ChatComposerProps {
  readonly disabled: boolean;
  readonly onSend: (question: string) => void;
}

export default function ChatComposer({
  disabled,
  onSend,
}: ChatComposerProps) {
  const [question, setQuestion] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (disabled || trimmedQuestion.length === 0) {
      return;
    }

    onSend(trimmedQuestion);
    setQuestion("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && event.nativeEvent.isComposing) {
      event.preventDefault();
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="composer__label" htmlFor="chat-question">
        Ask your CA question
      </label>
      <div className="composer__controls">
        <input
          autoComplete="off"
          className="composer__input"
          disabled={disabled}
          id="chat-question"
          onKeyDown={handleKeyDown}
          onChange={(event) => setQuestion(event.currentTarget.value)}
          placeholder="Ask about Indian tax, GST, TDS, ITR, or accounting..."
          type="text"
          value={question}
        />
        <button
          className="button button--primary"
          disabled={disabled || question.trim().length === 0}
          type="submit"
        >
          Send
        </button>
      </div>
    </form>
  );
}
