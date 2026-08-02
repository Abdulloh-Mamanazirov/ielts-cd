import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import type { QuestionGroup, TestImport } from "../../src/lib/tests/schema";
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
 * Adapter for the "@bekhruzposts" reading exports (Volume 1). One consistent
 * template across all ten files: three passages in `#left-pane .pcontent`,
 * question groups in `#right-pane .qsec`, and two inline answer objects —
 *
 *   const CA   = { 1:'white', 24:['vegetation'], 37:'E', ... };  // accepted
 *   const PICK = { 20:{g,qs:[20,21],set:['A','D']}, ... };       // choose-two
 *
 * CA carries every question; PICK, when present, marks the "choose TWO letters"
 * pairs so they can be graded as one unordered set. A single tool produced all
 * ten, so unlike the earlier one-off adapters this parses structure, not a
 * hand-identified layout.
 */

type PickEntry = { g: string; qs: number[]; set: string[] };
type SourceAnswer = string | string[];

/** A "choose TWO letters" pair keyed by its first question number. */
type SetGroup = { first: number; questions: number[]; accepted: string[] };

function readPickGroups($: CheerioAPI): Map<number, SetGroup> {
  const byFirst = new Map<number, SetGroup>();
  let pick: Record<string, PickEntry>;
  try {
    pick = extractJsonConst<Record<string, PickEntry>>($, "PICK");
  } catch {
    return byFirst;
  }
  for (const entry of Object.values(pick)) {
    const first = Math.min(...entry.qs);
    if (!byFirst.has(first)) {
      byFirst.set(first, { first, questions: [...entry.qs].sort((a, b) => a - b), accepted: entry.set });
    }
  }
  return byFirst;
}

/**
 * Some tests encode "choose TWO letters" not with `PICK` but as `.mc2box`
 * checkboxes carrying `data-base="20"`, and store the set on the anchor number
 * in CA (`20:['A','D']`, with 21 repeating it). Each distinct base is one set;
 * its size is how many letters the answer holds.
 */
function readMc2Sets($: CheerioAPI, CA: Record<string, SourceAnswer>): Map<number, SetGroup> {
  const bases = new Set<number>();
  $("input.mc2box[data-base], input[type=checkbox][data-base]").each((_, el) => {
    const base = Number($(el).attr("data-base"));
    if (Number.isFinite(base)) bases.add(base);
  });

  const sets = new Map<number, SetGroup>();
  for (const base of bases) {
    const answer = CA[String(base)];
    if (!Array.isArray(answer) || answer.length < 2) continue;
    sets.set(base, {
      first: base,
      questions: answer.map((_, i) => base + i),
      accepted: answer.map(String),
    });
  }
  return sets;
}

/** Numbers that belong to a select-two pair but are not its anchor. */
function coveredExtras(sets: Map<number, SetGroup>): Set<number> {
  const extra = new Set<number>();
  for (const set of sets.values()) for (const n of set.questions) if (n !== set.first) extra.add(n);
  return extra;
}

/** Drops case-only duplicates, keeping the first spelling as canonical. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function stripLeadingNumber(html: string): string {
  // "<strong>24.</strong>&nbsp; text" or a bare "24. text" — the slot or the
  // player's own number badge shows it, so the label would be a duplicate.
  return html
    .replace(/^\s*<strong>\s*\d+\s*[.)]?\s*<\/strong>\s*(?:&nbsp;|\s)*/i, "")
    .replace(/^\s*\d+\s*[.)]\s*(?:&nbsp;|\s)*/, "")
    .trim();
}

function radioValues($: CheerioAPI, body: Cheerio<Element>): string[] {
  return body
    .find("input[type=radio]")
    .map((_, el) => ($(el).attr("value") ?? "").trim().toUpperCase())
    .get();
}

/** One group's worth of source nodes: a heading, its rubric, and its body. */
type Segment = { headText: string; rubricNodes: Element[]; bodyNodes: Element[] };

