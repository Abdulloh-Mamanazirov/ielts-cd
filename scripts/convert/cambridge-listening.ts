import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AnswerEntry, QuestionGroup, TestImport, TestPart } from "../../src/lib/tests/schema";
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
 * Adapter for the Cambridge listening books.
 *
 * Same family as the reading export but a different shape: the four parts are
 * `section.part[data-part]`, and inside each one the groups are not nested in
 * containers — they are a flat run of children delimited by `.q-range` headings
 * ("Questions 1–6"). So the walk below starts a new group at every `.q-range`
 * and gathers everything after it until the next one.
 *
 * The recording is hot-linked from archive.org rather than embedded, so the URL
 * is recorded as `audioSourceUrl` for the uploader to download and re-host.
 */

type Meta = {
  title: string;
  slug: string;
  source: string;
  durationSeconds: number;
  isPremium: boolean;
};

/** Where a "label the map" image is written, so the player can serve it. */
export type ListeningAssets = { mediaDir: string; mediaUrlBase: string };

function optionalConst<T>($: Cheerio, name: string, fallback: T): T {
  try {
    return extractJsonConst<T>($, name);
  } catch {
    return fallback;
  }
}

/**
 * `QTYPE` is built by code — `set(1,6,'Table completion')` — rather than stored
 * as data, so the ranges are read from those calls.
 */
