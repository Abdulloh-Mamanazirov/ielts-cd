/**
 * Raw score to band conversion, Academic module.
 *
 * These are the indicative tables Cambridge publishes with its practice
 * material. Official conversion varies slightly between live test versions, so
 * every band we show a student is labelled as an estimate.
 */

type BandRow = { min: number; band: number };

const LISTENING_TABLE: BandRow[] = [
  { min: 39, band: 9 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8 },
  { min: 32, band: 7.5 },
  { min: 30, band: 7 },
  { min: 26, band: 6.5 },
  { min: 23, band: 6 },
  { min: 18, band: 5.5 },
  { min: 16, band: 5 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3 },
  { min: 4, band: 2.5 },
  { min: 3, band: 2 },
  { min: 2, band: 1.5 },
  { min: 1, band: 1 },
  { min: 0, band: 0 },
];

const ACADEMIC_READING_TABLE: BandRow[] = [
  { min: 39, band: 9 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8 },
  { min: 33, band: 7.5 },
  { min: 30, band: 7 },
  { min: 27, band: 6.5 },
  { min: 23, band: 6 },
  { min: 19, band: 5.5 },
  { min: 15, band: 5 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3 },
  { min: 4, band: 2.5 },
  { min: 3, band: 2 },
  { min: 2, band: 1.5 },
  { min: 1, band: 1 },
  { min: 0, band: 0 },
];

export const FULL_TEST_QUESTIONS = 40;

export type GradedSkill = "listening" | "reading";

/**
 * Band for a raw score. `totalQuestions` below 40 means a partial test (a
 * single reading passage, say); the score is scaled to a 40-question
 * equivalent first, which makes the result a rough indicator rather than a
 * band. Callers surface that distinction via `isEstimate`.
 */
export function bandForRawScore(
  skill: GradedSkill,
  rawScore: number,
  totalQuestions: number = FULL_TEST_QUESTIONS,
): { band: number; scaledScore: number; isEstimate: boolean } {
  const table = skill === "listening" ? LISTENING_TABLE : ACADEMIC_READING_TABLE;
  const clamped = Math.max(0, Math.min(rawScore, totalQuestions));
  const isPartial = totalQuestions !== FULL_TEST_QUESTIONS;

  const scaledScore = isPartial
    ? Math.round((clamped / totalQuestions) * FULL_TEST_QUESTIONS)
    : clamped;

  const row = table.find((entry) => scaledScore >= entry.min);
  return { band: row?.band ?? 0, scaledScore, isEstimate: isPartial };
}

/**
 * Official IELTS overall rounding: average the skill bands, then round to the
 * nearest half band, with an exact .25 going up to the next half and an exact
 * .75 up to the next whole. Round-half-up on the doubled value does all three.
 */
export function overallBand(bands: number[]): number | null {
  const scored = bands.filter((band) => Number.isFinite(band));
  if (scored.length === 0) return null;

  const mean = scored.reduce((sum, band) => sum + band, 0) / scored.length;
  return Math.round(mean * 2) / 2;
}

export function formatBand(band: number): string {
  return band.toFixed(1);
}
