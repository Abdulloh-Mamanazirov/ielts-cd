"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setTestImage } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Attaches a chart, map or process diagram after import.
 *
 * Kept out of the JSON on purpose: a model reading a PDF cannot produce the
 * picture, and asking an instructor to hand-edit a URL into a blob of JSON is
 * how a Task 1 ends up with nothing to describe.
 */
export function TestImageUpload({
  testId,
  target,
  label,
  currentUrl,
  slug,
}: {
  testId: string;
  /** Writing task number, or a question group id. */
  target: number | string;
  label: string;
  currentUrl?: string;
  slug: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("slug", slug);

      const response = await fetch("/api/admin/images", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "Upload failed.");
        return;
      }

      startTransition(async () => {
        const outcome = await setTestImage({ testId, target, url: data.url });
        if (outcome.ok) router.refresh();
        else setError(outcome.error);
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || pending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => choose(event.target.files?.[0])}
        className="hidden"
      />

      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt=""
          className="h-9 w-14 flex-none rounded bg-surface-alt object-contain"
        />
      ) : (
        <span className="text-[11px] font-bold tracking-[0.08em] text-brand-red-cta">
          NO IMAGE
        </span>
      )}

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn(
          "rounded-[9px] px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-60",
          currentUrl
            ? "bg-surface-alt text-ink-muted hover:bg-ink hover:text-white"
            : "bg-ink text-white hover:bg-ink/85",
        )}
      >
        {busy ? "Uploading…" : currentUrl ? `Replace ${label}` : `Add ${label} image`}
      </button>

      {error && <p className="w-full text-xs font-semibold text-brand-red-cta">{error}</p>}
    </div>
  );
}
