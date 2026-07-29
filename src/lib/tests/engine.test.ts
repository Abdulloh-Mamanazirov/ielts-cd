import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { z } from "zod";

import { bandForRawScore, overallBand } from "./bands";
import { gradeSubmission, perfectSubmission } from "./grade";
import { countWords, normalizeAnswer } from "./normalize";
import {
  testAnswerKeySchema,
  testContentSchema,
  testImportSchema,
  SCHEMA_VERSION,
} from "./schema";
import { validateTestImport } from "./validate";

/** A small but structurally complete reading test: gap fill, TFNG, and a select-two MCQ. */
function sampleImport(): z.input<typeof testImportSchema> {
  return {
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "reading",
      title: "Sample Reading",
      totalQuestions: 6,
      durationSeconds: 1200,
      parts: [
        {
          number: 1,
          passageHtml:
            "<p id='para-1'>The coat has dark patches which serve as camouflage. " +
            "Each giraffe consumes about 30 kilograms of leaves. The veins are thick.</p>",
          groups: [
            {
              id: "g1",
              type: "completion",
              rubricHtml: "<p>Complete the notes. Write ONE WORD ONLY from the passage.</p>",
              bodyHtml: "<ul><li>Coat provides {{1}}</li><li>Thick {{2}} stop leaks</li></ul>",
              maxWords: 1,
            },
            {
              id: "g2",
              type: "tfng",
              rubricHtml: "<p>Questions 3-4</p>",
              questions: [
                { number: 3, textHtml: "Giraffes eat leaves." },
                { number: 4, textHtml: "Giraffes are nocturnal." },
              ],
            },
            {
              id: "g3",
              type: "mcq",
              rubricHtml: "<p>Questions 5-6. Choose TWO letters.</p>",
              selectCount: 2,
              questions: [
                {
                  number: 5,
                  textHtml: "Which TWO features are mentioned?",
                  options: [
                    { letter: "A", textHtml: "camouflage" },
                    { letter: "B", textHtml: "thick veins" },
                    { letter: "C", textHtml: "night vision" },
                    { letter: "D", textHtml: "webbed feet" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    answerKey: {
      schemaVersion: SCHEMA_VERSION,
      answers: {
        "1": { accepted: ["camouflage"], type: "Note completion" },
        "2": { accepted: ["veins", "vein"], type: "Note completion" },
        "3": { accepted: ["TRUE"], type: "True/False/Not Given" },
        "4": { accepted: ["NOT GIVEN"], type: "True/False/Not Given" },
      },
      sets: [{ questions: [5, 6], accepted: ["A", "B"], type: "Multiple choice" }],
    },
  };
}

describe("normalizeAnswer", () => {
  it("ignores case, spacing, and surrounding punctuation", () => {
    assert.equal(normalizeAnswer("  Camouflage. "), "camouflage");
    assert.equal(normalizeAnswer('"fireplace"'), "fireplace");
  });

  it("treats hyphenated compounds as spaced", () => {
    assert.equal(normalizeAnswer("cow-dung"), normalizeAnswer("cow dung"));
  });

  it("ignores a leading article on either side", () => {
    assert.equal(normalizeAnswer("the fermentation"), normalizeAnswer("fermentation"));
    assert.equal(normalizeAnswer("An apple"), normalizeAnswer("apple"));
  });

  it("normalizes curly apostrophes to straight ones", () => {
    assert.equal(normalizeAnswer("hairdresser’s"), normalizeAnswer("hairdresser's"));
  });

  it("does not collapse genuinely different answers", () => {
    assert.notEqual(normalizeAnswer("veins"), normalizeAnswer("arteries"));
  });
});

describe("countWords", () => {
  it("counts a hyphenated compound as one word", () => {
    assert.equal(countWords("cow-dung"), 1);
    assert.equal(countWords("the fermentation process"), 3);
    assert.equal(countWords("   "), 0);
  });
});

describe("bandForRawScore", () => {
  it("uses the academic reading table for a full test", () => {
    assert.equal(bandForRawScore("reading", 40).band, 9);
    assert.equal(bandForRawScore("reading", 30).band, 7);
    assert.equal(bandForRawScore("reading", 23).band, 6);
    assert.equal(bandForRawScore("reading", 0).band, 0);
  });

  it("uses the listening table, which differs from reading at the edges", () => {
    assert.equal(bandForRawScore("listening", 19).band, 5.5);
    assert.equal(bandForRawScore("reading", 19).band, 5.5);
    assert.equal(bandForRawScore("listening", 16).band, 5);
    assert.equal(bandForRawScore("reading", 16).band, 5);
    assert.equal(bandForRawScore("listening", 32).band, 7.5);
    assert.equal(bandForRawScore("reading", 32).band, 7);
  });

  it("scales a partial test to 40 questions and flags it as an estimate", () => {
    const result = bandForRawScore("reading", 12, 13);
    assert.equal(result.scaledScore, 37);
    assert.equal(result.band, 8.5);
    assert.equal(result.isEstimate, true);
    assert.equal(bandForRawScore("reading", 40, 40).isEstimate, false);
  });
});

describe("overallBand", () => {
  it("rounds a .25 average up to the next half band", () => {
    assert.equal(overallBand([6, 6, 6.5, 6.5]), 6.5);
  });

  it("rounds a .75 average up to the next whole band", () => {
    assert.equal(overallBand([6.5, 7, 7, 7]), 7);
  });

  it("rounds down when the average is below the midpoint", () => {
    assert.equal(overallBand([6, 6, 6, 6.5]), 6);
  });

  it("returns null with nothing to average", () => {
    assert.equal(overallBand([]), null);
  });
});

describe("gradeSubmission", () => {
  const { content, answerKey } = sampleImport();
  const parsedContent = testContentSchema.parse(content);
  const parsedKey = testAnswerKeySchema.parse(answerKey);

  it("gives full marks for the key's own answers", () => {
    const result = gradeSubmission(parsedContent, parsedKey, perfectSubmission(parsedKey));
    assert.equal(result.rawScore, 6);
  });

  it("accepts a listed variant", () => {
    const result = gradeSubmission(parsedContent, parsedKey, { "2": "vein" });
    assert.equal(result.verdicts.find((v) => v.number === 2)?.correct, true);
  });

  it("marks a right answer wrong when it breaks the rubric word limit", () => {
    const result = gradeSubmission(parsedContent, parsedKey, { "1": "the camouflage pattern" });
    const verdict = result.verdicts.find((v) => v.number === 1);
    assert.equal(verdict?.correct, false);
    assert.equal(verdict?.overWordLimit, undefined);
  });

  it("flags an over-length answer that would otherwise have matched", () => {
    // "the veins" normalizes to "veins" (article stripped) but is two words as typed,
    // and its group allows only one.
    const result = gradeSubmission(parsedContent, parsedKey, { "2": "the veins" });
    const verdict = result.verdicts.find((v) => v.number === 2);
    assert.equal(verdict?.correct, false);
    assert.equal(verdict?.overWordLimit, true);
  });

  it("scores a select-two set in either order", () => {
    const forward = gradeSubmission(parsedContent, parsedKey, { "5": "A", "6": "B" });
    const reversed = gradeSubmission(parsedContent, parsedKey, { "5": "B", "6": "A" });
    assert.equal(forward.rawScore, 2);
    assert.equal(reversed.rawScore, 2);
  });

  it("gives one mark for one right letter in a select-two set", () => {
    const result = gradeSubmission(parsedContent, parsedKey, { "5": "A", "6": "D" });
    assert.equal(result.rawScore, 1);
  });

  it("gives no credit for repeating the same right letter twice", () => {
    const result = gradeSubmission(parsedContent, parsedKey, { "5": "A", "6": "A" });
    assert.equal(result.rawScore, 1);
  });

  it("counts a blank answer as wrong, not as a crash", () => {
    const result = gradeSubmission(parsedContent, parsedKey, {});
    assert.equal(result.rawScore, 0);
    assert.equal(result.verdicts.length, 6);
  });
});

describe("validateTestImport", () => {
  type Fixture = z.input<typeof testImportSchema>;

  // The fixture always populates these; the schema types them optional only
  // because they have defaults.
  const answersOf = (fixture: Fixture) =>
    fixture.answerKey.answers as Record<string, { accepted: string[]; type?: string }>;
  const firstGroupOf = (fixture: Fixture) => fixture.content.parts![0].groups[0];

  it("passes a well-formed test and reports the self-test score", () => {
    const report = validateTestImport(sampleImport());
    const errors = report.issues.filter((issue) => issue.level === "error");
    assert.deepEqual(errors, []);
    assert.equal(report.ok, true);
    assert.equal(report.stats?.selfTestScore, "6/6");
  });

  it("catches a key whose answers have shifted onto the wrong question types", () => {
    const broken = sampleImport();
    // The classic conversion bug: entries slide by two, so typed answers land on
    // True/False questions and vice versa. The key is still self-consistent, so
    // only the type check can see this.
    broken.answerKey.answers = {
      "1": { accepted: ["TRUE"] },
      "2": { accepted: ["NOT GIVEN"] },
      "3": { accepted: ["camouflage"] },
      "4": { accepted: ["veins"] },
    };

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    const drift = report.issues.filter((issue) => issue.code === "fixed_choice_mismatch");
    assert.equal(drift.length, 4);
  });

  it("self-test catches a canonical answer that breaks its own word limit", () => {
    const broken = sampleImport();
    // A later variant is within the limit, so the blanket word-limit check passes,
    // but the canonical answer the student is shown could never be marked right.
    answersOf(broken)["2"] = { accepted: ["thick strong veins", "veins"] };

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "self_test_failed"));
    assert.ok(
      report.issues.some(
        (issue) => issue.code === "self_test_question" && issue.questionNumber === 2,
      ),
    );
  });

  it("catches a question with no answer key entry", () => {
    const broken = sampleImport();
    delete answersOf(broken)["3"];

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) => issue.code === "missing_answer" && issue.questionNumber === 3),
    );
  });

  it("catches a slot with no matching question number", () => {
    const broken = sampleImport();
    firstGroupOf(broken).bodyHtml =
      "<ul><li>Coat provides {{1}}</li><li>Thick {{9}} stop leaks</li></ul>";

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "question_out_of_range"));
    assert.ok(report.issues.some((issue) => issue.code === "missing_question"));
  });

  it("catches an answer letter that is not among the options", () => {
    const broken = sampleImport();
    broken.answerKey.sets = [{ questions: [5, 6], accepted: ["A", "Z"] }];

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "unknown_option_letter"));
  });

  it("catches a question listed in both answers and a set", () => {
    const broken = sampleImport();
    answersOf(broken)["5"] = { accepted: ["A"] };

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "duplicate_answer"));
  });

  it("errors when every accepted answer breaks the group's own word limit", () => {
    const broken = sampleImport();
    answersOf(broken)["1"] = { accepted: ["dark patch camouflage effect"] };

    const report = validateTestImport(broken);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "accepted_over_word_limit"));
  });

  it("warns when a reading answer does not occur in the passage", () => {
    const drifted = sampleImport();
    answersOf(drifted)["1"] = { accepted: ["disguise"] };
    answersOf(drifted)["4"] = { accepted: ["NOT GIVEN"] };

    const report = validateTestImport(drifted);
    assert.ok(
      report.issues.some(
        (issue) => issue.code === "answer_not_in_passage" && issue.level === "warning",
      ),
    );
  });

  it("warns when a rubric states a word limit but maxWords is unset", () => {
    const loose = sampleImport();
    delete (firstGroupOf(loose) as Record<string, unknown>).maxWords;

    const report = validateTestImport(loose);
    assert.ok(report.issues.some((issue) => issue.code === "missing_max_words"));
    // A missing limit is sloppy, not fatal.
    assert.equal(report.ok, true);
  });

  it("rejects malformed input with a schema error rather than throwing", () => {
    const report = validateTestImport({ content: { skill: "reading" }, answerKey: {} });
    assert.equal(report.ok, false);
    assert.ok(report.issues.every((issue) => issue.code === "schema"));
  });
});

