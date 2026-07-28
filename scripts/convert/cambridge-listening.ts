import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

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
 * Adapter for the "Cambridge 21 Listening Test 4" style file. Unlike the
 * reading file, question groups are not wrapped in a container: a section is a
 * flat run of `.q-range`, `.q-instruction` and content blocks, so groups are
 * assembled by walking children and starting a new one at each `.q-range`.
 */


type DraftGroup = {
  id: string;
  rangeLabel: string;
  rubricHtml: string;
  rubricText: string;
  type: "completion" | "mcq" | "matching";
  selectCount: number;
  bodyHtml?: string;
  wordBank?: Array<{ letter: string; textHtml: string }>;
  questions: Array<{ number: number; textHtml?: string; options?: Array<{ letter: string; textHtml: string }> }>;
  maxWords?: number;
};

function parseMcqOptions($: CheerioAPI, block: Cheerio<Element>) {
  return block
    .find("label")
    .map((_, label) => {
      const row = $(label);
      const letter = (row.find("input").attr("value") ?? "").trim().toUpperCase();
      const text = row.text().replace(/\s+/g, " ").trim().replace(/^[A-Z]\s+/, "");
      return { letter, textHtml: text };
    })
    .get()
    .filter((option) => /^[A-Z]$/.test(option.letter));
}

function stemOf($: CheerioAPI, block: Cheerio<Element>): string {
  const stem = block.find(".stem").first().clone();
  return toCleanHtml($, stem);
}

export function convertCambridgeListening(
  sourcePath: string,
  options: { title: string; source: string; isPremium?: boolean; durationSeconds?: number },
): TestImport {
  const $ = loadHtml(sourcePath);
  const key = extractJsonConst<Record<string, string[]>>($, "KEY");
  const audioSourceUrl = $("audio").first().attr("src") ?? undefined;

  const parts = $("section.part[data-part]")
    .map((_, sectionElement) => {
      const section = $(sectionElement);
      const partNumber = Number(section.attr("data-part"));

      const banner = section.find(".part-banner").first();
      const sectionTitle = section.find(".section-title").first().text().trim();
      const instructionsHtml =
        `<h3>${banner.find("h2").first().text().trim()}</h3>` +
        `<p>${banner.find("p").first().text().trim()}</p>` +
        (sectionTitle ? `<p><strong>${sectionTitle}</strong></p>` : "");

      const groups: DraftGroup[] = [];
      let current: DraftGroup | null = null;

      const startGroup = (label: string) => {
        current = {
          id: slugify(label) || `part-${partNumber}-group-${groups.length + 1}`,
          rangeLabel: label,
          rubricHtml: "",
          rubricText: "",
          type: "completion",
          selectCount: 1,
          questions: [],
        };
        groups.push(current);
      };

      section.children().each((__, childElement) => {
        const child = $(childElement);
        const classes = child.attr("class") ?? "";

        if (classes.includes("q-range")) {
          startGroup(textOf($, child.clone()));
          return;
        }

        if (!current) return;

        if (classes.includes("q-instruction")) {
          const clone = child.clone();
          current.rubricText = textOf($, child.clone());
          current.rubricHtml = `<h3>${current.rangeLabel}</h3><p>${toCleanHtml($, clone)}</p>`;
          return;
        }

        if (classes.includes("form-box")) {
          current.type = "completion";
          current.bodyHtml = toSlotHtml($, child.clone());
          current.maxWords = maxWordsFromRubric(current.rubricText);
          return;
        }

        if (classes.includes("mcq")) {
          current.type = "mcq";
          const multi = classes.includes("multi");
          const numbers = (multi ? (child.attr("data-qs") ?? "") : (child.attr("data-q") ?? ""))
            .split(",")
            .map((value) => Number(value.trim()))
            .filter(Number.isFinite);

          if (numbers.length === 0) return;
          current.selectCount = multi ? numbers.length : 1;
          current.questions.push({
            number: numbers[0],
            textHtml: stemOf($, child),
            options: parseMcqOptions($, child),
          });
          return;
        }

        if (classes.includes("dd-wrap")) {
          current.type = "matching";
          current.wordBank = child
            .find(".chip[data-letter]")
            .map((___, chip) => ({
              letter: ($(chip).attr("data-letter") ?? "").toUpperCase(),
              textHtml: $(chip).text().replace(/\s+/g, " ").trim(),
            }))
            .get()
            .filter((item) => /^[A-Z]$/.test(item.letter));

          current.questions = child
            .find(".match-row")
            .map((___, row) => {
              const item = $(row);
              const number = Number(item.find(".dropzone").attr("data-q"));
              return { number, textHtml: item.find(".mtext").text().replace(/\s+/g, " ").trim() };
            })
            .get()
            .filter((question) => Number.isFinite(question.number));
        }
      });

      return {
        number: partNumber,
        instructionsHtml,
        groups: groups
          .filter((group) => group.bodyHtml || group.questions.length > 0)
          .map((group) => ({
            id: group.id,
            type: group.type,
            rubricHtml: group.rubricHtml || `<h3>${group.rangeLabel}</h3>`,
            selectCount: group.selectCount,
            ...(group.bodyHtml ? { bodyHtml: group.bodyHtml } : {}),
            ...(group.wordBank ? { wordBank: group.wordBank } : {}),
            ...(group.questions.length > 0 ? { questions: group.questions } : {}),
            ...(group.maxWords ? { maxWords: group.maxWords } : {}),
          })),
      };
    })
    .get()
    .sort((a, b) => a.number - b.number);

  // Letters must be upper-cased to match the option and word bank letters;
  // typed answers are left exactly as the source authored them.
  const lettered = new Set<number>();
  const setGroups: Array<{ questions: number[] }> = [];

  for (const part of parts) {
    for (const group of part.groups) {
      const numbers = group.questions?.map((question) => question.number) ?? [];
      if (group.type === "mcq" || group.type === "matching") {
        for (const number of numbers) {
          for (let offset = 0; offset < group.selectCount; offset += 1) {
            lettered.add(number + offset);
          }
        }
      }
      if (group.selectCount > 1) {
        for (const number of numbers) {
          setGroups.push({
            questions: Array.from({ length: group.selectCount }, (_, i) => number + i),
          });
        }
      }
    }
  }

  const inASet = new Set(setGroups.flatMap((group) => group.questions));
  const answers: TestImport["answerKey"]["answers"] = {};

  for (const [id, values] of Object.entries(key)) {
    const number = Number(id);
    if (inASet.has(number)) continue;

    const accepted = values.map((value) =>
      lettered.has(number) ? value.trim().toUpperCase() : value,
    );
    answers[id] = { accepted };
  }

  const sets = setGroups.map((group) => ({
    questions: group.questions,
    accepted: (key[String(group.questions[0])] ?? []).map((value) => value.trim().toUpperCase()),
  }));

  const totalQuestions = Math.max(...Object.keys(key).map(Number));

  return {
    slug: slugify(options.title),
    isPremium: options.isPremium ?? false,
    audioSourceUrl,
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "listening",
      title: options.title,
      source: options.source,
      totalQuestions,
      durationSeconds: options.durationSeconds ?? 1980,
      parts,
    },
    answerKey: {
      schemaVersion: SCHEMA_VERSION,
      answers,
      sets,
    },
  } as TestImport;
}
