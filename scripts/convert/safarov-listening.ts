import { SCHEMA_VERSION } from "../../src/lib/tests/schema";
import type { TestImport } from "../../src/lib/tests/schema";
import { extractJsonConst, loadHtml, maxWordsFromRubric, slugify } from "./lib";

/**
 * Adapter for the "@safarov_english" listening player.
 *
 * This source keeps its questions as data rather than markup — a `PARTS` array
 * of typed blocks that the page renders at runtime — so the conversion is a
 * straight mapping between two schemas instead of HTML scraping.
 */

type Gap = { q: number; before?: string; after?: string };
/** A note row is a gap, a plain bullet, or a sub-heading within the notes. */
type Row = Gap | { sub: string } | { h: string };
type Cell = string | Gap;
type Option = { key: string; label: string };

type Block =
  | { type: "note"; from: number; to: number; head: string; dir: string; title?: string; rows: Row[] }
  | {
      type: "table";
      from: number;
      to: number;
      head: string;
      dir: string;
      title?: string;
      headers: string[];
      rows: Array<{ cells: Cell[] }>;
    }
  | {
      type: "mcq";
      from: number;
      to: number;
      head: string;
      dir: string;
      title?: string;
      questions: Array<{ q: number; text: string; options: string[] }>;
    }
  | {
      type: "flowchart";
      from: number;
      to: number;
      head: string;
      dir: string;
      title?: string;
      options: Option[];
      steps: Row[];
    }
  | {
      type: "match";
      from: number;
      to: number;
      head: string;
      dir: string;
      optionBoxTitle?: string;
      options: Option[];
      itemsTitle?: string;
      items: Array<{ q: number; label: string }>;
    };

type Part = {
  part: number;
  label: string;
  topic?: string;
  instruction?: string;
  blocks: Block[];
};

type Config = { audio?: string; channel?: string; checkingSeconds?: number };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isGap(value: Row | Cell): value is Gap {
  return typeof value === "object" && value !== null && "q" in value;
}

/** The source writes its own bullet glyph; the player's list already draws one. */
function stripBullet(text: string): string {
  return text.replace(/^\s*[•·-]\s*/, "").trim();
}

/** `before {{n}} after`, with no space inserted before closing punctuation. */
function gapHtml(gap: Gap): string {
  const before = gap.before ? `${escapeHtml(stripBullet(gap.before))} ` : "";
  const rawAfter = gap.after?.trim() ?? "";
  const spacer = /^[.,;:!?)]/.test(rawAfter) ? "" : " ";
  const after = rawAfter ? `${spacer}${escapeHtml(rawAfter)}` : "";
  return `${before}{{${gap.q}}}${after}`;
}

/**
 * Notes are a mix of gaps, plain bullets and sub-headings. A heading breaks the
 * list, so the run is closed and reopened around it rather than nesting an
 * <h4> inside a <ul>.
 */
function rowsToHtml(rows: Row[]): string {
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const openList = () => {
    if (!inList) {
      out.push('<ul class="notes-list">');
      inList = true;
    }
  };

  for (const row of rows) {
    if ("h" in row) {
      closeList();
      out.push(`<h4 class="summary-title">${escapeHtml(row.h)}</h4>`);
      continue;
    }
    openList();
    out.push(`<li>${isGap(row) ? gapHtml(row) : escapeHtml(stripBullet(row.sub))}</li>`);
  }

  closeList();
  return out.join("");
}

function rubricHtml(head: string, dir: string, title?: string): string {
  return (
    `<h3>${escapeHtml(head)}</h3><p>${escapeHtml(dir)}</p>` +
    (title ? `<p><strong>${escapeHtml(title)}</strong></p>` : "")
  );
}

