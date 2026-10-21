import React, { useRef, useEffect, useState } from "react";
import { User, Sparkles, Copy, Check, Volume2, MessageSquareDashed } from "lucide-react";

export default function ChatFeed({ messages, status, onSelectPrompt }) {
  const scrollRef = useRef(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, status]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const samplePrompts = [
    {
      title: "Scientific Query",
      text: "How do neural networks transcribe human speech in real-time?",
    },
    {
      title: "Creative Story",
      text: "Describe a sunrise viewed from the ring system of Saturn.",
    },
    {
      title: "Productivity",
      text: "Give me 3 actionable tips for maintaining deep work focus.",
    },
    {
      title: "Philosophy",
      text: "Can a voice assistant ever truly understand human emotion?",
    },
  ];

  return (
    <div className="chat-feed-container" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="chat-empty-state">
          <div className="empty-sparkle-ring">
            <Sparkles size={28} className="empty-sparkle-icon" />
          </div>
          <h3 className="empty-title">Ready for Conversation</h3>
          <p className="empty-desc">
            Press and hold the voice orb or spacebar to speak naturally with Aura.
          </p>

          <div className="prompt-suggestions">
            <span className="prompt-header">Try asking about:</span>
            <div className="prompt-grid">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  className="prompt-chip"
                  onClick={() => onSelectPrompt && onSelectPrompt(p.text)}
                  title="Click to copy suggested question"
                >
                  <span className="prompt-chip-badge">{p.title}</span>
                  <span className="prompt-chip-text">"{p.text}"</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isLatestAssistant = !isUser && i === messages.length - 1;
            const isSpeakingNow = isLatestAssistant && status === "speaking";

            return (
              <div
                key={i}
                className={`message-row ${isUser ? "user-row" : "agent-row"}`}
              >
                <div className="message-avatar">
                  {isUser ? (
                    <div className="avatar-user">
                      <User size={15} />
                    </div>
                  ) : (
                    <div className={`avatar-agent ${isSpeakingNow ? "avatar-speaking" : ""}`}>
                      <Sparkles size={15} />
                    </div>
                  )}
                </div>

                <div className="message-bubble-wrapper">
                  <div className="message-header-meta">
                    <span className="message-sender-name">
                      {isUser ? "You" : "Aura Voice"}
                    </span>
                    {m.timestamp && (
                      <span className="message-timestamp">{m.timestamp}</span>
                    )}
                    {isSpeakingNow && (
                      <span className="speaking-tag">
                        <Volume2 size={12} className="pulse-fast" /> Speaking
                      </span>
                    )}
                  </div>

                  <div className={`message-bubble ${isUser ? "bubble-user" : "bubble-agent"}`}>
                    <p className="message-text">{m.text}</p>
                    
                    {!isUser && (
                      <div className="message-footer-actions">
                        <button
                          className="msg-action-btn"
                          onClick={() => handleCopy(m.text, i)}
                          title="Copy text"
                        >
                          {copiedIndex === i ? (
                            <>
                              <Check size={13} className="text-emerald" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking typing bubble */}
          {status === "thinking" && (
            <div className="message-row agent-row thinking-row">
              <div className="message-avatar">
                <div className="avatar-agent avatar-thinking">
                  <Sparkles size={15} className="spin-slow" />
                </div>
              </div>
              <div className="message-bubble-wrapper">
                <div className="message-bubble bubble-agent thinking-bubble">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-label">Synthesizing response...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
