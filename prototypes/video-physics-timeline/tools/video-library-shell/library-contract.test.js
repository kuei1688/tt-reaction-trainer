// Tests for library-contract.js — pure logic, zero dependencies.
// Run: node prototypes/video-physics-timeline/tools/video-library-shell/library-contract.test.js

"use strict";

const path = require("path");
const assert = require("assert");
const contract = require(path.join(__dirname, "library-contract.js"));

// ── localStorage mock ──────────────────────────────────────────
const store = new Map();
const localStorageMock = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); }
};
globalThis.localStorage = localStorageMock;

// A dummy draftStorageKeyFn that matches annotation-contract pattern
function draftKey(id) {
  return "direction-c-annotator:draft:" + encodeURIComponent(id) + ":v1";
}

let passed = 0;
function ok(label) { passed++; console.log("  ok - " + label); }
function test(name, fn) {
  store.clear();
  console.log(name);
  fn();
}

// ── isVideo ────────────────────────────────────────────────────
test("isVideo filters by extension", () => {
  assert.strictEqual(contract.isVideo({ name: "clip.mp4" }), true);
  assert.strictEqual(contract.isVideo({ name: "clip.MP4" }), true);
  assert.strictEqual(contract.isVideo({ name: "clip.webm" }), true);
  assert.strictEqual(contract.isVideo({ name: "photo.jpg" }), false);
  assert.strictEqual(contract.isVideo({ name: "noext" }), false);
  ok("isVideo");
});

// ── categoryFromPath ──────────────────────────────────────────
test("categoryFromPath extracts first folder", () => {
  assert.strictEqual(
    contract.categoryFromPath("images/contact_backspin/contact_backspin_001.mp4"),
    "contact_backspin"
  );
  assert.strictEqual(
    contract.categoryFromPath("images/contact_sidespin_right/contact_sidespin_023.mp4"),
    "contact_sidespin_right"
  );
  assert.strictEqual(
    contract.categoryFromPath("clip.mp4"),
    "uncategorized"
  );
  ok("categoryFromPath");
});

// ── buildIndex ─────────────────────────────────────────────────
test("buildIndex groups and sorts videos", () => {
  const files = [
    { name: "contact_sidespin_002.mp4", webkitRelativePath: "images/contact_sidespin_left/contact_sidespin_002.mp4", size: 90000 },
    { name: "contact_backspin_001.mp4", webkitRelativePath: "images/contact_backspin/contact_backspin_001.mp4", size: 250000 },
    { name: "contact_sidespin_001.mp4", webkitRelativePath: "images/contact_sidespin_left/contact_sidespin_001.mp4", size: 47000 },
    { name: "thumbnail.jpg", webkitRelativePath: "images/contact_backspin/thumbnail.jpg", size: 5000 },
  ];
  const index = contract.buildIndex(files);
  assert.strictEqual(index.videos.length, 3, "jpg filtered out");
  assert.strictEqual(index.videos[0].category, "contact_backspin");
  assert.strictEqual(index.videos[0].name, "contact_backspin_001.mp4");
  assert.strictEqual(index.videos[1].category, "contact_sidespin_left");
  assert.strictEqual(index.videos[1].name, "contact_sidespin_001.mp4");
  assert.strictEqual(index.videos[2].name, "contact_sidespin_002.mp4");
  assert.ok(index.categories.includes("contact_backspin"));
  assert.ok(index.categories.includes("contact_sidespin_left"));
  ok("buildIndex");
});

// ── completed-set tracking ─────────────────────────────────────
test("markCompleted / isCompleted round-trip", () => {
  assert.strictEqual(contract.isCompleted("v1.mp4"), false);
  contract.markCompleted("v1.mp4");
  assert.strictEqual(contract.isCompleted("v1.mp4"), true);
  assert.strictEqual(contract.isCompleted("v2.mp4"), false);
  ok("completed tracking");
});

// ── videoStatus ────────────────────────────────────────────────
test("videoStatus resolves correctly", () => {
  assert.strictEqual(contract.videoStatus("v.mp4", draftKey), "untouched");
  // Add a draft
  localStorage.setItem(draftKey("v.mp4"), '{"annotation_status":"draft"}');
  assert.strictEqual(contract.videoStatus("v.mp4", draftKey), "draft");
  // Mark complete overrides draft
  contract.markCompleted("v.mp4");
  assert.strictEqual(contract.videoStatus("v.mp4", draftKey), "complete");
  ok("videoStatus");
});

// ── statusCounts ───────────────────────────────────────────────
test("statusCounts tallies correctly", () => {
  const videos = [{ id: "a.mp4" }, { id: "b.mp4" }, { id: "c.mp4" }];
  localStorage.setItem(draftKey("a.mp4"), '{"annotation_status":"draft"}');
  contract.markCompleted("b.mp4");
  const counts = contract.statusCounts(videos, draftKey);
  assert.strictEqual(counts.untouched, 1);
  assert.strictEqual(counts.draft, 1);
  assert.strictEqual(counts.complete, 1);
  ok("statusCounts");
});

// ── buildManifest ──────────────────────────────────────────────
test("buildManifest collects all records", () => {
  const videos = [
    { id: "a.mp4", name: "a.mp4", category: "cat_a", path: "images/cat_a/a.mp4", size: 100 },
    { id: "b.mp4", name: "b.mp4", category: "cat_b", path: "images/cat_b/b.mp4", size: 200 }
  ];
  localStorage.setItem(draftKey("a.mp4"), JSON.stringify({ annotation_status: "draft", source_video: "a.mp4" }));
  contract.markCompleted("b.mp4");
  const manifest = contract.buildManifest(videos, draftKey);
  assert.strictEqual(manifest.total, 2);
  assert.strictEqual(manifest.completed, 1);
  assert.strictEqual(manifest.drafted, 1);
  assert.strictEqual(manifest.records[0].status, "draft");
  assert.strictEqual(manifest.records[0].draft.annotation_status, "draft");
  assert.strictEqual(manifest.records[1].status, "complete");
  assert.strictEqual(manifest.records[1].draft, null);
  ok("buildManifest");
});

// ── importManifest ─────────────────────────────────────────────
test("importManifest restores drafts and completed status", () => {
  const manifest = {
    records: [
      { id: "x.mp4", status: "draft", draft: { annotation_status: "draft", source_video: "x.mp4" } },
      { id: "y.mp4", status: "complete", draft: { annotation_status: "draft", source_video: "y.mp4" } }
    ]
  };
  const restored = contract.importManifest(manifest, draftKey);
  assert.strictEqual(restored, 2);
  assert.strictEqual(contract.videoStatus("x.mp4", draftKey), "draft");
  assert.strictEqual(contract.videoStatus("y.mp4", draftKey), "complete");
  ok("importManifest");
});

// ── importManifest with bad data ───────────────────────────────
test("importManifest rejects invalid manifest", () => {
  assert.strictEqual(contract.importManifest(null, draftKey), 0);
  assert.strictEqual(contract.importManifest({}, draftKey), 0);
  assert.strictEqual(contract.importManifest({ records: "not-an-array" }, draftKey), 0);
  ok("importManifest rejects bad data");
});

console.log("\nAll " + passed + " tests passed.");
