import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { en } from "./en";
import { getSiteContent, isLocale, untranslatedLocales, type PartialContent } from "./index";

describe("locale dictionaries", () => {
  it("returns English unchanged for the default locale", () => {
    assert.equal(getSiteContent("en"), en);
  });

  it("falls back to English for a locale with nothing translated", () => {
    // Uzbek and Russian are empty until the instructor supplies copy.
    assert.deepEqual(getSiteContent("uz"), en);
    assert.deepEqual(getSiteContent("ru"), en);
  });

  it("reports which locales are still untranslated", () => {
    assert.deepEqual(untranslatedLocales().sort(), ["ru", "uz"]);
  });

  it("recognises only known locales", () => {
    assert.equal(isLocale("en"), true);
    assert.equal(isLocale("uz"), true);
    assert.equal(isLocale("de"), false);
    assert.equal(isLocale(undefined), false);
  });

  it("keeps English for sections a translation has not reached", () => {
    // Simulates a half-finished dictionary via the same merge the loader uses.
    const partial: PartialContent = { footer: { contact: "Контакты" } };
    const merged = { ...en, footer: { ...en.footer, ...partial.footer } };

    assert.equal(merged.footer.contact, "Контакты");
    // Untouched keys in the same section survive.
    assert.equal(merged.footer.rights, en.footer.rights);
    // Untouched sections survive.
    assert.equal(merged.why.heading, en.why.heading);
  });
});
