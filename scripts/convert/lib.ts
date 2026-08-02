import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

export type Cheerio = cheerio.CheerioAPI;

/**
 * Shared machinery for turning the instructor's existing self-contained HTML
 * mocks into the canonical JSON format. Each source file has its own adapter
 * because their markup differs; everything below is what they share.
 */

/** Tags kept in question and passage HTML. Anything else is unwrapped. */
const ALLOWED_TAGS = new Set([
  "p", "h3", "h4", "h5", "strong", "em", "b", "u", "sup", "sub", "br",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "div", "span",
]);

/** Structural classes the player styles. Source classes are mapped onto these. */
const CLASS_MAP: Record<string, string> = {
  "summary-wrap": "summary",
  "summary-title": "summary-title",
  "flow-box": "flow-box",
  "flow-arrow": "flow-arrow",
  "notes-list": "notes-list",
  "q-table": "q-table",
  "example-box": "example",
  "form-table": "q-table",
  // Listening form completion. "label" and "value" are generic names, but in
  // these source files they only ever appear inside a form row.
  "form-box": "summary",
  "form-title": "summary-title",
  "form-row": "form-row",
  label: "form-label",
  value: "form-value",
  bullet: "notes-list",
};

/** Chrome from the source players that carries no content. */
const DROP_SELECTOR = [
  "script", "style", "noscript", "link", "iframe", "svg", "button", "audio",
  ".analysis", ".review-flag", ".cdi-placeholder", ".sectionRubric",
  ".wordbank", ".mcq-instruction-box", ".tfng-instruction-box",
  // The source printed the question number beside each input; the slot marker
  // now carries it, so keeping both would render it twice.
  ".qnum", ".dz-num", ".help-btn", ".help-text",
  // bekhruz reading/listening: the number badge beside a gap, and the
  // select-to-highlight hint the source players show above a passage.
  ".inline-qno", ".hl-tip", ".highlight-tip",
].join(",");

export function loadHtml(path: string): Cheerio {
  return cheerio.load(readFileSync(path, "utf8"));
}

/**
 * Parses `const NAME = {...};` out of the source file's inline script.
 *
 * The answer keys in these files are JavaScript object literals, not JSON:
 * bare numeric keys, single-quoted strings and trailing commas all appear. They
 * are read with the small parser below rather than eval or node:vm, because the
 * source HTML is downloaded from third parties and must never be executed.
 */
export function extractJsonConst<T>($: Cheerio, name: string): T {
  const scripts = $("script")
    .map((_, element) => $(element).html() ?? "")
    .get()
    .join("\n");

  const declaration = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`, "m");
  const match = scripts.match(declaration);
  if (!match || match.index === undefined) {
    throw new Error(`Could not find "${name}" in the source file's script`);
  }

  // Some sources hold their data in an array (a list of parts) rather than an
  // object, so start at whichever bracket comes first.
  const from = match.index + match[0].length;
  const brace = scripts.indexOf("{", from);
  const bracket = scripts.indexOf("[", from);
  const candidates = [brace, bracket].filter((index) => index !== -1);
  if (candidates.length === 0) throw new Error(`"${name}" is not an object or array literal`);
  const start = Math.min(...candidates);

  try {
    return parseObjectLiteral(scripts, start) as T;
  } catch (error) {
    throw new Error(`Could not read "${name}": ${(error as Error).message}`);
  }
}

