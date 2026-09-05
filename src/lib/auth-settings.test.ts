import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_AUTH_SETTINGS, mergeAuthSettings } from "./auth-settings";

describe("mergeAuthSettings", () => {
  it("closes email sign-up when nothing is stored", () => {
    // A fresh database must not open registration by accident.
    assert.deepEqual(mergeAuthSettings(undefined), { emailSignup: false });
    assert.deepEqual(mergeAuthSettings(null), DEFAULT_AUTH_SETTINGS);
  });

  it("honours a stored choice either way", () => {
    assert.equal(mergeAuthSettings({ emailSignup: true }).emailSignup, true);
    assert.equal(mergeAuthSettings({ emailSignup: false }).emailSignup, false);
  });

  it("ignores a value that is not a boolean", () => {
    // "true" as a string must not read as open.
    assert.equal(mergeAuthSettings({ emailSignup: "true" }).emailSignup, false);
    assert.equal(mergeAuthSettings({ emailSignup: 1 }).emailSignup, false);
  });
});
