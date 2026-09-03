import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_PLANS, allowsTest, mergePlans, type PlansConfig, type TestAccess } from "./plans";

/** A plan set whose FREE tier opens the given writing and speaking tests. */
function withSkills(WRITING: TestAccess, SPEAKING: TestAccess): PlansConfig {
  return {
    ...DEFAULT_PLANS,
    FREE: { ...DEFAULT_PLANS.FREE, skills: { WRITING, SPEAKING } },
  };
}

const w1 = { skill: "WRITING", slug: "writing-mock-1", series: "REAL_EXAM", seriesNumber: null } as const;
const w2 = { skill: "WRITING", slug: "writing-mock-2", series: "REAL_EXAM", seriesNumber: null } as const;
const s1 = { skill: "SPEAKING", slug: "speaking-test-1", series: "REAL_EXAM", seriesNumber: null } as const;
const reading = { skill: "READING", series: "CAMBRIDGE", seriesNumber: 16 } as const;

describe("allowsTest for writing and speaking", () => {
  it("opens every test when the plan says all", () => {
    const plans = withSkills({ kind: "all" }, { kind: "all" });
    assert.equal(allowsTest(plans, "FREE", w1), true);
    assert.equal(allowsTest(plans, "FREE", s1), true);
  });

  it("closes every test when the plan says none", () => {
    const plans = withSkills({ kind: "none" }, { kind: "none" });
    assert.equal(allowsTest(plans, "FREE", w1), false);
    assert.equal(allowsTest(plans, "FREE", s1), false);
  });

  it("opens only the tests that were picked", () => {
    const plans = withSkills({ kind: "some", slugs: ["writing-mock-1"] }, { kind: "none" });
    assert.equal(allowsTest(plans, "FREE", w1), true);
    assert.equal(allowsTest(plans, "FREE", w2), false);
    assert.equal(allowsTest(plans, "FREE", s1), false);
  });

  it("selects the two skills independently", () => {
    const plans = withSkills({ kind: "all" }, { kind: "none" });
    assert.equal(allowsTest(plans, "FREE", w1), true);
    assert.equal(allowsTest(plans, "FREE", s1), false);
  });

  it("closes a picked test that arrives without a slug", () => {
    // Nothing to match on, so a chosen few cannot be said to include it.
    const plans = withSkills({ kind: "some", slugs: ["writing-mock-1"] }, { kind: "all" });
    const noSlug = { skill: "WRITING", series: "REAL_EXAM", seriesNumber: null } as const;
    assert.equal(allowsTest(plans, "FREE", noSlug), false);
  });

  it("leaves listening and reading to the series access", () => {
    const plans = withSkills({ kind: "none" }, { kind: "none" });
    assert.equal(allowsTest(plans, "FREE", reading), false); // FREE opens no Cambridge
    assert.equal(allowsTest(plans, "PREMIUM", reading), true);
  });
});

describe("mergePlans", () => {
  it("keeps writing and speaking open for a config saved before the field existed", () => {
    // The stored JSON predates `skills`; the old behaviour was that both were
    // open on every plan, and an upgrade must not silently close them.
    const merged = mergePlans({ FREE: { label: "Free", price: "0" } });
    assert.deepEqual(merged.FREE.skills, {
      WRITING: { kind: "all" },
      SPEAKING: { kind: "all" },
    });
    assert.equal(merged.FREE.label, "Free");
  });

  it("honours a stored selection", () => {
    const merged = mergePlans({
      FREE: { skills: { WRITING: { kind: "some", slugs: ["writing-mock-3"] }, SPEAKING: { kind: "none" } } },
    });
    assert.deepEqual(merged.FREE.skills.WRITING, { kind: "some", slugs: ["writing-mock-3"] });
    assert.deepEqual(merged.FREE.skills.SPEAKING, { kind: "none" });
  });
});