/** Splits a flat run of children into head / rubric / body. */
function splitChildren($: CheerioAPI, nodes: Element[]): Segment {
  const seg: Segment = { headText: "", rubricNodes: [], bodyNodes: [] };
  let inRubric = false;
  for (const node of nodes) {
    const el = $(node);
    if (el.hasClass("qnum-head")) {
      seg.headText = el.text().replace(/\s+/g, " ").trim();
      inRubric = true;
      continue;
    }
    if (inRubric && el.hasClass("qinst")) {
      seg.rubricNodes.push(node);
      continue;
    }
    inRubric = false;
    seg.bodyNodes.push(node);
  }
  return seg;
}

/**
 * The exports come in two shapes. Some interleave each group's heading, rubric
 * and body as flat siblings inside the `.qsec`; others wrap each group in its
 * own `.qblock`. Both reduce to the same segment list.
 */
function segmentQsec($: CheerioAPI, qsec: Cheerio<Element>): Segment[] {
  const blocks = qsec.children(".qblock");
  if (blocks.length) {
    return blocks
      .map((_, block) => splitChildren($, $(block).children().get() as Element[]))
      .get();
  }

  const segments: Segment[] = [];
  let run: Element[] = [];
  const flush = () => {
    if (run.length) segments.push(splitChildren($, run));
    run = [];
  };
  qsec.children().each((_, node) => {
    if ($(node).hasClass("qnum-head") && run.length) flush();
    run.push(node as Element);
  });
  flush();
  return segments;
}

function rubricHtmlOf($: CheerioAPI, seg: Segment): string {
  const head = seg.headText ? `<h3>${seg.headText}</h3>` : "";
  const lines = seg.rubricNodes
    .map((node) => toCleanHtml($, $(node).clone()))
    .filter(Boolean)
    .join("");
  return head + lines;
}

function bodySelection($: CheerioAPI, seg: Segment): Cheerio<Element> {
  const wrap = $("<div></div>");
  for (const node of seg.bodyNodes) wrap.append($(node).clone());
  return wrap as unknown as Cheerio<Element>;
}

/** Options from a `.rgroup` of radio/checkbox labels: value is the letter. */
function optionsFrom($: CheerioAPI, body: Cheerio<Element>) {
  return body
    .find(".rlabel")
    .map((_, label) => {
      const row = $(label);
      const letter = (row.find("input").attr("value") ?? "").trim().toUpperCase();
      const clone = row.clone();
      clone.find("input, .mc-key").remove();
      // Some options badge the letter as `<strong>A</strong>` rather than a
      // `.mc-key`; drop that leading letter so it is not shown twice.
      const firstStrong = clone.find("strong").first();
      if (/^[A-Z]$/.test(firstStrong.text().trim())) firstStrong.remove();
      const textHtml = toCleanHtml($, clone).replace(/^[A-Z]\s+/, "").trim();
      return { letter, textHtml };
    })
    .get()
    .filter((o) => /^[A-Z]$/.test(o.letter));
}

/** The question number an item owns — from its radio name, else a leading "N.". */
function itemNumber($: CheerioAPI, block: Cheerio<Element>): number {
  const fromName = (block.find("input[name^='q']").first().attr("name") ?? "").replace(/^q/, "");
  if (/^\d+$/.test(fromName)) return Number(fromName);
  return Number((block.text().match(/^\s*(\d+)\s*[.)]/) ?? [])[1]);
}

function fixedChoiceQuestions($: CheerioAPI, body: Cheerio<Element>) {
  return body
    .find(".qitem")
    .map((_, item) => {
      const block = $(item);
      const prompt = block.find(".qprompt").first().clone();
      const number = Number((block.text().match(/^\s*(\d+)\s*[.)]/) ?? [])[1]);
      prompt.find(".mc-key, input, .rgroup").remove();
      const textHtml = stripLeadingNumber(toCleanHtml($, prompt));
      return { number, textHtml };
    })
    .get()
    .filter((q) => Number.isFinite(q.number));
}

