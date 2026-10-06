/**
 * What a student is shown after a mock, and how it ends.
 *
 * "Mock" here means a section of a full mock — an ordinary one or a mock test
 * event, which is a full mock with an event attached. A single test is never
 * affected, whether it was sat as practice or under exam timing: a student who
 * picks one paper to try wants its marking, and withholding it there only
 * frustrated people the switches were never aimed at.
 *
 * Stored in `SiteSetting` under `mock` so the instructor can switch these from
 * the admin panel. All on by default, which is the behaviour before the
 * switches existed. Because they are global switches, turning one back on
 * reveals the results of every past mock — which is how results are "released".
 */

export type MockSettings = {
  /** Confetti and a congratulations card when the last section is submitted. */
  celebrateCompletion: boolean;
  /**
   * The marked paper after a mock section: which answers were right, the
   * correct answers, explanations, "show me where".
   */
  showCorrectAnswers: boolean;
  /**
   * The numbers: each section's band and raw score, and the mock's overall.
   * Off, the student sees that a section is submitted and nothing more.
   */
  showSectionBands: boolean;
};

export const DEFAULT_MOCK_SETTINGS: MockSettings = {
  celebrateCompletion: true,
  showCorrectAnswers: true,
  showSectionBands: true,
};

/** A stored setting merged over the defaults; anything not a boolean is absent. */
export function mergeMockSettings(stored: unknown): MockSettings {
  if (!stored || typeof stored !== "object") return DEFAULT_MOCK_SETTINGS;
  const source = stored as Partial<Record<keyof MockSettings, unknown>>;
  const out = { ...DEFAULT_MOCK_SETTINGS };
  for (const key of Object.keys(out) as Array<keyof MockSettings>) {
    if (typeof source[key] === "boolean") out[key] = source[key] as boolean;
  }
  return out;
}

/**
 * Whether this attempt's bands and scores may be shown to the student.
 *
 * `withinFullMock` is whether the attempt is a section of a full mock or an
 * event — `Boolean(attempt.fullMockId)`. Not the attempt's mode: a single test
 * started under exam timing is a MOCK attempt too, and stays fully visible.
 */
export function revealsBands(settings: MockSettings, withinFullMock: boolean): boolean {
  return !withinFullMock || settings.showSectionBands;
}

/** Whether this attempt's marked paper may be shown to the student. Same rule. */
export function revealsAnswers(settings: MockSettings, withinFullMock: boolean): boolean {
  return !withinFullMock || settings.showCorrectAnswers;
}
