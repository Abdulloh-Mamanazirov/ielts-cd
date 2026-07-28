export type VideoPlatform = "youtube" | "instagram" | "other";

export type ParsedVideo = {
  platform: VideoPlatform;
  id: string | null;
  /** Derivable only for YouTube; Instagram needs an uploaded thumbnail. */
  posterUrl: string | null;
  label: string;
};

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
  /(?:youtu\.be\/)([\w-]{6,})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
];

const INSTAGRAM_PATTERN = /instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/i;

/**
 * Works out what a testimonial link points at, and whether a poster image can
 * be derived from it. YouTube exposes predictable thumbnail URLs; Instagram
 * does not, so reels fall back to an uploaded image or a branded placeholder.
 */
export function parseVideoUrl(url: string | null | undefined): ParsedVideo {
  if (!url) return { platform: "other", id: null, posterUrl: null, label: "Video" };

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return {
        platform: "youtube",
        id: match[1],
        // hqdefault exists for every video; maxresdefault often 404s.
        posterUrl: `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`,
        label: "Watch on YouTube",
      };
    }
  }

  const instagram = url.match(INSTAGRAM_PATTERN);
  if (instagram) {
    return {
      platform: "instagram",
      id: instagram[1],
      posterUrl: null,
      label: "Watch on Instagram",
    };
  }

  return { platform: "other", id: null, posterUrl: null, label: "Watch video" };
}

/** Poster to render: an uploaded image wins, then anything derivable. */
export function posterFor(
  url: string | null | undefined,
  uploaded: string | null | undefined,
): { src: string | null; parsed: ParsedVideo } {
  const parsed = parseVideoUrl(url);
  return { src: uploaded || parsed.posterUrl, parsed };
}
