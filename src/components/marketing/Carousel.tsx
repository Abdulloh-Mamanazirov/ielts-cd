"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Scroll-snap carousel. The track is a plain scroll container, so it works with
 * a trackpad, a touch swipe or the keyboard even before JavaScript loads; the
 * buttons only add a convenience on top.
 */
export function Carousel({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const element = track.current;
    if (!element) return;
    setAtStart(element.scrollLeft <= 4);
    setAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    const element = track.current;
    if (!element) return;

    element.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      element.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const scrollBy = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={track}
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-brand-blue [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>

      <NavButton side="left" disabled={atStart} onClick={() => scrollBy(-1)} />
      <NavButton side="right" disabled={atEnd} onClick={() => scrollBy(1)} />
    </div>
  );
}

function NavButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-white text-ink shadow-md transition sm:flex",
        "hover:border-brand-red hover:text-brand-red disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "-left-4" : "-right-4",
      )}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