function readQuestionTypes(html: string): Record<string, string> {
  const types: Record<string, string> = {};
  const calls = html.matchAll(/set\(\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([^'"]+)['"]\s*\)/g);
  for (const [, from, to, label] of calls) {
    for (let n = Number(from); n <= Number(to); n += 1) types[String(n)] = label;
  }
  return types;
}

export function convertCambridgeListening(
  path: string,
  meta: Meta,
  assets?: ListeningAssets,
): TestImport {
  const $ = loadHtml(path);
  const raw = $.html();

  const key = extractJsonConst<Record<string, string[]>>($, "KEY");
  const evidence = optionalConst<Record<string, { text?: string }>>($, "evidence", {});
  const types = readQuestionTypes(raw);

  // The recording lives on someone else's server; the uploader re-hosts it.
  const audioSourceUrl = raw.match(/https:\/\/archive\.org\/download\/[^"'\s)]+\.mp3/i)?.[0];

  const parts: TestPart[] = [];
  const setSpans: number[][] = [];

  $("section.part[data-part]").each((_, section) => {
    const number = Number($(section).attr("data-part") ?? parts.length + 1);
    const groups: QuestionGroup[] = [];

    // A group opens at each "Questions n–m" heading and runs to the next one.
    let rubricParts: string[] = [];
    let bucket: ReturnType<Cheerio>[] = [];

    const flush = () => {
      if (rubricParts.length === 0 || bucket.length === 0) return;
      const group = buildGroup($, rubricParts, bucket, groups.length, number, {
        slug: meta.slug,
        assets,
      });
      if (group) {
        groups.push(group);
        if (group.selectCount > 1) {
          for (const question of group.questions ?? []) {
            setSpans.push(
              Array.from(
                { length: group.selectCount },
                (_unused, offset) => question.number + offset,
              ),
            );
          }
        }
      }
      bucket = [];
    };

    $(section)
      .children()
      .each((__, child) => {
        const node = $(child);
        const className = node.attr("class") ?? "";

        if (className.includes("q-range")) {
          flush();
          rubricParts = [toCleanHtml($, node.clone())];
          return;
        }
        // The banner is the part's own title, not part of any group.
        if (className.includes("part-banner")) return;

        if (className.includes("q-instruction")) {
          rubricParts.push(toCleanHtml($, node.clone()));
          return;
        }

        bucket.push(node);
      });

    flush();

    parts.push({
      number,
      instructionsHtml:
        toCleanHtml($, $(section).find(".part-banner").first().clone()) || undefined,
      groups,
    });
  });

  const inASet = new Set(setSpans.flat());

  const sets = setSpans.map((numbers) => {
    const first = String(numbers[0]);
    // A "choose TWO" item repeats the same pair of letters under both numbers,
    // so the union — not the concatenation — is the accepted set.
    const accepted = [...new Set(numbers.flatMap((n) => key[String(n)] ?? []))];
    return {
      questions: numbers,
      accepted,
      type: types[first],
      evidence: evidence[first]?.text ? { snippet: evidence[first].text } : undefined,
    };
  });

  const answers: Record<string, AnswerEntry> = {};
  for (const [number, accepted] of Object.entries(key)) {
    if (inASet.has(Number(number))) continue;
    if (!accepted || accepted.length === 0) continue;

    answers[number] = {
      accepted,
      type: types[number],
      evidence: evidence[number]?.text ? { snippet: evidence[number].text } : undefined,
    };
  }

  return {
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "listening",
      title: meta.title,
      source: meta.source,
      totalQuestions: Object.keys(key).length,
      durationSeconds: meta.durationSeconds,
      parts,
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers, sets },
    slug: meta.slug,
    isPremium: meta.isPremium,
    audioSourceUrl,
  };
}

/** Writes a base64 map image out beside the other test media. */
function extractImage(
  $: Cheerio,
  root: ReturnType<Cheerio>,
  name: string,
  assets?: ListeningAssets,
): string | undefined {
  const src = root.find('img[src^="data:image"]').first().attr("src") ?? "";
  const match = src.match(/^data:image\/([a-z0-9]+);base64,(.+)$/i);
  if (!match) return undefined;

  const file = `${name}-map.${match[1] === "jpeg" ? "jpg" : match[1]}`;
  if (assets) {
    mkdirSync(resolve(assets.mediaDir), { recursive: true });
    writeFileSync(resolve(assets.mediaDir, file), Buffer.from(match[2], "base64"));
  }
  return `${assets?.mediaUrlBase ?? "/test-media"}/${file}`;
}

function buildGroup(
  $: Cheerio,
  rubricParts: string[],
  bucket: ReturnType<Cheerio>[],
  index: number,
  part: number,
  media: { slug: string; assets?: ListeningAssets },
): QuestionGroup | null {
  const rubricHtml = rubricParts.join("");
  const rubricText = rubricParts.join(" ").replace(/<[^>]*>/g, " ");
  const id = `part-${part}-group-${index + 1}`;
  const base = { id, rubricHtml, selectCount: 1 as const };

  // Multiple choice, single or "choose TWO letters".
  const choices = bucket.filter((node) => (node.attr("class") ?? "").includes("mcq"));
  if (choices.length > 0) {
    const questions: NonNullable<QuestionGroup["questions"]> = [];
    let selectCount = 1;

    for (const node of choices) {
      const options = node
        .find("label")
        .map((_, label) => ({
          letter: $(label).find("input").attr("value") ?? "",
          textHtml: textOf($, $(label).clone()).replace(/^[A-Z]\s*/, ""),
        }))
        .get()
        .filter((option) => /^[A-Z]$/.test(option.letter));

      const spans = (node.attr("data-qs") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      const number = spans.length > 0 ? spans[0] : Number(node.attr("data-q"));
      if (!Number.isFinite(number)) continue;

      if (spans.length > 1) selectCount = Math.max(selectCount, spans.length);

      const stem = node.find(".stem").first();
      questions.push({
        number,
        textHtml: stem.length > 0 ? toCleanHtml($, stem.clone()) : undefined,
        options,
      });
    }

    if (questions.length === 0) return null;
    return { ...base, type: "mcq", selectCount, questions };
  }

  // "Label the map": an image with lettered positions, and a bank of chips —
  // one per question — to place on them.
  const map = bucket.find((node) => (node.attr("class") ?? "").includes("map-dd"));
  if (map) {
    const letters = [
      ...new Set(
        map
          .find("[data-letter]")
          .map((_, node) => ($(node).attr("data-letter") ?? "").toUpperCase())
          .get()
          .filter((letter) => /^[A-Z]$/.test(letter)),
      ),
    ];

    const questions = map
      .find(".place-chip[data-q]")
      .map((_, chip) => ({
        number: Number($(chip).attr("data-q")),
        textHtml: textOf($, $(chip).find(".pc-text").first().clone()),
      }))
      .get()
      .filter((question) => Number.isFinite(question.number));

    if (questions.length > 0) {
      return {
        ...base,
        type: "map_labeling",
        imageUrl: extractImage($, map, `${media.slug}-p${part}`, media.assets),
        wordBank: letters.map((letter) => ({ letter, textHtml: letter })),
        questions,
      };
    }
  }

  // Matching: a column of labelled drop zones beside a bank of draggable chips.
  const dd = bucket.find((node) => (node.attr("class") ?? "").includes("dd-wrap"));
  if (dd) {
    const wordBank = dd
      .find(".chip[data-letter]")
      .map((_, chip) => ({
        letter: ($(chip).attr("data-letter") ?? "").toUpperCase(),
        textHtml: textOf($, $(chip).clone()),
      }))
      .get()
      .filter((entry) => /^[A-Z]$/.test(entry.letter));

    const questions = dd
      .find(".match-row")
      .map((_, row) => ({
        number: Number($(row).find(".dropzone").first().attr("data-q")),
        textHtml: toCleanHtml($, $(row).find(".mtext").first().clone()),
      }))
      .get()
      .filter((question) => Number.isFinite(question.number));

    if (wordBank.length > 0 && questions.length > 0) {
      return { ...base, type: "matching", wordBank, questions };
    }
  }

  // Everything else is a completion body — a table, notes or a form.
  const wrapper = $("<div></div>");
  for (const node of bucket) wrapper.append(node.clone());

  const bodyHtml = toSlotHtml($, wrapper);
  if (!/\{\{\s*\d+\s*\}\}/.test(bodyHtml)) return null;

  return {
    ...base,
    type: "completion",
    bodyHtml,
    maxWords: maxWordsFromRubric(rubricText),
  };
}
