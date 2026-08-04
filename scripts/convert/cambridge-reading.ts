import type {
  AnswerEntry,
  QuestionGroup,
  TestImport,
  TestPart,
} from "../../src/lib/tests/schema";
import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import {
  extractJsonConst,
  loadHtml,
  maxWordsFromRubric,
  toCleanHtml,
  toSlotHtml,
  textOf,
  type Cheerio,
} from "./lib";

/**
 * Adapter for the Cambridge books exported from the Inspera-style CDI player.
 *
 * A different animal from the @bekhruzposts files: the questions are marked up
 * by type rather than by a generic slot, and — the reason this adapter is worth
 * having — the source ships its own `explanations`, `questionTypes` and, best of
 * all, an `evidence` map giving the paragraph and the exact sentence each answer
 * comes from. That is precisely what the review screen's "see where I went
 * wrong" marks need, so these tests arrive with better review content than
 * anything converted so far.
 *
 * Six group shapes appear across the books, and all six are handled below:
 * note/summary completion (with and without a word bank), TRUE/FALSE/NOT GIVEN,
 * YES/NO/NOT GIVEN, matching to lettered passage sections, and multiple choice.
 */

type Meta = {
  title: string;
  slug: string;
  source: string;
  durationSeconds: number;
  isPremium: boolean;
};

/** `evidence` in the source: which paragraph and sentence proves each answer. */
type SourceEvidence = { para?: string; snippet?: string; part?: number };

/** Reads a constant that only some tests define. */
function optionalConst<T>($: Cheerio, name: string, fallback: T): T {
  try {
    return extractJsonConst<T>($, name);
  } catch {
    return fallback;
  }
}

