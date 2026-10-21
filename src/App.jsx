// voice-ui/src/App.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import Header from "./components/Header";
import VoiceOrb from "./components/VoiceOrb";
import AudioVisualizer from "./components/AudioVisualizer";
import ChatFeed from "./components/ChatFeed";
import SettingsModal from "./components/SettingsModal";
import {
  AlertCircle,
  X,
  Sparkles,
  Volume2,
  Mic,
  Play,
  Radio,
  SendHorizontal,
} from "lucide-react";
import "./App.css";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

// Patient silence durations: gives the user breathing room between words and clauses
const SENSITIVITY_CONFIG = {
  high: { thresholdDelta: 0.035, silenceDelta: 0.015, silenceTimeout: 2200 }, // 2.2s pause, very patient
  medium: { thresholdDelta: 0.06, silenceDelta: 0.025, silenceTimeout: 1900 }, // 1.9s pause, balanced
  low: { thresholdDelta: 0.1, silenceDelta: 0.04, silenceTimeout: 1600 }, // 1.6s pause, noisy room
};

export default function App() {
  // States: idle | listening | recording | thinking | speaking
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  // Default to 'alexa' mode for hands-free always-listening
  const [talkMode, setTalkMode] = useState(() => {
    return localStorage.getItem("aura_talk_mode") || "alexa";
  });
  const [vadSensitivity, setVadSensitivity] = useState(() => {
    return localStorage.getItem("aura_vad_sensitivity") || "high";
  });
  const [wsUrl, setWsUrl] = useState(() => {
    return localStorage.getItem("aura_ws_url") || `${WS_URL}/ws`;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeStream, setActiveStream] = useState(null);
  const [vadLevel, setVadLevel] = useState(0);
  const [isPausing, setIsPausing] = useState(false);

  // Sync mutable refs to avoid React state closure stalls in audio loop
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const talkModeRef = useRef(talkMode);
  useEffect(() => {
    talkModeRef.current = talkMode;
  }, [talkMode]);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const isSpacePressedRef = useRef(false);

  // VAD state trackers
  const speechStartRef = useRef(0);
  const lastSpeechRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const vadContextRef = useRef(null);
  const vadRafRef = useRef(null);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const addMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { role, text, timestamp: formatTime() }]);
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "status") {
            setStatus(msg.state);
          } else if (msg.type === "transcript") {
            addMessage("user", msg.text);
          } else if (msg.type === "reply") {
            addMessage("assistant", msg.text);
          } else if (msg.type === "error") {
            setError(msg.message || "An unexpected error occurred.");
            setStatus("listening");
          }
        } catch {
          addMessage("assistant", event.data);
        }
        return;
      }

      // Spoken WAV reply
      try {
        const url = URL.createObjectURL(
          new Blob([event.data], { type: "audio/wav" }),
        );
        const audio = new Audio(url);
        currentAudioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          // 450ms cooldown prevents audio playback resonance from re-triggering mic
          cooldownUntilRef.current = Date.now() + 450;
          setStatus("listening");
          setIsPausing(false);
        };

        setStatus("speaking");
        setIsPausing(false);
        audio.play().catch(() => {
          setError("Audio playback was blocked by browser policy.");
          setStatus("listening");
        });
      } catch (err) {
        console.error("Audio playback error:", err);
        setStatus("listening");
      }
    },
    [addMessage],
  );

  // Connect WebSocket & Request Microphone
  const start = async () => {
    setError("");
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setActiveStream(stream);
    } catch {
      setError(
        "Microphone access was denied. Please allow microphone permissions.",
      );
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        cooldownUntilRef.current = Date.now() + 300;
        setStatus("listening");
      };
      ws.onclose = () => {
        setStatus("idle");
        currentAudioRef.current?.pause();
      };
      ws.onerror = () => {
        setError(`Failed to connect to voice server at ${wsUrl}`);
      };
      ws.onmessage = handleMessage;
      wsRef.current = ws;
    } catch {
      setError(`Invalid WebSocket server URL: ${wsUrl}`);
    }
  };

  // Disconnect & Cleanup
  const stop = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActiveStream(null);
    setStatus("idle");
    setVadLevel(0);
    setIsPausing(false);
  };

  // Start Audio Recording
  const startRecording = useCallback(() => {
    if (statusRef.current !== "listening") return;
    if (!streamRef.current) return;

    chunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(streamRef.current, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 2000 || wsRef.current?.readyState !== WebSocket.OPEN) {
          setStatus("listening");
          setIsPausing(false);
          return;
        }
        wsRef.current.send(blob);
        setStatus("thinking");
        setIsPausing(false);
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
      setIsPausing(false);
    } catch (err) {
      setError("Failed to initialize audio recorder.");
      console.error(err);
    }
  }, []);

  // Stop Audio Recording
  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  // Continuous Voice Activity Detection (VAD) Engine
  useEffect(() => {
    if (!activeStream) {
      if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
      if (vadContextRef.current && vadContextRef.current.state !== "closed") {
        try {
          vadContextRef.current.close();
        } catch {}
        vadContextRef.current = null;
      }
      setVadLevel(0);
      setIsPausing(false);
      return;
    }

    let isRunning = true;
    let audioCtx = null;
    let analyser = null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.2;
      const source = audioCtx.createMediaStreamSource(activeStream);
      source.connect(analyser);

      vadContextRef.current = audioCtx;
    } catch (err) {
      console.warn("AudioContext setup error:", err);
      return;
    }

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let noiseFloor = 0.04; // dynamically adapted room noise
    let consecutiveSpeechFrames = 0;
    let hangoverUntil = 0; // Speech hangover buffer (400ms) to bridge micro-pauses

    const processAudio = () => {
      if (!isRunning) return;

      analyser.getByteFrequencyData(buffer);

      // Focus on human speech spectrum: bins 2 to 24 (~300 Hz to ~4500 Hz)
      let speechSum = 0;
      const startBin = 2;
      const endBin = Math.min(buffer.length, 25);
      for (let i = startBin; i < endBin; i++) {
        speechSum += buffer[i];
      }
      const speechAvg = speechSum / (endBin - startBin); // 0 to 255
      const currentLevel = speechAvg / 255; // 0.0 to 1.0

      // Update UI meter (scaled for clear visual response)
      setVadLevel(Math.min(100, Math.round(currentLevel * 350)));

      const now = Date.now();
      const currentStatus = statusRef.current;
      const currentMode = talkModeRef.current;

      const config =
        SENSITIVITY_CONFIG[vadSensitivity] || SENSITIVITY_CONFIG.high;
      // Speech threshold floats above ambient noise floor
      const speechThreshold = Math.max(
        0.08,
        noiseFloor + config.thresholdDelta,
      );
      const silenceThreshold = Math.max(0.04, noiseFloor + config.silenceDelta);

      // Alexa Mode Auto Detection
      if (currentMode === "alexa" && now > cooldownUntilRef.current) {
        if (currentStatus === "listening") {
          // Adapt noise floor when room is quiet
          if (currentLevel < speechThreshold) {
            noiseFloor = noiseFloor * 0.98 + currentLevel * 0.02;
            consecutiveSpeechFrames = 0;
          } else {
            // Require 2 consecutive frames (>30ms) to filter sudden clicks/pops
            consecutiveSpeechFrames++;
            if (consecutiveSpeechFrames >= 2) {
              speechStartRef.current = now;
              lastSpeechRef.current = now;
              hangoverUntil = now + 400; // 400ms speech extension
              startRecording();
            }
          }
        } else if (currentStatus === "recording") {
          if (currentLevel > silenceThreshold) {
            // User actively speaking
            hangoverUntil = now + 400; // Extend speech hangover
            lastSpeechRef.current = now;
            setIsPausing(false);
          } else if (now < hangoverUntil) {
            // Still within speech hangover buffer - do not start silence count!
            lastSpeechRef.current = now;
            setIsPausing(false);
          } else {
            // Silence period: user paused
            const silenceDuration = now - lastSpeechRef.current;
            const totalDuration = now - speechStartRef.current;

            if (silenceDuration > 500) {
              setIsPausing(true);
            }

            // Only stop when patient silence timeout is fully met and at least 800ms recorded
            if (
              silenceDuration > config.silenceTimeout &&
              totalDuration > 800
            ) {
              setIsPausing(false);
              stopRecording();
            }
          }

          // Safety watchdog: allow up to 60 seconds of speech (never cut at 12s)
          if (now - speechStartRef.current > 60000) {
            setIsPausing(false);
            stopRecording();
          }
        }
      }

      vadRafRef.current = requestAnimationFrame(processAudio);
    };

    vadRafRef.current = requestAnimationFrame(processAudio);

    return () => {
      isRunning = false;
      if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
      if (audioCtx && audioCtx.state !== "closed") {
        try {
          audioCtx.close();
        } catch {}
      }
    };
  }, [activeStream, vadSensitivity, startRecording, stopRecording]);

  // Toggle Recording for click mode
  const handleToggleRecord = useCallback(() => {
    if (status === "recording") {
      stopRecording();
    } else if (status === "listening") {
      startRecording();
    }
  }, [status, startRecording, stopRecording]);

  // Spacebar Hotkey Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        document.activeElement.tagName !== "INPUT"
      ) {
        e.preventDefault();
        if (isSpacePressedRef.current) return;
        isSpacePressedRef.current = true;

        if (status === "idle") {
          start();
        } else if (talkMode === "hold") {
          startRecording();
        } else if (talkMode === "toggle" || talkMode === "alexa") {
          handleToggleRecord();
        }
      } else if (e.code === "Escape") {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        isSpacePressedRef.current = false;
        if (talkMode === "hold" && status === "recording") {
          stopRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    status,
    talkMode,
    isSettingsOpen,
    startRecording,
    stopRecording,
    handleToggleRecord,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Cycle modes: Alexa -> Hold -> Toggle
  const handleToggleTalkMode = () => {
    const modes = ["alexa", "hold", "toggle"];
    const nextIdx = (modes.indexOf(talkMode) + 1) % modes.length;
    const newMode = modes[nextIdx];
    setTalkMode(newMode);
    localStorage.setItem("aura_talk_mode", newMode);
  };

  const handleSaveWsUrl = (newUrl) => {
    setWsUrl(newUrl);
    localStorage.setItem("aura_ws_url", newUrl);
  };

  const handleChangeSensitivity = (newLevel) => {
    setVadSensitivity(newLevel);
    localStorage.setItem("aura_vad_sensitivity", newLevel);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="app-container">
      {/* Dynamic Ambient Background Nebulas */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <div className="ambient-glow-3" />
        <div className="ambient-grid" />
      </div>

      {/* Top Application Header */}
      <Header
        status={status}
        wsUrl={wsUrl}
        talkMode={talkMode}
        onToggleTalkMode={handleToggleTalkMode}
        onClearChat={handleClearChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStop={stop}
        hasMessages={messages.length > 0}
      />

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <div className="error-banner-content">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            className="error-close-btn"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <main className="app-main-grid">
        {/* Left: Cockpit & Voice Orb */}
        <section className="cockpit-card" aria-label="Voice Controls">
          <div className="cockpit-header-badge">
            <span className="brand-sub">NEURAL AUDIO ENGINE</span>
          </div>

          {/* Alexa Mode Active Banner with Live Voice Meter & Quick Send */}
          {talkMode === "alexa" && status !== "idle" && (
            <div className="alexa-status-banner">
              <div className="alexa-banner-left">
                <Radio size={14} className="icon-emerald" />
                <span>
                  {status === "recording"
                    ? isPausing
                      ? "Paused... (Sending soon or speak again)"
                      : "Hearing your voice..."
                    : status === "speaking"
                      ? "Replying..."
                      : status === "thinking"
                        ? "Thinking..."
                        : "Always Listening"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {status === "recording" && (
                  <button
                    className="alexa-done-btn"
                    onClick={stopRecording}
                    title="Send speech immediately without waiting for silence pause"
                  >
                    Done Speaking
                  </button>
                )}
                <div className="vad-level-wrapper">
                  <span>Mic</span>
                  <div className="vad-meter-track">
                    <div
                      className="vad-meter-fill"
                      style={{ width: `${Math.min(100, vadLevel)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <VoiceOrb
            status={status}
            isRecording={status === "recording"}
            talkMode={talkMode}
            onStart={start}
            onPointerDown={talkMode === "hold" ? startRecording : undefined}
            onPointerUp={talkMode === "hold" ? stopRecording : undefined}
            onPointerLeave={talkMode === "hold" ? stopRecording : undefined}
            onToggleRecord={handleToggleRecord}
            onStop={stop}
            disabled={status !== "listening" && status !== "recording"}
          />

          {/* Real-time reactive Audio Visualizer */}
          <AudioVisualizer stream={activeStream} status={status} />

          {/* Cockpit Actions */}
          <div className="cockpit-controls">
            {status === "idle" ? (
              <button className="cockpit-btn btn-start-primary" onClick={start}>
                <Play size={16} fill="currentColor" />
                <span>Initialize Voice</span>
              </button>
            ) : (
              <button className="cockpit-btn btn-outline-danger" onClick={stop}>
                <span>End Session</span>
              </button>
            )}
          </div>

          <div className="keyboard-hint-pill">
            {talkMode === "alexa" ? (
              <span>
                Hands-free • Takes natural pauses without cutting you off
              </span>
            ) : (
              <>
                <span>Press</span>
                <kbd>Space</kbd>
                <span>
                  to {talkMode === "hold" ? "hold & speak" : "toggle speech"}
                </span>
              </>
            )}
          </div>
        </section>

        {/* Right: Real-time Conversation Feed */}
        <section className="conversation-card" aria-label="Conversation Feed">
          <div className="conversation-header">
            <div className="conv-title-row">
              <span className="conv-title">Live Transcript</span>
              <span className="conv-count-badge">
                {messages.length} {messages.length === 1 ? "turn" : "turns"}
              </span>
            </div>
            {status === "speaking" && (
              <div className="speaking-tag">
                <Volume2 size={12} className="pulse-fast" />
                <span>Streaming Audio</span>
              </div>
            )}
          </div>

          <ChatFeed
            messages={messages}
            status={status}
            onSelectPrompt={(text) => {
              navigator.clipboard?.writeText(text);
            }}
          />
        </section>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        wsUrl={wsUrl}
        defaultUrl={WS_URL}
        onSaveWsUrl={handleSaveWsUrl}
        talkMode={talkMode}
        onChangeTalkMode={(mode) => {
          setTalkMode(mode);
          localStorage.setItem("aura_talk_mode", mode);
        }}
        vadSensitivity={vadSensitivity}
        onChangeSensitivity={handleChangeSensitivity}
      />
    </div>
  );
}
