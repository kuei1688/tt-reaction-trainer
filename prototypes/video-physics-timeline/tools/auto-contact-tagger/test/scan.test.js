'use strict';
const assert = require('assert');
const scan = require('../scan');

const fps = 60;
const frames = [];
for (let i = 0; i < 300; i++) frames.push({ index: i, timeSec: i / fps, path: 'f' + i });
const contactIdx = 258; // 4.3s（real_backspin_001 人工真值 frame 258 = 4.300s）

const classify = async function (f) {
  if (f.index < contactIdx - 1) return 'before_contact';
  if (f.index <= contactIdx + 1) return 'contact';
  return 'after_contact';
};
const isContact = async function (f) {
  if (f.index === contactIdx) return { is_contact: true, confidence: 0.9 };
  if (Math.abs(f.index - contactIdx) <= 1) return { is_contact: false, confidence: 0.35 };
  return { is_contact: false, confidence: 0.05 };
};

(async function () {
  // 1. 兩階段：無 hint
  const r = await scan.detectContact(frames, {
    coarseIntervalSec: 0.5, halfWindowSec: 0.5,
    classifyFn: classify, isContactFn: isContact
  });
  const errFrames = Math.abs(r.contactTimeSec - 4.3) * fps;
  assert.ok(errFrames <= 1, 'expected within 1 frame, got err=' + errFrames + ' sec=' + r.contactTimeSec);
  assert.strictEqual(r.stage, 'fine');
  assert.ok(r.confidence >= 0.5);

  // 2. --hint 直接進細掃
  const r2 = await scan.detectContact(frames, {
    coarseIntervalSec: 0.5, halfWindowSec: 0.5, hintSec: 4.3,
    classifyFn: classify, isContactFn: isContact
  });
  assert.ok(Math.abs(r2.contactTimeSec - 4.3) * fps <= 1);
  assert.ok(r2.warnings.some(function (w) { return w.indexOf('hint') >= 0; }));

  // 3. coarse 選幀間隔
  const coarse = scan.selectCoarseFrames(frames, 0.5);
  assert.ok(coarse.length > 0 && coarse.length < 20);
  assert.strictEqual(coarse[0].timeSec, 0);

  // 4. detectCoarseBoundary：contact 標籤優先
  const b = scan.detectCoarseBoundary([
    { frame: { timeSec: 0 }, label: 'before_contact' },
    { frame: { timeSec: 0.5 }, label: 'before_contact' },
    { frame: { timeSec: 4.0 }, label: 'contact' },
    { frame: { timeSec: 4.5 }, label: 'after_contact' }
  ]);
  assert.strictEqual(b.contactFrame.timeSec, 4.0);
  assert.strictEqual(b.clear, true);

  // 5. 全 unclear 退化
  const b2 = scan.detectCoarseBoundary([
    { frame: { timeSec: 0 }, label: 'unclear' },
    { frame: { timeSec: 1 }, label: 'unclear' }
  ]);
  assert.strictEqual(b2.contactFrame, null);

  // 6. normalize/parse（來自 vision-backend）
  const vb = require('../vision-backend');
  assert.strictEqual(vb.normalizeLabel('AFTER_CONTACT'), 'after_contact');
  assert.strictEqual(vb.normalizeLabel('it is contact'), 'contact');
  assert.strictEqual(vb.normalizeLabel('nope'), 'unclear');
  const p = vb.parseIsContact('blah {"is_contact": true, "confidence": 0.8} trailing');
  assert.strictEqual(p.is_contact, true);
  assert.strictEqual(p.confidence, 0.8);

  console.log('scan.test.js OK -> detected', r.contactTimeSec.toFixed(4), 'conf', r.confidence.toFixed(2));
})().catch(function (e) { console.error(e); process.exit(1); });