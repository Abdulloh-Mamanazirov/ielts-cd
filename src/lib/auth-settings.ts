/**
 * Site-wide switches for how people get an account.
 *
 * The shape and its defaults live here; the values are stored in `SiteSetting`
 * under `auth` so the instructor can flip them in the admin panel without a
 * deploy, the same way plan pricing works. Reading and writing them is
 * `auth-settings-store.ts`.
 */

export type AuthSettings = {
  /**
   * Whether a visitor may create an account with an email and password.
   *
   * Off by default: registration goes through Telegram, which is where the
   * instructor already talks to students and which needs no password. Signing
   * *in* with an email is never affected — accounts that already exist have to
   * keep working, and closing registration must not lock anyone out.
   */
  emailSignup: boolean;
};

export const DEFAULT_AUTH_SETTINGS: AuthSettings = { emailSignup: false };

/**
 * A stored setting merged over the defaults.
 *
 * Anything that is not a boolean is treated as absent rather than coerced: the
 * string "false" is truthy, and a setting that fails open is the wrong way for
 * this one to fail.
 */
export function mergeAuthSettings(stored: unknown): AuthSettings {
  if (!stored || typeof stored !== "object") return DEFAULT_AUTH_SETTINGS;
  const source = stored as Partial<AuthSettings>;
  return {
    emailSignup:
      typeof source.emailSignup === "boolean"
        ? source.emailSignup
        : DEFAULT_AUTH_SETTINGS.emailSignup,
  };
}
