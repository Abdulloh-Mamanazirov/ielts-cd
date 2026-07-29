/**
 * Student highlights over a reading passage.
 *
 * A highlight is stored as a character range over the passage's *text*, not as
 * a DOM path or a copy of the markup. Offsets survive a re-render, a font-size
 * change and a review-mode evidence mark, none of which change the text.
 *
 * Marks are woven into the HTML string before it is parsed, rather than wrapped
 * into the DOM afterwards. Mutating React-owned nodes is what makes this kind of
 * feature crash on the next render, and the passage HTML is not sanitised, so
 * handing it to `dangerouslySetInnerHTML` to get an opaque subtree would trade a
 * rendering bug for an injection one.
 */

export type Highlight = {
  id: string;
  /** Part the passage belongs to; each part has its own text. */
  part: number;
  start: number;
  end: number;
  /** Kept for the notes list, so a note reads sensibly away from the passage. */
  text: string;
  note?: string;
};

export type Annotations = {
  highlights?: Highlight[];
  /** Free scratchpad, for tests with no passage to highlight. */
  scratchpad?: string;
};

const ENTITY = /^&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;

/**
 * Weaves `<mark>` elements into `html` for each range.
 *
 * A range that spans a tag boundary is emitted as one mark per text run rather
 * than a single mark straddling the tags — a `<mark>` opened inside one
 * paragraph and closed inside the next is invalid, and the parser's repair of
 * it is not something to rely on.
 */
export function applyHighlightMarks(html: string, ranges: Highlight[]): string {
  if (ranges.length === 0) return html;

  // Sorted and merged so overlapping selections cannot open nested marks.
  const merged = mergeRanges(ranges);

  let out = "";
  let textOffset = 0;
  let index = 0;
  let open: (typeof merged)[number] | null = null;

  const closeIfOpen = () => {
    if (open) {
      out += "</mark>";
      open = null;
    }
  };

  while (index < html.length) {
    const char = html[index];

    if (char === "<") {
      // Tags carry no text: close across them and reopen on the far side.
      closeIfOpen();
      const end = html.indexOf(">", index);
      const stop = end === -1 ? html.length : end + 1;
      out += html.slice(index, stop);
      index = stop;
      continue;
    }

    // One entity is one character of text, however many bytes of markup.
    const entity = char === "&" ? html.slice(index).match(ENTITY) : null;
    const token = entity ? entity[0] : char;

    const covering = merged.find((range) => textOffset >= range.start && textOffset < range.end);

    if (covering && !open) {
      out += `<mark data-hl="${escapeAttribute(covering.id)}"${covering.note ? ' data-note="1"' : ""}>`;
      open = covering;
    } else if (!covering && open) {
      closeIfOpen();
    } else if (covering && open && covering.id !== open.id) {
      closeIfOpen();
      out += `<mark data-hl="${escapeAttribute(covering.id)}"${covering.note ? ' data-note="1"' : ""}>`;
      open = covering;
    }

    out += token;
    textOffset += 1;
    index += token.length;
  }

  closeIfOpen();
  return out;
}

/**
 * Overlapping highlights collapse into one. Two marks covering the same words
 * would otherwise nest and paint twice, and the darker patch reads as a
 * different, more important highlight when it is only an accident of dragging.
 */
export function mergeRanges(ranges: Highlight[]): Highlight[] {
  const sorted = [...ranges]
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Highlight[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      // A note anywhere in the union survives the merge.
      if (!last.note && range.note) last.note = range.note;
      continue;
    }
    merged.push({ ...range });
  }

  return merged;
}

/**
 * Ids are generated locally, never typed by anyone, but this string is written
 * straight into markup — so it is escaped rather than trusted.
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntity(entity: string): string {
  const body = entity.slice(1, -1);
  if (body.startsWith("#x") || body.startsWith("#X")) {
    return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
  }
  if (body.startsWith("#")) return String.fromCodePoint(Number(body.slice(1)));
  return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
}

/**
 * Plain text of an HTML string, matching what the DOM reports — one character
 * per entity, so its indices line up with the offsets a selection produces.
 */
export function htmlToText(html: string): string {
  let out = "";
  let index = 0;

  while (index < html.length) {
    if (html[index] === "<") {
      const end = html.indexOf(">", index);
      index = end === -1 ? html.length : end + 1;
      continue;
    }
    const entity = html[index] === "&" ? html.slice(index).match(ENTITY) : null;
    out += entity ? decodeEntity(entity[0]) : html[index];
    index += entity ? entity[0].length : 1;
  }

  return out;
}
