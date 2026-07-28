import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { contentRange, parseRangeHeader } from "./range";
import { isValidStorageKey } from "./storage";

const SIZE = 1000;

describe("range parsing", () => {
  it("treats a missing or malformed header as a whole-file request", () => {
    assert.deepEqual(parseRangeHeader(null, SIZE), { kind: "full" });
    assert.deepEqual(parseRangeHeader("", SIZE), { kind: "full" });
    assert.deepEqual(parseRangeHeader("items=0-10", SIZE), { kind: "full" });
    assert.deepEqual(parseRangeHeader("bytes=abc-def", SIZE), { kind: "full" });
    assert.deepEqual(parseRangeHeader("bytes=-", SIZE), { kind: "full" });
  });

  it("reads an open-ended range, which is how playback opens", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-", SIZE), { kind: "range", start: 0, end: 999 });
    assert.deepEqual(parseRangeHeader("bytes=500-", SIZE), { kind: "range", start: 500, end: 999 });
  });

  it("reads a closed range", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-99", SIZE), { kind: "range", start: 0, end: 99 });
    assert.deepEqual(parseRangeHeader("bytes=200-300", SIZE), { kind: "range", start: 200, end: 300 });
  });

  it("clamps an end past the last byte instead of failing", () => {
    assert.deepEqual(parseRangeHeader("bytes=900-5000", SIZE), { kind: "range", start: 900, end: 999 });
  });

  it("reads a suffix range as the last n bytes", () => {
    assert.deepEqual(parseRangeHeader("bytes=-100", SIZE), { kind: "range", start: 900, end: 999 });
    // Longer than the file: the whole file, not a negative offset.
    assert.deepEqual(parseRangeHeader("bytes=-4000", SIZE), { kind: "range", start: 0, end: 999 });
  });

  it("rejects ranges that start past the end", () => {
    assert.deepEqual(parseRangeHeader("bytes=1000-", SIZE), { kind: "unsatisfiable" });
    assert.deepEqual(parseRangeHeader("bytes=2000-3000", SIZE), { kind: "unsatisfiable" });
    assert.deepEqual(parseRangeHeader("bytes=-0", SIZE), { kind: "unsatisfiable" });
    assert.deepEqual(parseRangeHeader("bytes=300-200", SIZE), { kind: "unsatisfiable" });
  });

  it("rejects any range against an empty file", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-", 0), { kind: "unsatisfiable" });
  });

  it("ignores whitespace and multipart requests", () => {
    assert.deepEqual(parseRangeHeader("  bytes=10-20  ", SIZE), { kind: "range", start: 10, end: 20 });
    assert.deepEqual(parseRangeHeader("bytes=0-10,20-30", SIZE), { kind: "full" });
  });

  it("formats Content-Range the way the spec wants it", () => {
    assert.equal(contentRange(0, 999, 1000), "bytes 0-999/1000");
  });
});

describe("storage keys", () => {
  it("accepts the keys the uploader generates", () => {
    assert.equal(isValidStorageKey("audio/cd-ielts-listening-a1b2c3d4.mp3"), true);
    assert.equal(isValidStorageKey("audio/file.mp3"), true);
  });

  it("refuses anything that could escape the media root", () => {
    for (const key of [
      "../.env",
      "audio/../../.env",
      "/etc/passwd",
      "audio\\..\\.env",
      "C:/Windows/system.ini",
      "./audio/x.mp3",
      "",
      "audio//x.mp3",
    ]) {
      assert.equal(isValidStorageKey(key), false, `should reject ${JSON.stringify(key)}`);
    }
  });
});
