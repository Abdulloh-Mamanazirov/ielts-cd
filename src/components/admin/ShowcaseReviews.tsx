"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteTestimonial, moveTestimonial, saveTestimonial } from "@/app/admin/actions";
import { parseVideoUrl } from "@/lib/media/video";
import { EmptyState } from "./AdminPage";
import {
  Checkbox,
  Field,
  FormShell,
  ImageField,
  RowActions,
  Select,
  TextArea,
  TextInput,
} from "./ShowcaseFields";

export type ReviewRow = {
  id: string;
  studentName: string;
  rating: number;
  mediaType: "TEXT" | "YOUTUBE" | "INSTAGRAM";
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  quoteEn: string | null;
  quoteUz: string | null;
  quoteRu: string | null;
  isVisible: boolean;
};

type Draft = {
  studentName: string;
  rating: string;
  mediaType: "TEXT" | "YOUTUBE" | "INSTAGRAM";
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  quoteEn: string;
  quoteUz: string;
  quoteRu: string;
  isVisible: boolean;
};

const BLANK: Draft = {
  studentName: "",
  rating: "5",
  mediaType: "TEXT",
  mediaUrl: "",
  thumbnailUrl: "",
  caption: "",
  quoteEn: "",
  quoteUz: "",
  quoteRu: "",
  isVisible: true,
};

function draftOf(row: ReviewRow): Draft {
  return {
    studentName: row.studentName,
    rating: String(row.rating),
    mediaType: row.mediaType,
    mediaUrl: row.mediaUrl ?? "",
    thumbnailUrl: row.thumbnailUrl ?? "",
    caption: row.caption ?? "",
    quoteEn: row.quoteEn ?? "",
    quoteUz: row.quoteUz ?? "",
    quoteRu: row.quoteRu ?? "",
    isVisible: row.isVisible,
  };
}

function payloadOf(draft: Draft, id?: string) {
  return {
    ...(id ? { id } : {}),
    studentName: draft.studentName.trim(),
    rating: Number(draft.rating),
    mediaType: draft.mediaType,
    mediaUrl: draft.mediaUrl.trim(),
    thumbnailUrl: draft.thumbnailUrl || null,
    caption: draft.caption,
    quoteEn: draft.quoteEn,
    quoteUz: draft.quoteUz,
    quoteRu: draft.quoteRu,
    isVisible: draft.isVisible,
  };
}

