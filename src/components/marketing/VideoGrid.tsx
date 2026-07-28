import { VideoCard, type VideoTestimonial } from "./VideoCard";
import { parseVideoUrl } from "@/lib/media/video";

/**
 * YouTube is landscape and Instagram reels are portrait, so mixing them in one
 * grid gives every row a different height. Splitting them into a row each keeps
 * the aspect ratio uniform within each row.
 */
export function VideoGrid({ videos }: { videos: VideoTestimonial[] }) {
  const youtube = videos.filter((item) => parseVideoUrl(item.mediaUrl).platform === "youtube");
  const reels = videos.filter((item) => parseVideoUrl(item.mediaUrl).platform === "instagram");
  const other = videos.filter(
    (item) => !youtube.includes(item) && !reels.includes(item),
  );

  return (
    <div className="space-y-8">
      {youtube.length + other.length > 0 && (
        <Row
          label="Video interviews"
          accent="red"
          items={[...youtube, ...other]}
          aspect="aspect-video"
          columns="sm:grid-cols-2 lg:grid-cols-3"
        />
      )}

      {reels.length > 0 && (
        <Row
          label="Reels"
          accent="blue"
          items={reels}
          // Reel covers are 9:16; 3:4 keeps the row from towering while still
          // reading as portrait, and object-cover handles the difference.
          aspect="aspect-[3/4]"
          columns="grid-cols-2 lg:grid-cols-4"
        />
      )}
    </div>
  );
}

function Row({
  label,
  accent,
  items,
  aspect,
  columns,
}: {
  label: string;
  accent: "red" | "blue";
  items: VideoTestimonial[];
  aspect: string;
  columns: string;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`text-[10px] font-bold tracking-[0.22em] ${
            accent === "red" ? "text-brand-red-cta" : "text-brand-blue"
          }`}
        >
          {label.toUpperCase()}
        </span>
        <span aria-hidden className="h-px flex-1 bg-ink-faint" />
      </div>

      <ul className={`grid gap-5 ${columns}`}>
        {items.map((item) => (
          <li key={item.id}>
            <VideoCard item={item} aspect={aspect} />
          </li>
        ))}
      </ul>
    </div>
  );
}
