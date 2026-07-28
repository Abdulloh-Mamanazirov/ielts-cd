import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import type { TestImport } from "../../src/lib/tests/schema";
import {
  extractJsonConst,
  extractStringConst,
  loadHtml,
  maxWordsFromRubric,
  slugify,
  textOf,
  toCleanHtml,
  toSlotHtml,
} from "./lib";

/**
 * Adapter for the "IELTS CDI Listening Practice" file: four `.question-part`
 * sections, each holding `.question` groups whose type has to be inferred from
 * the controls the author used — text inputs, radios, a select per map label,
 * or drag targets.
 *
 * Its `checkboxGroups` and `aliasMap` constants are dead code left over from an
 * earlier version of the page; nothing in the markup uses them.
 */

type Group = {
  id: string;
  type: "completion" | "mcq" | "matching" | "map_labeling";
  rubricHtml: string;
  selectCount: number;
  bodyHtml?: string;
  imageUrl?: string;
  wordBank?: Array<{ letter: string; textHtml: string }>;
  questions?: Array<{
    number: number;
    textHtml?: string;
    options?: Array<{ letter: string; textHtml: string }>;
  }>;
  maxWords?: number;
};

function parseSingleChoice($: CheerioAPI, block: Cheerio<Element>) {
  return block
    .find(".single-choice")
    .map((_, element) => {
      const item = $(element);
      const stem = item.find("p").first();
      const number = Number(stem.find("strong").first().text().trim());

      const text = stem.clone();
      text.find("strong").first().remove();

      const options = item
        .find("label")
        .map((__, label) => {
          const row = $(label);
          const letter = (row.find("input").attr("value") ?? "").trim().toUpperCase();
          return { letter, textHtml: row.text().replace(/\s+/g, " ").trim() };
        })
        .get()
        .filter((option) => /^[A-Z]$/.test(option.letter));

      return { number, textHtml: toCleanHtml($, text), options };
    })
    .get()
    .filter((question) => Number.isInteger(question.number) && question.number > 0);
}

/** Map labels: the question number sits in a <strong>, the answer in a <select>. */
function parseMapItems($: CheerioAPI, block: Cheerio<Element>) {
  return block
    .find(".matching-question-item")
    .map((_, element) => {
      const item = $(element);
      const select = item.find("select").first();
      const number = Number((select.attr("id") ?? "").replace(/^q/, ""));

      const text = item.find(".question-text").first().clone();
      text.find("strong").first().remove();

      return { number, textHtml: text.text().replace(/\s+/g, " ").trim() };
    })
    .get()
    .filter((question) => Number.isInteger(question.number) && question.number > 0);
}

/** Drag targets: the number lives inside the drop zone, keyed by data-question. */
function parseDragItems($: CheerioAPI, block: Cheerio<Element>) {
  return block
    .find(".matching-question-item")
    .map((_, element) => {
      const item = $(element);
      const zone = item.find("[data-question]").first();
      const number = Number((zone.attr("data-question") ?? "").replace(/^q/, ""));

      const text = item.find(".question-text").first().clone();
      text.find("strong").first().remove();

      return { number, textHtml: text.text().replace(/\s+/g, " ").trim() };
    })
    .get()
    .filter((question) => Number.isInteger(question.number) && question.number > 0);
}

function lettersFromSelect($: CheerioAPI, block: Cheerio<Element>) {
  return block
    .find("select")
    .first()
    .find("option")
    .map((_, option) => ($(option).attr("value") ?? "").trim().toUpperCase())
    .get()
    .filter((value) => /^[A-Z]$/.test(value))
    .map((letter) => ({ letter, textHtml: letter }));
}

