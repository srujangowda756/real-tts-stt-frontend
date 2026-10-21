import React, { useEffect, useRef } from "react";

export default function AudioVisualizer({ stream, status }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!stream || status !== "recording") {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch {
          // ignore
        }
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.warn("AudioContext setup failed:", e);
    }

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [stream, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 32;
      const barWidth = Math.max(3, (width - barCount * 3) / barCount);
      const centerY = height / 2;

      let dataArray = null;
      if (status === "recording" && analyserRef.current) {
        dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      phase += 0.06;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;

        if (status === "recording") {
          if (dataArray) {
            const dataIndex = Math.floor((i / barCount) * dataArray.length);
            const val = dataArray[dataIndex] || 0;
            barHeight = Math.max(4, (val / 255) * (height * 0.75));
          } else {
            barHeight = 6 + Math.sin(phase * 2 + i * 0.5) * 14;
          }
        } else if (status === "speaking") {
          // Energetic harmonic waves
          const wave1 = Math.sin(phase * 1.5 + i * 0.35) * 0.5 + 0.5;
          const wave2 = Math.cos(phase * 2.2 + i * 0.2) * 0.5 + 0.5;
          barHeight = 4 + (wave1 * 0.6 + wave2 * 0.4) * (height * 0.65);
        } else if (status === "thinking") {
          // Orbiting wave pulse
          const pulse = Math.sin(phase * 3 - i * 0.25);
          barHeight = 5 + Math.max(0, pulse) * (height * 0.45);
        } else if (status === "listening") {
          // Gentle ambient ripple
          const gentle = Math.sin(phase * 0.8 + i * 0.2);
          barHeight = 4 + Math.abs(gentle) * 8;
        } else {
          // Idle flat line
          barHeight = 3;
        }

        const x = i * (barWidth + 3) + (width - (barCount * (barWidth + 3))) / 2;
        const y = centerY - barHeight / 2;

        // Gradient coloring based on state
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (status === "recording") {
          gradient.addColorStop(0, "#fb7185");
          gradient.addColorStop(0.5, "#f43f5e");
          gradient.addColorStop(1, "#e11d48");
        } else if (status === "speaking") {
          gradient.addColorStop(0, "#38bdf8");
          gradient.addColorStop(0.5, "#818cf8");
          gradient.addColorStop(1, "#c084fc");
        } else if (status === "thinking") {
          gradient.addColorStop(0, "#fbbf24");
          gradient.addColorStop(0.5, "#a855f7");
          gradient.addColorStop(1, "#ec4899");
        } else if (status === "listening") {
          gradient.addColorStop(0, "#22d3ee");
          gradient.addColorStop(1, "#38bdf8");
        } else {
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.08)");
        }

        ctx.fillStyle = gradient;
        // Rounded bar
        ctx.beginPath();
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [status]);

  return (
    <div className="visualizer-container">
      <canvas
        ref={canvasRef}
        width={340}
        height={56}
        className="visualizer-canvas"
      />
    </div>
  );
}
