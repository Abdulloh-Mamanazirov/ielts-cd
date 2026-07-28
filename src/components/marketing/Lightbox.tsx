"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Click-to-enlarge for certificates. Renders as a plain button so it is
 * keyboard reachable, and the open dialog traps Escape and restores focus.
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

      {open && (
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
        </div>
      )}
    </>
  );
}
