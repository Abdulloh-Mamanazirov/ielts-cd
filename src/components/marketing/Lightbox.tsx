"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Click-to-enlarge for certificates. Renders as a plain button so it is
 * keyboard reachable, and the open dialog traps Escape and restores focus.
 *
 * The overlay is portalled to `document.body`, and that is load-bearing rather
 * than tidiness. Left in place it was a descendant of the result card, which
 * carries `hover:-translate-y-1` and `overflow-hidden` — and a transformed
 * ancestor becomes the containing block for `position: fixed`, so the
 * "full-screen" overlay was laid out inside the card and then clipped to it.
 *
 * Worse, it flickered: the overlay being inside the card meant hovering the
 * overlay counted as hovering the card. Cursor off the card → no transform →
 * overlay covers the viewport → cursor is now over the overlay → card is
 * hovered again → transform returns → overlay shrinks back into the card →
 * cursor is off it again. That loop ran at frame rate until the pointer left
 * the page entirely.
 */
export function Lightbox({
  src,
  alt,
  caption,
  children,
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);

    // Stop the page behind from scrolling while the overlay is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closer.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "group/lb block cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue",
          className,
        )}
      >
        {children}
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={close}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-ink/90 p-5 backdrop-blur-sm"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-[82vh] w-full max-w-2xl overflow-hidden bg-white shadow-2xl"
            >
              <Image
                src={src}
                alt={alt}
                width={1000}
                height={1400}
                className="h-auto max-h-[82vh] w-full object-contain"
              />
            </div>

            {caption && <p className="text-sm font-medium text-white/80">{caption}</p>}

            <button
              ref={closer}
              type="button"
              onClick={close}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-ink transition hover:bg-brand-red-cta hover:text-white"
            >
              Close
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