function mcqQuestions($: CheerioAPI, body: Cheerio<Element>) {
  return body
    .find(".qitem")
    .map((_, item) => {
      const block = $(item);
      const number = itemNumber($, block);
      const stem = block.find(".qprompt").first().clone();
      stem.find(".rgroup, input, .mc-key").remove();
      const textHtml = stripLeadingNumber(toCleanHtml($, stem));
      const options = optionsFrom($, block);
      return { number, textHtml, options };
    })
    .get()
    .filter((q) => Number.isFinite(q.number) && q.options.length >= 2);
}

type Option = { letter: string; textHtml: string };

/**
 * A "List of ..." box, in either shape the exports use: `.frow`/`.fkey` rows,
 * or a single blob of "A&nbsp;China<br>B&nbsp;Japan" lines.
 */
function parseListBox($: CheerioAPI, fbox: Cheerio<Element>): Option[] {
  const rows = fbox
    .find(".frow")
    .map((_, row) => {
      const letter = $(row).find(".fkey").first().text().trim().toUpperCase();
      const clone = $(row).clone();
      clone.find(".fkey").remove();
      return { letter, textHtml: toCleanHtml($, clone) };
    })
    .get()
    .filter((o) => /^[A-Z]$/.test(o.letter));
  if (rows.length) return rows;

  const clone = fbox.clone();
  clone.find("strong").first().remove(); // "List of Countries" title
  return toCleanHtml($, clone)
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]+>/g, "").replace(/ /g, " ").replace(/&nbsp;/g, " ").trim())
    .map((line) => {
      const m = line.match(/^([A-Z])\s+(.*)$/);
      return m ? { letter: m[1], textHtml: m[2].trim() } : null;
    })
    .filter((o): o is Option => o !== null);
}

function matchingGroup(
  $: CheerioAPI,
  seg: Segment,
  body: Cheerio<Element>,
  id: string,
): QuestionGroup {
  // Prefer a "List of ..." box, whose options carry text (people, countries).
  // Paragraph matching has none, so the matrix column letters stand alone.
  const fbox = body.find(".fbox").first();
  let wordBank: Option[] = fbox.length ? parseListBox($, fbox) : [];
  if (!wordBank.length) {
    wordBank = body
      .find("table.matrix thead th")
      .map((_, th) => $(th).text().trim().toUpperCase())
      .get()
      .filter((t) => /^[A-Z]$/.test(t))
      .map((letter) => ({ letter, textHtml: letter }));
  }

  const questions = body
    .find("table.matrix tbody tr")
    .map((_, tr) => {
      const stmt = $(tr).find(".mx-stmt").first().clone();
      const number = Number(stmt.find(".mx-num").first().text().trim());
      stmt.find(".mx-num").remove();
      return { number, textHtml: toCleanHtml($, stmt) };
    })
    .get()
    .filter((q) => Number.isFinite(q.number));

  return { id, type: "matching", rubricHtml: rubricHtmlOf($, seg), selectCount: 1, wordBank, questions };
}

/**
 * "Choose the correct heading" — the source drags roman-numbered heading cards
 * onto slots in the passage. The schema's letters are A–Z, so the headings are
 * renumbered i→A, ii→B in the order they are listed, and the CA answers (which
 * are roman) are mapped through the same table.
 */
function romanLetterMap($: CheerioAPI, box: Cheerio<Element>): Map<string, string> {
  const map = new Map<string, string>();
  box.find(".mh-heading-card").each((i, card) => {
    const code = ($(card).attr("data-code") ?? "").trim().toLowerCase();
    if (code) map.set(code, String.fromCharCode(65 + i));
  });
  return map;
}

