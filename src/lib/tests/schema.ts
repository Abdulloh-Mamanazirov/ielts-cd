import { z } from "zod";

/**
 * Canonical test format, version 1.
 *
 * Two halves that are stored and transmitted separately:
 *  - TestContent  — questions and passages. Sent to the browser.
 *  - TestAnswerKey — accepted answers, explanations, evidence. Server only.
 *
 * Question bodies stay as HTML with `{{n}}` slots rather than fully structured
 * data, because real IELTS layouts are tables, forms and flow-charts whose
 * shape carries meaning. The slot markers are what tie the HTML back to
 * question numbers.
 */

export const SCHEMA_VERSION = 1;

export const SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export type SkillSlug = (typeof SKILLS)[number];

export const GROUP_TYPES = [
  // bodyHtml with {{n}} slots: notes, form, table, flow-chart, summary,
  // sentence completion. A wordBank turns the slots into letter inputs.
  "completion",
  // Standalone numbered questions, each followed by its own blank.
  "short_answer",
  "mcq",
  "tfng",
  "ynng",
  // Numbered items answered with a letter drawn from a shared list.
  "matching",
  // Image plus either slots or numbered items, answered with letters.
  "map_labeling",
] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

/** Matches `{{12}}` slot markers inside bodyHtml. */
export const SLOT_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

const html = z.string();
const positiveInt = z.number().int().positive();

const wordBankItemSchema = z.object({
  letter: z
    .string()
    .regex(/^[A-Z]$/, "Word bank letters must be a single capital letter A-Z"),
  textHtml: html,
});

const optionSchema = z.object({
  letter: z.string().regex(/^[A-Z]$/, "Option letters must be A-Z"),
  textHtml: html,
});

const questionSchema = z.object({
  /** First question number this item occupies. */
  number: positiveInt,
  textHtml: html.optional(),
  options: z.array(optionSchema).optional(),
});

export const questionGroupSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(GROUP_TYPES),
    /** Verbatim rubric, e.g. "Questions 8-10. Complete the flow-chart below." */
    rubricHtml: html,
    bodyHtml: html.optional(),
    wordBank: z.array(wordBankItemSchema).optional(),
    questions: z.array(questionSchema).optional(),
    /**
     * Questions per item, for "choose TWO letters" groups. An item with
     * number 11 and selectCount 2 occupies question numbers 11 and 12, and
     * both are graded as one unordered set.
     */
    selectCount: positiveInt.default(1),
    /** Word ceiling from the rubric, used by the validator and the player. */
    maxWords: positiveInt.optional(),
    imageUrl: z.string().optional(),
  })
  .superRefine((group, ctx) => {
    const usesBody = group.type === "completion";
    const usesQuestions =
      group.type === "short_answer" ||
      group.type === "mcq" ||
      group.type === "tfng" ||
      group.type === "ynng" ||
      group.type === "matching";

    if (usesBody && !group.bodyHtml) {
      ctx.addIssue({
        code: "custom",
        message: `Group "${group.id}" is type "${group.type}" and needs bodyHtml with {{n}} slots`,
        path: ["bodyHtml"],
      });
    }

    if (usesQuestions && (!group.questions || group.questions.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: `Group "${group.id}" is type "${group.type}" and needs a questions array`,
        path: ["questions"],
      });
    }

    if (group.type === "map_labeling" && !group.bodyHtml && !group.questions) {
      ctx.addIssue({
        code: "custom",
        message: `Group "${group.id}" needs either bodyHtml slots or a questions array`,
        path: ["questions"],
      });
    }

    if (group.type === "matching" && (!group.wordBank || group.wordBank.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: `Matching group "${group.id}" needs a wordBank of lettered options`,
        path: ["wordBank"],
      });
    }

    if (group.type === "mcq") {
      for (const question of group.questions ?? []) {
        if (!question.options || question.options.length < 2) {
          ctx.addIssue({
            code: "custom",
            message: `Question ${question.number} in group "${group.id}" needs at least two options`,
            path: ["questions"],
          });
        }
        const letters = (question.options ?? []).map((o) => o.letter);
        if (new Set(letters).size !== letters.length) {
          ctx.addIssue({
            code: "custom",
            message: `Question ${question.number} in group "${group.id}" has duplicate option letters`,
            path: ["questions"],
          });
        }
      }
    }

    if (group.wordBank) {
      const letters = group.wordBank.map((w) => w.letter);
      if (new Set(letters).size !== letters.length) {
        ctx.addIssue({
          code: "custom",
          message: `Group "${group.id}" has duplicate word bank letters`,
          path: ["wordBank"],
        });
      }
    }
  });

export const partSchema = z.object({
  number: positiveInt,
  title: z.string().optional(),
  /** Shown above the panes, e.g. "Part 1 — Read the text below". */
  instructionsHtml: html.optional(),
  /** Reading only. Paragraph anchors (id="para-2") let evidence link into it. */
  passageHtml: html.optional(),
  /** Listening only. Offset in the test's single audio file where this part starts. */
  audioStartSeconds: z.number().int().nonnegative().optional(),
  groups: z.array(questionGroupSchema).min(1),
});

