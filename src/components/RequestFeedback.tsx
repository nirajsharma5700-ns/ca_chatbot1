import type { ChatError, RequestState } from "../types/chat";

interface RequestFeedbackProps {
  readonly request: RequestState;
  readonly onRetry: () => void;
}

const ERROR_MESSAGES: Record<ChatError, string> = {
  "rate-limit": "CA Assist is temporarily busy. Please wait a moment and retry.",
  timeout: "The response took too long. Please try again.",
  network: "Unable to connect. Check your connection and try again.",
  service: "Unable to get a response. Please try again.",
  configuration: "CA Assist is not configured yet. Please try again later.",
};

export default function RequestFeedback({
  request,
  onRetry,
}: RequestFeedbackProps) {
  if (request.status !== "error") {
    return null;
  }

  return (
    <div className="request-feedback" role="alert">
      <p className="request-feedback__message">{ERROR_MESSAGES[request.error]}</p>
      <button
        className="button button--secondary request-feedback__retry"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}
