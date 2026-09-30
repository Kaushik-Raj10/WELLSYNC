import { useCallback, useEffect, useRef, useState } from "react";

const TRACKS = {
  morning: "/wellsync-music/morning.mp3",
  day: "/wellsync-music/day.mp3",
  evening: "/wellsync-music/evening.mp3",
  night: "/wellsync-music/night.mp3",
};

const LABELS = {
  morning: "Morning ambience",
  day: "Day ambience",
  evening: "Evening ambience",
  night: "Night ambience",
};

const MAX_VOLUME = 0.16;
const FADE_DURATION = 1800;

export default function SeasonalAmbience({ theme }) {
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const activeAudioRef = useRef(null);
  const currentThemeRef = useRef(theme);
  const fadeFrameRef = useRef(null);
  const cleanupRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const clearFade = useCallback(() => {
    if (fadeFrameRef.current !== null) {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }, []);

  const fade = useCallback((audio, from, to, duration = 900) => {
    return new Promise((resolve) => {
      if (!audio) {
        resolve();
        return;
      }

      const start = performance.now();

      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * eased));

        if (progress < 1) {
          fadeFrameRef.current = requestAnimationFrame(step);
        } else {
          fadeFrameRef.current = null;
          audio.volume = to;
          resolve();
        }
      }

      fadeFrameRef.current = requestAnimationFrame(step);
    });
  }, []);

  const startCurrentTheme = useCallback(async () => {
    const audio = audioARef.current;
    if (!audio) return false;

    audio.pause();
    audio.src = TRACKS[currentThemeRef.current];
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.muted = false;

    try {
      await audio.play();
      await fade(audio, 0, isMuted ? 0 : MAX_VOLUME, 1000);
      activeAudioRef.current = audio;
      setIsPlaying(true);
      return true;
    } catch (error) {
      console.info("WELLsync ambience autoplay blocked:", error?.name || error);
      return false;
    }
  }, [fade, isMuted]);

  useEffect(() => {
    currentThemeRef.current = theme;
  }, [theme]);

  // Attempt immediate autoplay. If the browser blocks it, the first real user
  // interaction anywhere on the page starts the ambience automatically.
  useEffect(() => {
    let cancelled = false;
    const audio = audioARef.current;

    if (!audio) return undefined;

    audio.src = TRACKS[theme];
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.muted = false;

    const startAfterInteraction = async () => {
      if (cancelled || activeAudioRef.current) return;
      const started = await startCurrentTheme();
      if (started) cleanupRef.current?.();
    };

    const events = ["pointerdown", "touchstart", "keydown"];

    async function initialize() {
      try {
        await audio.play();
        if (cancelled) {
          audio.pause();
          return;
        }
        activeAudioRef.current = audio;
        await fade(audio, 0, isMuted ? 0 : MAX_VOLUME, 1100);
        if (!cancelled) setIsPlaying(true);
      } catch {
        events.forEach((event) => {
          document.addEventListener(event, startAfterInteraction, {
            passive: true,
            once: true,
          });
        });

        cleanupRef.current = () => {
          events.forEach((event) =>
            document.removeEventListener(event, startAfterInteraction)
          );
        };
      }
    }

    initialize();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [fade, isMuted, startCurrentTheme, theme]);

  // Crossfade whenever the existing Dashboard timeTheme changes.
  useEffect(() => {
    const audioA = audioARef.current;
    const audioB = audioBRef.current;
    const current = activeAudioRef.current;

    if (!audioA || !audioB || !current) return undefined;

    const currentFile = current.src.split("/").pop();
    const nextFile = TRACKS[theme].split("/").pop();
    if (currentFile === nextFile) return undefined;

    let cancelled = false;
    const next = current === audioA ? audioB : audioA;

    clearFade();

    async function crossfade() {
      next.pause();
      next.src = TRACKS[theme];
      next.loop = true;
      next.preload = "auto";
      next.volume = 0;
      next.muted = false;

      try {
        await next.play();
      } catch {
        return;
      }

      if (cancelled) {
        next.pause();
        return;
      }

      const oldVolume = current.volume;
      const newVolume = isMuted ? 0 : MAX_VOLUME;
      const start = performance.now();

      function step(now) {
        if (cancelled) return;

        const progress = Math.min((now - start) / FADE_DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        current.volume = Math.max(0, oldVolume * (1 - eased));
        next.volume = Math.max(0, newVolume * eased);

        if (progress < 1) {
          fadeFrameRef.current = requestAnimationFrame(step);
          return;
        }

        current.pause();
        current.currentTime = 0;
        current.volume = 0;
        next.volume = newVolume;
        activeAudioRef.current = next;
        setIsPlaying(true);
        fadeFrameRef.current = null;
      }

      fadeFrameRef.current = requestAnimationFrame(step);
    }

    crossfade();

    return () => {
      cancelled = true;
    };
  }, [clearFade, isMuted, theme]);

  useEffect(() => {
    [audioARef.current, audioBRef.current].forEach((audio) => {
      if (audio) audio.volume = isMuted ? 0 : MAX_VOLUME;
    });
  }, [isMuted]);

  // Stop completely when the Dashboard unmounts.
  useEffect(() => {
    return () => {
      clearFade();
      cleanupRef.current?.();
      cleanupRef.current = null;

      [audioARef.current, audioBRef.current].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
        audio.removeAttribute("src");
        audio.load();
      });

      activeAudioRef.current = null;
    };
  }, [clearFade]);

  function handleControlClick() {
    const audio = activeAudioRef.current;

    if (!audio) {
      startCurrentTheme();
      return;
    }

    setIsMuted((value) => !value);
  }

  return (
    <>
      <audio ref={audioARef} preload="auto" loop aria-hidden="true" />
      <audio ref={audioBRef} preload="auto" loop aria-hidden="true" />

      <button
        type="button"
        className={`wellsync-ambient-control ${isPlaying ? "is-playing" : ""}`}
        onClick={handleControlClick}
        aria-label={isMuted ? "Unmute WELLsync ambience" : "Mute WELLsync ambience"}
        title={`${LABELS[theme]} • ${isMuted ? "Muted" : "Playing"}`}
      >
        <span className="wellsync-ambient-icon" aria-hidden="true">
          {isMuted ? "🔇" : "♫"}
        </span>
        <span className="wellsync-ambient-copy">
          <strong>{isMuted ? "Ambience muted" : "Ambient"}</strong>
          <small>{LABELS[theme]}</small>
        </span>
        <span className={`wellsync-ambient-pulse ${isPlaying && !isMuted ? "active" : ""}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
    </>
  );
}
