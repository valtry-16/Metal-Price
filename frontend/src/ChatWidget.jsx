import { useState, useRef, useEffect } from "react";

const SUGGESTIONS = [
  "What is the gold price today?",
  "Compare gold and silver",
  "Weekly gold trend",
  "Which metal is cheapest?",
  "What can you do?",
];

export default function ChatWidget({ apiBase }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm Auric AI. Ask me anything about metal prices." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: data.reply || "Sorry, no response received." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating toggle button with site logo */}
      <button
        className="chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Ask Auric AI"}
        title="Ask Auric AI"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <img
            src="/metal-price-icon.svg"
            alt="Auric AI"
            className="chat-fab-logo"
          />
        )}
      </button>

      {/* Label pill */}
      {!open && (
        <span className="chat-fab-label">Ask AI</span>
      )}

      {/* Chat panel */}
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Auric AI Chat">
          {/* Header */}
          <div className="chat-header">
            <img src="/metal-price-icon.svg" alt="" className="chat-header-logo" />
            <div className="chat-header-info">
              <span className="chat-header-title">Auric AI</span>
              <span className="chat-header-status">
                <span className="chat-header-dot" />
                Online
              </span>
            </div>
            <button className="chat-close-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                {m.role === "bot" && (
                  <img src="/metal-price-icon.svg" alt="" className="chat-avatar" />
                )}
                <div className="chat-bubble">{m.text}</div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg--bot">
                <img src="/metal-price-icon.svg" alt="" className="chat-avatar" />
                <div className="chat-bubble chat-bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions (only on welcome) */}
          {messages.length === 1 && !loading && (
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="chat-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-bar">
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder="Ask about metal prices..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              maxLength={500}
            />
            <button
              className="chat-send-btn"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