export function convertMockListening(
  sourcePath: string,
  options: {
    title: string;
    source: string;
    isPremium?: boolean;
    durationSeconds?: number;
    /** Local copy of the map image, since the source hot-links archive.org. */
    mapImageUrl?: string;
  },
): TestImport {
  const $ = loadHtml(sourcePath);
  // Typed answers are stored as a list of variants, letter answers as a bare
  // string, so both shapes have to be accepted.
  const correct = extractJsonConst<Record<string, string | string[]>>($, "correctAnswers");
  const audioSourceUrl = extractStringConst($, "audioSource");

  const parts = $(".question-part[id^='part-']")
    .map((_, sectionElement) => {
      const section = $(sectionElement);
      const partNumber = Number((section.attr("id") ?? "").replace("part-", ""));

      const header = section.find(".part-header").first();
      const instructionsHtml = header
        .find("p")
        .map((__, p) => `<p>${$(p).text().trim()}</p>`)
        .get()
        .join("")
        .replace(/^<p>/, "<h3>")
        .replace(/<\/p>/, "</h3>");

      const groups = section
        .find(".question")
        .map((__, questionElement) => {
          const block = $(questionElement);
          const promptElement = block.find(".question-prompt").first();
          const rubricText = textOf($, promptElement.clone());
          const rubricHtml = toCleanHtml($, promptElement.clone());
          const id = slugify(rubricText.split(".")[0]) || `part-${partNumber}-group`;

          const content = block.clone();
          content.find(".question-prompt").remove();

          const hasSelect = content.find("select.answer-select").length > 0;
          const hasDrag = content.find("[data-question]").length > 0;
          const hasRadio = content.find(".single-choice").length > 0;

          if (hasRadio) {
            return {
              id,
              type: "mcq" as const,
              rubricHtml,
              selectCount: 1,
              questions: parseSingleChoice($, content),
            } satisfies Group;
          }

          if (hasSelect) {
            const image = content.find("img").first().attr("src");
            return {
              id,
              type: "map_labeling" as const,
              rubricHtml,
              selectCount: 1,
              ...(options.mapImageUrl ?? image ? { imageUrl: options.mapImageUrl ?? image } : {}),
              wordBank: lettersFromSelect($, content),
              questions: parseMapItems($, content),
            } satisfies Group;
          }

          if (hasDrag) {
            const wordBank = content
              .find(".drag-item[data-value]")
              .map((___, chip) => {
                const item = $(chip);
                const letter = (item.attr("data-value") ?? "").toUpperCase();
                const label = item.clone();
                label.find("strong").first().remove();
                return { letter, textHtml: label.text().replace(/\s+/g, " ").trim() };
              })
              .get()
              .filter((entry) => /^[A-Z]$/.test(entry.letter));

            return {
              id,
              type: "matching" as const,
              rubricHtml,
              selectCount: 1,
              wordBank,
              questions: parseDragItems($, content),
            } satisfies Group;
          }

          return {
            id,
            type: "completion" as const,
            rubricHtml,
            selectCount: 1,
            bodyHtml: toSlotHtml($, content),
            ...(maxWordsFromRubric(rubricText)
              ? { maxWords: maxWordsFromRubric(rubricText) }
              : {}),
          } satisfies Group;
        })
        .get() as Group[];

      const populated = groups.filter(
        (group) => group.bodyHtml || (group.questions?.length ?? 0) > 0,
      );

      return { number: partNumber, instructionsHtml, groups: populated };
    })
    .get()
    .sort((a, b) => a.number - b.number);

  const lettered = new Set<number>();
  for (const part of parts) {
    for (const group of part.groups) {
      if (group.type === "completion") continue;
      for (const question of group.questions ?? []) lettered.add(question.number);
    }
  }

  const answers: TestImport["answerKey"]["answers"] = {};
  for (const [key, value] of Object.entries(correct)) {
    const number = Number(key.replace(/^q/, ""));
    if (!Number.isFinite(number)) continue;
    const variants = Array.isArray(value) ? value : [value];
    answers[String(number)] = {
      accepted: variants.map((entry) =>
        lettered.has(number) ? entry.trim().toUpperCase() : entry,
      ),
    };
  }

  return {
    slug: slugify(options.title),
    isPremium: options.isPremium ?? false,
    audioSourceUrl,
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "listening",
      title: options.title,
      source: options.source,
      totalQuestions: Math.max(...Object.keys(answers).map(Number)),
      durationSeconds: options.durationSeconds ?? 1980,
      parts,
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers, sets: [] },
  } as TestImport;
}