/** An Academic Writing test: a chart to describe, then an opinion essay. */
function writingImport(): z.input<typeof testImportSchema> {
  return {
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "writing",
      title: "Sample Writing",
      totalQuestions: 0,
      durationSeconds: 3600,
      tasks: [
        {
          number: 1,
          promptHtml: "<p>The chart below shows enrolment.</p>",
          imageUrl: "/test-media/chart.png",
          minWords: 150,
          suggestedMinutes: 20,
        },
        {
          number: 2,
          promptHtml: "<p>To what extent do you agree?</p>",
          minWords: 250,
          suggestedMinutes: 40,
        },
      ],
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers: {}, sets: [] },
  };
}

function tasksOf(input: z.input<typeof testImportSchema>) {
  return (input.content as { tasks: Array<Record<string, unknown>> }).tasks;
}

describe("validateTestImport for writing", () => {
  it("accepts a well-formed two-task test", () => {
    const report = validateTestImport(writingImport());
    assert.equal(report.ok, true);
    assert.equal(report.issues.length, 0);
    assert.equal(report.stats?.skill, "writing");
  });

  it("warns when Academic Task 1 has no visual to describe", () => {
    const noImage = writingImport();
    delete tasksOf(noImage)[0].imageUrl;

    const report = validateTestImport(noImage);
    assert.ok(report.issues.some((issue) => issue.code === "task1_without_image"));
    // A General Training letter legitimately has no image, so this cannot block.
    assert.equal(report.ok, true);
  });

  it("errors when the suggested timings do not fit the duration", () => {
    const cramped = writingImport();
    (cramped.content as { durationSeconds: number }).durationSeconds = 1800;

    const report = validateTestImport(cramped);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "timings_exceed_duration"));
  });

  it("errors on a duplicated task number", () => {
    const duplicated = writingImport();
    tasksOf(duplicated)[1].number = 1;

    const report = validateTestImport(duplicated);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "duplicate_task"));
  });

  it("errors on a prompt that is empty once its markup is stripped", () => {
    const blank = writingImport();
    tasksOf(blank)[0].promptHtml = "<p></p>";

    const report = validateTestImport(blank);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "empty_prompt"));
  });

  it("warns when a task asks for fewer words than the exam requires", () => {
    const lenient = writingImport();
    tasksOf(lenient)[1].minWords = 200;

    const report = validateTestImport(lenient);
    assert.ok(report.issues.some((issue) => issue.code === "unusual_min_words"));
  });
});

