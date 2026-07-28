import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chooseForSkill, isExamLength, type Candidate } from "./select";

function reading(id: string, totalQuestions: number, durationSeconds = 3600): Candidate {
  return { id, skill: "READING", totalQuestions, durationSeconds };
}

function writing(id: string, durationSeconds: number): Candidate {
  return { id, skill: "WRITING", totalQuestions: 0, durationSeconds };
}

/** Always picks the first of whatever it is offered, so choices are assertable. */
const firstOf = () => 0;

describe("isExamLength", () => {
  it("judges graded skills on question count", () => {
    assert.equal(isExamLength(reading("full", 40)), true);
    assert.equal(isExamLength(reading("single-passage", 13, 1200)), false);
    assert.equal(isExamLength({ id: "l", skill: "LISTENING", totalQuestions: 40, durationSeconds: 1980 }), true);
  });

  it("judges writing and speaking on length, having no questions to count", () => {
    assert.equal(isExamLength(writing("both-tasks", 3600)), true);
    assert.equal(isExamLength(writing("task-1-only", 1200)), false);
    assert.equal(isExamLength({ id: "s", skill: "SPEAKING", totalQuestions: 0, durationSeconds: 840 }), true);
  });
});

describe("chooseForSkill", () => {
  it("returns null when the skill has nothing published", () => {
    assert.equal(chooseForSkill([], new Map()), null);
  });

  it("prefers a whole section over a shortened practice", () => {
    const pool = [reading("practice", 13, 1200), reading("full", 40)];
    const chosen = chooseForSkill(pool, new Map(), firstOf);
    assert.equal(chosen?.id, "full");
  });

  it("falls back to a short test when the skill has no full-length one", () => {
    const pool = [reading("practice", 13, 1200)];
    assert.equal(chooseForSkill(pool, new Map(), firstOf)?.id, "practice");
  });

  it("prefers a test the student has not sat", () => {
    const pool = [reading("sat", 40), reading("fresh", 40)];
    const lastSat = new Map([["sat", Date.now()]]);
    assert.equal(chooseForSkill(pool, lastSat, firstOf)?.id, "fresh");
  });

  it("falls back to the one sat longest ago when all have been sat", () => {
    const pool = [reading("recent", 40), reading("ancient", 40)];
    const lastSat = new Map([
      ["recent", 2_000],
      ["ancient", 1_000],
    ]);
    assert.equal(chooseForSkill(pool, lastSat, firstOf)?.id, "ancient");
  });

  it("keeps section length ahead of freshness", () => {
    // The unsat option is a 13-question practice; the full section was sat
    // before. A mock needs the real section.
    const pool = [reading("fresh-but-short", 13, 1200), reading("sat-but-full", 40)];
    const lastSat = new Map([["sat-but-full", Date.now()]]);
    assert.equal(chooseForSkill(pool, lastSat, firstOf)?.id, "sat-but-full");
  });

  it("spreads across the unsat full-length tests rather than always picking one", () => {
    const pool = [reading("a", 40), reading("b", 40), reading("c", 40)];
    const picked = new Set<string>();
    // Drive the generator across its whole range instead of trusting chance.
    for (const value of [0, 0.5, 0.99]) {
      picked.add(chooseForSkill(pool, new Map(), () => value)!.id);
    }
    assert.deepEqual([...picked].sort(), ["a", "b", "c"]);
  });
});
