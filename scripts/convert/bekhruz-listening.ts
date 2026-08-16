import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import type { QuestionGroup, TestImport } from "../../src/lib/tests/schema";
import { extractJsonConst, maxWordsFromRubric, slugify, toCleanHtml, toSlotHtml } from "./lib";

/**
 * Adapter for the "@bekhruzposts" listening exports (Volume 1). One template
 * across all ten: four `.part-content` sections, groups introduced by an italic
 * "Questions X–Y: ..." leader, and two inline answer objects —
 *
 *   const correctAnswers = { 1:'theatre', 2:['4.30','4:30'], ... };  // single
 *   const pickGroups     = [{ qNums:[21,22], target:['A','C'] }, ...]; // choose-two
 *
 * The audio is a single base64 data URL, extracted to an .mp3 the existing
 * upload pipeline can ingest; a "Label the map" group carries a base64 image
 * that is written into public/test-media the same way.
 */

export type ListeningAssets = {
  /** Where to write the extracted audio, e.g. "_source-tests/<slug>.mp3". */
  audioPath: string;
  /** Directory for extracted map images, e.g. "public/test-media". */
  mediaDir: string;
  /** Public URL prefix those images are served from, e.g. "/test-media". */
  mediaUrlBase: string;
};

type PickGroup = { name?: string; qNums: number[]; target: string[] };
type Option = { letter: string; textHtml: string };
type Segment = { leaderText: string; leaderHtml: string; bodyNodes: Element[] };

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

/**
 * The audio arrives one of two ways: embedded as a base64 data URL, or
 * hot-linked from an external host. base64 is decoded to bytes for extraction;
 * an external URL is passed back as `audioSourceUrl` so `audio:upload
 * --from-source` can re-host it. Either way the giant string is dropped before
 * cheerio parses the rest.
 */
function extractAudio(html: string): { bytes: Buffer | null; audioSourceUrl?: string; html: string } {
  const b64 = html.match(/src="data:audio\/[a-z0-9]+;base64,([A-Za-z0-9+/=]+)"/);
  if (b64) return { bytes: Buffer.from(b64[1], "base64"), html: html.replace(b64[0], 'src=""') };

  const ext = html.match(/<audio[^>]*\ssrc="(https?:\/\/[^"]+)"/i);
  if (ext) return { bytes: null, audioSourceUrl: ext[1].replace(/&amp;/g, "&"), html };

  return { bytes: null, html };
}

function isLeader($: CheerioAPI, node: Element): boolean {
  if (($(node).get(0) as Element).tagName !== "p") return false;
  return /^Questions?\s*\d+/i.test($(node).text().replace(/\s+/g, " ").trim());
}

function segment($: CheerioAPI, content: Cheerio<Element>): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;
  content.children().each((_, node) => {
    if (isLeader($, node as Element)) {
      current = {
        leaderText: $(node).text().replace(/\s+/g, " ").trim(),
        leaderHtml: `<p>${$(node).html()?.replace(/\s+/g, " ").trim()}</p>`,
        bodyNodes: [],
      };
      segments.push(current);
      return;
    }
    if (current) current.bodyNodes.push(node as Element);
  });
  return segments;
}

function bodyOf($: CheerioAPI, seg: Segment): Cheerio<Element> {
  const wrap = $("<div></div>");
  for (const node of seg.bodyNodes) wrap.append($(node).clone());
  return wrap as unknown as Cheerio<Element>;
}

type AnswerSet = { questions: number[]; accepted: string[] };

/**
 * "Choose TWO/THREE letters" groups. The checkbox name is a range (`q18_20`
 * covers 18, 19 and 20). The set of correct letters comes from `pickGroups`
 * when the export split them out, and otherwise from `correctAnswers`, which is
 * where the single-object exports keep them.
 */
function buildSets(
  $: CheerioAPI,
  correctAnswers: Record<string, string | string[]>,
  pickGroups: PickGroup[],
): Map<number, AnswerSet> {
  const byMin = new Map<number, PickGroup>();
  for (const pg of pickGroups) byMin.set(Math.min(...pg.qNums), pg);

  const sets = new Map<number, AnswerSet>();
  const seenNames = new Set<string>();
  $("input[type=checkbox][name]").each((_, el) => {
    const name = $(el).attr("name") ?? "";
    const m = name.match(/^q(\d+)_(\d+)$/);
    if (!m || seenNames.has(name)) return;
    seenNames.add(name);
    const from = Number(m[1]);
    const to = Number(m[2]);
    const questions: number[] = [];
    for (let n = from; n <= to; n += 1) questions.push(n);
    const pg = byMin.get(from);
    const accepted = pg
      ? pg.target.map((s) => s.trim())
      : questions
          .map((n) => {
            const v = correctAnswers[String(n)];
            return String((Array.isArray(v) ? v[0] : v) ?? "").trim();
          })
          .filter(Boolean);
    sets.set(from, { questions, accepted });
  });

  // A pickGroups entry with no checkbox in the markup (defensive; unseen so far).
  for (const pg of pickGroups) {
    const first = Math.min(...pg.qNums);
    if (!sets.has(first)) {
      sets.set(first, { questions: [...pg.qNums].sort((a, b) => a - b), accepted: pg.target.map((s) => s.trim()) });
    }
  }
  return sets;
}

