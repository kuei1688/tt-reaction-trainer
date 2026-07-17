#!/usr/bin/env node

// VAL-005: return-studio.html 回擊批次驗證（研究頁行為快照）。
//
// 邊界（docs/VAL005_RETURN_STUDIO_BATCH_VALIDATION_TASKPACK.md）：
// - 結果只代表 return-studio.html 研究頁自身，不是 game4.html 正式驗收；
//   不與 game4.html 做「是否一致」的 cross-check（兩邊回擊公式族刻意分歧）。
// - 只驗證「16 preset × 技術 × side 目前的過網／落點／成功判定」這類可重跑
//   的行為快照，不驗證物理是否真實正確。
// - 透過 load-return-studio-physics.js 做具名符號抽取，不整段執行 inline script。
//
// Exit code 判準（比照任務包階段三的建議選項）：
// - 0 = 腳本層級執行成功（讀到 preset、loader 就緒、64 組合全部產生結果）。
//   單筆組合判定失敗或丟出例外（reason 標記 "Exception: ..."）不影響 exit code，
//   因為部分組合設計上本來就可能不成功（參照 VAL-003 個別 solver 門檻寬鬆的先例）。
// - 1 = 腳本層級失敗（讀不到 preset 檔案、loader 未就緒、結果筆數不完整）。

const fs = require("fs");
const path = require("path");
const {
  loadReturnStudioPhysics,
  RETURN_STUDIO_TARGETS,
  TECHNIQUES_EXTRACTION_NOTE,
} = require("../load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
// 獨立報告檔案：不共用 AI_CONTEXT/adhoc-experiments/test_output.txt（VAL-003/VAL-004 已存在
// 互相覆寫問題，本工具不加入爭搶；理由見任務包「輸出檔案」小節）。
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "val005_return_studio_test_output.txt");

// side × 技術組合：依 return-studio.html syncSideLock() 的現行邏輯——
// forehand_attack 鎖 forehand、backhand_attack 鎖 backhand、push 雙側皆合法。
// 16 preset × 4 組合 = 64 組。
const COMBOS = [
  { techniqueKey: "forehand_attack", side: "forehand" },
  { techniqueKey: "backhand_attack", side: "backhand" },
  { techniqueKey: "push", side: "forehand" },
  { techniqueKey: "push", side: "backhand" },
];

