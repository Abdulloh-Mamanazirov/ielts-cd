/**
 * Dates written the several ways a candidate might write them.
 *
 * "10 September", "10th September", "September 10", "September 10th" and "the
 * 10th of September" are one answer, and an examiner marks them all right.
 * Answer keys list some of those spellings and not others, unevenly — one key
 * in this library carries four variants, another carries one — so the equality
 * belongs in the comparison rather than in every key.
 *
 * Only a bare month and day is recognised. A bare month ("September"), a date
 * carrying a year ("30 March 1988") and a numeric date ("13/01") are left
 * alone: they are different answers, and a key that wants them says so.
 */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** Full names and the three-letter abbreviations, to the full name. */
const MONTH_BY_NAME = new Map<string, string>();
for (const month of MONTHS) {
  MONTH_BY_NAME.set(month, month);
  MONTH_BY_NAME.set(month.slice(0, 3), month);
}
// The one abbreviation that is not simply the first three letters.
MONTH_BY_NAME.set("sept", "september");

const DAY = /^(\d{1,2})(?:st|nd|rd|th)?$/;

/**
 * A date's canonical form, or null when the answer is not a bare month and day.
 *
 * The prefix keeps a date from comparing equal to an answer that merely reads
 * like one.
 */
export function canonicalDate(normalized: string): string | null {
  if (!normalized) return null;

  // "the" has already gone with the leading article; "of" is what is left of
  // "the 10th of September".
  const tokens = normalized.split(" ").filter((token) => token && token !== "of");
  if (tokens.length !== 2) return null;

  const [first, second] = tokens;
  const asDate = (monthWord: string, dayWord: string) => {
    const month = MONTH_BY_NAME.get(monthWord);
    const day = DAY.exec(dayWord);
    if (!month || !day) return null;
    const number = Number(day[1]);
    if (number < 1 || number > 31) return null;
    return `date:${month}-${number}`;
  };

  return asDate(first, second) ?? asDate(second, first);
}