/** Reads a plain `const NAME = 'value';` string out of the inline script. */
export function extractStringConst($: Cheerio, name: string): string | undefined {
  const scripts = $("script")
    .map((_, element) => $(element).html() ?? "")
    .get()
    .join("\n");

  const match = scripts.match(
    new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(['"\`])([^'"\`]*)\\1`, "m"),
  );
  return match?.[2];
}

/**
 * Minimal recursive-descent reader for JSON-with-JavaScript-conveniences.
 * Handles objects, arrays, both quote styles, bare keys, trailing commas and
 * comments. Anything else is a parse error rather than an execution.
 */
function parseObjectLiteral(source: string, start: number): unknown {
  let index = start;

  const error = (message: string): never => {
    const line = source.slice(0, index).split("\n").length;
    throw new Error(`${message} at line ${line}`);
  };

  const skipTrivia = () => {
    for (;;) {
      while (index < source.length && /\s/.test(source[index])) index += 1;
      if (source.startsWith("//", index)) {
        const end = source.indexOf("\n", index);
        index = end === -1 ? source.length : end;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const end = source.indexOf("*/", index);
        index = end === -1 ? source.length : end + 2;
        continue;
      }
      return;
    }
  };

  const readString = (): string => {
    const quote = source[index];
    index += 1;
    let out = "";
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        const next = source[index + 1];
        const escapes: Record<string, string> = {
          n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "\\": "\\", "'": "'", '"': '"', "/": "/",
        };
        if (next === "u") {
          out += String.fromCharCode(parseInt(source.slice(index + 2, index + 6), 16));
          index += 6;
        } else {
          out += escapes[next] ?? next;
          index += 2;
        }
        continue;
      }
      if (char === quote) {
        index += 1;
        return out;
      }
      out += char;
      index += 1;
    }
    return error("Unterminated string");
  };

  const readValue = (): unknown => {
    skipTrivia();
    const char = source[index];

    if (char === "{") {
      index += 1;
      const result: Record<string, unknown> = {};
      for (;;) {
        skipTrivia();
        if (source[index] === "}") {
          index += 1;
          return result;
        }
        let key: string;
        if (source[index] === '"' || source[index] === "'") {
          key = readString();
        } else {
          const bare = /^[A-Za-z0-9_$]+/.exec(source.slice(index));
          if (!bare) return error("Expected a property name");
          key = bare[0];
          index += key.length;
        }
        skipTrivia();
        if (source[index] !== ":") return error(`Expected ":" after key "${key}"`);
        index += 1;
        result[key] = readValue();
        skipTrivia();
        if (source[index] === ",") index += 1;
        else if (source[index] !== "}") return error("Expected \",\" or \"}\"");
      }
    }

    if (char === "[") {
      index += 1;
      const items: unknown[] = [];
      for (;;) {
        skipTrivia();
        if (source[index] === "]") {
          index += 1;
          return items;
        }
        items.push(readValue());
        skipTrivia();
        if (source[index] === ",") index += 1;
        else if (source[index] !== "]") return error("Expected \",\" or \"]\"");
      }
    }

    if (char === '"' || char === "'") return readString();

    const literal = /^(true|false|null)\b/.exec(source.slice(index));
    if (literal) {
      index += literal[0].length;
      return literal[0] === "true" ? true : literal[0] === "false" ? false : null;
    }

    const number = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) {
      index += number[0].length;
      return Number(number[0]);
    }

    return error(`Unexpected character "${char ?? "end of input"}"`);
  };

  return readValue();
}

/**
 * Rewrites the source's answer inputs as `{{n}}` slot markers, then strips the
 * markup down to the allowed tags and classes. Mutates the passed selection, so
 * callers should clone first.
 */
export function toSlotHtml<T extends AnyNode>($: Cheerio, root: cheerio.Cheerio<T>): string {
  // Wrapper spans in the Cambridge files, bare inputs in the listening file.
  root.find(".blank-wrapper").each((_, element) => {
    const id = $(element).attr("id") ?? "";
    const number = id.replace(/^question-/, "");
    $(element).replaceWith(number ? `{{${number}}}` : "");
  });

  root.find("input.gap, input[data-q]").each((_, element) => {
    const number = $(element).attr("data-q");
    $(element).replaceWith(number ? `{{${number}}}` : "");
  });

  // bekhruz listening: <input data-question="8">, <select data-question="15">.
  // Only a control becomes a slot — some reading summaries put data-question on
  // the *paragraph* that holds several inputs, and replacing that would swallow
  // the other blanks with it.
  root.find("input[data-question], select[data-question]").each((_, element) => {
    const number = $(element).attr("data-question");
    $(element).replaceWith(/^\d+$/.test(number ?? "") ? `{{${number}}}` : "");
  });

  root.find("span[data-q], .dzone[data-q]").each((_, element) => {
    const number = $(element).attr("data-q");
    $(element).replaceWith(/^\d+$/.test(number ?? "") ? `{{${number}}}` : "");
  });

  root.find("input[name^='q']").each((_, element) => {
    const number = ($(element).attr("name") ?? "").replace(/^q/, "");
    $(element).replaceWith(/^\d+$/.test(number) ? `{{${number}}}` : "");
  });

  // A gap is sometimes a <select id="q32"> (a word-bank summary) rather than an
  // <input>; a select whose id is not a question number is left in place, since
  // removing it would drop a real control.
  root.find("input[id], select[id]").each((_, element) => {
    const el = $(element);
    const id = el.attr("id") ?? "";
    if (/^q\d+$/.test(id)) el.replaceWith(`{{${id.slice(1)}}}`);
    else if ((element as unknown as { tagName?: string }).tagName === "input") el.replaceWith("");
  });

  root.find(DROP_SELECTOR).remove();

  cleanTree($, root);

  return collapse(root.html() ?? "");
}

