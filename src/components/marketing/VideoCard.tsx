import Image from "next/image";

import { posterFor } from "@/lib/media/video";
import { cn } from "@/lib/utils";

export type VideoTestimonial = {
  id: string;
  studentName: string;
  mediaType: "TEXT" | "YOUTUBE" | "INSTAGRAM";
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
};

export function VideoCard({
  item,
  /** Set by the grid so every card in a row is the same height. */
  aspect = "aspect-video",
  className,
}: {
  item: VideoTestimonial;
  aspect?: string;
  className?: string;
}) {
  const { src, parsed } = posterFor(item.mediaUrl, item.thumbnailUrl);
  const isReel = parsed.platform === "instagram";

  return (
    <a
      href={item.mediaUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative block overflow-hidden bg-ink transition duration-300",
        "hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgba(11,17,32,.5)]",
        className,
      )}
    >
      <div className={cn("relative w-full", aspect)}>
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <PosterFallback platform={parsed.platform} />
        )}

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent opacity-90"
        />

        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-red text-white shadow-[0_10px_30px_-8px_rgba(225,0,70,.9)] transition duration-300 group-hover:scale-110"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="m7 4 13 8-13 8Z" />
          </svg>
        </span>

        <span
          className={cn(
            "absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[9.5px] font-bold tracking-[0.16em]",
            isReel ? "text-brand-blue" : "text-ink",
          )}
        >
          <PlatformGlyph platform={parsed.platform} />
          {parsed.platform === "youtube" ? "YOUTUBE" : isReel ? "REEL" : "VIDEO"}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="truncate font-bold text-white">{item.studentName}</p>
        {item.caption && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/70">{item.caption}</p>
        )}
      </div>
    </a>
  );
}

/** Shown when Instagram gives us nothing to hotlink and no image was uploaded. */
function PosterFallback({ platform }: { platform: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0",
        platform === "instagram"
          ? "bg-[linear-gradient(135deg,#833ab4,#fd1d1d_55%,#fcb045)]"
          : "bg-[linear-gradient(135deg,#0b1120,#0154f8)]",
      )}
    >
      <div className="om-grid-lines absolute inset-0 opacity-30" />
    </div>
  );
}

function PlatformGlyph({ platform }: { platform: string }) {
  if (platform === "youtube") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#e10046" aria-hidden>
        <path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6a3 3 0 0 0-2.1 2.1C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.5v-7l6.2 3.5-6.2 3.5Z" />
      </svg>
    );
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0154f8"
      strokeWidth="2.2"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="#0154f8" stroke="none" />
    </svg>
  );
}
