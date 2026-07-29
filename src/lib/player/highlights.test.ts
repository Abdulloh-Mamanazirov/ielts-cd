import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyHighlightMarks, htmlToText, mergeRanges, type Highlight } from "./highlights";

function range(start: number, end: number, extra: Partial<Highlight> = {}): Highlight {
  return { id: "h1", part: 1, start, end, text: "", ...extra };
}

describe("htmlToText", () => {
  it("drops tags and counts an entity as one character", () => {
    assert.equal(htmlToText("<p>a&amp;b</p>"), "a&b");
    assert.equal(htmlToText("<p>a&amp;b</p>").length, 3);
  });

  it("decodes numeric and hex entities", () => {
    assert.equal(htmlToText("&#65;&#x42;"), "AB");
  });

  it("gives offsets that span element boundaries continuously", () => {
    assert.equal(htmlToText("<p>one</p><p>two</p>"), "onetwo");
  });
});

describe("applyHighlightMarks", () => {
  it("leaves the html alone when there is nothing to mark", () => {
    assert.equal(applyHighlightMarks("<p>hello</p>", []), "<p>hello</p>");
  });

  it("wraps a range inside one element", () => {
    // "hello world" — mark "world".
    const out = applyHighlightMarks("<p>hello world</p>", [range(6, 11)]);
    assert.equal(out, '<p>hello <mark data-hl="h1">world</mark></p>');
  });

  it("marks the very start and the very end", () => {
    assert.equal(
      applyHighlightMarks("<p>abc</p>", [range(0, 3)]),
      '<p><mark data-hl="h1">abc</mark></p>',
    );
  });

  it("splits a range that crosses a tag boundary into valid marks", () => {
    // "onetwo" — mark "etw", which straddles the two paragraphs.
    const out = applyHighlightMarks("<p>one</p><p>two</p>", [range(2, 5)]);
    assert.equal(
      out,
      '<p>on<mark data-hl="h1">e</mark></p><p><mark data-hl="h1">tw</mark>o</p>',
    );
    // Never an unbalanced mark.
    assert.equal((out.match(/<mark/g) ?? []).length, (out.match(/<\/mark>/g) ?? []).length);
  });

  it("counts an entity as a single character when placing marks", () => {
    // Text is "a&b"; marking offsets 1..3 must cover "&b".
    const out = applyHighlightMarks("<p>a&amp;b</p>", [range(1, 3)]);
    assert.equal(out, '<p>a<mark data-hl="h1">&amp;b</mark></p>');
  });

  it("flags a highlight that carries a note", () => {
    const out = applyHighlightMarks("<p>hello</p>", [range(0, 5, { note: "check this" })]);
    assert.ok(out.includes('data-note="1"'));
  });

  it("escapes an id rather than letting it break out of the attribute", () => {
    const out = applyHighlightMarks("<p>hi</p>", [range(0, 2, { id: '"><script>' })]);
    assert.ok(!out.includes("<script>"));
    assert.ok(out.includes("&quot;&gt;&lt;script&gt;"));
  });

  it("survives an attribute containing a > inside the tag", () => {
    const html = '<p title="a > b">xy</p>';
    const out = applyHighlightMarks(html, [range(0, 2)]);
    // The naive tag scan stops at the first ">", so the mark lands after it.
    assert.ok(out.includes("</mark>"));
    assert.equal((out.match(/<mark/g) ?? []).length, (out.match(/<\/mark>/g) ?? []).length);
  });
});

describe("mergeRanges", () => {
  it("collapses overlapping highlights into one", () => {
    const merged = mergeRanges([range(0, 5), range(3, 9, { id: "h2" })]);
    assert.equal(merged.length, 1);
    assert.deepEqual([merged[0].start, merged[0].end], [0, 9]);
  });

  it("keeps separate highlights separate", () => {
    const merged = mergeRanges([range(0, 3), range(6, 9, { id: "h2" })]);
    assert.equal(merged.length, 2);
  });

  it("keeps a note when the range carrying it is absorbed", () => {
    const merged = mergeRanges([range(0, 5), range(2, 7, { id: "h2", note: "why" })]);
    assert.equal(merged[0].note, "why");
  });

  it("drops empty ranges, which a stray click produces", () => {
    assert.deepEqual(mergeRanges([range(4, 4)]), []);
  });

  it("does not mutate the input", () => {
    const input = [range(0, 5), range(3, 9, { id: "h2" })];
    mergeRanges(input);
    assert.equal(input[0].end, 5);
  });
});