function matchingHeadingsGroup(
  $: CheerioAPI,
  seg: Segment,
  body: Cheerio<Element>,
  id: string,
  romanToLetter: Map<string, string>,
): QuestionGroup {
  const box = body.find(".headings-box").first();
  const wordBank: Option[] = box
    .find(".mh-heading-card")
    .map((_, card) => ({
      letter: romanToLetter.get(($(card).attr("data-code") ?? "").toLowerCase()) ?? "",
      textHtml: ($(card).attr("data-label") ?? $(card).text()).trim(),
    }))
    .get()
    .filter((o) => /^[A-Z]$/.test(o.letter));

  const [from, to] = (seg.headText.match(/(\d+)\D+(\d+)/) ?? []).slice(1).map(Number);
  const questions = [];
  for (let n = from; n <= to; n += 1) {
    questions.push({ number: n, textHtml: `Paragraph <strong>${String.fromCharCode(65 + (n - from))}</strong>` });
  }

  return { id, type: "matching", rubricHtml: rubricHtmlOf($, seg), selectCount: 1, wordBank, questions };
}

function completionGroup(
  $: CheerioAPI,
  seg: Segment,
  body: Cheerio<Element>,
  id: string,
): QuestionGroup {
  const rubricText = seg.rubricNodes.map((n) => textOf($, $(n).clone())).join(" ");

  // A drag-word summary carries its options as `.dchip` chips; the answer is a
  // letter, so it becomes a lettered word bank rather than a typed blank.
  const chips = body.find(".dchip");
  let wordBank: Array<{ letter: string; textHtml: string }> | undefined;
  if (chips.length) {
    wordBank = chips
      .map((_, chip) => {
        const letter = ($(chip).attr("data-letter") ?? "").trim().toUpperCase();
        const word = $(chip).attr("data-word") ?? $(chip).text().replace(/^[A-Z]\s*/, "").trim();
        return { letter, textHtml: word };
      })
      .get()
      .filter((o) => /^[A-Z]$/.test(o.letter));
    body.find(".dchip").parent().remove();
  }

  const bodyHtml = toSlotHtml($, body.clone());

  return {
    id,
    type: "completion",
    rubricHtml: rubricHtmlOf($, seg),
    selectCount: 1,
    bodyHtml,
    ...(wordBank && wordBank.length ? { wordBank } : { maxWords: maxWordsFromRubric(rubricText) }),
  };
}

function buildGroup(
  $: CheerioAPI,
  seg: Segment,
  sets: Map<number, SetGroup>,
  romanToLetter: Map<string, string>,
  partNumber: number,
  index: number,
): QuestionGroup {
  const body = bodySelection($, seg);
  const id = `part-${partNumber}-group-${index + 1}`;
  const values = radioValues($, body);

  if (body.find(".headings-box").length) return matchingHeadingsGroup($, seg, body, id, romanToLetter);
  if (body.find("table.matrix").length) return matchingGroup($, seg, body, id);

  const checkboxes = body.find(
    "input[type=checkbox][name^='pg_'], input.mc2box[data-base], input[type=checkbox][data-base]",
  );
  if (checkboxes.length) {
    // "Choose TWO letters": one item, the options as an mcq, graded as a set.
    // The anchor number is the checkbox's `data-base` where it has one, else the
    // first number in the heading ("Questions 20–21"); the option rows that make
    // up the body carry no number of their own.
    const base = checkboxes.first().attr("data-base");
    const first = base ? Number(base) : Number((seg.headText.match(/(\d+)/) ?? [])[1]);
    const set = [...sets.values()].find((s) => s.questions.includes(first)) ?? { first, questions: [first], accepted: [] };
    const stem = body.find(".qprompt").first().clone();
    stem.find(".rgroup, input").remove();
    return {
      id,
      type: "mcq",
      rubricHtml: rubricHtmlOf($, seg),
      selectCount: set.questions.length,
      questions: [
        { number: set.first, textHtml: stripLeadingNumber(toCleanHtml($, stem)), options: optionsFrom($, body) },
      ],
    };
  }

  if (values.some((v) => v === "TRUE" || v === "FALSE")) {
    return { id, type: "tfng", rubricHtml: rubricHtmlOf($, seg), selectCount: 1, questions: fixedChoiceQuestions($, body) };
  }
  if (values.some((v) => v === "YES" || v === "NO")) {
    return { id, type: "ynng", rubricHtml: rubricHtmlOf($, seg), selectCount: 1, questions: fixedChoiceQuestions($, body) };
  }
  if (body.find(".mc-key").length || (values.length && body.find(".qitem").length)) {
    return { id, type: "mcq", rubricHtml: rubricHtmlOf($, seg), selectCount: 1, questions: mcqQuestions($, body) };
  }

  return completionGroup($, seg, body, id);
}

