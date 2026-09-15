/**
 * How a full mock feels at the end.
 *
 * Stored in `SiteSetting` under `mock` so the instructor can switch it from
 * the admin panel, like the sign-up and marking switches.
 */

export type MockSettings = {
  /** Confetti and a congratulations card when the last section is submitted. */
  celebrateCompletion: boolean;
};

export const DEFAULT_MOCK_SETTINGS: MockSettings = { celebrateCompletion: true };

/** A stored setting merged over the defaults; anything not a boolean is absent. */
export function mergeMockSettings(stored: unknown): MockSettings {
  if (!stored || typeof stored !== "object") return DEFAULT_MOCK_SETTINGS;
  const source = stored as Partial<MockSettings>;
  return {
    celebrateCompletion:
      typeof source.celebrateCompletion === "boolean"
        ? source.celebrateCompletion
        : DEFAULT_MOCK_SETTINGS.celebrateCompletion,
  };
}