/** Word bank + statements for a matching group, in either UI the exports use. */
function matchingParts($: CheerioAPI, body: Cheerio<Element>): { wordBank: Option[]; questions: { number: number; textHtml: string }[] } {
  // Drag-and-drop UI: a box of `.drag-item` tiles and `.drop-zone` rows.
  const tiles = body.find(".drag-item");
  if (tiles.length) {
    const wordBank = tiles
      .map((_, t) => {
        const letter = ($(t).attr("data-value") ?? "").trim().toUpperCase();
        const text = ($(t).attr("data-text") ?? $(t).text()).replace(/^[A-Z]\s*[—–-]\s*/, "").trim();
        return { letter, textHtml: text };
      })
      .get()
      .filter((o) => /^[A-Z]$/.test(o.letter));
    const questions = body
      .find(".drop-zone[data-question], [data-question]")
      .filter((_, z) => $(z).is(".drop-zone") || $(z).closest(".dnd-matching-row").length > 0)
      .map((_, z) => {
        const number = Number($(z).attr("data-question"));
        const label = $(z).closest(".dnd-matching-row").find(".matching-label").first().text().trim();
        return { number, textHtml: label };
      })
      .get()
      .filter((q, i, arr) => Number.isFinite(q.number) && arr.findIndex((x) => x.number === q.number) === i);
    return { wordBank, questions };
  }

  // Select UI: option letters, statements built from each select's line.
  const wordBank = parseBox($, body);
  return {
    wordBank: wordBank.length ? wordBank : letterOptionsFromSelect($, body),
    questions: selectQuestions($, body),
  };
}

/**
 * Rubric prose that also bolds its answer letters, e.g. "Write the correct
 * letter, <strong>A</strong>, <strong>B</strong> or <strong>C</strong>, next to
 * Questions 12-15." Left unguarded, parseBox split lines like this into fake
 * options (A -> ",", B -> "or", C -> ", next to questions 12-15."), which is how
 * a dozen Volume matching groups ended up with rubric fragments for a word bank.
 */
const RUBRIC_PHRASE =
  /correct letter|next to (the )?question|for each (item|point|statement|aspect|of)|more than once|choose (the|two|from)/i;

/** True when the "options" are really the enumeration inside a rubric line. */
function looksLikeRubric(options: Option[]): boolean {
  if (!options.length) return true;
  const junk = options.filter((o) => /^[,;.]?\s*(or|and)?[,;.]?$/i.test(o.textHtml)).length;
  const rubricky = options.some((o) => RUBRIC_PHRASE.test(o.textHtml));
  return rubricky || junk >= Math.ceil(options.length / 2);
}

/** "<strong>A</strong> the realistic colours <strong>B</strong> ..." → options. */
function parseBox($: CheerioAPI, body: Cheerio<Element>): Option[] {
  // Every strong-bearing block, not just the first: the real option box often
  // sits below the rubric line, which also bolds its A/B/C letters.
  const boxes = body
    .find("div, p")
    .filter((_, el) => $(el).find("strong").length >= 2 && $(el).find("select, input").length === 0);

  for (const el of boxes.toArray()) {
    if (RUBRIC_PHRASE.test($(el).text())) continue; // skip the rubric itself
    const html = ($(el).html() ?? "").replace(/&nbsp;/g, " ");
    const options: Option[] = [];
    const re = /<strong>\s*([A-Z])\s*<\/strong>([\s\S]*?)(?=<strong>\s*[A-Z]\s*<\/strong>|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const textHtml = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (textHtml) options.push({ letter: m[1], textHtml });
    }
    if (options.length && !looksLikeRubric(options)) return options;
  }
  return [];
}

