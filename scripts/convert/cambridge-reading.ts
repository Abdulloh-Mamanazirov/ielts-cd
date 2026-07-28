import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import type { TestImport } from "../../src/lib/tests/schema";
import {
  extractJsonConst,
  loadHtml,
  maxWordsFromRubric,
  parseWordBank,
  slugify,
  textOf,
  toCleanHtml,
  toSlotHtml,
} from "./lib";

/**
 * Adapter for the "Cambridge 21 Reading Test 4" style file: three passages in
 * `.passage-part[data-part]`, question groups in `.questions-part[data-part]`,
 * and the answer key held in inline `const` objects.
 */

type Evidence = { para?: string; snippet?: string; part?: number };

type SourceKey = {
  correctAnswers: Record<string, string>;
  acceptableAnswers: Record<string, string[]>;
  explanations: Record<string, string>;
  questionTypes: Record<string, string>;
  evidence: Record<string, Evidence>;
};


function readSourceKey($: CheerioAPI): SourceKey {
  return {
    correctAnswers: extractJsonConst($, "correctAnswers"),
    acceptableAnswers: safeExtract($, "acceptableAnswers"),
    explanations: safeExtract($, "explanations"),
    questionTypes: safeExtract($, "questionTypes"),
    evidence: safeExtract($, "evidence"),
  };
}

function safeExtract<T extends object>($: CheerioAPI, name: string): T {
  try {
    return extractJsonConst<T>($, name);
  } catch {
    return {} as T;
  }
}

/** Decides the group type from the markup the source used for its inputs. */
function detectGroupType(
  $: CheerioAPI,
  content: Cheerio<Element>,
): { type: "tfng" | "ynng" | "mcq" | "completion"; selectCount: number } {
  if (content.find(".tfng-question").length > 0) {
    const values = content
      .find("input[type=radio]")
      .map((_, element) => $(element).attr("value") ?? "")
      .get();
    const isYesNo = values.some((value) => value === "YES" || value === "NO");
    return { type: isYesNo ? "ynng" : "tfng", selectCount: 1 };
  }

  if (content.find(".mcq-block").length > 0) {
    const checkboxes = content.find("input[type=checkbox]").length;
    return { type: "mcq", selectCount: checkboxes > 0 ? 2 : 1 };
  }

  return { type: "completion", selectCount: 1 };
}

function parseFixedChoiceQuestions($: CheerioAPI, content: Cheerio<Element>) {
  return content
    .find(".tfng-question")
    .map((_, element) => {
      const block = $(element);
      const number = Number(block.find(".tfng-number").first().text().trim());
      const statement = block.find(".tfng-statement-text").first().clone();
      return { number, textHtml: toCleanHtml($, statement) };
    })
    .get()
    .filter((question) => Number.isFinite(question.number));
}

function parseMcqQuestions($: CheerioAPI, content: Cheerio<Element>) {
  return content
    .find(".mcq-block")
    .map((_, element) => {
      const block = $(element);
      const number = Number(block.find(".mcq-q-num-box").first().text().trim());
      const stem = block.find(".mcq-stem").first().clone();

      const options = block
        .find("label")
        .map((__, label) => {
          const row = $(label);
          const letter = (row.find("input").attr("value") ?? "").trim().toUpperCase();
          // The letter is repeated as a badge; the option text is the rest.
          const text = row
            .find("span")
            .filter((___, span) => !$(span).hasClass("mcq-letter"))
            .map((___, span) => $(span).text())
            .get()
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          return { letter, textHtml: text };
        })
        .get()
        .filter((option) => /^[A-Z]$/.test(option.letter));

      return { number, textHtml: toCleanHtml($, stem), options };
    })
    .get()
    .filter((question) => Number.isFinite(question.number));
}

