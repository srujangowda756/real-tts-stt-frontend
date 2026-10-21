import React from "react";
import { Mic, MicOff, Volume2, Sparkles, Loader2, Power } from "lucide-react";

export default function VoiceOrb({
  status,
  isRecording,
  talkMode,
  onStart,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onToggleRecord,
  onStop,
  disabled,
}) {
  const isIdle = status === "idle";

  // Determine helper text based on state
  const getHelperText = () => {
    switch (status) {
      case "idle":
        return "Click to connect & start";
      case "listening":
        if (talkMode === "alexa") {
          return "Always listening... Just speak naturally";
        }
        return talkMode === "hold"
          ? "Hold button or Spacebar to talk"
          : "Click button or press Space to record";
      case "recording":
        if (talkMode === "alexa") {
          return "Listening to you... Pause when done";
        }
        return talkMode === "hold"
          ? "Listening... Release to send"
          : "Listening... Click to send";
      case "thinking":
        return "Neural synthesis in progress...";
      case "speaking":
        return "Aura is replying...";
      default:
        return "";
    }
  };

  const getOrbStatusClass = () => {
    if (status === "recording") return "orb-recording";
    if (status === "speaking") return "orb-speaking";
    if (status === "thinking") return "orb-thinking";
    if (status === "listening") return "orb-listening";
    return "orb-idle";
  };

  return (
    <div className="voice-orb-wrapper">
      <div className={`orb-ambient-ring-3 ${getOrbStatusClass()}`} />
      <div className={`orb-ambient-ring-2 ${getOrbStatusClass()}`} />
      <div className={`orb-ambient-ring-1 ${getOrbStatusClass()}`} />

      {/* Main Interactive Orb */}
      {isIdle ? (
        <button
          className="voice-orb-core orb-idle-btn"
          onClick={onStart}
          aria-label="Start Voice Agent"
        >
          <div className="orb-inner-glow" />
          <div className="orb-icon-content">
            <Power className="orb-icon icon-power" size={38} />
            <span className="orb-btn-label">Start Agent</span>
          </div>
        </button>
      ) : (
        <button
          className={`voice-orb-core ${getOrbStatusClass()} ${
            status === "recording" ? "is-pressed" : ""
          }`}
          onPointerDown={talkMode === "hold" ? onPointerDown : undefined}
          onPointerUp={talkMode === "hold" ? onPointerUp : undefined}
          onPointerLeave={talkMode === "hold" ? onPointerLeave : undefined}
          onClick={talkMode === "toggle" ? onToggleRecord : undefined}
          disabled={disabled && status !== "recording"}
          aria-label={status === "recording" ? "Stop recording" : "Record audio"}
        >
          <div className="orb-inner-glow" />
          
          {/* Orbital glowing ring for thinking state */}
          {status === "thinking" && <div className="orb-spinner-ring" />}

          <div className="orb-icon-content">
            {status === "recording" && (
              <>
                <div className="orb-rec-dot" />
                <Mic className="orb-icon icon-rec" size={38} />
              </>
            )}
            {status === "thinking" && (
              <Sparkles className="orb-icon icon-think spin-slow" size={38} />
            )}
            {status === "speaking" && (
              <Volume2 className="orb-icon icon-speak pulse-fast" size={38} />
            )}
            {status === "listening" && (
              <Mic className="orb-icon icon-listen" size={38} />
            )}
          </div>
        </button>
      )}

      {/* State badge & Action hints */}
      <div className="orb-state-indicator">
        <div className={`status-pill ${getOrbStatusClass()}`}>
          <span className="status-dot" />
          <span className="status-label">{status.toUpperCase()}</span>
        </div>
        <p className="orb-helper-text">{getHelperText()}</p>
      </div>
    </div>
  );
}