export const writingTaskSchema = z.object({
  number: z.union([z.literal(1), z.literal(2)]),
  promptHtml: html,
  imageUrl: z.string().optional(),
  minWords: positiveInt,
  suggestedMinutes: positiveInt,
});

export const speakingPromptSchema = z.object({
  part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  promptHtml: html,
  /** Part 2 cue card bullets. */
  bulletsHtml: z.array(html).optional(),
  prepSeconds: z.number().int().nonnegative().default(0),
  speakSeconds: positiveInt,
});

export const testContentSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    skill: z.enum(SKILLS),
    title: z.string().min(1),
    source: z.string().optional(),
    description: z.string().optional(),
    /** 0 for writing and speaking, which are not auto-graded. */
    totalQuestions: z.number().int().nonnegative(),
    durationSeconds: positiveInt,
    parts: z.array(partSchema).optional(),
    tasks: z.array(writingTaskSchema).optional(),
    prompts: z.array(speakingPromptSchema).optional(),
  })
  .superRefine((content, ctx) => {
    const graded = content.skill === "listening" || content.skill === "reading";

    if (graded) {
      if (!content.parts || content.parts.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `A ${content.skill} test needs at least one part`,
          path: ["parts"],
        });
      }
      if (content.totalQuestions === 0) {
        ctx.addIssue({
          code: "custom",
          message: `A ${content.skill} test needs totalQuestions > 0`,
          path: ["totalQuestions"],
        });
      }
    }

    if (content.skill === "reading") {
      for (const part of content.parts ?? []) {
        if (!part.passageHtml) {
          ctx.addIssue({
            code: "custom",
            message: `Reading part ${part.number} is missing passageHtml`,
            path: ["parts"],
          });
        }
      }
    }

    if (content.skill === "writing" && (!content.tasks || content.tasks.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: "A writing test needs at least one task",
        path: ["tasks"],
      });
    }

    if (content.skill === "speaking" && (!content.prompts || content.prompts.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: "A speaking test needs at least one prompt",
        path: ["prompts"],
      });
    }
  });

const evidenceSchema = z.object({
  /** id of an element in passageHtml, e.g. "para-2". */
  anchor: z.string().optional(),
  /** Verbatim phrase to highlight when revealing the answer. */
  snippet: z.string().optional(),
});

export const answerEntrySchema = z.object({
  /** First entry is the canonical form shown in review screens. */
  accepted: z.array(z.string().min(1)).min(1),
  /** Human label for the results breakdown, e.g. "Note completion". */
  type: z.string().optional(),
  explanation: z.string().optional(),
  evidence: evidenceSchema.optional(),
});

/** "Choose TWO letters" — the questions are graded as one unordered set. */
export const answerSetSchema = z.object({
  questions: z.array(positiveInt).min(2),
  accepted: z.array(z.string().min(1)).min(2),
  type: z.string().optional(),
  explanation: z.string().optional(),
  evidence: evidenceSchema.optional(),
});

export const testAnswerKeySchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  answers: z.record(z.string().regex(/^\d+$/), answerEntrySchema).default({}),
  sets: z.array(answerSetSchema).default([]),
});

export const testImportSchema = z.object({
  content: testContentSchema,
  answerKey: testAnswerKeySchema,
  /** Publishing metadata the admin form can override. */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by hyphens")
    .optional(),
  isPremium: z.boolean().optional(),
  /**
   * Where this sits on the practice shelf: which body of material, and where
   * inside it. Optional because a one-off test need belong to no numbered set.
   */
  series: z.enum(["REAL_EXAM", "CAMBRIDGE"]).optional(),
  seriesNumber: positiveInt.optional(),
  testNumber: positiveInt.optional(),
  /**
   * Where the listening audio came from, for tests converted from a source that
   * streamed it. The importer surfaces this so the audio gets re-hosted rather
   * than hot-linked; a listening test cannot be published without an upload.
   */
  audioSourceUrl: z.string().optional(),
});

export type WordBankItem = z.infer<typeof wordBankItemSchema>;
export type QuestionOption = z.infer<typeof optionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionGroup = z.infer<typeof questionGroupSchema>;
export type TestPart = z.infer<typeof partSchema>;
export type WritingTask = z.infer<typeof writingTaskSchema>;
export type SpeakingPrompt = z.infer<typeof speakingPromptSchema>;
export type TestContent = z.infer<typeof testContentSchema>;
export type AnswerEntry = z.infer<typeof answerEntrySchema>;
export type AnswerSet = z.infer<typeof answerSetSchema>;
export type TestAnswerKey = z.infer<typeof testAnswerKeySchema>;
export type TestImport = z.infer<typeof testImportSchema>;
