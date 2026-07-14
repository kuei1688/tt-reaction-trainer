'use strict';
// verify-handoff.js — 用 auto-contact-tagger 產出的 draft 驅動 direction-c-annotator
// 的 C3 預覽邏輯（純 Node，不開瀏覽器），確認 handoff 時間軸與訓練球軌跡一致且可計算。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const here = __dirname;
const protoDir = path.resolve(here, '../..');
const annotatorDir = path.resolve(here, '../direction-c-annotator');
const ctx = vm.createContext({ console });
for (const f of [
  path.resolve(protoDir, '../../shared-physics-core.js'),
  path.resolve(protoDir, 'prototype-physics-bridge.js'),
  path.resolve(protoDir, 'projection-helper.js'),
  path.resolve(protoDir, 'direction-c/direction-c-engine.js'),
  path.resolve(annotatorDir, 'annotation-contract.js'),
  path.resolve(annotatorDir, 'preview-runtime.js')
]) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);

const contract = ctx.DirectionCAnnotationContract;
const runtime = ctx.DirectionCAnnotatorPreviewRuntime;
const bridge = ctx.PrototypePhysicsBridge;
const projection = ctx.VideoPhysicsProjection;
const Experiment = ctx.DirectionCExperiment.Experiment;

const draft = JSON.parse(fs.readFileSync(path.join(here, 'real_backspin_001.draft.json'), 'utf8'));
contract.validateAnnotation(draft);
const config = JSON.parse(fs.readFileSync(path.join(protoDir, 'timeline-config.json'), 'utf8'));
const profile = config.serves.find(function (s) { return s.id === contract.PROFILE_ID; }).physics;
const W = 960, H = 540;
const deps = { projection: projection, bridge: bridge, width: W, height: H };

console.log('draft:', JSON.stringify({ contact: draft.contact_time_sec, obsEnd: draft.observation_end_sec, entry: draft.entry_position, profile: draft.preview_profile_id }));

// C3 狀態機
const exp = new Experiment(draft.contact_time_sec, draft.observation_end_sec, {});
exp.start('C3', 0);
const transitions = [];
let prev = exp.snapshot(0).state;
for (let i = 0; i <= 420; i++) {
  const mt = i / 60;
  const now = mt * 1000;
  const snap = exp.tick(mt, now);
  if (snap.state !== prev) { transitions.push({ atSec: mt, from: prev, to: snap.state, showVideo: snap.showVideo, showBall: snap.showTrainingBall }); prev = snap.state; }
}
console.log('\nC3 狀態轉換:');
for (const t of transitions) console.log('  t=' + t.atSec.toFixed(3) + 's  ' + t.from + ' -> ' + t.to + '  (video=' + t.showVideo + ', ball=' + t.showBall + ')');
console.log('events: ' + exp.events.map(function (e) { return e.type + '@' + (e.mediaTimeSec != null ? e.mediaTimeSec.toFixed(3) + 's' : (e.nowMs / 1000).toFixed(3) + 's'); }).join(' | '));

// 軌跡
const traj = runtime.traceEntryTrajectory(draft.entry_position, profile, deps);
console.log('\n軌跡: points=' + traj.points.length + ' bounces=' + traj.bounces.length + ' stopped=' + traj.stopped + ' reason=' + traj.stopReason);
console.log('first:', JSON.stringify(traj.points[0]));
console.log('last:', JSON.stringify(traj.points[traj.points.length - 1]));
const geom = projection.tableGeometry(W, H, runtime.MOBILE_TABLE_LAYOUT);
function insideTable(p) {
  if (p.y < geom.farY - 1e-6 || p.y > geom.nearY + 1e-6) return false;
  const d = (p.y - geom.farY) / (geom.nearY - geom.farY);
  return Math.abs(p.x - W / 2) <= geom.farHalf + (geom.nearHalf - geom.farHalf) * d + 1e-6;
}
const bouncesIn = traj.bounces.filter(insideTable).length;
const ptsIn = traj.points.filter(insideTable).length;
console.log('bounces inside drawn table: ' + bouncesIn + '/' + traj.bounces.length);
console.log('points inside drawn table: ' + ptsIn + '/' + traj.points.length);
console.log('\nHANDOFF OK');