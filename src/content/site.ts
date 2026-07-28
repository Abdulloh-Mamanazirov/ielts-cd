import { getSiteContent } from "./locales";

/**
 * The marketing copy the components render.
 *
 * Still a single import so no markup had to change when the dictionary went
 * per-locale. Once a translation exists and its locale is active, this becomes
 * `getSiteContent(locale)` resolved from the request.
 */
export const site = getSiteContent();

export type { Locale, SiteContent } from "./locales";
export { ACTIVE_LOCALES, LOCALES, LOCALE_NAMES, getSiteContent, isLocale } from "./locales";
