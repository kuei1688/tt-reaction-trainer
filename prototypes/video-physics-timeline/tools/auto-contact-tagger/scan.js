'use strict';
// scan.js
// 兩階段掃描的純邏輯（不碰檔案系統、不呼 API），方便用 mock 測試。
// classifyFn(frame) -> Promise<'before_contact'|'contact'|'after_contact'|'unclear'>
// isContactFn(frame) -> Promise<{is_contact:boolean, confidence:number}>
// frame = { index, timeSec, path }

const LABELS = ['before_contact', 'contact', 'after_contact', 'unclear'];

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
    if (firstContactish === null && (c.label === 'contact' || c.label === 'after_contact')) {
      firstContactish = c.frame;
    }
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
  const boundary = detectCoarseBoundary(classifications);
  return { classifications: classifications, boundary: boundary };
}

async function runFine(frames, isContactFn) {
  let best = null;
  for (const f of frames) {
    const r = await isContactFn(f);
    const conf = Number.isFinite(r.confidence) ? r.confidence : (r.is_contact ? 0.5 : 0.0);
    if (best === null || conf > best.confidence) {
      best = { frame: f, isContact: !!r.is_contact, confidence: conf };
    }
  }
  return best;
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
  const fine = await runFine(fineFrames, opts.isContactFn);
  if (!fine) {
    return { contactTimeSec: centerTimeSec, confidence: 0, stage: 'fine-none', coarse: coarseResult, fine: null, warnings: warnings };
  }
  if (fine.confidence < 0.5) warnings.push('low fine-scan confidence (' + fine.confidence.toFixed(2) + ')');
  return {
    contactTimeSec: fine.frame.timeSec,
    confidence: fine.confidence,
    stage: 'fine',
    coarse: coarseResult,
    fine: { frame: fine.frame, isContact: fine.isContact, confidence: fine.confidence },
    warnings: warnings
  };
}

module.exports = {
  LABELS: LABELS,
  selectCoarseFrames: selectCoarseFrames,
  detectCoarseBoundary: detectCoarseBoundary,
  selectFineFrames: selectFineFrames,
  runCoarse: runCoarse,
  runFine: runFine,
  detectContact: detectContact
};