function main() {
  // 以下任何一步失敗都屬於腳本層級失敗（exit 1）：
  const presets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  if (presets.length === 0) {
    throw new Error(`No serve presets found in ${PRESETS_FILE}.`);
  }

  const loader = loadReturnStudioPhysics({});
  const extracted = loader.instantiateReturnStudioSymbols([
    ...RETURN_STUDIO_TARGETS.functions,
    ...RETURN_STUDIO_TARGETS.constants,
  ]);

  const rows = [];
  for (const preset of presets) {
    for (const combo of COMBOS) {
      rows.push(runCombo(extracted, preset, combo));
    }
  }

  const expectedCount = presets.length * COMBOS.length;
  if (rows.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} results, got ${rows.length}.`);
  }

  const okCount = rows.filter((row) => row.ok).length;
  const exceptionCount = rows.filter((row) =>
    String(row.reason).startsWith("Exception:")
  ).length;

  // 終端機輔助顯示（檔案輸出才是完整結構化結果）。
  console.table(
    rows.map((row) => ({
      preset: row.preset,
      technique: row.technique,
      side: row.side,
      ok: row.ok,
      reason: row.reason,
    }))
  );

  const report = formatReport(rows, presets.length, okCount, exceptionCount);
  fs.writeFileSync(REPORT_FILE, report, "utf8");
  console.log(`ok: ${okCount} / ${rows.length} (exceptions: ${exceptionCount})`);
  console.log(`Report written to ${REPORT_FILE}`);
  process.exit(0);
}

function runCombo(extracted, preset, combo) {
  const row = {
    preset: preset.id,
    technique: combo.techniqueKey,
    side: combo.side,
    ok: false,
    reason: null,
    netClearance: null,
    firstBounce: null,
    hitPoint: null,
  };

  // 單筆組合的例外（數值錯誤、undefined 存取等）標記後繼續跑下一組，
  // 不讓單一極端值中斷整個批次。
  try {
    const sim = extracted.simulateReturnForPreset(
      preset,
      combo.side,
      combo.techniqueKey
    );
    const judged = extracted.judgeResult(sim.result);
    row.ok = judged.ok;
    row.reason = judged.reason;
    row.netClearance = judged.netClearance != null ? round(judged.netClearance) : null;
    row.firstBounce = judged.firstBounce
      ? { x: round(judged.firstBounce.x), z: round(judged.firstBounce.z) }
      : null;
    row.hitPoint = sim.hitPoint
      ? { x: round(sim.hitPoint.x), y: round(sim.hitPoint.y), z: round(sim.hitPoint.z) }
      : null;
  } catch (error) {
    row.ok = false;
    row.reason = `Exception: ${error.message}`;
  }

  return row;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function formatReport(rows, presetCount, okCount, exceptionCount) {
  const lines = [];
  lines.push("# Return Studio Batch Validation (VAL-005)");
  lines.push("");
  lines.push("> return-studio.html 研究頁批次結果，非 game4.html 正式驗收。");
  lines.push("> 本報告不與 game4.html 做一致性 cross-check：兩邊的回擊公式族刻意分歧");
  lines.push("> （見 docs/VAL005_RETURN_STUDIO_BATCH_VALIDATION_TASKPACK.md「範圍界定」），");
  lines.push("> 差異比對屬於 VAL-006 / CMD-008 範圍。");
  lines.push(`> 本工具抽取的 TECHNIQUES：${TECHNIQUES_EXTRACTION_NOTE}。`);
  lines.push("");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presetCount} (physics-presets.json)`);
  lines.push(
    "Combos: forehand_attack×forehand + backhand_attack×backhand + push×forehand + push×backhand" +
      ` = ${rows.length} 組（side 對應依 return-studio.html syncSideLock() 現行邏輯）`
  );
  lines.push("");
  lines.push("觀察註記：現行 simulateReturnForPreset(preset, side, techniqueKey) 的 side 參數");
  lines.push("在函式體內未被使用（原始碼行為快照），因此 push 的 forehand / backhand 兩側");
  lines.push("結果目前相同。此為 return-studio.html 現況的如實記錄，非本工具的判定。");
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`ok: ${okCount} / ${rows.length}（Exception 例外筆數: ${exceptionCount}）`);
  for (const combo of COMBOS) {
    const comboRows = rows.filter(
      (row) => row.technique === combo.techniqueKey && row.side === combo.side
    );
    const comboOk = comboRows.filter((row) => row.ok).length;
    lines.push(`- ${combo.techniqueKey} × ${combo.side}: ${comboOk} / ${comboRows.length} ok`);
  }
  lines.push("");
  lines.push(
    "Exit code: 0 =「腳本本身執行無例外且 64 組全部產生結果」；不代表全部組合判定成功，"
  );
  lines.push("單筆 ok:false / Exception 不算腳本層級失敗（比照 VAL-003 先例）。");
  lines.push("");

  lines.push("## Results");
  lines.push("");
  lines.push("status | preset | technique | side | reason | netClearance | firstBounce(x,z)");
  lines.push("--- | --- | --- | --- | --- | --- | ---");
  for (const row of rows) {
    const status = row.ok ? "Pass" : "Fail";
    const net = row.netClearance != null ? row.netClearance.toFixed(4) : "null";
    const bounce = row.firstBounce
      ? `${row.firstBounce.x.toFixed(3)}, ${row.firstBounce.z.toFixed(3)}`
      : "null";
    lines.push(
      `${status} | ${row.preset} | ${row.technique} | ${row.side} | ${row.reason} | ${net} | ${bounce}`
    );
  }
  lines.push("");

  lines.push("## Full JSON");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(rows, null, 2));
  lines.push("```");
  return lines.join("\n") + "\n";
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.message}`);
  process.exit(1);
}
