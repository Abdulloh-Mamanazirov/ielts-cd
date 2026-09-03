import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_PLANS, allowsTest, mergePlans, type PlansConfig } from "./plans";

/** A plan set where FREE opens neither writing nor speaking. */
function withSkills(WRITING: boolean, SPEAKING: boolean): PlansConfig {
  return {
    ...DEFAULT_PLANS,
    FREE: { ...DEFAULT_PLANS.FREE, skills: { WRITING, SPEAKING } },
  };
}

const writing = { skill: "WRITING", series: "REAL_EXAM", seriesNumber: null } as const;
const speaking = { skill: "SPEAKING", series: "REAL_EXAM", seriesNumber: null } as const;
const reading = { skill: "READING", series: "CAMBRIDGE", seriesNumber: 16 } as const;

describe("allowsTest for writing and speaking", () => {
  it("opens them when the plan's switch is on", () => {
    const plans = withSkills(true, true);
    assert.equal(allowsTest(plans, "FREE", writing), true);
    assert.equal(allowsTest(plans, "FREE", speaking), true);
  });

  it("closes them when the plan's switch is off", () => {
    const plans = withSkills(false, false);
    assert.equal(allowsTest(plans, "FREE", writing), false);
    assert.equal(allowsTest(plans, "FREE", speaking), false);
  });

  it("switches the two skills independently", () => {
    const plans = withSkills(true, false);
    assert.equal(allowsTest(plans, "FREE", writing), true);
    assert.equal(allowsTest(plans, "FREE", speaking), false);
  });

  it("leaves listening and reading to the series access", () => {
    // Turning writing and speaking off must not touch the graded skills, which
    // FREE opens by volume rather than by skill.
    const plans = withSkills(false, false);
    assert.equal(allowsTest(plans, "FREE", reading), false); // FREE opens no Cambridge
    assert.equal(allowsTest(plans, "PREMIUM", reading), true);
  });
});

describe("mergePlans", () => {
  it("keeps writing and speaking open for a config saved before the field existed", () => {
    // The stored JSON predates `skills`; the old behaviour was that both were
    // open on every plan, and an upgrade must not silently close them.
    const merged = mergePlans({ FREE: { label: "Free", price: "0" } });
    assert.deepEqual(merged.FREE.skills, { WRITING: true, SPEAKING: true });
    assert.equal(merged.FREE.label, "Free");
  });

  it("honours a stored switch", () => {
    const merged = mergePlans({ FREE: { skills: { WRITING: false, SPEAKING: true } } });
    assert.deepEqual(merged.FREE.skills, { WRITING: false, SPEAKING: true });
  });
});
