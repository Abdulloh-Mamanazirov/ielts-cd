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
  const normalized = normalizeAnswer(submitted);
  if (!normalized) return false;
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalized);
}
