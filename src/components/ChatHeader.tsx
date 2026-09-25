interface ChatHeaderProps {
  readonly onNewChat: () => void;
}

export default function ChatHeader({ onNewChat }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="chat-header__topline">
        <div>
          <p className="chat-header__eyebrow">CA ASSIST</p>
          <h1>Tax &amp; accounting guidance, made clearer.</h1>
          <p className="chat-header__description">
            General information on Indian income tax, GST, TDS, ITR filing, and
            accounting.
          </p>
        </div>
        <button
          className="button button--secondary"
          onClick={onNewChat}
          type="button"
        >
          New chat
        </button>
      </div>
    </header>
  );
}
