"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveMockEvent } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export type EventTestOption = {
  id: string;
  title: string;
  /** Reserved for events: shown first, since that is what an event is usually made of. */
  eventOnly: boolean;
  /** Listening only: without audio the test cannot be sat. */
  hasAudio: boolean;
};

export type EventDraft = {
  id?: string;
  title: string;
  description: string;
  listeningTestId: string;
  readingTestId: string;
  writingTestId: string;
  /** yyyy-mm-ddThh:mm, what a datetime-local input reads and writes. */
  closesAt: string;
  maxParticipants: number | null;
};

/**
 * Create or edit an event. The three pickers list published tests of the
 * right skill; a listening test with no audio is shown but cannot be chosen.
 * Once someone has joined, the tests are shown but fixed.
 */
export function EventForm({
  initial,
  tests,
  locked = false,
}: {
  initial: EventDraft;
  tests: { LISTENING: EventTestOption[]; READING: EventTestOption[]; WRITING: EventTestOption[] };
  /** True once a participant exists: the paper can no longer change. */
  locked?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = () =>
    start(async () => {
      setError(null);
      setMessage(null);
      const result = await saveMockEvent(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!draft.id && "id" in result) {
        router.push(`/admin/events/${result.id}`);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
        <Field label="Name — what the students see">
          <input
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="e.g. September Mock Test"
            className={inputClass}
          />
        </Field>

        <Field label="Description — optional, shown on the join page">
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
            className={cn(inputClass, "resize-y leading-relaxed")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Closes — optional; you can also close it by hand">
            <input
              type="datetime-local"
              value={draft.closesAt}
              onChange={(event) => set("closesAt", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Maximum participants — blank for no limit">
            <input
              type="number"
              min={1}
              value={draft.maxParticipants ?? ""}
              onChange={(event) =>
                set("maxParticipants", event.target.value === "" ? null : Number(event.target.value))
              }
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
        <div>
          <h2 className="text-sm font-bold text-ink">The paper</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {locked
              ? "Someone has joined, so the paper is fixed."
              : "One test per section, sat in this order. Tests reserved for events are listed first."}
          </p>
        </div>

        <TestPicker
          label="Listening"
          options={tests.LISTENING}
          value={draft.listeningTestId}
          onChange={(id) => set("listeningTestId", id)}
          disabled={locked}
          needsAudio
        />
        <TestPicker
          label="Reading"
          options={tests.READING}
          value={draft.readingTestId}
          onChange={(id) => set("readingTestId", id)}
          disabled={locked}
        />
        <TestPicker
          label="Writing"
          options={tests.WRITING}
          value={draft.writingTestId}
          onChange={(id) => set("writingTestId", id)}
          disabled={locked}
        />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[10px] bg-ink px-6 py-3 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : draft.id ? "Save changes" : "Create event"}
        </button>
        {message && <p className="text-[13px] font-bold text-ok">{message}</p>}
        {error && <p className="text-[13px] font-bold text-bad">{error}</p>}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[9px] bg-surface-alt px-3 py-2 text-[13px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_#0154f8]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}

function TestPicker({
  label,
  options,
  value,
  onChange,
  disabled,
  needsAudio = false,
}: {
  label: string;
  options: EventTestOption[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  needsAudio?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(inputClass, "disabled:opacity-70")}
      >
        <option value="">— choose —</option>
        {options.map((test) => {
          const unsittable = needsAudio && !test.hasAudio;
          return (
            <option key={test.id} value={test.id} disabled={unsittable}>
              {test.eventOnly ? "★ " : ""}
              {test.title}
              {unsittable ? " (no audio yet)" : ""}
            </option>
          );
        })}
      </select>
    </Field>
  );
}