/** Same cleanup, without slot rewriting — for passages and statement text. */
export function toCleanHtml<T extends AnyNode>($: Cheerio, root: cheerio.Cheerio<T>): string {
  root.find(DROP_SELECTOR).remove();
  cleanTree($, root);
  return collapse(root.html() ?? "");
}

function cleanTree<T extends AnyNode>($: Cheerio, root: cheerio.Cheerio<T>): void {
  root.find("*").each((_, node) => {
    const element = $(node);
    const tag = (node as unknown as { tagName?: string }).tagName?.toLowerCase() ?? "";

    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(element.contents());
      return;
    }

    const sourceClasses = (element.attr("class") ?? "").split(/\s+/).filter(Boolean);
    const mapped = sourceClasses.map((name) => CLASS_MAP[name]).filter(Boolean);
    const colspan = element.attr("colspan");
    const rowspan = element.attr("rowspan");
    const id = element.attr("id");

    for (const attribute of Object.keys((node as unknown as { attribs: object }).attribs)) {
      element.removeAttr(attribute);
    }

    // Paragraph anchors survive so evidence snippets can point at them.
    if (id && /^para-/.test(id)) element.attr("id", id);
    if (mapped.length > 0) element.attr("class", [...new Set(mapped)].join(" "));
    if (tag === "table" && mapped.length === 0) element.attr("class", "q-table");
    if (colspan) element.attr("colspan", colspan);
    if (rowspan) element.attr("rowspan", rowspan);

    // A span with nothing left to say is noise.
    if (tag === "span" && mapped.length === 0) {
      element.replaceWith(element.contents());
    }
  });
}

function collapse(html: string): string {
  return html.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

/** Plain text of a node, minus player chrome. Mutates; pass a clone. */
export function textOf<T extends AnyNode>($: Cheerio, root: cheerio.Cheerio<T>): string {
  root.find(DROP_SELECTOR).remove();
  return (root.text() ?? "").replace(/\s+/g, " ").trim();
}

/** Word ceiling stated in a rubric, if any. */
export function maxWordsFromRubric(rubric: string): number | undefined {
  // "AND/OR A NUMBER" allows one extra token, so those phrasings have to be
  // tested before the plainer ones they contain.
  const table: Array<[RegExp, number]> = [
    [/\bNO MORE THAN THREE WORDS AND\/?OR A NUMBER\b/i, 4],
    [/\bNO MORE THAN TWO WORDS AND\/?OR A NUMBER\b/i, 3],
    [/\bNO MORE THAN ONE WORD AND\/?OR A NUMBER\b/i, 2],
    [/\bONE WORD AND\/?OR A NUMBER\b/i, 2],
    [/\bONE WORD ONLY\b/i, 1],
    [/\bNO MORE THAN ONE WORD\b/i, 1],
    [/\bNO MORE THAN TWO WORDS\b/i, 2],
    [/\bTWO WORDS ONLY\b/i, 2],
    [/\bNO MORE THAN THREE WORDS\b/i, 3],
    [/\bTHREE WORDS ONLY\b/i, 3],
  ];
  return table.find(([pattern]) => pattern.test(rubric))?.[1];
}

/** Lettered options out of a `<strong>A</strong> text` word bank grid. */
export function parseWordBank<T extends AnyNode>(
  $: Cheerio,
  root: cheerio.Cheerio<T>,
): Array<{ letter: string; textHtml: string }> {
  const items: Array<{ letter: string; textHtml: string }> = [];

  root.find("span").each((_, element) => {
    const raw = $(element).text().replace(/\s+/g, " ").trim();
    const match = raw.match(/^([A-Z])\s+(.*)$/);
    if (match) items.push({ letter: match[1], textHtml: match[2] });
  });

  return items;
}

export function writeJson(relativePath: string, value: unknown): string {
  const target = resolve(process.cwd(), relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
