"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { formatClock } from "./PlayerChrome";
import { useVolume } from "./useVolume";

export type AudioPartMarker = { number: number; startSeconds: number };

/** Buffer to hold before the recording can be started, so it will not stall. */
const MIN_BUFFER_SECONDS = 15;

/** How far the position may drift before a mock treats it as an attempted seek. */
const SEEK_TOLERANCE_SECONDS = 1.5;

/** What the element is doing. "idle" is before the first press. */
type Playback = "idle" | "playing" | "stalled" | "paused" | "ended" | "error";

/** What the bar shows — "idle" resolves to loading or ready depending on buffer. */
type Phase = Exclude<Playback, "idle"> | "loading" | "ready";

/**
 * The listening recording, presented the way a real test presents it: in a mock
 * it plays once, straight through, and cannot be paused, rewound or replayed.
 * Practice and review hand back full control, because there the point is to
 * study the recording rather than to be tested by it.
 *
 * Not in the design file. Built from the existing chrome's vocabulary — white
 * bar, hairline rule, ink fill, no colour and no motion.
 */
export function AudioBar({
  src,
  locked,
  parts = [],
  knownDuration,
}: {
  src: string;
  /** Mock rules: one press, no pause, no seek, no replay. */
  locked: boolean;
  parts?: AudioPartMarker[];
  /** Duration recorded at upload, shown before the browser reads its own. */
  knownDuration?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { volume, setVolume } = useVolume();

  const [playback, setPlayback] = useState<Playback>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  // Furthest point reached legitimately. A mock snaps back to it if anything —
  // media keys, the OS overlay, devtools — moves the position.
  const allowedTime = useRef(0);
  const correcting = useRef(false);
  const hasEnded = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const readBuffered = () => {
      setBufferedEnd(audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0);
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
      readBuffered();
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.seeking) allowedTime.current = audio.currentTime;
      readBuffered();
    };

    const onSeeking = () => {
      if (!locked || correcting.current) return;
      if (Math.abs(audio.currentTime - allowedTime.current) <= SEEK_TOLERANCE_SECONDS) return;
      correcting.current = true;
      audio.currentTime = allowedTime.current;
    };

    const onSeeked = () => {
      correcting.current = false;
    };

    const onPlay = () => {
      // A finished mock recording stays finished, however play was triggered.
      if (locked && hasEnded.current) {
        audio.pause();
        return;
      }
      setPlayback("playing");
    };

    const onEnded = () => {
      hasEnded.current = true;
      setPlayback("ended");
    };

    const onError = () => setPlayback("error");
    const onWaiting = () => setPlayback((current) => (current === "ended" ? current : "stalled"));
    const onPause = () => {
      if (hasEnded.current) return;
      setPlayback((current) => (current === "playing" || current === "stalled" ? "paused" : current));
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("progress", readBuffered);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeking", onSeeking);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("progress", readBuffered);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeking", onSeeking);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [locked]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const fullyBuffered = duration > 0 && bufferedEnd >= duration - 0.5;
  const armed = duration > 0 && (fullyBuffered || bufferedEnd - currentTime >= MIN_BUFFER_SECONDS);

  // The buffering gate is derived, not stored: it is a fact about how much has
  // arrived, and the element owns every phase after the first press.
  const phase: Phase = playback === "idle" ? (armed ? "ready" : "loading") : playback;

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
    } catch {
      // A rejected play() outside an autoplay block means the source failed.
      setPlayback("error");
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (hasEnded.current) {
        hasEnded.current = false;
        audio.currentTime = 0;
        allowedTime.current = 0;
      }
      void play();
    } else {
      audio.pause();
    }
  }, [play]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    allowedTime.current = seconds;
    setCurrentTime(seconds);
  }, []);

  const started = playback !== "idle";
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const bufferedFraction = duration > 0 ? Math.min(1, bufferedEnd / duration) : 0;

  return (
    <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink/[0.12] bg-white px-4 py-2.5 lg:px-[22px]">
      <audio ref={audioRef} src={src} preload="auto" />

      <PrimaryControl
        phase={phase}
        locked={locked}
        onStart={play}
        onToggle={toggle}
      />

      <div className="flex min-w-[190px] flex-1 items-center gap-3">
        <span className="font-display text-[13px] leading-none tabular-nums text-ink">
          {formatClock(Math.floor(currentTime))}
        </span>

        <Track
          progress={progress}
          buffered={bufferedFraction}
          duration={duration}
          parts={parts}
          seekable={!locked && duration > 0}
          onSeek={seek}
        />

        <span className="font-display text-[13px] leading-none tabular-nums text-ink-subtle">
          {duration > 0 ? formatClock(Math.floor(duration)) : "--:--"}
        </span>
      </div>

      <Status phase={phase} locked={locked} started={started} bufferedFraction={bufferedFraction} />

      <VolumeControl volume={volume} onChange={setVolume} />
    </div>
  );
}

