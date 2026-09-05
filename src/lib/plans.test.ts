import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

const v1t1 = {
  skill: "READING",
  slug: "reading-volume-1-test-1",
  series: "REAL_EXAM",
  seriesNumber: 1,
} as const;
const v1t4 = {
  skill: "READING",
  slug: "reading-volume-1-test-4",
  series: "REAL_EXAM",
  seriesNumber: 1,
} as const;
const c14t1 = {
  skill: "LISTENING",
  slug: "listening-cambridge-14-test-1",
  series: "CAMBRIDGE",
  seriesNumber: 14,
} as const;

describe("allowsTest for reading and listening", () => {
  it("opens part of a volume without opening the rest of it", () => {
    // The free tier: three tests of Volume 1, not the other seven.
    assert.equal(allowsTest(DEFAULT_PLANS, "FREE", v1t1), true);
    assert.equal(allowsTest(DEFAULT_PLANS, "FREE", v1t4), false);
  });

  it("opens the one Cambridge test the free plan names", () => {
    assert.equal(allowsTest(DEFAULT_PLANS, "FREE", c14t1), true);
    assert.equal(
      allowsTest(DEFAULT_PLANS, "FREE", { ...c14t1, slug: "listening-cambridge-14-test-2" }),
      false,
    );
  });

  it("still opens everything for a paid plan", () => {
    for (const test of [v1t1, v1t4, c14t1]) {
      assert.equal(allowsTest(DEFAULT_PLANS, "PREMIUM", test), true);
      assert.equal(allowsTest(DEFAULT_PLANS, "STUDENT", test), true);
    }
  });

  it("closes a per-test plan for a paper that arrives without a slug", () => {
    const noSlug = { skill: "READING", series: "REAL_EXAM", seriesNumber: 1 } as const;
    assert.equal(allowsTest(DEFAULT_PLANS, "FREE", noSlug), false);
  });

  it("keeps whole-number access working alongside it", () => {
    const plans: PlansConfig = {
      ...DEFAULT_PLANS,
      FREE: {
        ...DEFAULT_PLANS.FREE,
        access: { REAL_EXAM: { kind: "some", numbers: [1] }, CAMBRIDGE: { kind: "none" } },
      },
    };
    assert.equal(allowsTest(plans, "FREE", v1t1), true);
    assert.equal(allowsTest(plans, "FREE", v1t4), true);
    assert.equal(allowsTest(plans, "FREE", c14t1), false);
  });
});

describe("the free plan's own configuration", () => {
  it("names only tests that exist in content/tests", () => {
    // A typo here would silently close the free tier, so the slugs are checked
    // against the files the seed loads rather than trusted.
    const access = [DEFAULT_PLANS.FREE.access.REAL_EXAM, DEFAULT_PLANS.FREE.access.CAMBRIDGE];
    const slugs = access.flatMap((entry) => (entry.kind === "tests" ? entry.slugs : []));
    assert.equal(slugs.length, 8);
    for (const slug of slugs) {
      assert.ok(
        existsSync(resolve("content/tests", `${slug}.json`)),
        `${slug} has no test file`,
      );
    }
  });
});
