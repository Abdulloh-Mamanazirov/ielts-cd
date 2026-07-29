import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeNext } from "./request";

/**
 * `next` now arrives from a form field on the sign-in page, so it is attacker
 * controlled. An open redirect there is a phishing gift: the victim sees a real
 * sign-in on the real domain and lands somewhere else afterwards.
 */
describe("safeNext", () => {
  it("keeps an ordinary same-origin path", () => {
    assert.equal(safeNext("/dashboard"), "/dashboard");
    assert.equal(safeNext("/tests?skill=reading"), "/tests?skill=reading");
  });

  it("rejects an absolute URL", () => {
    assert.equal(safeNext("https://evil.example.com"), "/dashboard");
    assert.equal(safeNext("http://evil.example.com"), "/dashboard");
  });

  it("rejects a protocol-relative URL", () => {
    // `new URL("//evil.example.com", origin)` resolves to that host, so this is
    // the bypass that matters most.
    assert.equal(safeNext("//evil.example.com"), "/dashboard");
    assert.equal(safeNext("//evil.example.com/path"), "/dashboard");
  });

  it("rejects a backslash-separated host, which some parsers treat as a slash", () => {
    assert.equal(safeNext("/\\evil.example.com"), "/dashboard");
    assert.equal(safeNext("\\\\evil.example.com"), "/dashboard");
  });

  it("rejects a scheme that is not a path at all", () => {
    assert.equal(safeNext("javascript:alert(1)"), "/dashboard");
    assert.equal(safeNext("data:text/html,<script>"), "/dashboard");
  });

  it("rejects anything that is not a string", () => {
    assert.equal(safeNext(undefined), "/dashboard");
    assert.equal(safeNext(null), "/dashboard");
    assert.equal(safeNext(42), "/dashboard");
    assert.equal(safeNext(["/dashboard"]), "/dashboard");
  });

  it("honours a caller's own fallback", () => {
    assert.equal(safeNext("https://evil.example.com", "/login"), "/login");
  });
});
