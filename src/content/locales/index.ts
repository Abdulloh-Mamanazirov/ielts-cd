import { en } from "./en";
import { ru } from "./ru";
import { uz } from "./uz";

/**
 * Per-locale marketing copy.
 *
 * English is the reference: it is the only dictionary required to be complete,
 * and the others are merged over it key by key. That is what makes a partial
 * translation safe to ship — an untranslated heading renders in English rather
 * than as a blank or a raw key, which is the failure mode that makes half-done
 * localisation worse than none.
 *
 * Adding a language is two steps: fill in its dictionary, then add it to
 * `ACTIVE_LOCALES`. Nothing in the markup changes.
 */

export const LOCALES = ["en", "uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  uz: "O‘zbekcha",
  ru: "Русский",
};

/**
 * Locales offered to visitors. Uzbek and Russian stay out until their
 * dictionaries are filled in — publishing a /ru page of English text is worse
 * for a reader than not offering Russian at all.
 */
export const ACTIVE_LOCALES: Locale[] = ["en"];

export type SiteContent = typeof en;

/** A translation may fill in as much or as little as it has. */
export type PartialContent = {
  [K in keyof SiteContent]?: SiteContent[K] extends readonly unknown[]
    ? SiteContent[K]
    : Partial<SiteContent[K]>;
};

const DICTIONARIES: Record<Locale, PartialContent> = { en, uz, ru };

export function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && (LOCALES as readonly string[]).includes(value));
}

/**
 * Copy for a locale, with anything untranslated taken from English.
 *
 * One level deep on purpose. The dictionary is a flat set of sections, and a
 * recursive merge would silently splice half-translated arrays — a `mockPoints`
 * list with two Russian entries and two English ones reads as a bug, so an
 * array is taken whole or not at all.
 */
export function getSiteContent(locale: Locale = DEFAULT_LOCALE): SiteContent {
  if (locale === DEFAULT_LOCALE) return en;

  const dictionary = DICTIONARIES[locale] ?? {};
  const merged = { ...en } as Record<string, unknown>;

  for (const [section, value] of Object.entries(dictionary)) {
    if (value === undefined) continue;

    const fallback = (en as Record<string, unknown>)[section];
    merged[section] =
      Array.isArray(value) || typeof value !== "object"
        ? value
        : { ...(fallback as object), ...value };
  }

  return merged as SiteContent;
}

/** Locales with nothing translated yet, so a build can say so out loud. */
export function untranslatedLocales(): Locale[] {
  return LOCALES.filter(
    (locale) => locale !== DEFAULT_LOCALE && Object.keys(DICTIONARIES[locale] ?? {}).length === 0,
  );
}