/** MCQ items keyed by radio name (qN); stem is the nearest preceding <p>. */
function mcqQuestions($: CheerioAPI, body: Cheerio<Element>) {
  const byName = new Map<number, { options: Option[]; stem: Cheerio<Element> }>();
  const order: number[] = [];

  body.find("input[type=radio], input[type=checkbox]").each((_, input) => {
    const name = $(input).attr("name") ?? "";
    const num = Number((name.match(/^q(\d+)/) ?? [])[1]);
    if (!Number.isFinite(num)) return;
    if (!byName.has(num)) {
      const label = $(input).closest("label");
      const stem = label.parent().prevAll("p").first();
      byName.set(num, { options: [], stem: (stem.length ? stem : label.parent().prev()) as Cheerio<Element> });
      order.push(num);
    }
    const entry = byName.get(num)!;
    const letter = ($(input).attr("value") ?? "").trim().toUpperCase();
    const label = $(input).closest("label").clone();
    label.find("input").remove();
    const textHtml = toCleanHtml($, label).replace(/^[A-Z]\s+/, "").trim();
    if (/^[A-Z]$/.test(letter)) entry.options.push({ letter, textHtml });
  });

  return order.map((num) => {
    const { options, stem } = byName.get(num)!;
    return { number: num, textHtml: cleanStem($, stem), options };
  });
}

function cleanStem($: CheerioAPI, stem: Cheerio<Element>): string {
  if (!stem || !stem.length) return "";
  const clone = stem.clone();
  return toCleanHtml($, clone).replace(/^\s*<strong>\s*\d+\s*<\/strong>\s*/i, "").replace(/^\s*\d+\s*[.)]?\s*/, "").trim();
}

/** Statements answered from a `<select>` (map labels, "choose from box"). */
function selectQuestions($: CheerioAPI, body: Cheerio<Element>) {
  return body
    .find("select[data-question]")
    .map((_, sel) => {
      const number = Number($(sel).attr("data-question"));
      const line = $(sel).closest("div, p, li, td");
      const clone = line.clone();
      clone.find("select").remove();
      const textHtml = clone.text().replace(/\s+/g, " ").replace(/^\s*\d+\s*/, "").trim();
      return { number, textHtml };
    })
    .get()
    .filter((q) => Number.isFinite(q.number));
}

function letterOptionsFromSelect($: CheerioAPI, body: Cheerio<Element>): Option[] {
  const letters = body
    .find("select")
    .first()
    .find("option")
    .map((_, o) => ($(o).attr("value") ?? $(o).text()).trim().toUpperCase())
    .get()
    .filter((l) => /^[A-Z]$/.test(l));
  return [...new Set(letters)].map((letter) => ({ letter, textHtml: letter }));
}

function extractImage(
  $: CheerioAPI,
  body: Cheerio<Element>,
  slug: string,
  assets: ListeningAssets | null,
  imageCounter: { n: number },
): string | undefined {
  const src = body.find('img[src^="data:image"]').first().attr("src") ?? "";
  const match = src.match(/^data:image\/([a-z0-9]+);base64,(.+)$/i);
  if (!match) return undefined;
  imageCounter.n += 1;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const file = `${slug}-map-${imageCounter.n}.${ext}`;
  if (assets) {
    mkdirSync(resolve(assets.mediaDir), { recursive: true });
    writeFileSync(resolve(assets.mediaDir, file), Buffer.from(match[2], "base64"));
  }
  return `${assets?.mediaUrlBase ?? "/test-media"}/${file}`;
}

function buildGroup(
  $: CheerioAPI,
  seg: Segment,
  partNumber: number,
  index: number,
  sets: Map<number, AnswerSet>,
  slug: string,
  assets: ListeningAssets | null,
  imageCounter: { n: number },
): QuestionGroup {
  const body = bodyOf($, seg);
  const id = `part-${partNumber}-group-${index + 1}`;
  const rubricHtml = seg.leaderHtml;
  const leader = seg.leaderText;
  const hasMatching = body.find("select[data-question], .drag-item, .drop-zone[data-question]").length > 0;

  // Map / plan / diagram labelling: statements answered with a letter, over an
  // image the source embedded as base64.
  if (hasMatching && /Label the (map|plan|diagram)/i.test(leader)) {
    const imageUrl = extractImage($, body, slug, assets, imageCounter);
    const { wordBank, questions } = matchingParts($, body);
    return {
      id,
      type: "map_labeling",
      rubricHtml,
      selectCount: 1,
      ...(imageUrl ? { imageUrl } : {}),
      wordBank: wordBank.length ? wordBank : letterOptionsFromSelect($, body),
      questions,
    };
  }

  // "Choose ... from the box" and letter-matching, drag-and-drop or select.
  if (hasMatching) {
    const { wordBank, questions } = matchingParts($, body);
    return { id, type: "matching", rubricHtml, selectCount: 1, wordBank, questions };
  }

  // "Choose TWO/THREE letters" — checkboxes, graded as an unordered set.
  if (body.find("input[type=checkbox]").length) {
    const name = body.find("input[type=checkbox]").first().attr("name") ?? "";
    const first = Number((name.match(/^q(\d+)/) ?? [])[1]);
    const set = sets.get(first);
    const questions = mcqQuestions($, body);
    return {
      id,
      type: "mcq",
      rubricHtml,
      selectCount: set ? set.questions.length : 1,
      questions: questions.length ? [{ ...questions[0], number: first }] : [],
    };
  }

  // Multiple choice — one item per radio-group.
  if (body.find("input[type=radio]").length) {
    return { id, type: "mcq", rubricHtml, selectCount: 1, questions: mcqQuestions($, body) };
  }

  // Notes / table / sentence / form completion.
  return {
    id,
    type: "completion",
    rubricHtml,
    selectCount: 1,
    bodyHtml: toSlotHtml($, body.clone()),
    maxWords: maxWordsFromRubric(leader),
  };
}

