import { SLOT_PATTERN, type QuestionGroup, type TestContent } from "./schema";

/** Question numbers referenced by `{{n}}` markers, in document order. */
export function slotNumbersIn(bodyHtml: string): number[] {
  const numbers: number[] = [];
  for (const match of bodyHtml.matchAll(SLOT_PATTERN)) {
    numbers.push(Number(match[1]));
  }
  return numbers;
}

/**
 * Every question number a group covers. Items with selectCount > 1 occupy a
 * run of numbers starting at their own: number 11 with selectCount 2 owns 11
 * and 12, which the grader treats as one unordered set.
 */
export function questionNumbersInGroup(group: QuestionGroup): number[] {
  const fromSlots = group.bodyHtml ? slotNumbersIn(group.bodyHtml) : [];

  const fromQuestions = (group.questions ?? []).flatMap((question) =>
    Array.from({ length: group.selectCount }, (_, offset) => question.number + offset),
  );

  return [...fromSlots, ...fromQuestions];
}

export function questionNumbersInContent(content: TestContent): number[] {
  return (content.parts ?? []).flatMap((part) =>
    part.groups.flatMap((group) => questionNumbersInGroup(group)),
  );
}

/** Maps each question number to the group that owns it. */
export function groupByQuestionNumber(content: TestContent): Map<number, QuestionGroup> {
  const index = new Map<number, QuestionGroup>();
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      for (const number of questionNumbersInGroup(group)) {
        if (!index.has(number)) index.set(number, group);
      }
    }
  }
  return index;
}

/** Maps each question number to its part number. */
export function partByQuestionNumber(content: TestContent): Map<number, number> {
  const index = new Map<number, number>();
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      for (const number of questionNumbersInGroup(group)) {
        if (!index.has(number)) index.set(number, part.number);
      }
    }
  }
  return index;
}
