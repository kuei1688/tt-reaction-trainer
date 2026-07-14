'use strict';
const assert = require('assert');
const scan = require('../scan');

const fps = 60;
const frames = [];
for (let i = 0; i < 300; i++) frames.push({ index: i, timeSec: i / fps, path: 'f' + i });
const contactIdx = 258; // 4.3s

const classify = async function (f) {
  if (f.index < contactIdx - 1) return 'before_contact';
  if (f.index <= contactIdx + 1) return 'contact';
  return 'after_contact';
};

(async function () {
  const r = await scan.detectContact(frames, { coarseIntervalSec: 0.5, halfWindowSec: 0.5, classifyFn: classify });
  const err = Math.abs(r.contactTimeSec - 4.3) * fps;
  assert.ok(err <= 1, 'expected within 1 frame, got err=' + err + ' sec=' + r.contactTimeSec);
  assert.strictEqual(r.stage, 'fine');
  assert.ok(r.confidence >= 0.5);
  assert.strictEqual(r.fine.via, 'contact');

  const r2 = await scan.detectContact(frames, { coarseIntervalSec: 0.5, halfWindowSec: 0.5, hintSec: 4.3, classifyFn: classify });
  assert.ok(Math.abs(r2.contactTimeSec - 4.3) * fps <= 1);
  assert.ok(r2.warnings.some(function (w) { return w.indexOf('hint') >= 0; }));

  const coarse = scan.selectCoarseFrames(frames, 0.5);
  assert.ok(coarse.length > 0 && coarse.length < 20);
  assert.strictEqual(coarse[0].timeSec, 0);

  const b = scan.detectCoarseBoundary([
    { frame: { timeSec: 0 }, label: 'before_contact' },
    { frame: { timeSec: 0.5 }, label: 'before_contact' },
    { frame: { timeSec: 4.0 }, label: 'contact' },
    { frame: { timeSec: 4.5 }, label: 'after_contact' }
  ]);
  assert.strictEqual(b.contactFrame.timeSec, 4.0);
  assert.strictEqual(b.clear, true);

  const b2 = scan.detectCoarseBoundary([
    { frame: { timeSec: 0 }, label: 'unclear' },
    { frame: { timeSec: 1 }, label: 'unclear' }
  ]);
  assert.strictEqual(b2.contactFrame, null);

  const vb = require('../vision-backend');
  assert.strictEqual(vb.normalizeLabel('AFTER_CONTACT'), 'after_contact');
  assert.strictEqual(vb.normalizeLabel('it is contact'), 'contact');
  assert.strictEqual(vb.normalizeLabel('nope'), 'unclear');
  const p = vb.parseIsContact('blah {"is_contact": true, "confidence": 0.8} trailing');
  assert.strictEqual(p.is_contact, true);
  assert.strictEqual(p.confidence, 0.8);

  console.log('scan.test.js OK -> detected', r.contactTimeSec.toFixed(4), 'conf', r.confidence.toFixed(2), 'via', r.fine.via);
})().catch(function (e) { console.error(e); process.exit(1); });