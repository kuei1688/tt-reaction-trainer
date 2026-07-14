'use strict';
// draft-builder.js
// 把偵測到的 contact_time_sec 組裝成通過 annotation-contract 驗證的 draft JSON。
// 只有 contact_time_sec 是自動偵測；其餘欄位為佔位預設，待人工在標註器內調整。
// 欄位名遵循 annotation-contract.js makeDraft 的 snake_case 命名。
// observation_end_sec 只有在呼叫端未提供時才給預設；若呼叫端給了不合法值，
// 刻意不靜默修正，交給契約拋錯（避免吃掉錯誤）。
const contract = require('./contract-bridge');

const DEFAULT_SPIN_NOTE = '待人工填寫';

function snapToFrame(sec, fps) {
  return Math.round(sec * fps) / fps;
}

function buildDraft(opts) {
  const fps = opts.fps;
  const contact = snapToFrame(opts.contactTimeSec, fps);
  let obsEnd = opts.observationEndSec;
  if (obsEnd == null) {
    obsEnd = snapToFrame(contact + 0.3, fps);
  } else {
    obsEnd = snapToFrame(obsEnd, fps);
  }
  const entry = opts.entryPosition || { x: 0.5, y: 0.5 };
  return contract.makeDraft({
    source_video: opts.sourceVideo,
    fps: fps,
    contact_time_sec: contact,
    observation_end_sec: obsEnd,
    entry_position: entry,
    spin_note: opts.spinNote || DEFAULT_SPIN_NOTE,
    length: ['short'],
    placement: [],
    speed: []
  });
}

module.exports = { buildDraft: buildDraft, snapToFrame: snapToFrame, DEFAULT_SPIN_NOTE: DEFAULT_SPIN_NOTE };