export function convertBekhruzReading(
  sourcePath: string,
  options: { title: string; source: string; slug?: string; isPremium?: boolean; durationSeconds?: number },
): TestImport {
  const $ = loadHtml(sourcePath);
  const CA = extractJsonConst<Record<string, SourceAnswer>>($, "CA");
  const sets = readPickGroups($);
  for (const [base, set] of readMc2Sets($, CA)) if (!sets.has(base)) sets.set(base, set);
  const extras = coveredExtras(sets);
  const romanToLetter = romanLetterMap($, $(".headings-box").first());

  const passages = $("#left-pane .pcontent, .pcontent")
    .map((_, el) => {
      const pc = $(el).clone();
      const title = pc.find(".ptitle").first().text().trim() || undefined;
      // The heading-match slot lines ("1", "2" before each section) are drop
      // targets that carry no meaning once the passage is read-only.
      pc.find(".ptitle, .mh-slot-line").remove();
      // The paragraph letter is a bare `<span class="pl">A</span>` glued to the
      // first word. Bold it and give it room, so a matching-headings passage
      // reads "A  The story…" the way the printed exam labels its sections.
      pc.find("span.pl").each((_, letter) => {
        const text = $(letter).text().trim();
        if (/^[A-Z]$/.test(text)) $(letter).replaceWith(`<strong>${text}</strong>  `);
      });
      return { title, passageHtml: toCleanHtml($, pc) };
    })
    .get();

  const parts = $("#right-pane .qsec, .qsec")
    .map((el, node) => {
      const partNumber = el + 1;
      const qsec = $(node);
      const passage = passages[el] ?? { title: undefined, passageHtml: "" };
      const groups = segmentQsec($, qsec).map((seg, i) => buildGroup($, seg, sets, romanToLetter, partNumber, i));
      return {
        number: partNumber,
        title: passage.title,
        passageHtml: passage.passageHtml,
        groups,
      };
    })
    .get();

  const numbers = Object.keys(CA).map(Number).filter((n) => Number.isFinite(n));
  const totalQuestions = numbers.length ? Math.max(...numbers) : 0;

  const answers: TestImport["answerKey"]["answers"] = {};
  for (const number of numbers.sort((a, b) => a - b)) {
    if (extras.has(number) || sets.has(number)) continue; // sets are graded together
    const raw = CA[String(number)];
    const accepted = dedupe(
      (Array.isArray(raw) ? raw : [raw])
        .map((s) => String(s).trim())
        // A heading answer is a roman code; the word bank renumbered it to a letter.
        .map((s) => romanToLetter.get(s.toLowerCase()) ?? s)
        .filter(Boolean),
    );
    answers[String(number)] = { accepted };
  }

  const answerSets = [...sets.values()]
    .sort((a, b) => a.first - b.first)
    .map((s) => ({ questions: s.questions, accepted: s.accepted }));

  return {
    slug: options.slug ?? slugify(options.title),
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
    answerKey: { schemaVersion: SCHEMA_VERSION, answers, sets: answerSets },
  } as TestImport;
}