/** Written and video reviews, in one list because they share a display order. */
export function ShowcaseReviews({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, close = false) => {
    setError(null);
    startTransition(async () => {
      const outcome = await work();
      if (!outcome.ok) {
        setError(outcome.error ?? "Something went wrong.");
        return;
      }
      if (close) setOpen(null);
      router.refresh();
    });
  };

  const isVideo = draft.mediaType !== "TEXT";
  // YouTube exposes a predictable poster; Instagram blocks hotlinking and its
  // oEmbed needs a token, so a reel needs one uploaded here or it renders bare.
  const derivesPoster = parseVideoUrl(draft.mediaUrl).posterUrl !== null;

  const form = (title: string, id?: string) => (
    <FormShell
      title={title}
      saving={pending}
      error={error}
      onCancel={() => setOpen(null)}
      onSave={() => run(() => saveTestimonial(payloadOf(draft, id)), true)}
    >
      <Field label="Student name">
        <TextInput
          value={draft.studentName}
          onChange={(event) => set("studentName", event.target.value)}
          placeholder="Shakhzoda"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind">
          <Select
            value={draft.mediaType}
            onChange={(event) => set("mediaType", event.target.value as Draft["mediaType"])}
          >
            <option value="TEXT">Written</option>
            <option value="YOUTUBE">YouTube video</option>
            <option value="INSTAGRAM">Instagram reel</option>
          </Select>
        </Field>
        <Field label="Stars">
          <Select value={draft.rating} onChange={(event) => set("rating", event.target.value)}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {"★".repeat(value)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isVideo && (
        <>
          <Field
            label="Video link"
            className="sm:col-span-2"
            hint={
              draft.mediaUrl && !derivesPoster
                ? "No poster can be derived from this link — upload one below."
                : "Paste the link to the video itself, not to a profile."
            }
          >
            <TextInput
              type="url"
              value={draft.mediaUrl}
              onChange={(event) => set("mediaUrl", event.target.value)}
              placeholder="https://www.instagram.com/reel/…"
            />
          </Field>

          <Field label="Caption" className="sm:col-span-2">
            <TextInput
              value={draft.caption}
              onChange={(event) => set("caption", event.target.value)}
              placeholder="From 6.0 to 7.5 in three months"
            />
          </Field>

          <div className="sm:col-span-2">
            <ImageField
              label="Poster image"
              slug={draft.studentName || "review"}
              value={draft.thumbnailUrl}
              onChange={(url) => set("thumbnailUrl", url)}
              hint={
                derivesPoster
                  ? "Optional — YouTube supplies one. Upload to override it."
                  : "Instagram will not give us a poster, so upload a still from the reel."
              }
            />
          </div>
        </>
      )}

      <Field
        label={isVideo ? "Quote (English), optional" : "Quote (English)"}
        className="sm:col-span-2"
      >
        <TextArea
          rows={3}
          value={draft.quoteEn}
          onChange={(event) => set("quoteEn", event.target.value)}
          placeholder="I went from 6.0 to 8.0 in three months."
        />
      </Field>

      <Field label="Quote (O‘zbekcha)" hint="Optional — falls back to English.">
        <TextArea
          rows={2}
          value={draft.quoteUz}
          onChange={(event) => set("quoteUz", event.target.value)}
        />
      </Field>

      <Field label="Quote (Русский)" hint="Optional — falls back to English.">
        <TextArea
          rows={2}
          value={draft.quoteRu}
          onChange={(event) => set("quoteRu", event.target.value)}
        />
      </Field>

      <div className="sm:col-span-2">
        <Checkbox
          label="Show on the home page and results page"
          checked={draft.isVisible}
          onChange={(value) => set("isVisible", value)}
        />
      </div>
    </FormShell>
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[17px] tracking-[-0.02em] text-ink">
          Reviews{" "}
          <span className="font-sans text-[13px] font-semibold text-ink-subtle">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </span>
        </h2>
        {open !== "new" && (
          <button
            type="button"
            onClick={() => {
              setDraft(BLANK);
              setError(null);
              setOpen("new");
            }}
            className="rounded-lg bg-brand-red-cta px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-red-dark"
          >
            Add a review
          </button>
        )}
      </div>

      {open === "new" && <div className="mb-3">{form("New review")}</div>}

      {rows.length === 0 && open !== "new" ? (
        <EmptyState>No reviews yet.</EmptyState>
      ) : (
        <ul className="space-y-px">
          {rows.map((row) => (
            <li key={row.id}>
              {open === row.id ? (
                form(`Editing ${row.studentName}`, row.id)
              ) : (
                <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3">
                  <span className="w-[74px] flex-none rounded bg-surface-alt px-2 py-1 text-center text-[10px] font-bold tracking-[0.08em] text-ink-subtle">
                    {row.mediaType === "TEXT" ? "WRITTEN" : row.mediaType}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {row.studentName}
                      <span className="ml-2 text-[12px] text-brand-red">
                        {"★".repeat(row.rating)}
                      </span>
                    </p>
                    <p className="truncate text-[12px] text-ink-subtle">
                      {row.quoteEn || row.caption || row.mediaUrl || "No text"}
                    </p>
                  </div>

                  <RowActions
                    busy={pending}
                    hidden={!row.isVisible}
                    onUp={() => run(() => moveTestimonial(row.id, -1))}
                    onDown={() => run(() => moveTestimonial(row.id, 1))}
                    onEdit={() => {
                      setDraft(draftOf(row));
                      setError(null);
                      setOpen(row.id);
                    }}
                    onDelete={() => run(() => deleteTestimonial(row.id))}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && open === null && (
        <p role="alert" className="mt-3 text-sm font-semibold text-brand-red-cta">
          {error}
        </p>
      )}
    </section>
  );
}
