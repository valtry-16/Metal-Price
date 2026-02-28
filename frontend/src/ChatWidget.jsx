import { useState, useRef, useEffect, useCallback } from "react";

const SUGGESTIONS = [
  "What is the gold price today?",
  "Compare gold and silver",
  "Gold price on 22 February",
  "Which metal is cheapest?",
  "Gold trend last 7 days",
];

/** Detect mobile (<= 480px) */
const isMobile = () => window.innerWidth <= 480;

export default function ChatWidget({ apiBase }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm Auric AI. Ask me anything about metal prices - today, any date, trends, comparisons, and more!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Lock body scroll when chat is open on mobile
  useEffect(() => {
    if (!isMobile()) return;
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [open]);

  // Handle mobile keyboard: resize chat panel to visual viewport
  useEffect(() => {
    if (!open || !isMobile() || !window.visualViewport) return;

    const vv = window.visualViewport;

    const onResize = () => {
      const vh = vv.height;
      const isKb = vh < window.innerHeight * 0.75;
      setKeyboardOpen(isKb);

      if (panelRef.current) {
        panelRef.current.style.setProperty("--chat-vh", `${vh}px`);
      }

      // Keep input visible by scrolling messages
      if (isKb) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [open]);

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);

    // Add a placeholder bot message that we'll stream into
    const botIdx = messages.length + 1; // index after adding user msg
    setMessages((prev) => [...prev, { role: "bot", text: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              fullText += parsed.token;
              const captured = fullText;
              setMessages((prev) => {
                const updated = [...prev];
                const lastBot = updated.length - 1;
                if (updated[lastBot]?.role === "bot") {
                  updated[lastBot] = { ...updated[lastBot], text: captured };
                }
                return updated;
              });
            }
            if (parsed.error) {
              fullText += parsed.error;
            }
          } catch {
            // skip malformed
          }
        }
      }

      // If nothing was streamed, show fallback
      if (!fullText.trim()) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastBot = updated.length - 1;
          if (updated[lastBot]?.role === "bot") {
            updated[lastBot] = { ...updated[lastBot], text: "Sorry, I couldn't generate a response. Please try again." };
          }
          return updated;
        });
      }

    } catch (err) {
      if (err.name === "AbortError") return;
      setMessages((prev) => {
        const updated = [...prev];
        const lastBot = updated.length - 1;
        if (updated[lastBot]?.role === "bot" && !updated[lastBot].text) {
          updated[lastBot] = { ...updated[lastBot], text: "Connection error. Please try again." };
        }
        return updated;
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, apiBase, messages.length]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    setOpen(false);
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
        <div
          ref={panelRef}
          className={`chat-panel${keyboardOpen ? " keyboard-open" : ""}`}
          role="dialog"
          aria-label="Auric AI Chat"
        >
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
            <button className="chat-close-btn" onClick={handleClose} aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((m, i) => {
              const isStreamingMsg = loading && i === messages.length - 1 && m.role === "bot";
              const isEmpty = !m.text;

              // Hide empty bot placeholder (typing dots show instead)
              if (isStreamingMsg && isEmpty) return null;

              return (
                <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                  {m.role === "bot" && (
                    <img src="/metal-price-icon.svg" alt="" className="chat-avatar" />
                  )}
                  <div className={`chat-bubble${isStreamingMsg ? " chat-bubble--streaming" : ""}`}>
                    {m.text}
                    {isStreamingMsg && <span className="chat-cursor" />}
                  </div>
                </div>
              );
            })}
            {loading && messages[messages.length - 1]?.role === "bot" && !messages[messages.length - 1]?.text && (
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
