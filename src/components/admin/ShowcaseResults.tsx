"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteShowcaseResult,
  moveShowcaseResult,
  saveShowcaseResult,
} from "@/app/admin/actions";
import { EmptyState } from "./AdminPage";
import {
  BandSelect,
  Checkbox,
  Field,
  FormShell,
  ImageField,
  RowActions,
  TextArea,
  TextInput,
} from "./ShowcaseFields";

export type ShowcaseRow = {
  id: string;
  studentName: string;
  overallBand: number;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  quoteEn: string | null;
  quoteUz: string | null;
  quoteRu: string | null;
  certificateUrl: string | null;
  /** Already formatted as yyyy-mm-dd so it drops into a date input. */
  testDate: string | null;
  isVisible: boolean;
};

type Draft = {
  studentName: string;
  overallBand: string;
  listening: string;
  reading: string;
  writing: string;
  speaking: string;
  quoteEn: string;
  quoteUz: string;
  quoteRu: string;
  certificateUrl: string;
  testDate: string;
  isVisible: boolean;
};

const BLANK: Draft = {
  studentName: "",
  overallBand: "7.0",
  listening: "",
  reading: "",
  writing: "",
  speaking: "",
  quoteEn: "",
  quoteUz: "",
  quoteRu: "",
  certificateUrl: "",
  testDate: "",
  isVisible: true,
};

const band = (value: number | null) => (value === null ? "" : value.toFixed(1));

function draftOf(row: ShowcaseRow): Draft {
  return {
    studentName: row.studentName,
    overallBand: row.overallBand.toFixed(1),
    listening: band(row.listening),
    reading: band(row.reading),
    writing: band(row.writing),
    speaking: band(row.speaking),
    quoteEn: row.quoteEn ?? "",
    quoteUz: row.quoteUz ?? "",
    quoteRu: row.quoteRu ?? "",
    certificateUrl: row.certificateUrl ?? "",
    testDate: row.testDate ?? "",
    isVisible: row.isVisible,
  };
}

function payloadOf(draft: Draft, id?: string) {
  const optional = (value: string) => (value ? Number(value) : null);

  return {
    ...(id ? { id } : {}),
    studentName: draft.studentName.trim(),
    overallBand: Number(draft.overallBand),
    listening: optional(draft.listening),
    reading: optional(draft.reading),
    writing: optional(draft.writing),
    speaking: optional(draft.speaking),
    quoteEn: draft.quoteEn,
    quoteUz: draft.quoteUz,
    quoteRu: draft.quoteRu,
    // The empty string is not a path, and the field is validated as one.
    certificateUrl: draft.certificateUrl || null,
    testDate: draft.testDate,
    isVisible: draft.isVisible,
  };
}

/**
 * The bands on the home page and on /results.
 *
 * These are marketing rows typed by the instructor, not attempts pulled from
 * the database — the students who sat the real exam mostly did not sit it here.
 */
export function ShowcaseResults({ rows }: { rows: ShowcaseRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const openNew = () => {
    setDraft(BLANK);
    setError(null);
    setOpen("new");
  };

  const openRow = (row: ShowcaseRow) => {
    setDraft(draftOf(row));
    setError(null);
    setOpen(row.id);
  };

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

  const form = (title: string, id?: string) => (
    <FormShell
      title={title}
      saving={pending}
      error={error}
      onCancel={() => setOpen(null)}
      onSave={() => run(() => saveShowcaseResult(payloadOf(draft, id)), true)}
    >
      <Field label="Student name">
        <TextInput
          value={draft.studentName}
          onChange={(event) => set("studentName", event.target.value)}
          placeholder="Malika A."
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Overall band">
          <BandSelect
            value={draft.overallBand}
            onChange={(value) => set("overallBand", value)}
            allowBlank={false}
          />
        </Field>
        <Field label="Test date" hint="Only the year is shown publicly.">
          <TextInput
            type="date"
            value={draft.testDate}
            onChange={(event) => set("testDate", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:col-span-2">
        {(["listening", "reading", "writing", "speaking"] as const).map((skill) => (
          <Field key={skill} label={skill}>
            <BandSelect value={draft[skill]} onChange={(value) => set(skill, value)} />
          </Field>
        ))}
      </div>

      <Field label="Quote (English)" className="sm:col-span-2">
        <TextArea
          rows={2}
          value={draft.quoteEn}
          onChange={(event) => set("quoteEn", event.target.value)}
          placeholder="What this student said about the course."
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
        <ImageField
          label="Certificate scan"
          slug={draft.studentName || "certificate"}
          value={draft.certificateUrl}
          onChange={(url) => set("certificateUrl", url)}
          warning={
            <>
              <strong>Cover the personal details first.</strong> A Test Report Form carries the
              candidate&rsquo;s full name, date of birth, candidate number, ID number and
              nationality. This image is published on a public page — black those out before
              uploading. The bands and the date are all anyone needs to see.
            </>
          }
          hint="PNG, JPEG, WebP or GIF, up to 8 MB."
        />
      </div>

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
          Student results{" "}
          <span className="font-sans text-[13px] font-semibold text-ink-subtle">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </span>
        </h2>
        {open !== "new" && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-brand-red-cta px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-red-dark"
          >
            Add a result
          </button>
        )}
      </div>

      {open === "new" && <div className="mb-3">{form("New result")}</div>}

      {rows.length === 0 && open !== "new" ? (
        <EmptyState>No results yet. Add one and it appears on the home page.</EmptyState>
      ) : (
        <ul className="space-y-px">
          {rows.map((row) => (
            <li key={row.id}>
              {open === row.id ? (
                form(`Editing ${row.studentName}`, row.id)
              ) : (
                <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3">
                  {row.certificateUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.certificateUrl}
                      alt=""
                      className="h-10 w-8 flex-none rounded bg-surface-alt object-cover object-top"
                    />
                  ) : (
                    <span className="h-10 w-8 flex-none rounded bg-surface-alt" aria-hidden />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {row.studentName}
                      <span className="ml-2 font-display text-brand-red">
                        {row.overallBand.toFixed(1)}
                      </span>
                    </p>
                    <p className="truncate text-[12px] text-ink-subtle">
                      {(["listening", "reading", "writing", "speaking"] as const)
                        .map((skill) =>
                          row[skill] === null
                            ? null
                            : `${skill[0].toUpperCase()} ${row[skill]!.toFixed(1)}`,
                        )
                        .filter(Boolean)
                        .join(" · ") || "No skill bands"}
                      {row.testDate && ` · ${row.testDate.slice(0, 4)}`}
                    </p>
                  </div>

                  <RowActions
                    busy={pending}
                    hidden={!row.isVisible}
                    onUp={() => run(() => moveShowcaseResult(row.id, -1))}
                    onDown={() => run(() => moveShowcaseResult(row.id, 1))}
                    onEdit={() => openRow(row)}
                    onDelete={() => run(() => deleteShowcaseResult(row.id))}
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
