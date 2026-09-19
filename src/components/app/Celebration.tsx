"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Confetti from both edges of the screen and a card in the middle, shown once
 * per mock — a reload must not fire it again, so the mock's id is remembered
 * in localStorage.
 *
 * Drawn on a canvas by hand rather than from a library: the whole effect is
 * a few dozen lines, and the player's dependency list is short on purpose.
 */

const COLOURS = ["#fe014d", "#0154f8", "#ffc107", "#0b7a52", "#ffffff", "#0b1120"];
const DURATION_MS = 3800;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  colour: string;
  born: number;
};

function burst(width: number, height: number, now: number, fromLeft: boolean): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < 70; i += 1) {
    const speed = 9 + Math.random() * 9;
    // Fired inwards and upwards from the edge, so it arcs across the screen.
    const direction = fromLeft ? 1 : -1;
    const theta = (-Math.PI / 4) * (0.6 + Math.random() * 0.8);
    out.push({
      x: fromLeft ? -10 : width + 10,
      y: height * (0.35 + Math.random() * 0.4),
      vx: direction * Math.cos(theta) * speed,
      vy: Math.sin(theta) * speed,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      born: now,
    });
  }
  return out;
}

function Confetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    let particles: Particle[] = [];
    let frame = 0;
    let lastBurst = -Infinity;

    const tick = (now: number) => {
      const elapsed = now - start;
      // Three volleys from each side over the first two seconds.
      if (elapsed < 2000 && now - lastBurst > 650) {
        particles.push(...burst(canvas.width, canvas.height, now, true));
        particles.push(...burst(canvas.width, canvas.height, now, false));
        lastBurst = now;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter((p) => p.y < canvas.height + 40 && now - p.born < DURATION_MS);
      for (const p of particles) {
        p.vy += 0.28; // gravity
        p.vx *= 0.985; // drag
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        const life = 1 - (now - p.born) / DURATION_MS;
        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, life * 1.4));
        context.translate(p.x, p.y);
        context.rotate(p.angle);
        context.fillStyle = p.colour;
        context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        context.restore();
      }

      if (elapsed < DURATION_MS + 1500 && (particles.length > 0 || elapsed < 2000)) {
        frame = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}

/**
 * Whether this mock's celebration has already been shown, read from storage
 * once per page and then held: the marker is written the moment it shows, and
 * re-reading storage on the next render would hide it again mid-confetti.
 * The server always answers "seen", so nothing flashes before hydration.
 */
const seenOnce = new Map<string, boolean>();

function readSeen(key: string): boolean {
  if (!seenOnce.has(key)) {
    let seen = false;
    try {
      seen = window.localStorage.getItem(key) === "1";
    } catch {
      // Private mode or blocked storage: celebrate, once per page load.
    }
    seenOnce.set(key, seen);
  }
  return seenOnce.get(key)!;
}

const subscribeToNothing = () => () => {};

export function Celebration({
  mockId,
  title,
  overallBand,
  withheld = false,
  children,
}: {
  mockId: string;
  title: string;
  /** Null while an essay is still with the instructor. */
  overallBand: number | null;
  /** The instructor is not showing bands: congratulate without a number. */
  withheld?: boolean;
  /** The band summary, rendered inside the card. */
  children?: React.ReactNode;
}) {
  const key = `celebrated:${mockId}`;
  const seen = useSyncExternalStore(subscribeToNothing, () => readSeen(key), () => true);
  const [dismissed, setDismissed] = useState(false);
  const [confetti, setConfetti] = useState(true);
  // Stable, so the canvas effect does not restart on a re-render.
  const stopConfetti = useCallback(() => setConfetti(false), []);

  useEffect(() => {
    if (seen) return;
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Same as above.
    }
  }, [seen, key]);

  if (seen || dismissed) return null;

  return (
    <>
      {confetti && <Confetti onDone={stopConfetti} />}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-5 backdrop-blur-[2px]"
      >
        <div className="w-full max-w-md animate-[var(--animate-rise)] rounded-2xl bg-white p-8 text-center shadow-[0_40px_80px_-30px_rgba(11,17,32,.6)]">
          <p className="text-[10px] font-bold tracking-[0.24em] text-brand-red">CONGRATULATIONS</p>
          <h2
            id="celebration-title"
            className="mt-3 font-display text-[clamp(1.6rem,5vw,2.25rem)] leading-[1] tracking-[-0.03em] text-ink"
          >
            You finished {title}.
          </h2>
          {withheld ? (
            <p className="mx-auto mt-5 max-w-[34ch] text-sm leading-relaxed text-ink-muted">
              Every section is in. Your results will be released by the instructor.
            </p>
          ) : overallBand !== null ? (
            <>
              <p className="mt-6 text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
                OVERALL BAND
              </p>
              <p className="mt-1 font-display text-6xl leading-none text-brand-red">
                {overallBand.toFixed(1)}
              </p>
            </>
          ) : (
            <p className="mx-auto mt-5 max-w-[34ch] text-sm leading-relaxed text-ink-muted">
              Your listening and reading bands are in. Your essays are with the instructor, and
              your overall band appears once they are marked.
            </p>
          )}
          {children && <div className="mt-6">{children}</div>}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-7 w-full rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/90"
          >
            See my results
          </button>
        </div>
      </div>
    </>
  );
}