export function convertBekhruzListening(
  sourcePath: string,
  options: { title: string; source: string; slug?: string; isPremium?: boolean; durationSeconds?: number },
  assets: ListeningAssets | null,
): TestImport {
  const raw = readFileSync(sourcePath, "utf8");
  const { bytes, audioSourceUrl, html } = extractAudio(raw);
  if (bytes && assets) {
    mkdirSync(resolve(assets.audioPath, ".."), { recursive: true });
    writeFileSync(resolve(assets.audioPath), bytes);
  }

  const $ = cheerio.load(html);
  const slug = options.slug ?? slugify(options.title);
  const correctAnswers = extractJsonConst<Record<string, string | string[]>>($, "correctAnswers");
  let pickGroups: PickGroup[] = [];
  try {
    pickGroups = extractJsonConst<PickGroup[]>($, "pickGroups");
  } catch {
    pickGroups = [];
  }

  const sets = buildSets($, correctAnswers, pickGroups);
  const covered = new Set<number>();
  for (const set of sets.values()) for (const n of set.questions) covered.add(n);

  let partConfig: Record<string, { title?: string; instruction?: string }> = {};
  try {
    partConfig = extractJsonConst($, "partConfig");
  } catch {
    partConfig = {};
  }

  const imageCounter = { n: 0 };
  const parts = $(".part-content")
    .map((partIndex, node) => {
      const partNumber = partIndex + 1;
      const content = $(node).find(".question-content").first();
      const container = (content.length ? content : $(node)) as Cheerio<Element>;
      const config = partConfig[String(partNumber)] ?? {};
      const groups = segment($, container).map((seg, i) =>
        buildGroup($, seg, partNumber, i, sets, slug, assets, imageCounter),
      );
      return {
        number: partNumber,
        title: config.title ?? `Part ${partNumber}`,
        ...(config.instruction ? { instructionsHtml: `<p>${config.instruction}</p>` } : {}),
        groups,
      };
    })
    .get();

  const numbers = Object.keys(correctAnswers).map(Number).filter((n) => Number.isFinite(n));
  const totalQuestions = 40;

  const answers: TestImport["answerKey"]["answers"] = {};
  for (const number of numbers.sort((a, b) => a - b)) {
    if (covered.has(number)) continue; // graded together as a set
    const rawValue = correctAnswers[String(number)];
    const accepted = dedupe(
      (Array.isArray(rawValue) ? rawValue : [rawValue]).map((s) => String(s).trim()).filter(Boolean),
    );
    if (accepted.length) answers[String(number)] = { accepted };
  }

  const answerSets = [...sets.values()].sort((a, b) => a.questions[0] - b.questions[0]);

  // Some source leaders state a tighter limit than their own key respects — one
  // test answers a "ONE WORD ONLY" gap with "higher seats". Rather than reject
  // the instructor's own answer, widen the cap to the longest accepted answer.
  for (const part of parts) {
    for (const group of part.groups) {
      if (group.type !== "completion" || !group.bodyHtml) continue;
      let longest = 0;
      for (const m of group.bodyHtml.matchAll(/\{\{(\d+)\}\}/g)) {
        for (const a of answers[m[1]]?.accepted ?? []) {
          longest = Math.max(longest, a.trim().split(/\s+/).length);
        }
      }
      if (longest > (group.maxWords ?? 0)) group.maxWords = longest;
    }
  }

  return {
    slug,
    isPremium: options.isPremium ?? false,
    // An externally hosted recording is recorded so the uploader can re-host it;
    // an embedded one was already extracted to disk and needs no URL.
    ...(audioSourceUrl ? { audioSourceUrl } : {}),
    content: {
      schemaVersion: SCHEMA_VERSION,
      skill: "listening",
      title: options.title,
      source: options.source,
      totalQuestions,
      durationSeconds: options.durationSeconds ?? 1800,
      parts,
    },
    answerKey: { schemaVersion: SCHEMA_VERSION, answers, sets: answerSets },
  } as TestImport;
}