/** A speaking test with all three parts and a cue card long turn. */
function speakingImport(): z.input<typeof testImportSchema> {
  return {
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "speaking",
      title: "Sample Speaking",
      totalQuestions: 0,
      durationSeconds: 840,
      // Eight prompts, because a realistically sized test is what the
      // "too few prompts" check is calibrated against.
      prompts: [
        { part: 1, promptHtml: "<p>Where do you live?</p>", prepSeconds: 0, speakSeconds: 30 },
        { part: 1, promptHtml: "<p>Do you like it there?</p>", prepSeconds: 0, speakSeconds: 30 },
        { part: 1, promptHtml: "<p>How long have you lived there?</p>", prepSeconds: 0, speakSeconds: 30 },
        { part: 1, promptHtml: "<p>Would you like to move away?</p>", prepSeconds: 0, speakSeconds: 30 },
        {
          part: 2,
          promptHtml: "<p>Describe something you own.</p>",
          bulletsHtml: ["where you got it", "why it matters"],
          prepSeconds: 60,
          speakSeconds: 120,
        },
        { part: 3, promptHtml: "<p>How have values changed?</p>", prepSeconds: 0, speakSeconds: 60 },
        { part: 3, promptHtml: "<p>Do people own too much these days?</p>", prepSeconds: 0, speakSeconds: 60 },
        { part: 3, promptHtml: "<p>Will that change in the future?</p>", prepSeconds: 0, speakSeconds: 60 },
      ],
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers: {}, sets: [] },
  };
}