/** "question-group-14-17" -> [14, 17]. */
function groupRange(id: string): [number, number] | null {
  const match = id.match(/question-group-(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const from = Number(match[1]);
  return [from, match[2] ? Number(match[2]) : from];
}

export function convertCambridgeReading(path: string, meta: Meta): TestImport {
  const $ = loadHtml(path);

  const correct = extractJsonConst<Record<string, string>>($, "correctAnswers");
  const acceptable = optionalConst<Record<string, string[]>>($, "acceptableAnswers", {});
  const explanations = optionalConst<Record<string, string>>($, "explanations", {});
  const evidence = optionalConst<Record<string, SourceEvidence>>($, "evidence", {});
  const types = optionalConst<Record<string, string>>($, "questionTypes", {});
  const partRanges = optionalConst<Record<string, [number, number]>>($, "PART_RANGES", {});
  // Only the books with a drag-and-drop summary carry a bank of phrases.
  const wordOptions = optionalConst<Array<[string, string]>>($, "WORD_OPTIONS", []);

  // Which part a question number belongs to, from the source's own ranges.
  const partOf = (n: number): number => {
    for (const [part, [from, to]] of Object.entries(partRanges)) {
      if (n >= from && n <= to) return Number(part);
    }
    return 1;
  };

  const groups = new Map<number, QuestionGroup[]>();
  // "Choose TWO letters" items are graded as one unordered set, so the numbers
  // they consume are answered together rather than one at a time.
  const setSpans: number[][] = [];

  $(".question").each((_, element) => {
    const holder = $(element);
    const range = groupRange(holder.attr("id") ?? "");
    if (!range) return;

    const group = buildGroup($, holder, range, wordOptions);
    if (!group) return;

    if (group.selectCount > 1) {
      for (const question of group.questions ?? []) {
        setSpans.push(
          Array.from({ length: group.selectCount }, (_unused, offset) => question.number + offset),
        );
      }
    }

    const part = partOf(range[0]);
    groups.set(part, [...(groups.get(part) ?? []), group]);
  });

  const parts: TestPart[] = [];

  $(".passage-part").each((_, element) => {
    const number = Number($(element).attr("data-part") ?? parts.length + 1);
    const rubric = $(element).find(".sectionRubric").first();
    const instructionsHtml = rubric.length > 0 ? toCleanHtml($, rubric.clone()) : undefined;

    // `.sectionRubric` is dropped by the shared cleaner, so it is captured above
    // as the part's instructions rather than left inside the passage.
    const passageHtml = toCleanHtml($, $(element).clone());

    parts.push({
      number,
      title: $(element).find("h1").first().text().trim() || undefined,
      instructionsHtml,
      passageHtml,
      groups: groups.get(number) ?? [],
    });
  });

  const asEvidence = (found: SourceEvidence | undefined) =>
    found?.snippet || found?.para ? { anchor: found.para, snippet: found.snippet } : undefined;

  // Numbers answered as part of a set are not answered individually.
  const inASet = new Set(setSpans.flat());

  const sets = setSpans.map((numbers) => {
    const first = String(numbers[0]);
    return {
      questions: numbers,
      accepted: numbers.map((n) => correct[String(n)]).filter(Boolean),
      type: types[first],
      explanation: explanations[first],
      evidence: asEvidence(evidence[first]),
    };
  });

  const answers: Record<string, AnswerEntry> = {};
  for (const [number, value] of Object.entries(correct)) {
    if (inASet.has(Number(number))) continue;
    const extra = (acceptable[number] ?? []).filter((entry) => entry !== value);

    answers[number] = {
      // The canonical form first — it is what the review screen prints.
      accepted: [value, ...extra],
      type: types[number],
      explanation: explanations[number],
      evidence: asEvidence(evidence[number]),
    };
  }

  return {
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "reading",
      title: meta.title,
      source: meta.source,
      totalQuestions: Object.keys(correct).length,
      durationSeconds: meta.durationSeconds,
      parts,
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers, sets },
    slug: meta.slug,
    isPremium: meta.isPremium,
  };
}

function buildGroup(
  $: Cheerio,
  holder: ReturnType<Cheerio>,
  [from, to]: [number, number],
  wordOptions: Array<[string, string]>,
): QuestionGroup | null {
  const id = `part-q${from}-${to}`;
  const rubricNode = holder.find(".question-rubric").first();
  const rubricHtml = rubricNode.length > 0 ? toCleanHtml($, rubricNode.clone()) : "";
  const rubricText = rubricNode.length > 0 ? textOf($, rubricNode.clone()) : "";
  const maxWords = maxWordsFromRubric(rubricText);

  const content = holder.find(".question-content").first();
  if (content.length === 0) return null;

  const base = { id, rubricHtml, maxWords, selectCount: 1 as const };

  // 1. Matching to lettered sections of the passage: a grid of radio buttons.
  if (content.find(".matching-radio").length > 0) {
    const letters = content
      .find("th.letter-th")
      .map((_, cell) => $(cell).text().trim())
      .get()
      .filter((letter) => /^[A-Z]$/.test(letter));

    const questions = content
      .find("tr[id^='question-']")
      .map((_, row) => ({
        number: Number(($(row).attr("id") ?? "").replace("question-", "")),
        textHtml: toCleanHtml($, $(row).find(".stmt-text").first().clone()),
      }))
      .get()
      .filter((question) => Number.isFinite(question.number));

    // The columns are passage sections, so the letter *is* the option text.
    return {
      ...base,
      type: "matching",
      wordBank: letters.map((letter) => ({ letter, textHtml: letter })),
      questions,
    };
  }

  // 2a. "Choose TWO letters" — checkboxes in a .mcq-multi whose id spans the two
  //     question numbers it consumes. The stem is stated in the rubric, so the
  //     item carries only its options.
  const multi = content.find(".mcq-multi").first();
  if (multi.length > 0) {
    const span = (multi.attr("id") ?? "").match(/multi-(\d+)-(\d+)$/);
    const start = span ? Number(span[1]) : from;
    const end = span ? Number(span[2]) : to;

    const options = multi
      .find(".mcq-row")
      .map((_, row) => ({
        letter: $(row).find("input").attr("value") ?? "",
        textHtml: toCleanHtml($, $(row).find("span").last().clone()),
      }))
      .get()
      .filter((option) => /^[A-Z]$/.test(option.letter));

    return {
      ...base,
      type: "mcq",
      selectCount: Math.max(2, end - start + 1),
      questions: [{ number: start, options }],
    };
  }

  // 2b. Ordinary multiple choice. Each block of rows shares one input name.
  if (content.find(".mcq-row").length > 0) {
    const questions = content
      .find(".mcq-single")
      .map((_, block) => {
        const rows = $(block).find(".mcq-row");
        const name = rows.find("input").first().attr("name") ?? "";
        const number = Number(name.replace(/^q/, ""));

        // The stem sits in the block that precedes the options.
        const stem = $(block).prevAll().find("p").first();

        return {
          number,
          textHtml: stem.length > 0 ? toCleanHtml($, stem.clone()) : undefined,
          options: rows
            .map((__, row) => {
              const letter = $(row).find("input").attr("value") ?? "";
              const label = $(row).find("span").last();
              return { letter, textHtml: toCleanHtml($, label.clone()) };
            })
            .get()
            .filter((option) => /^[A-Z]$/.test(option.letter)),
        };
      })
      .get()
      .filter((question) => Number.isFinite(question.number));

    return { ...base, type: "mcq", questions };
  }

  // 3. TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN share one markup; the radio
  //    values are what tell them apart.
  if (content.find(".tfng-question").length > 0) {
    const values = new Set(
      content
        .find("input[type='radio']")
        .map((_, input) => ($(input).attr("value") ?? "").toUpperCase())
        .get(),
    );

    const questions = content
      .find(".tfng-question")
      .map((_, node) => ({
        number: Number($(node).find(".tfng-number").first().text().trim()),
        textHtml: toCleanHtml($, $(node).find(".tfng-statement-text").first().clone()),
      }))
      .get()
      .filter((question) => Number.isFinite(question.number));

    return { ...base, type: values.has("YES") ? "ynng" : "tfng", questions };
  }

  // 4. Everything else is a completion body: notes, a summary, a table or a
  //    flow-chart, with `.blank-wrapper` spans that become {{n}} slots.
  const body = content.clone();
  const bodyHtml = toSlotHtml($, body);
  if (!/\{\{\s*\d+\s*\}\}/.test(bodyHtml)) return null;

  // A summary filled from a bank of phrases rather than from the passage.
  const usesBank = content.find("#optionBank, .option-bank").length > 0 && wordOptions.length > 0;

  return {
    ...base,
    type: "completion",
    bodyHtml,
    wordBank: usesBank
      ? wordOptions
          .filter(([letter]) => /^[A-Z]$/.test(letter))
          .map(([letter, text]) => ({ letter, textHtml: text }))
      : undefined,
    // A word bank answer is a letter, so a word ceiling would be nonsense.
    maxWords: usesBank ? undefined : maxWords,
  };
}
