import ChatComposer from "./components/ChatComposer";
import ChatHeader from "./components/ChatHeader";
import Conversation from "./components/Conversation";
import Disclaimer from "./components/Disclaimer";
import RequestFeedback from "./components/RequestFeedback";
import useChat from "./hooks/useChat";

export default function App() {
  const { state, sendMessage, retry, startNewChat } = useChat();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#chat-question">
        Skip to your question
      </a>
      <div className="app-frame">
        <ChatHeader onNewChat={startNewChat} />
        <main aria-label="CA Assist chat" className="chat-panel">
          <Conversation
            isThinking={state.request.status === "loading"}
            messages={state.messages}
          />
          <RequestFeedback onRetry={retry} request={state.request} />
          <ChatComposer
            disabled={state.request.status === "loading"}
            onSend={sendMessage}
          />
        </main>
        <Disclaimer />
      </div>
    </div>
  );
}
