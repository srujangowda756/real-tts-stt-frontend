import React, { useState } from "react";
import { X, Server, Mic, Keyboard, Check, RefreshCw } from "lucide-react";

export default function SettingsModal({
  isOpen,
  onClose,
  wsUrl,
  defaultUrl,
  onSaveWsUrl,
  talkMode,
  onChangeTalkMode,
  vadSensitivity = "high",
  onChangeSensitivity,
}) {
  if (!isOpen) return null;

  const [inputUrl, setInputUrl] = useState(wsUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    onSaveWsUrl(inputUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const targetUrl = defaultUrl || "ws://localhost:8000/ws";
    setInputUrl(targetUrl);
    onSaveWsUrl(targetUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Server size={20} className="modal-icon text-violet" />
            <h3 className="modal-title">Settings & Audio Configuration</h3>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          {/* WebSocket Server Endpoint */}
          <div className="setting-group">
            <label className="setting-label">WebSocket Server Endpoint</label>
            <p className="setting-desc">
              URL of the real-time STT/TTS backend server
            </p>
            <div className="input-group">
              <input
                type="text"
                className="modal-input"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="ws://localhost:8000"
              />
              <button
                type="button"
                className="reset-url-btn"
                onClick={handleReset}
                title="Reset to default"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Interaction Mode */}
          <div className="setting-group">
            <label className="setting-label">Voice Interaction Mode</label>
            <p className="setting-desc">
              Choose how you want to talk with Aura
            </p>
            <div className="mode-selector-grid-3">
              <button
                type="button"
                className={`mode-card ${talkMode === "alexa" ? "selected mode-card-alexa" : ""}`}
                onClick={() => onChangeTalkMode("alexa")}
              >
                <div className="mode-card-header">
                  <Mic size={18} className="text-emerald" />
                  <span className="mode-card-title">
                    Always Listening (Alexa Mode)
                  </span>
                  <span className="badge-recommended">Recommended</span>
                </div>
                <p className="mode-card-desc">
                  Completely hands-free. Listens continuously, detects when you
                  speak, and automatically sends when you pause.
                </p>
              </button>

              <button
                type="button"
                className={`mode-card ${talkMode === "hold" ? "selected" : ""}`}
                onClick={() => onChangeTalkMode("hold")}
              >
                <div className="mode-card-header">
                  <Mic size={18} className="text-violet" />
                  <span className="mode-card-title">Hold to Talk</span>
                </div>
                <p className="mode-card-desc">
                  Push-to-talk: Hold button or Spacebar while speaking. Sends on
                  release.
                </p>
              </button>

              <button
                type="button"
                className={`mode-card ${talkMode === "toggle" ? "selected" : ""}`}
                onClick={() => onChangeTalkMode("toggle")}
              >
                <div className="mode-card-header">
                  <Mic size={18} className="text-cyan" />
                  <span className="mode-card-title">Click to Toggle</span>
                </div>
                <p className="mode-card-desc">
                  Tap once to begin recording, tap again to finalize and send.
                </p>
              </button>
            </div>
          </div>

          {/* VAD Sensitivity for Alexa Mode */}
          {talkMode === "alexa" && (
            <div className="setting-group">
              <label className="setting-label">Alexa Mode Sensitivity</label>
              <p className="setting-desc">
                Adjust speech trigger sensitivity for your room
              </p>
              <div className="sensitivity-selector-row">
                <button
                  type="button"
                  className={`sensitivity-btn ${vadSensitivity === "low" ? "active" : ""}`}
                  onClick={() =>
                    onChangeSensitivity && onChangeSensitivity("low")
                  }
                >
                  Low (Noisy Room)
                </button>
                <button
                  type="button"
                  className={`sensitivity-btn ${vadSensitivity === "medium" ? "active" : ""}`}
                  onClick={() =>
                    onChangeSensitivity && onChangeSensitivity("medium")
                  }
                >
                  Medium (Default)
                </button>
                <button
                  type="button"
                  className={`sensitivity-btn ${vadSensitivity === "high" ? "active" : ""}`}
                  onClick={() =>
                    onChangeSensitivity && onChangeSensitivity("high")
                  }
                >
                  High (Quiet Room)
                </button>
              </div>
            </div>
          )}

          {/* Shortcuts Guide */}
          <div className="setting-group">
            <label className="setting-label">
              <Keyboard
                size={15}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Keyboard Shortcuts
            </label>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <span className="shortcut-desc">Trigger Recording</span>
                <kbd className="kbd-badge">Spacebar</kbd>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-desc">Close Modal / Dismiss</span>
                <kbd className="kbd-badge">Escape</kbd>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {saved ? (
                <>
                  <Check size={16} /> Saved!
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
