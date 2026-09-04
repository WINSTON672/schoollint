import assert from "node:assert/strict";
import test from "node:test";
import { passesAiFindingGuard, reportableBrokenStatus } from "../lib/auditor";

test("only definitive missing-link statuses are reportable", () => {
  assert.equal(reportableBrokenStatus(404), true);
  assert.equal(reportableBrokenStatus(410), true);
  for (const status of [200, 301, 401, 403, 405, 429, 500, 503]) {
    assert.equal(reportableBrokenStatus(status), false, `${status} must not become a broken-link finding`);
  }
});

test("AI review requires an explicit high-confidence conflict", () => {
  assert.equal(passesAiFindingGuard({ isConflict: true, confidence: .94, title: "Which deadline is current?" }), true);
  assert.equal(passesAiFindingGuard({ isConflict: false, confidence: 1, title: "Different pages" }), false);
  assert.equal(passesAiFindingGuard({ isConflict: true, confidence: .89, title: "Possible conflict" }), false);
});

test("a self-negating model explanation can never become a finding", () => {
  assert.equal(passesAiFindingGuard({
    isConflict: true,
    confidence: 1,
    title: "Which detail is current?",
    explanation: "No genuine conflict found; these passages describe different programs.",
  }), false);
});
