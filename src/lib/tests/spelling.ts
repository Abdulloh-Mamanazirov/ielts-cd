/**
 * British and American spellings of the same answer.
 *
 * IELTS accepts either, so the grader has to as well. Doing it here rather than
 * by listing both spellings in every answer key means a key written in one
 * variety marks the other right without anyone remembering to add it — the way
 * "theatre" sat in the key while students typed "theater" and were marked wrong.
 *
 * The list is deliberately explicit rather than a set of suffix rules. A rule
 * turning -ise into -ize would also accept "surprize" and "advertize", which are
 * misspellings in both varieties, and IELTS marks spelling.
 *
 * A pair only belongs here when the two spellings mean the same thing wherever
 * they appear. Several famous ones do not, and are left out on purpose:
 *
 *   story / storey    a narrative is not a floor of a building — and both
 *                     answers in this library are narratives
 *   check / cheque    "credit check $15" is a background check, not a cheque
 *   draught / draft   a current of air is not a first attempt
 *   kerb / curb       the edge of a road is not a restraint
 *   mould / mold      fungus is not a shape
 *
 * Getting one of those wrong would mark a wrong answer right, which is worse
 * than the problem being solved.
 */

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  // -re / -er
  ["theatre", "theater"],
  ["centre", "center"],
  ["centres", "centers"],
  ["metre", "meter"],
  ["metres", "meters"],
  ["kilometre", "kilometer"],
  ["kilometres", "kilometers"],
  ["litre", "liter"],
  ["litres", "liters"],
  ["fibre", "fiber"],
  ["fibres", "fibers"],

  // -our / -or
  ["colour", "color"],
  ["colours", "colors"],
  ["coloured", "colored"],
  ["behaviour", "behavior"],
  ["behaviours", "behaviors"],
  ["favour", "favor"],
  ["favourite", "favorite"],
  ["flavour", "flavor"],
  ["flavours", "flavors"],
  ["harbour", "harbor"],
  ["harbours", "harbors"],
  ["honour", "honor"],
  ["humour", "humor"],
  ["labour", "labor"],
  ["neighbour", "neighbor"],
  ["neighbours", "neighbors"],
  ["neighbourhood", "neighborhood"],
  ["odour", "odor"],
  ["odours", "odors"],
  ["rumour", "rumor"],
  ["rumours", "rumors"],
  ["vapour", "vapor"],

  // -ise / -ize
  ["organise", "organize"],
  ["organised", "organized"],
  ["organisation", "organization"],
  ["organisations", "organizations"],
  ["recognise", "recognize"],
  ["realise", "realize"],
  ["specialise", "specialize"],
  ["specialised", "specialized"],
  ["apologise", "apologize"],
  ["minimise", "minimize"],
  ["maximise", "maximize"],
  ["analyse", "analyze"],
  ["analysed", "analyzed"],
  ["fertilise", "fertilize"],
  ["fertiliser", "fertilizer"],
  ["fertilisers", "fertilizers"],

  // doubled l before a suffix
  ["travelling", "traveling"],
  ["travelled", "traveled"],
  ["traveller", "traveler"],
  ["travellers", "travelers"],
  ["cancelled", "canceled"],
  ["modelling", "modeling"],
  ["labelled", "labeled"],
  ["jewellery", "jewelry"],

  // -ogue / -og
  ["catalogue", "catalog"],
  ["catalogues", "catalogs"],
  ["dialogue", "dialog"],

  // ae / oe
  ["encyclopaedia", "encyclopedia"],
  ["archaeology", "archeology"],
  ["archaeologist", "archeologist"],
  ["archaeologists", "archeologists"],
  ["paediatric", "pediatric"],
  ["anaemia", "anemia"],

  // one-off pairs
  ["programme", "program"],
  ["programmes", "programs"],
  ["grey", "gray"],
  ["tyre", "tire"],
  ["tyres", "tires"],
  ["aluminium", "aluminum"],
  ["sulphur", "sulfur"],
  ["defence", "defense"],
  ["licence", "license"],
  ["ageing", "aging"],
  ["plough", "plow"],
  ["moustache", "mustache"],
  ["pyjamas", "pajamas"],
  ["sceptical", "skeptical"],
  ["aeroplane", "airplane"],
];

/** Either spelling to the one both are compared under. */
const CANONICAL = new Map<string, string>();
for (const [british, american] of PAIRS) {
  CANONICAL.set(british, american);
  CANONICAL.set(american, american);
}

/**
 * The answer with every word put into one spelling, so the two varieties
 * compare equal. Words that are not in the list are left exactly as typed.
 */
export function canonicalSpelling(normalized: string): string {
  if (!normalized) return normalized;
  return normalized
    .split(" ")
    .map((word) => CANONICAL.get(word) ?? word)
    .join(" ");
}
