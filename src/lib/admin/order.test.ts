import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reorder } from "./order";

describe("reorder", () => {
  it("moves an item up", () => {
    assert.deepEqual(reorder(["a", "b", "c"], "c", -1), ["a", "c", "b"]);
  });

  it("moves an item down", () => {
    assert.deepEqual(reorder(["a", "b", "c"], "a", 1), ["b", "a", "c"]);
  });

  it("refuses to move the first item up or the last one down", () => {
    assert.equal(reorder(["a", "b"], "a", -1), null);
    assert.equal(reorder(["a", "b"], "b", 1), null);
  });

  it("returns null for an id that is not in the list", () => {
    assert.equal(reorder(["a", "b"], "z", 1), null);
  });

  it("leaves the input untouched", () => {
    const ids = ["a", "b", "c"];
    reorder(ids, "a", 1);
    assert.deepEqual(ids, ["a", "b", "c"]);
  });

  it("handles a single-item list", () => {
    assert.equal(reorder(["a"], "a", 1), null);
    assert.equal(reorder(["a"], "a", -1), null);
  });
});