function promptsOf(input: z.input<typeof testImportSchema>) {
  return (input.content as { prompts: Array<Record<string, unknown>> }).prompts;
}

/** The cue card, found by shape rather than position so the fixture can grow. */
function cueCardOf(input: z.input<typeof testImportSchema>) {
  return promptsOf(input).find((prompt) => prompt.part === 2 && Number(prompt.prepSeconds) > 0)!;
}

describe("validateTestImport for speaking", () => {
  it("accepts a well-formed three-part test", () => {
    const report = validateTestImport(speakingImport());
    assert.equal(report.ok, true);
    assert.equal(report.issues.length, 0);
    assert.equal(report.stats?.skill, "speaking");
  });

  it("warns when Part 2 has no preparation time, so there is no long turn", () => {
    const rushed = speakingImport();
    cueCardOf(rushed).prepSeconds = 0;

    const report = validateTestImport(rushed);
    assert.ok(report.issues.some((issue) => issue.code === "no_long_turn"));
  });

  it("warns when the cue card has no bullets", () => {
    const bare = speakingImport();
    delete cueCardOf(bare).bulletsHtml;

    const report = validateTestImport(bare);
    assert.ok(report.issues.some((issue) => issue.code === "cue_card_without_bullets"));
  });

  it("warns when a prompt is a topic heading rather than a question", () => {
    // The exact bad conversion seen in the wild: "<h3>Work</h3>".
    const topics = speakingImport();
    promptsOf(topics)[0].promptHtml = "<h3>Work</h3>";

    const report = validateTestImport(topics);
    assert.ok(report.issues.some((issue) => issue.code === "prompt_looks_like_a_topic"));
    // Suspicious, not fatal — a one-word question is legal, just unlikely.
    assert.equal(report.ok, true);
  });

  it("does not mistake a short real question for a topic", () => {
    const short = speakingImport();
    promptsOf(short)[0].promptHtml = "<p>Do you work?</p>";

    const report = validateTestImport(short);
    assert.ok(!report.issues.some((issue) => issue.code === "prompt_looks_like_a_topic"));
  });

  it("warns when a test has too few prompts to be a real interview", () => {
    const thin = speakingImport();
    (thin.content as { prompts: unknown[] }).prompts = promptsOf(thin).slice(0, 3);

    const report = validateTestImport(thin);
    assert.ok(report.issues.some((issue) => issue.code === "too_few_prompts"));
  });

  it("errors when speaking and preparation time overrun the test", () => {
    const overlong = speakingImport();
    cueCardOf(overlong).speakSeconds = 900;

    const report = validateTestImport(overlong);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === "timings_exceed_duration"));
  });
});
