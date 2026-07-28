import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, needsRehash, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("Correct horse battery staple", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  it("produces a different hash each time for the same password", async () => {
    const [first, second] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    assert.notEqual(first, second);
    assert.equal(await verifyPassword("same", first), true);
    assert.equal(await verifyPassword("same", second), true);
  });

  it("handles non-ascii passwords", async () => {
    const hash = await hashPassword("parolim-ниҳоятда-кучли-🔐");
    assert.equal(await verifyPassword("parolim-ниҳоятда-кучли-🔐", hash), true);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    for (const stored of ["", "not-a-hash", "scrypt$1$2$3", "bcrypt$16384$8$1$aa$bb"]) {
      assert.equal(await verifyPassword("anything", stored), false);
    }
  });

  it("flags hashes that used weaker parameters", async () => {
    assert.equal(needsRehash(await hashPassword("x")), false);
    assert.equal(needsRehash("scrypt$1024$8$1$c2FsdA==$aGFzaA=="), true);
    assert.equal(needsRehash("legacy-bcrypt-hash"), true);
  });
});
