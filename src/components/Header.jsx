import React from "react";
import { Sparkles, Settings2, Trash2, Radio, SlidersHorizontal, Square, RefreshCw } from "lucide-react";

export default function Header({
  status,
  wsUrl,
  talkMode,
  onToggleTalkMode,
  onClearChat,
  onOpenSettings,
  onStop,
  hasMessages,
}) {
  const isConnected = status !== "idle";

  const getHostLabel = () => {
    try {
      const parsed = new URL(wsUrl.replace(/^ws/, "http"));
      return parsed.host || "Active";
    } catch {
      return "Active";
    }
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo-glow">
          <Sparkles className="brand-icon" size={22} />
        </div>
        <div className="brand-text">
          <div className="brand-title-row">
            <span className="brand-title">AURA</span>
            <span className="brand-version">v2.5</span>
          </div>
          <span className="brand-sub">Neural Voice Assistant</span>
        </div>
      </div>

      <div className="header-center-pill">
        <div className={`connection-badge ${isConnected ? "connected" : "disconnected"}`}>
          <span className="pulse-ping" />
          <span className="pulse-dot" />
          <span className="connection-text">
            {isConnected ? `WS Connected (${getHostLabel()})` : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="header-actions">
        {isConnected && (
          <button
            className={`header-pill-btn mode-btn ${talkMode === "alexa" ? "mode-btn-alexa" : ""}`}
            onClick={onToggleTalkMode}
            title="Click to cycle interaction mode (Alexa Hands-Free / Push to Talk / Tap to Talk)"
          >
            <Radio size={14} className={talkMode === "alexa" ? "icon-emerald" : talkMode === "toggle" ? "icon-cyan" : ""} />
            <span>
              {talkMode === "alexa"
                ? "Alexa Mode (Auto)"
                : talkMode === "hold"
                ? "Hold to Talk"
                : "Click to Talk"}
            </span>
          </button>
        )}

        {hasMessages && (
          <button
            className="header-icon-btn"
            onClick={onClearChat}
            title="Clear conversation history"
            aria-label="Clear chat"
          >
            <Trash2 size={16} />
          </button>
        )}

        {isConnected && (
          <button
            className="header-icon-btn btn-danger"
            onClick={onStop}
            title="End voice session"
            aria-label="End session"
          >
            <Square size={16} fill="currentColor" />
          </button>
        )}

        <button
          className="header-icon-btn"
          onClick={onOpenSettings}
          title="Audio & Server Settings"
          aria-label="Settings"
        >
          <Settings2 size={18} />
        </button>
      </div>
    </header>
  );
}
