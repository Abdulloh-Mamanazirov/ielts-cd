/**
 * Answer comparison. Both the student's input and the accepted answers pass
 * through the same normalizer, so the key can be authored naturally.
 */

const LEADING_ARTICLE = /^(?:a|an|the)\s+/;

export function normalizeAnswer(raw: string): string {
  return (
    raw
      .normalize("NFKC")
      // Smart quotes and dashes vary by keyboard and by source PDF.
      .replace(/[‘’‛′`]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐-―−]/g, "-")
      .toLowerCase()
      // Hyphenated compounds are marked correct either way ("cow-dung" = "cow dung").
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^["'([]+/, "")
      .replace(/["')\].,;:!?]+$/, "")
      .trim()
      // Examiners accept a leading article on an otherwise correct answer, and
      // omitting one the key includes. Stripping it on both sides is the only
      // way to make those equivalent without listing every permutation.
      .replace(LEADING_ARTICLE, "")
      .trim()
  );
}

/**
 * The same answer with the grouping taken out of a number or a code, or null
 * when it is neither.
 *
 * Answer keys print long numbers the way the exam booklet does — a phone number
 * as "87954 82361", a postcode as "DW30 7YZ" — but that grouping is typography,
 * not part of the answer. A student who types the digits straight through has
 * written the same thing, and an examiner marks it right.
 *
 * The rule fires only when every part contains a digit, which is the shape of a
 * number or a code and never of an ordinary two-word answer. That is what keeps
 * "10 September", "3 weeks" and "factor 40" comparing as the two words they are.
 */
function ungrouped(normalized: string): string | null {
  if (!normalized.includes(" ")) return null;
  const parts = normalized.split(" ");
  if (!parts.every((part) => /\d/.test(part))) return null;
  return parts.join("");
}

/** Every spelling one answer can be compared under. */
function comparableForms(raw: string): string[] {
  const normalized = normalizeAnswer(raw);
  const joined = ungrouped(normalized);
  return joined ? [normalized, joined] : [normalized];
}

/**
 * Whether a student's answer and an accepted one are the same answer.
 *
 * Compared in both directions so it does not matter which side the key happened
 * to write in groups.
 */
export function answersMatch(submitted: string, candidate: string): boolean {
  const mine = comparableForms(submitted);
  const theirs = comparableForms(candidate);
  return mine.some((form) => form !== "" && theirs.includes(form));
}

/** Words a student wrote, for enforcing rubric limits like "ONE WORD ONLY". */
export function countWords(raw: string): number {
  const cleaned = raw.trim();
  if (!cleaned) return 0;
  // Hyphenated compounds count as one word, matching IELTS marking guidance.
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function isBlank(raw: string | null | undefined): boolean {
  return !raw || raw.trim().length === 0;
}

export function matchesAnyAccepted(submitted: string, accepted: readonly string[]): boolean {
  if (!normalizeAnswer(submitted)) return false;
  return accepted.some((candidate) => answersMatch(submitted, candidate));
}
