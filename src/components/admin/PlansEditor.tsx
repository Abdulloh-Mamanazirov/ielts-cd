"use client";

import { useState, useTransition } from "react";

import { updatePlans } from "@/app/admin/actions";
import { PLAN_ORDER, type PlanConfig, type PlansConfig, type SeriesAccess } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Editor for the three plans: what they cost, what they promise, which material
 * they open and how many full mocks they allow.
 *
 * The whole configuration is saved in one go, so a half-finished edit never
 * reaches the pricing page.
 */
export function PlansEditor({
  initial,
  seriesNumbers,
}: {
  initial: PlansConfig;
  /** Which volumes and books actually exist, so access can be ticked off. */
  seriesNumbers: { REAL_EXAM: number[]; CAMBRIDGE: number[] };
}) {
  const [plans, setPlans] = useState<PlansConfig>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const patch = (plan: keyof PlansConfig, next: Partial<PlanConfig>) =>
    setPlans((current) => ({ ...current, [plan]: { ...current[plan], ...next } }));

  const save = () =>
    start(async () => {
      setMessage(null);
      setError(null);
      const result = await updatePlans(plans);
      if (result.ok) setMessage(result.message);
      else setError(result.error);
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const plan = plans[key];

          return (
            <section
              key={key}
              className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)]"
            >
              <p className="text-[10px] font-bold tracking-[0.22em] text-brand-blue">{key}</p>

              <Field label="Name">
                <input
                  value={plan.label}
                  onChange={(event) => patch(key, { label: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Tagline">
                <input
                  value={plan.tagline}
                  onChange={(event) => patch(key, { tagline: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price">
                  <input
                    value={plan.price}
                    onChange={(event) => patch(key, { price: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Period">
                  <input
                    value={plan.period}
                    onChange={(event) => patch(key, { period: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Benefits — one per line">
                <textarea
                  rows={6}
                  value={plan.benefits.join("\n")}
                  onChange={(event) =>
                    patch(key, {
                      benefits: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                    })
                  }
                  className={cn(inputClass, "resize-y leading-relaxed")}
                />
              </Field>

              <Field label="Full mocks — blank for unlimited">
                <input
                  type="number"
                  min={0}
                  value={plan.fullMocks ?? ""}
                  onChange={(event) =>
                    patch(key, {
                      fullMocks: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                  className={inputClass}
                />
              </Field>

              <AccessPicker
                label="Real Exam volumes"
                available={seriesNumbers.REAL_EXAM}
                value={plan.access.REAL_EXAM}
                onChange={(access) =>
                  patch(key, { access: { ...plan.access, REAL_EXAM: access } })
                }
              />

              <AccessPicker
                label="Cambridge books"
                available={seriesNumbers.CAMBRIDGE}
                value={plan.access.CAMBRIDGE}
                onChange={(access) =>
                  patch(key, { access: { ...plan.access, CAMBRIDGE: access } })
                }
              />

              <div className="mt-1 flex flex-wrap gap-4">
                <Toggle
                  checked={plan.featured}
                  onChange={(featured) => patch(key, { featured })}
                  label="Highlight on pricing page"
                />
                <Toggle
                  checked={plan.inviteOnly}
                  onChange={(inviteOnly) => patch(key, { inviteOnly })}
                  label="Hide from public pricing"
                />
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[10px] bg-ink px-6 py-3 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save all plans"}
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

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

/** All, none, or a ticked list of the numbers that actually exist. */
function AccessPicker({
  label,
  available,
  value,
  onChange,
}: {
  label: string;
  available: number[];
  value: SeriesAccess;
  onChange: (access: SeriesAccess) => void;
}) {
  const chosen = value.kind === "some" ? value.numbers : [];

  const toggle = (number: number) => {
    const next = chosen.includes(number)
      ? chosen.filter((entry) => entry !== number)
      : [...chosen, number].sort((a, b) => a - b);
    onChange({ kind: "some", numbers: next });
  };

  return (
    <div>
      <span className="mb-1 block text-[11px] font-bold text-ink-subtle">{label}</span>
      <div className="flex gap-1.5">
        {(["all", "none", "some"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() =>
              onChange(kind === "some" ? { kind: "some", numbers: chosen } : { kind })
            }
            className={cn(
              "rounded-[7px] px-2.5 py-1 text-[11px] font-bold transition",
              value.kind === kind ? "bg-ink text-white" : "bg-surface-alt text-ink-muted",
            )}
          >
            {kind === "all" ? "All" : kind === "none" ? "None" : "Choose"}
          </button>
        ))}
      </div>

      {value.kind === "some" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.length === 0 && (
            <span className="text-[11px] text-ink-subtle">None imported yet.</span>
          )}
          {available.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => toggle(number)}
              className={cn(
                "h-7 min-w-[28px] rounded-[6px] px-1.5 text-[11px] font-bold transition",
                chosen.includes(number)
                  ? "bg-brand-blue text-white"
                  : "bg-surface-alt text-ink-muted hover:bg-ink/10",
              )}
            >
              {number}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