export function convertCambridgeReading(
  sourcePath: string,
  options: { title: string; source: string; isPremium?: boolean; durationSeconds?: number },
): TestImport {
  const $ = loadHtml(sourcePath);
  const key = readSourceKey($);

  const parts = $("#passageContent .passage-part")
    .map((_, element) => {
      const partElement = $(element);
      const partNumber = Number(partElement.attr("data-part"));

      const rubric = partElement.find(".sectionRubric").first();
      const instructionsHtml = rubric.length
        ? `<h3>${rubric.find("h2").first().text().trim()}</h3><p>${rubric
            .find("p")
            .first()
            .text()
            .trim()}</p>`
        : undefined;
      const title = partElement.find("h1").first().text().trim() || undefined;

      const passage = partElement.clone();
      passage.find("h1").first().remove();
      const passageHtml = toCleanHtml($, passage);

      const groups = $(`.questions-part[data-part="${partNumber}"] .question`)
        .map((__, questionElement) => {
          const questionBlock = $(questionElement);
          const rubricElement = questionBlock.find(".question-rubric").first();
          const rubricText = textOf($, rubricElement.clone());
          const rubricHtml = toCleanHtml($, rubricElement.clone());

          const contentElement = questionBlock.find(".question-content").first();
          const { type, selectCount } = detectGroupType($, contentElement);

          const wordBankElement = contentElement.find(".wordbank-grid").first();
          const wordBank =
            wordBankElement.length > 0
              ? parseWordBank($, wordBankElement.clone())
              : undefined;

          const id = questionBlock.attr("id") ?? `part-${partNumber}-group`;

          if (type === "tfng" || type === "ynng") {
            return {
              id,
              type,
              rubricHtml,
              selectCount,
              questions: parseFixedChoiceQuestions($, contentElement),
            };
          }

          if (type === "mcq") {
            return {
              id,
              type,
              rubricHtml,
              selectCount,
              questions: parseMcqQuestions($, contentElement),
            };
          }

          return {
            id,
            type: "completion" as const,
            rubricHtml,
            selectCount,
            bodyHtml: toSlotHtml($, contentElement.clone()),
            ...(wordBank && wordBank.length > 0 ? { wordBank } : {}),
            ...(wordBank && wordBank.length > 0
              ? {}
              : { maxWords: maxWordsFromRubric(rubricText) }),
          };
        })
        .get();

      return {
        number: partNumber,
        title,
        instructionsHtml,
        passageHtml,
        groups,
      };
    })
    .get()
    .sort((a, b) => a.number - b.number);

  const questionNumbers = Object.keys(key.correctAnswers)
    .map(Number)
    .sort((a, b) => a - b);
  const totalQuestions = questionNumbers.at(-1) ?? 0;

  const answers: TestImport["answerKey"]["answers"] = {};
  for (const number of questionNumbers) {
    const id = String(number);
    const canonical = key.correctAnswers[id];
    const variants = key.acceptableAnswers[id];
    // The source lists the canonical answer first when it has variants; keep
    // that order so the review screen shows the expected form.
    const accepted =
      variants && variants.length > 0
        ? [...new Set([canonical, ...variants])].filter(Boolean)
        : [canonical];

    const sourceEvidence = key.evidence[id];

    answers[id] = {
      accepted,
      ...(key.questionTypes[id] ? { type: key.questionTypes[id] } : {}),
      ...(key.explanations[id] ? { explanation: key.explanations[id] } : {}),
      ...(sourceEvidence?.para || sourceEvidence?.snippet
        ? {
            evidence: {
              ...(sourceEvidence.para ? { anchor: sourceEvidence.para } : {}),
              ...(sourceEvidence.snippet ? { snippet: sourceEvidence.snippet } : {}),
            },
          }
        : {}),
    };
  }

  return {
    slug: slugify(options.title),
    isPremium: options.isPremium ?? false,
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "reading",
      title: options.title,
      source: options.source,
      totalQuestions,
      durationSeconds: options.durationSeconds ?? 3600,
      parts,
    },
    answerKey: {
      schemaVersion: SCHEMA_VERSION,
      answers,
      sets: [],
    },
  } as TestImport;
}
