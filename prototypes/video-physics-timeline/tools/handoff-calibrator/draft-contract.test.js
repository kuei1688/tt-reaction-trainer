"use strict";

const assert = require("node:assert/strict");
const { validateDraft } = require("./draft-contract.js");
let passed = 0;

function validDraft() {
  return {
    schema_version: 1,
    status: "draft",
    source: { serve_id: "real_backspin_001", video_src: "./assets/serve-real-backspin-001.mp4" },
    trigger: { time_sec: 4.3, fps: 60 },
    anchor_uv: { x: 0.282, y: 0.266 },
    physics_profile_id: "prototype_short",
    measurement: { canvas_width_px: 960, canvas_height_px: 540, raw_delta_px: 349.2 },
    created_at: "2026-07-11T00:00:00.000Z"
  };
}

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

function rejects(name, mutate) {
  test(name, () => {
    const draft = validDraft();
    mutate(draft);
    assert.throws(() => validateDraft(draft), /Invalid handoff draft/);
  });
}

test("接受有效的單一樣本草稿", () => assert.equal(validateDraft(validDraft()).status, "draft"));
rejects("拒絕錯誤 serve", (draft) => { draft.source.serve_id = "prototype_short"; });
rejects("拒絕非 60 fps 對齊 trigger", (draft) => { draft.trigger.time_sec = 4.301; });
rejects("拒絕越界 UV", (draft) => { draft.anchor_uv.x = 1.01; });
rejects("拒絕負 delta", (draft) => { draft.measurement.raw_delta_px = -1; });
rejects("拒絕發布狀態", (draft) => { draft.status = "published"; });
rejects("拒絕額外發布欄位", (draft) => { draft.reviewed = true; });

console.log(`# ${passed} tests passed`);
