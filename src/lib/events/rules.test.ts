import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { joinRefusal, newEventToken } from "./rules";
import { canRequestReview, mergeMarkingSettings } from "../marking-settings";

const open = {
  status: "OPEN" as const,
  closesAt: null,
  maxParticipants: null,
  participantCount: 0,
  alreadyIn: false,
};

describe("joinRefusal", () => {
  it("lets anyone into an open event with no cap", () => {
    assert.equal(joinRefusal(open), null);
  });

  it("keeps a draft and a closed event shut", () => {
    assert.equal(joinRefusal({ ...open, status: "DRAFT" }), "not_open");
    assert.equal(joinRefusal({ ...open, status: "CLOSED" }), "closed");
  });

  it("closes at the deadline even if nobody pressed the button", () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    assert.equal(joinRefusal({ ...open, closesAt: past }), "closed");
    assert.equal(joinRefusal({ ...open, closesAt: future }), null);
  });

  it("stops newcomers at the cap but not people already in", () => {
    const full = { ...open, maxParticipants: 30, participantCount: 30 };
    assert.equal(joinRefusal(full), "full");
    assert.equal(joinRefusal({ ...full, alreadyIn: true }), null);
    assert.equal(joinRefusal({ ...full, participantCount: 29 }), null);
  });
});

describe("newEventToken", () => {
  it("is URL-safe and not short", () => {
    for (let i = 0; i < 20; i += 1) {
      const token = newEventToken();
      assert.match(token, /^[A-Za-z0-9_-]{12}$/);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, newEventToken));
    assert.equal(seen.size, 200);
  });
});

describe("canRequestReview", () => {
  const closed = mergeMarkingSettings(undefined);
  const student = { role: "STUDENT" };

  it("is closed to every plan by default", () => {
    assert.equal(canRequestReview(closed, student, "FREE", false), false);
    assert.equal(canRequestReview(closed, student, "PREMIUM", false), false);
  });

  it("opens per plan", () => {
    const settings = mergeMarkingSettings({ PREMIUM: true });
    assert.equal(canRequestReview(settings, student, "PREMIUM", false), true);
    assert.equal(canRequestReview(settings, student, "STUDENT", false), false);
  });

  it("always marks an event essay, whatever the plan says", () => {
    assert.equal(canRequestReview(closed, student, "FREE", true), true);
  });

  it("always lets an admin mark their own practice", () => {
    assert.equal(canRequestReview(closed, { role: "ADMIN" }, "FREE", false), true);
  });

  it("ignores a stored value that is not a boolean", () => {
    assert.equal(mergeMarkingSettings({ FREE: "true" }).FREE, false);
  });
});
