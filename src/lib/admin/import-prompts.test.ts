import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateTestImport } from "@/lib/tests/validate";
import { IMPORT_PROMPTS } from "./import-prompts";

/**
 * The worked example inside each prompt is the thing a model copies. If one of
 * them does not itself import cleanly, the prompt is worse than no prompt —
 * so every example is pulled back out of the prompt text and run through the
 * real validator.
 */
function exampleFrom(prompt: string): unknown {
  // The example is the last JSON block, after the WORKED EXAMPLE heading —
  // earlier braces belong to prose like `{ "1": { "accepted": [...] } }`.
  const heading = prompt.lastIndexOf("EXAMPLE");
  const start = prompt.indexOf("{", heading);
  const end = prompt.lastIndexOf("}");
  assert.ok(start !== -1 && end > start, "prompt contains no JSON example");
  return JSON.parse(prompt.slice(start, end + 1));
}

describe("import prompts", () => {
  it("covers all four skills", () => {
    assert.deepEqual(
      IMPORT_PROMPTS.map((entry) => entry.skill).sort(),
      ["listening", "reading", "speaking", "writing"],
    );
  });

  for (const entry of IMPORT_PROMPTS) {
    it(`${entry.skill}: its worked example passes the real validator`, () => {
      const report = validateTestImport(exampleFrom(entry.prompt));

      assert.equal(
        report.ok,
        true,
        `example rejected: ${report.issues
          .filter((issue) => issue.level === "error")
          .map((issue) => issue.message)
          .join(" · ")}`,
      );
      assert.equal(report.parsed?.content.skill, entry.skill);
    });

    it(`${entry.skill}: its example raises no unexpected warnings`, () => {
      const report = validateTestImport(exampleFrom(entry.prompt));
      const warnings = report.issues
        .filter((issue) => issue.level === "warning")
        .map((issue) => issue.code);

      // Writing is the one exception, and it is deliberate: the prompt tells
      // the model to leave imageUrl out because the chart is uploaded through
      // the admin screen afterwards, so the validator's nudge is expected.
      const allowed = entry.skill === "writing" ? ["task1_without_image"] : [];
      assert.deepEqual(warnings, allowed);
    });

    it(`${entry.skill}: the prompt forbids markdown fences`, () => {
      // A fenced reply is the single most common reason a paste fails to parse.
      assert.match(entry.prompt, /No markdown, no ```json fences/);
    });
  }

  it("tells the reading prompt to include the passage", () => {
    const reading = IMPORT_PROMPTS.find((entry) => entry.skill === "reading")!;
    assert.match(reading.prompt, /passageHtml/);
    assert.match(reading.prompt, /COMPLETE passage text/);
  });

  it("tells the speaking prompt one object per question, not per part", () => {
    const speaking = IMPORT_PROMPTS.find((entry) => entry.skill === "speaking")!;
    assert.match(speaking.prompt, /ONE OBJECT PER INDIVIDUAL QUESTION/);
    // The exact failure seen in the wild: three prompts named after topics.
    assert.match(speaking.prompt, /do NOT put a topic name like "Work" or "Hometown"/);
  });
});
