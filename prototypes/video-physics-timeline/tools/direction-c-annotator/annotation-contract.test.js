"use strict";

const assert = require("node:assert/strict");
const contract = require("./annotation-contract.js");
let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`ok ${passed} - ${name}`); }
function valid() {
  return contract.makeDraft({ fps: 60, contact_time_sec: 1.2833333333333334, observation_end_sec: 1.75, entry_position: { x: 0.313, y: 0.11 }, spin_note: "Backspin observation; coach review required." });
}

test("creates a deliberately draft-only annotation", () => {
  const draft = valid();
  assert.equal(draft.annotation_status, "draft");
  assert.equal(draft.allowed_variants_draft.review_status, "pending_coach");
  assert.equal(draft.preview_profile_id, "prototype_short");
});
test("defaults to the bundled sample but accepts any selected source file", () => {
  assert.equal(valid().source_video, contract.DEFAULT_SOURCE_VIDEO);
  const draft = valid(); draft.source_video = "coach-batch/serve-topspin-014.mp4";
  assert.equal(contract.validateAnnotation(draft), draft);
});
test("rejects an empty or oversized source video name", () => {
  const draft = valid();
  draft.source_video = "   ";
  assert.throws(() => contract.validateAnnotation(draft), /source_video/);
  draft.source_video = "x".repeat(201);
  assert.throws(() => contract.validateAnnotation(draft), /source_video/);
});
test("requires observation to end after contact", () => {
  const draft = valid(); draft.observation_end_sec = draft.contact_time_sec;
  assert.throws(() => contract.validateAnnotation(draft), /after contact/);
});
test("rejects a generation-status style field", () => {
  const draft = valid(); draft.generation_status = "ready";
  assert.throws(() => contract.validateAnnotation(draft), /unsupported fields/);
});
test("locks review to pending coach", () => {
  const draft = valid(); draft.allowed_variants_draft.review_status = "approved";
  assert.throws(() => contract.validateAnnotation(draft), /review_status/);
});
test("uses a source-specific stable local storage key", () => {
  assert.equal(contract.draftStorageKey(), `direction-c-annotator:draft:${encodeURIComponent(contract.DEFAULT_SOURCE_VIDEO)}:v1`);
  assert.equal(contract.draftStorageKey("my serve.mp4"), "direction-c-annotator:draft:my%20serve.mp4:v1");
});
console.log(`# ${passed} tests passed`);