function blockToGroup(block: Block, partNumber: number) {
  const id = slugify(block.head) || `part-${partNumber}-${block.from}-${block.to}`;
  const rubric = rubricHtml(block.head, block.dir, "title" in block ? block.title : undefined);
  const maxWords = maxWordsFromRubric(block.dir);

  if (block.type === "note") {
    return {
      id,
      type: "completion" as const,
      rubricHtml: rubric,
      selectCount: 1,
      bodyHtml: rowsToHtml(block.rows),
      ...(maxWords ? { maxWords } : {}),
    };
  }

  if (block.type === "table") {
    const head = block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const body = block.rows
      .map(
        (row) =>
          `<tr>${row.cells
            .map((cell) => `<td>${isGap(cell) ? gapHtml(cell) : escapeHtml(cell)}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    return {
      id,
      type: "completion" as const,
      rubricHtml: rubric,
      selectCount: 1,
      bodyHtml: `<table class="q-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
      ...(maxWords ? { maxWords } : {}),
    };
  }

  if (block.type === "mcq") {
    return {
      id,
      type: "mcq" as const,
      rubricHtml: rubric,
      selectCount: 1,
      questions: block.questions.map((question) => ({
        number: question.q,
        textHtml: escapeHtml(question.text),
        // The source stores options positionally; the letter is the index.
        options: question.options.map((option, index) => ({
          letter: LETTERS[index],
          textHtml: escapeHtml(option),
        })),
      })),
    };
  }

  if (block.type === "flowchart") {
    const steps = block.steps
      .map((step) => {
        if (isGap(step)) return `<div class="flow-box">${gapHtml(step)}</div>`;
        if ("h" in step) return `<h4 class="summary-title">${escapeHtml(step.h)}</h4>`;
        return `<div class="flow-box">${escapeHtml(stripBullet(step.sub))}</div>`;
      })
      .join('<div class="flow-arrow">↓</div>');

    return {
      id,
      type: "completion" as const,
      rubricHtml: rubric,
      selectCount: 1,
      bodyHtml: `<div class="summary">${steps}</div>`,
      wordBank: block.options.map((option) => ({
        letter: option.key.toUpperCase(),
        textHtml: escapeHtml(option.label),
      })),
    };
  }

  return {
    id,
    type: "matching" as const,
    rubricHtml: rubric,
    selectCount: 1,
    wordBank: block.options.map((option) => ({
      letter: option.key.toUpperCase(),
      textHtml: escapeHtml(option.label),
    })),
    questions: block.items.map((item) => ({
      number: item.q,
      textHtml: escapeHtml(item.label),
    })),
  };
}

export function convertSafarovListening(
  sourcePath: string,
  options: { title: string; source: string; isPremium?: boolean; durationSeconds?: number },
): TestImport {
  const $ = loadHtml(sourcePath);
  const config = extractJsonConst<Config>($, "CONFIG");
  const parts = extractJsonConst<Part[]>($, "PARTS");
  const answers = extractJsonConst<Record<string, string>>($, "ANSWERS");

  const content = {
    schemaVersion: SCHEMA_VERSION,
    skill: "listening" as const,
    title: options.title,
    source: options.source,
    totalQuestions: Math.max(...Object.keys(answers).map(Number)),
    durationSeconds: options.durationSeconds ?? 1980,
    parts: parts.map((part) => ({
      number: part.part,
      title: part.topic,
      instructionsHtml:
        `<h3>${escapeHtml(part.label)}</h3>` +
        (part.instruction ? `<p>${escapeHtml(part.instruction)}</p>` : "") +
        (part.topic ? `<p><strong>${escapeHtml(part.topic)}</strong></p>` : ""),
      groups: part.blocks.map((block) => blockToGroup(block, part.part)),
    })),
  };

  // Anything answered from a lettered box must be upper-cased to match the
  // option letters; typed answers keep the source's own casing.
  const lettered = new Set<number>();
  for (const part of parts) {
    for (const block of part.blocks) {
      if (block.type === "mcq" || block.type === "flowchart" || block.type === "match") {
        for (let n = block.from; n <= block.to; n += 1) lettered.add(n);
      }
    }
  }

  const answerKey = {
    schemaVersion: SCHEMA_VERSION,
    answers: Object.fromEntries(
      Object.entries(answers).map(([id, value]) => [
        id,
        { accepted: [lettered.has(Number(id)) ? value.trim().toUpperCase() : value] },
      ]),
    ),
    sets: [],
  };

  return {
    slug: slugify(options.title),
    isPremium: options.isPremium ?? false,
    audioSourceUrl: config.audio,
    content,
    answerKey,
  } as TestImport;
}
