import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import type { TestImport } from "../../src/lib/tests/schema";
import {
  extractJsonConst,
  loadHtml,
  maxWordsFromRubric,
  slugify,
  textOf,
  toCleanHtml,
  toSlotHtml,
} from "./lib";

/**
 * Adapter for the single-passage practice file. One part, questions split into
 * `.question[data-q-start]` blocks, answer key in a `CA` object whose values are
 * either a plain string or a list of accepted variants.
 */


export function convertGiraffesReading(
  sourcePath: string,
  options: { title: string; source: string; isPremium?: boolean; durationSeconds?: number },
): TestImport {
  const $ = loadHtml(sourcePath);
  const rawKey = extractJsonConst<Record<string, string | string[]>>($, "CA");

  const passageElement = $(".reading-passage").first().clone();
  const passageTitle = passageElement.find("h4").first().text().trim();
  passageElement.find("h4").first().remove();
  const passageHtml = toCleanHtml($, passageElement);

  const partHeader = $(".part-header").first();
  const instructionsHtml = partHeader.length
    ? `<h3>Part 1</h3><p>${partHeader.find("p").last().text().trim()}</p>`
    : undefined;

  const groups = $(".questions-panel .question")
    .map((_, element) => {
      const block = $(element);
      const from = Number(block.attr("data-q-start"));
      const to = Number(block.attr("data-q-end"));
      const id = `questions-${from}-${to}`;

      const prompt = block.find(".question-prompt").first();
      const rubricText = textOf($, prompt.clone());
      const rubricHtml = toCleanHtml($, prompt.clone());

      const fixedChoice = block.find(".tf-question");
      if (fixedChoice.length > 0) {
        const questions = fixedChoice
          .map((__, item) => {
            const question = $(item);
            return {
              number: Number(question.find(".tf-question-number").first().text().trim()),
              textHtml: question.find(".tf-question-text").first().text().replace(/\s+/g, " ").trim(),
            };
          })
          .get()
          .filter((question) => Number.isFinite(question.number));

        return { id, type: "tfng" as const, rubricHtml, selectCount: 1, questions };
      }

      const body = block.clone();
      body.find(".question-prompt").remove();

      return {
        id,
        type: "completion" as const,
        rubricHtml,
        selectCount: 1,
        bodyHtml: toSlotHtml($, body),
        maxWords: maxWordsFromRubric(rubricText),
      };
    })
    .get();

  const answers: TestImport["answerKey"]["answers"] = {};
  for (const [id, value] of Object.entries(rawKey)) {
    answers[id] = { accepted: Array.isArray(value) ? value : [value] };
  }

  const totalQuestions = Math.max(...Object.keys(rawKey).map(Number));

  return {
    slug: slugify(options.title),
    isPremium: options.isPremium ?? false,
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "reading",
      title: options.title,
      source: options.source,
      description: passageTitle || undefined,
      totalQuestions,
      durationSeconds: options.durationSeconds ?? 1200,
      parts: [
        {
          number: 1,
          title: passageTitle || undefined,
          instructionsHtml,
          passageHtml,
          groups,
        },
      ],
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers, sets: [] },
  } as TestImport;
}
