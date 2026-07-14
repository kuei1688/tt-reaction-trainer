#!/usr/bin/env node

// tiltY 校準掃描：在 return-studio.html 的切球(push)路徑上，用
// load-return-studio-physics.js 現成的具名符號抽取機制，對一段 tiltY 候選值
// 逐一覆寫 PUSH_TILT_Y 常數（透過 instantiateReturnStudioSymbols 的
// extraExternals 參數——external 優先於本地抽取，見該檔案內 bounceOffPlane
// 的 FORCE_LOCAL_OVERRIDES 範例，這裡是反向操作：把常數變成外部注入值，
// 不改動 return-studio.html 原始碼），重跑 push 技術對每個候選值的過網/
// 落點結果。
//
// 不是自動最佳化：只逐一算出每個候選值的分數，不會自己選出「最佳解」，
// 由人判斷 pass 率/失敗原因後決定要不要收斂範圍。
//
// 資料集邊界（使用者 2026-07-13 確認）：16 顆發球 preset 拿掉 5 顆——
// - no_spin_long_forehand / no_spin_long_backhand：不轉的球不該拿來測切球側旋修正。
// - backspin_short_forehand_2 / backspin_short_backhand_2 / backspin_short_backhand：
//   第二落點過度貼網(z=0.24/0.45/0.54，明顯短於 backspin_short_forehand 的 1.11)，
//   設計得太誇張，不適合拿來找一般解。
// 保留 11 顆。
//
// side 參數注意：simulateReturnForPreset(preset, side, techniqueKey) 目前
// push 的 side 參數在函式體內未被使用(既有已知現況，見
// AI_CONTEXT/OPEN_ITEMS.md VAL-005 Phase 2 註記)，forehand/backhand 結果
// 會相同，這裡只跑 forehand 一側避免重複列出一樣的數字。

const fs = require("fs");
const path = require("path");
const {
  loadReturnStudioPhysics,
  RETURN_STUDIO_TARGETS,
} = require("./load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_tilty_sweep_output.txt");

const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

const TILT_Y_CANDIDATES = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.73];

function angleFromTiltY(tiltY) {
  return 90 - (Math.atan(tiltY) * 180) / Math.PI;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function runOneTiltY(tiltY, presets) {
  const loader = loadReturnStudioPhysics({});
  const extracted = loader.instantiateReturnStudioSymbols(
    RETURN_STUDIO_TARGETS.functions,
    { PUSH_TILT_Y: tiltY }
  );

  const rows = [];
  for (const preset of presets) {
    const row = { preset: preset.id, ok: false, reason: null, netClearance: null };
    try {
      const sim = extracted.simulateReturnForPreset(preset, "forehand", "push");
      const judged = extracted.judgeResult(sim.result);
      row.ok = judged.ok;
      row.reason = judged.reason;
      row.netClearance = judged.netClearance != null ? round(judged.netClearance) : null;
    } catch (error) {
      row.ok = false;
      row.reason = `Exception: ${error.message}`;
    }
    rows.push(row);
  }
  return rows;
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const presets = allPresets.filter((preset) => !EXCLUDED_PRESET_IDS.has(preset.id));

  if (presets.length !== allPresets.length - EXCLUDED_PRESET_IDS.size) {
    throw new Error(
      `Expected to exclude ${EXCLUDED_PRESET_IDS.size} presets by id, but excluded ${
        allPresets.length - presets.length
      }. Check EXCLUDED_PRESET_IDS against physics-presets.json.`
    );
  }

  const summary = TILT_Y_CANDIDATES.map((tiltY) => {
    const rows = runOneTiltY(tiltY, presets);
    const okCount = rows.filter((row) => row.ok).length;
    const failing = rows.filter((row) => !row.ok);
    return { tiltY, angleDeg: round(angleFromTiltY(tiltY)), okCount, total: rows.length, rows, failing };
  });

  const lines = [];
  lines.push("# push tiltY 校準掃描(return-studio.html, push 技術, forehand 側)");
  lines.push("");
  lines.push("> 研究工具輸出，非 game4.html 正式驗收。只逐一計算候選值分數，不自動找最佳解。");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length}（原始16顆，排除 ${EXCLUDED_PRESET_IDS.size} 顆：${[...EXCLUDED_PRESET_IDS].join(", ")}）`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("tiltY | 換算角度 | pass/total | 失敗 preset");
  lines.push("--- | --- | --- | ---");
  for (const entry of summary) {
    const failNames = entry.failing.map((row) => `${row.preset}(${row.reason})`).join("; ") || "-";
    lines.push(`${entry.tiltY} | ${entry.angleDeg}° | ${entry.okCount}/${entry.total} | ${failNames}`);
  }
  lines.push("");
  lines.push("## Full JSON");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.map(({ tiltY, angleDeg, okCount, total, rows }) => ({ tiltY, angleDeg, okCount, total, rows })), null, 2));
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");
  console.table(summary.map((entry) => ({ tiltY: entry.tiltY, angleDeg: entry.angleDeg, pass: `${entry.okCount}/${entry.total}` })));
  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.message}`);
  process.exit(1);
}
