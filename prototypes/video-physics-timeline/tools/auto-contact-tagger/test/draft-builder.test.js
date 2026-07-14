'use strict';
const assert = require('assert');
const { buildDraft, snapToFrame } = require('../draft-builder');

(function () {
  assert.strictEqual(snapToFrame(4.3001, 60), 4.3);
  assert.strictEqual(snapToFrame(4.30, 60), 4.3);

  const d = buildDraft({ sourceVideo: 'x.mp4', fps: 60, contactTimeSec: 4.3 });
  assert.strictEqual(d.annotation_status, 'draft');
  assert.strictEqual(d.source_video, 'x.mp4');
  assert.strictEqual(d.contact_time_sec, 4.3);
  assert.ok(d.observation_end_sec > d.contact_time_sec, 'observation_end must be after contact');
  assert.strictEqual(d.entry_position.x, 0.5);
  assert.strictEqual(d.entry_position.y, 0.5);
  assert.strictEqual(d.spin_note, '待人工填寫');
  assert.strictEqual(d.preview_profile_id, 'prototype_short');
  assert.strictEqual(d.allowed_variants_draft.review_status, 'pending_coach');
  assert.deepStrictEqual(d.allowed_variants_draft.length, ['short']);

  const d2 = buildDraft({ sourceVideo: 'x.mp4', fps: 60, contactTimeSec: 4.3, observationEndSec: 4.5 });
  assert.strictEqual(d2.observation_end_sec, 4.5);

  // 空 source 退回契約預設（不拋錯）
  const d3 = buildDraft({ sourceVideo: '', fps: 60, contactTimeSec: 4.3 });
  assert.strictEqual(d3.source_video, 'serve-real-backspin-001.mp4');

  // contract 拒絕 end <= contact
  assert.throws(function () { buildDraft({ sourceVideo: 'x.mp4', fps: 60, contactTimeSec: 4.3, observationEndSec: 4.3 }); });
  // contract 拒絕過長 source（>200 字元）
  assert.throws(function () { buildDraft({ sourceVideo: 'x'.repeat(201), fps: 60, contactTimeSec: 4.3 }); });

  console.log('draft-builder.test.js OK');
})();