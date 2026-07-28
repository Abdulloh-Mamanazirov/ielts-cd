import type { Skill } from "@/generated/prisma/enums";

/**
 * How a full mock chooses its tests. Deliberately free of any database import
 * so the rules can be tested directly — they are the part most likely to be
 * argued with later.
 */

/** Exam order. Speaking is last because it is optional and separately timed. */
export const FULL_MOCK_ORDER: Skill[] = ["LISTENING", "READING", "WRITING", "SPEAKING"];

export type Candidate = {
  id: string;
  skill: Skill;
  totalQuestions: number;
  durationSeconds: number;
};

/**
 * Whether a test is a whole exam section rather than a shortened practice.
 *
 * This matters more than it looks: the library holds a 13-question reading
 * passage and a single-task writing practice, both excellent for drilling and
 * both wrong inside a mock. A "full mock" whose reading section is 20 minutes
 * long reports a band the student cannot reproduce on the day.
 *
 * Graded skills are judged on question count, which is exact. Writing and
 * speaking have no questions, so length is the only signal available.
 */
export function isExamLength(test: Candidate): boolean {
  if (test.skill === "LISTENING" || test.skill === "READING") return test.totalQuestions >= 40;
  if (test.skill === "WRITING") return test.durationSeconds >= 3000;
  return test.durationSeconds >= 600;
}

/**
 * Picks one test for a skill, in priority order:
 *
 *   1. a full-length section the student has not sat
 *   2. the full-length section they sat longest ago
 *   3. any unsat test, if the library has no full-length one for this skill
 *   4. whatever they sat longest ago
 *
 * Repeating a test inflates the band and teaches nothing, so freshness beats
 * everything except section length.
 */
export function chooseForSkill(
  pool: Candidate[],
  lastSat: Map<string, number>,
  random: () => number = Math.random,
): Candidate | null {
  if (pool.length === 0) return null;

  const fullLength = pool.filter(isExamLength);
  const tier = fullLength.length > 0 ? fullLength : pool;

  const unseen = tier.filter((test) => !lastSat.has(test.id));
  if (unseen.length > 0) return unseen[Math.floor(random() * unseen.length)];

  return [...tier].sort((a, b) => (lastSat.get(a.id) ?? 0) - (lastSat.get(b.id) ?? 0))[0];
}