function PrimaryControl({
  phase,
  locked,
  onStart,
  onToggle,
}: {
  phase: Phase;
  locked: boolean;
  onStart: () => void;
  onToggle: () => void;
}) {
  const waiting = phase === "loading";
  const failed = phase === "error";

  // In a mock the button exists only to arm the recording; afterwards there is
  // nothing left to press, so it becomes a label rather than a dead control.
  if (locked && (phase === "playing" || phase === "stalled" || phase === "ended")) {
    return (
      <span className="inline-flex items-center gap-2 rounded-[9px] bg-surface-alt px-4 py-2.5 text-[13px] font-bold text-ink-muted">
        {phase === "ended" ? "Recording finished" : "Playing"}
      </span>
    );
  }

  const label = failed
    ? "Audio unavailable"
    : waiting
      ? "Loading audio…"
      : locked
        ? // Nothing in the UI pauses a mock, but the OS can — unplugged
          // headphones, an incoming call. Resuming keeps the position, so this
          // is not a second listen.
          phase === "paused"
          ? "Resume recording"
          : "Start recording"
        : phase === "playing" || phase === "stalled"
          ? "Pause"
          : phase === "ended"
            ? "Play again"
            : "Play";

  return (
    <button
      type="button"
      onClick={locked ? onStart : onToggle}
      disabled={waiting || failed}
      className={cn(
        "inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-bold transition",
        "bg-ink text-white hover:bg-ink/85 disabled:bg-surface-alt disabled:text-ink-subtle",
      )}
    >
      {phase === "playing" || phase === "stalled" ? <PauseIcon /> : <PlayIcon />}
      {label}
    </button>
  );
}

/**
 * Position and buffer in one rule, echoing the timer's depleting bar. Locked
 * mode renders no control at all, rather than a disabled one: there is nothing
 * to reach for, which is the point.
 */
function Track({
  progress,
  buffered,
  duration,
  parts,
  seekable,
  onSeek,
}: {
  progress: number;
  buffered: number;
  duration: number;
  parts: AudioPartMarker[];
  seekable: boolean;
  onSeek: (seconds: number) => void;
}) {
  const markers = parts.filter(
    (part) => duration > 0 && part.startSeconds > 0 && part.startSeconds < duration,
  );

  const rule = (
    <span aria-hidden className="relative block h-[5px] w-full rounded-sm bg-ink/15">
      <span
        className="absolute inset-y-0 left-0 rounded-sm bg-ink/20"
        style={{ width: `${buffered * 100}%` }}
      />
      <span
        className="absolute inset-y-0 left-0 rounded-sm bg-ink transition-[width] duration-500 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
      {markers.map((part) => (
        <span
          key={part.number}
          className="absolute top-1/2 h-[9px] w-px -translate-y-1/2 bg-ink/35"
          style={{ left: `${(part.startSeconds / duration) * 100}%` }}
        />
      ))}
    </span>
  );

  if (!seekable) {
    return (
      <span
        role="progressbar"
        aria-label="Recording position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="flex-1"
      >
        {rule}
      </span>
    );
  }

  return (
    <span className="relative flex-1">
      {rule}
      <input
        type="range"
        min={0}
        max={duration}
        step={1}
        value={Math.min(progress * duration, duration)}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-label="Seek recording"
        className="absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent
          [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
      />
    </span>
  );
}

function Status({
  phase,
  locked,
  started,
  bufferedFraction,
}: {
  phase: Phase;
  locked: boolean;
  started: boolean;
  bufferedFraction: number;
}) {
  const message =
    phase === "error"
      ? "The recording could not be loaded. Reload the page, or tell your instructor."
      : phase === "loading"
        ? `Loading the recording… ${Math.round(bufferedFraction * 100)}%`
        : phase === "stalled"
          ? "Buffering…"
          : phase === "ended"
            ? "The recording has finished. Your answers are still editable until you submit."
            : !started && locked
              ? "The recording plays once and cannot be paused or rewound."
              : null;

  if (!message) return null;

  return (
    <p
      aria-live="polite"
      className={cn(
        "order-last w-full text-[12px] font-semibold sm:order-none sm:w-auto",
        phase === "error" ? "text-brand-red-cta" : "text-ink-subtle",
      )}
    >
      {message}
    </p>
  );
}

function VolumeControl({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (value: number) => void;
}) {
  const muted = volume === 0;

  return (
    <div className="flex flex-none items-center gap-2 rounded-[9px] bg-surface-alt px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => onChange(muted ? 0.8 : 0)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="text-ink-muted transition hover:text-ink"
      >
        {muted ? <MutedIcon /> : <SpeakerIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Volume"
        className="h-1 w-[72px] cursor-pointer appearance-none rounded-sm bg-ink/20 accent-ink
          [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
      />
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}
