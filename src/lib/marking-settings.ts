import type { Plan } from "@/generated/prisma/enums";

/**
 * Who may send a writing or speaking answer to the instructor for a band.
 *
 * Marking is the instructor's own time, so it is opened plan by plan from the
 * admin panel rather than to everyone at once. Off everywhere by default: the
 * queue only ever fills with work he has decided to take on.
 *
 * A mock event is the exception and is not a setting. Its essays are marked
 * regardless of the student's plan — that is what the event is for — which is
 * decided in `canRequestReview`, not here.
 */

export type MarkingSettings = Record<Plan, boolean>;

export const DEFAULT_MARKING_SETTINGS: MarkingSettings = {
  FREE: false,
  STUDENT: false,
  PREMIUM: false,
};

/** A stored setting merged over the defaults; anything not a boolean is absent. */
export function mergeMarkingSettings(stored: unknown): MarkingSettings {
  if (!stored || typeof stored !== "object") return DEFAULT_MARKING_SETTINGS;
  const source = stored as Partial<Record<Plan, unknown>>;
  const out = { ...DEFAULT_MARKING_SETTINGS };
  for (const plan of Object.keys(out) as Plan[]) {
    if (typeof source[plan] === "boolean") out[plan] = source[plan] as boolean;
  }
  return out;
}

/**
 * Whether this attempt may go to the marking queue.
 *
 * Event essays always may. Otherwise it is the student's plan that decides,
 * and an admin can always mark their own practice.
 */
export function canRequestReview(
  settings: MarkingSettings,
  user: { role: string },
  plan: Plan,
  inEvent: boolean,
): boolean {
  if (inEvent) return true;
  if (user.role === "ADMIN") return true;
  return settings[plan];
}
