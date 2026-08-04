"use client";

import { useState, useTransition } from "react";

import { updateStudentPlan, updateStudentProfile } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export type StudentRowData = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  telegramUsername: string | null;
  isStudent: boolean;
  plan: "FREE" | "STUDENT" | "PREMIUM";
  planExpiresAt: string | null;
  unlimitedMocks: boolean;
  attempts: number;
  mocks: number;
  joined: string;
  lastSeen: string | null;
};

const PLAN_TINT: Record<StudentRowData["plan"], string> = {
  FREE: "bg-surface-alt text-ink-subtle",
  STUDENT: "bg-brand-blue-soft text-brand-blue",
  PREMIUM: "bg-ok-soft text-ok",
};

/**
 * One student, with everything the instructor edits about them behind a single
 * "Edit" toggle: who they are, whether they study with him, their subscription
 * and whether their mock allowance is lifted.
 */
export function StudentRow({ student }: { student: StudentRowData }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(student);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMessage(null);
      setError(null);

      const profile = await updateStudentProfile({
        userId: draft.id,
        fullName: draft.fullName,
        phone: draft.phone ?? "",
        isStudent: draft.isStudent,
      });
      if (!profile.ok) {
        setError(profile.error);
        return;
      }

      const plan = await updateStudentPlan({
        userId: draft.id,
        plan: draft.plan,
        expiresAt: draft.planExpiresAt ?? undefined,
        unlimitedMocks: draft.unlimitedMocks,
      });
      if (!plan.ok) {
        setError(plan.error);
        return;
      }

      setMessage("Saved.");
    });

  // Captured once on mount: reading the clock during render is impure, and a
  // list of students does not need the badge to tick over as you look at it.
  const [now] = useState(() => Date.now());
  const lapsed =
    draft.planExpiresAt !== null &&
    draft.plan !== "FREE" &&
    new Date(draft.planExpiresAt).getTime() < now;

  return (
    <li className="bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-bold text-ink">
            {draft.fullName}
            {draft.isStudent && (
              <span className="rounded-full bg-brand-red-soft px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-brand-red-cta">
                STUDENT
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-subtle">
            {draft.email ?? (draft.telegramUsername ? `@${draft.telegramUsername}` : "Telegram")}
            {draft.phone ? ` · ${draft.phone}` : ""} · joined {draft.joined}
            {draft.lastSeen ? ` · last seen ${draft.lastSeen}` : " · never signed in"}
          </p>
        </div>

        <span className="text-xs tabular-nums text-ink-subtle">
          {draft.attempts} attempt{draft.attempts === 1 ? "" : "s"} · {draft.mocks} mock
          {draft.mocks === 1 ? "" : "s"}
        </span>

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em]",
            lapsed ? "bg-bad-soft text-bad" : PLAN_TINT[draft.plan],
          )}
        >
          {lapsed ? "LAPSED" : draft.plan}
          {draft.unlimitedMocks ? " · ∞" : ""}
        </span>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-[9px] bg-surface-alt px-4 py-2 text-[12px] font-bold text-ink-muted transition hover:bg-ink hover:text-white"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 rounded-xl bg-surface-alt p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Full name">
            <input
              value={draft.fullName}
              onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Phone">
            <input
              value={draft.phone ?? ""}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              placeholder="+998…"
              className={inputClass}
            />
          </Field>

          <Field label="Plan">
            <select
              value={draft.plan}
              onChange={(event) =>
                setDraft({ ...draft, plan: event.target.value as StudentRowData["plan"] })
              }
              className={inputClass}
            >
              <option value="FREE">Free</option>
              <option value="STUDENT">Student</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </Field>

          <Field label="Plan ends — blank for no end">
            <input
              type="date"
              value={draft.planExpiresAt?.slice(0, 10) ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, planExpiresAt: event.target.value || null })
              }
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
            <input
              type="checkbox"
              checked={draft.isStudent}
              onChange={(event) => setDraft({ ...draft, isStudent: event.target.checked })}
              className="h-4 w-4"
            />
            Studies with Davronbek
          </label>

          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
            <input
              type="checkbox"
              checked={draft.unlimitedMocks}
              onChange={(event) => setDraft({ ...draft, unlimitedMocks: event.target.checked })}
              className="h-4 w-4"
            />
            Unlimited full mocks
          </label>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-[9px] bg-ink px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {message && <span className="text-[12px] font-bold text-ok">{message}</span>}
            {error && <span className="text-[12px] font-bold text-bad">{error}</span>}
          </div>
        </div>
      )}
    </li>
  );
}

const inputClass =
  "w-full rounded-[9px] bg-white px-3 py-2 text-[13px] text-ink outline-none focus:shadow-[inset_0_0_0_2px_#0154f8]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}
