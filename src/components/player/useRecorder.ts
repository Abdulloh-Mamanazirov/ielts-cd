"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture for the speaking test.
 *
 * The stream is opened once and kept for the whole sitting: asking for the
 * microphone before every question would put a permission prompt between the
 * student and their answer, and some browsers add an audible click each time
 * the device is acquired.
 */

export type RecorderState = "idle" | "requesting" | "ready" | "recording" | "denied" | "unsupported";

/** Preference order. Opus is far smaller; Safari only offers MP4/AAC. */
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }, []);

  // Releases the microphone when the player unmounts, so the browser's
  // recording indicator does not stay lit after the test.
  useEffect(() => {
    return () => {
      stopTicker();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    };
  }, [stopTicker]);

  const arm = useCallback(async () => {
    if (streamRef.current) {
      setState("ready");
      return true;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !pickMimeType()) {
      setState("unsupported");
      setError("This browser cannot record audio. Try Chrome, Edge, Firefox or Safari.");
      return false;
    }

    setState("requesting");
    setError(null);

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setState("ready");
      return true;
    } catch {
      setState("denied");
      setError(
        "The microphone is blocked. Allow it in your browser's address bar, then try again.",
      );
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    const stream = streamRef.current ?? ((await arm()) ? streamRef.current : null);
    if (!stream) return false;

    const mimeType = pickMimeType();
    if (!mimeType) {
      setState("unsupported");
      return false;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();

    recorderRef.current = recorder;
    startedAt.current = Date.now();
    setElapsed(0);
    setState("recording");

    stopTicker();
    ticker.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      250,
    );

    return true;
  }, [arm, stopTicker]);

  /** Resolves with the finished take, or null if nothing was captured. */
  const stop = useCallback(async (): Promise<{ blob: Blob; seconds: number } | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType.split(";")[0] }));
      recorder.stop();
    });

    stopTicker();
    recorderRef.current = null;
    setState("ready");

    return blob.size > 0 ? { blob, seconds } : null;
  }, [stopTicker]);

  return { state, error, elapsed, arm, start, stop };
}
