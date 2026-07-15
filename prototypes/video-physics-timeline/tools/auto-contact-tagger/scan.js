'use strict';
// scan.js
// 兩階段掃描的純邏輯（不碰檔案系統、不呼 API），方便用 mock 測試。
// 粗掃與細掃都用同一個 classifyFn(frame) -> Promise<label>，
// label ∈ before_contact | contact | after_contact | unclear。
// （原計畫細掃用 isContact 二元+信心；實測 reasoning 模型在嚴格二元判斷上會猶豫，
//  但 4-way classify 在觸球幀能正確回 contact，故細掃改用 classify label 選幀。）
// frame = { index, timeSec, path }

function selectCoarseFrames(frames, coarseIntervalSec) {
  if (!frames.length) return [];
  if (coarseIntervalSec <= 0) return frames.slice();
  const sampled = [];
  let nextTarget = 0;
  for (const f of frames) {
    if (f.timeSec >= nextTarget - 1e-9) {
      sampled.push(f);
      nextTarget = sampled.length * coarseIntervalSec;
    }
  }
  return sampled;
}

function detectCoarseBoundary(classifications) {
  let firstContactish = null;
  let lastBefore = null;
  let contactLabelFrame = null;
  for (const c of classifications) {
    if (c.label === 'before_contact') lastBefore = c.frame;
    if (contactLabelFrame === null && c.label === 'contact') contactLabelFrame = c.frame;
    if (firstContactish === null && (c.label === 'contact' || c.label === 'after_contact')) firstContactish = c.frame;
  }
  if (contactLabelFrame) return { contactFrame: contactLabelFrame, confidence: 0.55, clear: true };
  if (firstContactish) return { contactFrame: firstContactish, confidence: 0.45, clear: true };
  if (lastBefore) return { contactFrame: lastBefore, confidence: 0.25, clear: false };
  return { contactFrame: null, confidence: 0, clear: false };
}

function selectFineFrames(frames, centerTimeSec, halfWindowSec) {
  const lo = centerTimeSec - halfWindowSec;
  const hi = centerTimeSec + halfWindowSec;
  return frames.filter(f => f.timeSec >= lo - 1e-9 && f.timeSec <= hi + 1e-9);
}

async function runCoarse(frames, coarseIntervalSec, classifyFn) {
  const sampled = selectCoarseFrames(frames, coarseIntervalSec);
  const classifications = [];
  for (const f of sampled) {
    const label = await classifyFn(f);
    classifications.push({ frame: f, label: label });
  }
  return { classifications: classifications, boundary: detectCoarseBoundary(classifications) };
}

async function runFine(frames, classifyFn) {
  const labels = [];
  for (const f of frames) {
    labels.push({ frame: f, label: await classifyFn(f) });
  }
  const contactFrames = labels.filter(c => c.label === 'contact');
  if (contactFrames.length) {
    // 取 contact 叢集的「首幀」＝ before→contact 的轉換點。
    // 先前取中間幀會把觸球後仍貼著拍的幾幀也算進來，使偵測系統性偏晚。
    const first = contactFrames[0];
    return { frame: first.frame, confidence: 0.85, labels: labels, via: 'contact' };
  }
  let lastBefore = null, firstAfter = null;
  for (const c of labels) {
    if (c.label === 'before_contact') lastBefore = c.frame;
    if (firstAfter === null && c.label === 'after_contact') firstAfter = c.frame;
  }
  if (lastBefore && firstAfter) return { frame: lastBefore, confidence: 0.5, labels: labels, via: 'boundary' };
  if (lastBefore) return { frame: lastBefore, confidence: 0.3, labels: labels, via: 'before-only' };
  if (firstAfter) return { frame: firstAfter, confidence: 0.3, labels: labels, via: 'after-only' };
  return { frame: labels[labels.length - 1].frame, confidence: 0.1, labels: labels, via: 'unclear' };
}

async function detectContact(frames, opts) {
  const warnings = [];
  const coarseIntervalSec = opts.coarseIntervalSec != null ? opts.coarseIntervalSec : 0.5;
  const halfWindowSec = opts.halfWindowSec != null ? opts.halfWindowSec : 0.5;
  let centerTimeSec = null;
  let coarseResult = null;

  if (opts.hintSec != null) {
    centerTimeSec = opts.hintSec;
    warnings.push('using --hint, skipping coarse scan');
  } else {
    coarseResult = await runCoarse(frames, coarseIntervalSec, opts.classifyFn);
    const b = coarseResult.boundary;
    if (!b.contactFrame) {
      warnings.push('coarse scan found no clear contact boundary; best-effort fallback');
      const cls = coarseResult.classifications;
      centerTimeSec = cls.length ? cls[cls.length - 1].frame.timeSec : frames[frames.length - 1].timeSec;
    } else {
      if (!b.clear) warnings.push('coarse boundary ambiguous (low confidence)');
      centerTimeSec = b.contactFrame.timeSec;
    }
  }

  const fineFrames = selectFineFrames(frames, centerTimeSec, halfWindowSec);
  if (!fineFrames.length) {
    warnings.push('no frames in fine-scan window; falling back to center frame');
    return { contactTimeSec: centerTimeSec, confidence: 0, stage: 'fine-empty', coarse: coarseResult, fine: null, warnings: warnings };
  }
  const fine = await runFine(fineFrames, opts.classifyFn);
  if (fine.confidence < 0.5) warnings.push('low fine-scan confidence (' + fine.confidence.toFixed(2) + ', via ' + fine.via + ')');
  return {
    contactTimeSec: fine.frame.timeSec,
    confidence: fine.confidence,
    stage: 'fine',
    coarse: coarseResult,
    fine: { frame: fine.frame, confidence: fine.confidence, via: fine.via, labels: fine.labels },
    warnings: warnings
  };
}

module.exports = {
  selectCoarseFrames: selectCoarseFrames,
  detectCoarseBoundary: detectCoarseBoundary,
  selectFineFrames: selectFineFrames,
  runCoarse: runCoarse,
  runFine: runFine,
  detectContact: detectContact
};