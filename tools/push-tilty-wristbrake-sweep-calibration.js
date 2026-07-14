#!/usr/bin/env node

// tiltY × wristBrakeRate 聯合掃描：延續 push-tilty-sweep-calibration.js 的做法，
// 但這次(1)重新打開 tiltY 的搜尋範圍到「拍面幾乎平躺」的大值(不再迴避舊
// Stage 2 判定的「flat paddle」偏誤——使用者已確認那個偏誤其實是資料集裡
// no_spin_* 造成的假象，不是拍面平躺本身有問題，見 2026-07-13 對話結論)，
// (2)第一次把 wristBrakeRate（接觸期間手腕煞車速率，見 return-studio.html
// 的 bounceOffPlaneSubstepped/applyPushContact 說明，目前正式常數
// PUSH_WRIST_BRAKE_RATE 寫死為0，從未進過任何聯合搜尋)一起納入自由參數。
//
// 覆寫機制沿用 load-return-studio-physics.js 的
// instantiateReturnStudioSymbols(symbolNames, extraExternals)：extraExternals
// 裡的名字會蓋掉本地抽取，PUSH_TILT_Y 覆寫方式跟舊工具一樣；wristBrakeRate
// 不是常數本身而是 applyPushContact 呼叫 bounceOffPlaneSubstepped 時傳入的
// options.wristBrakeRate: PUSH_WRIST_BRAKE_RATE，所以一樣可以透過覆寫
// PUSH_WRIST_BRAKE_RATE 這個常數達到目的，不需要更複雜的整函式覆寫招數。
//
// 不是自動最佳化：只逐一算出每個候選組合的分數，不自動收斂範圍。
//
// 資料集邊界跟 push-tilty-sweep-calibration.js 完全一致（同一組 11 顆）。
//
// 旋轉正確性指標（本工具自訂，非逐字複製 docs/ARCHIVE/physics-engine-v2-plan.md
// 的 correctSpinFrac，但精神一致）：該文件的歷史紀錄顯示，「揮拍方向y分量
// 用物理上正確的負值（往下刷）」被判定為「旋轉方向多數正確」，而那個設定
// 下輸出的 topspin 維持跟來球同號（負值/下旋），不是翻正——也就是說，該文件
// 定義的「正確」= 輸出旋轉方向跟來球同號（下旋刷過去還是下旋，只是量可能
// 減少），不是翻轉成上旋。本工具採用同一個定義：
//   incomingTopspin 一定是負值(下旋，資料集只含 backspin/sidebackspin 系列)
//   spinCorrect = (outgoingTopspin <= 0)  // 同號或至少沒翻正
// 同時也記錄 spinFlipped（號翻轉了沒有）跟量的比例，方便回頭核對定義。
//
// side 參數注意：跟舊工具一樣，push 的 side 參數目前在函式體內未被使用，
// 只跑 forehand 一側。

const fs = require("fs");
const path = require("path");
const {
  loadReturnStudioPhysics,
  RETURN_STUDIO_TARGETS,
} = require("./load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(
  ROOT_DIR,
  "AI_CONTEXT",
  "push_tilty_wristbrake_sweep_output.txt"
);

const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

// 寬範圍：0.8(≈51°)~10(≈5.7°，近乎平拍)，涵蓋舊搜尋範圍(1.0~1.73)也涵蓋
// 使用者描述的「指尖發球式」平拍區。
const TILT_Y_CANDIDATES = [0.8, 1.0, 1.3, 1.73, 2.5, 4, 6, 10];

// 接觸時長約5.5ms(真實秒)。0=完全不煞車(現行部署值)；50/145大致落在「自然
// 減速」區間(exp(-rate*0.0055)≈0.71~0.48，保留約5~7成到約5成速度)；
// 300/500/800落入「急停」區間(保留約17%~<1%速度)，對應使用者描述的指尖
// 發球式手感實驗。
const WRIST_BRAKE_RATE_CANDIDATES = [0, 50, 145, 300, 500, 800];

function angleFromTiltY(tiltY) {
  return 90 - (Math.atan(tiltY) * 180) / Math.PI;
}

function round(value) {
  if (value == null || !Number.isFinite(value)) return value;
  return Math.round(value * 10000) / 10000;
}

function findPresetHitSpin(extracted, preset) {
  // 跟 simulateReturnForPreset 內部完全一致的邏輯，只是額外把 hitSpin
  // (來球旋轉)也留下來，因為 simulateReturnForPreset 本身不回傳它。
  const serve = extracted.simulateServe(preset);
  const hitIndex = extracted.findPushHitIndex(serve);
  return serve.spins[hitIndex];
}

function runOneCombo(tiltY, wristBrakeRate, presets) {
  const loader = loadReturnStudioPhysics({});
  const extracted = loader.instantiateReturnStudioSymbols(
    RETURN_STUDIO_TARGETS.functions,
    { PUSH_TILT_Y: tiltY, PUSH_WRIST_BRAKE_RATE: wristBrakeRate }
  );

  const rows = [];
  for (const preset of presets) {
    const row = {
      preset: preset.id,
      ok: false,
      reason: null,
      netClearance: null,
      incomingTopspin: null,
      outgoingTopspin: null,
      spinFlipped: null,
      spinCorrect: null,
      spinRetainedFrac: null,
    };
    try {
      const sim = extracted.simulateReturnForPreset(preset, "forehand", "push");
      const judged = extracted.judgeResult(sim.result);
      row.ok = judged.ok;
      row.reason = judged.reason;
      row.netClearance = judged.netClearance != null ? round(judged.netClearance) : null;

      const hitSpin = findPresetHitSpin(extracted, preset);
      const incomingTopspin = hitSpin.topspin;
      // sim.result.spins[0] = 觸拍後、飛行前的立即輸出旋轉(第一個桌面反彈前
      // 不會再變動，因為 spin 只在 simulatePath 的反彈事件才更新)。
      const outgoingTopspin = sim.result.spins[0] ? sim.result.spins[0].topspin : null;

      row.incomingTopspin = round(incomingTopspin);
      row.outgoingTopspin = round(outgoingTopspin);
      if (incomingTopspin != null && outgoingTopspin != null) {
        row.spinFlipped = Math.sign(incomingTopspin) !== Math.sign(outgoingTopspin) && outgoingTopspin !== 0;
        // 定義見檔頭註解：跟來球同號(未翻正)視為「方向正確」。
        row.spinCorrect = outgoingTopspin <= 0;
        if (incomingTopspin !== 0) {
          row.spinRetainedFrac = round(outgoingTopspin / incomingTopspin);
        }
      }
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

  const summary = [];
  for (const tiltY of TILT_Y_CANDIDATES) {
    for (const wristBrakeRate of WRIST_BRAKE_RATE_CANDIDATES) {
      const rows = runOneCombo(tiltY, wristBrakeRate, presets);
      const okCount = rows.filter((row) => row.ok).length;
      const spinCorrectCount = rows.filter((row) => row.spinCorrect === true).length;
      const spinFlippedCount = rows.filter((row) => row.spinFlipped === true).length;
      const failing = rows.filter((row) => !row.ok);
      summary.push({
        tiltY,
        angleDeg: round(angleFromTiltY(tiltY)),
        wristBrakeRate,
        okCount,
        spinCorrectCount,
        spinFlippedCount,
        total: rows.length,
        rows,
        failing,
      });
    }
  }

  const lines = [];
  lines.push("# push tiltY × wristBrakeRate 聯合校準掃描(return-studio.html, push 技術, forehand 側)");
  lines.push("");
  lines.push("> 研究工具輸出，非 game4.html 正式驗收。只逐一計算候選組合分數，不自動找最佳解。");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(
    `Presets: ${presets.length}（原始16顆，排除 ${EXCLUDED_PRESET_IDS.size} 顆：${[...EXCLUDED_PRESET_IDS].join(", ")}）`
  );
  lines.push(`tiltY candidates: ${TILT_Y_CANDIDATES.join(", ")}`);
  lines.push(`wristBrakeRate candidates: ${WRIST_BRAKE_RATE_CANDIDATES.join(", ")}`);
  lines.push(
    "spinCorrect 定義：輸出topspin跟來球topspin同號(未翻正)視為方向正確（依據 docs/ARCHIVE/physics-engine-v2-plan.md 對「揮拍方向y負值/下旋刷」被判定為「旋轉方向多數正確」時輸出仍為負值topspin的歷史紀錄推得，非逐字沿用該文件的correctSpinFrac實作）。"
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("tiltY | 角度 | wristBrakeRate | landing pass/total | spinCorrect/total | spinFlipped/total | 失敗 preset");
  lines.push("--- | --- | --- | --- | --- | --- | ---");
  for (const entry of summary) {
    const failNames = entry.failing.map((row) => `${row.preset}(${row.reason})`).join("; ") || "-";
    lines.push(
      `${entry.tiltY} | ${entry.angleDeg}° | ${entry.wristBrakeRate} | ${entry.okCount}/${entry.total} | ${entry.spinCorrectCount}/${entry.total} | ${entry.spinFlippedCount}/${entry.total} | ${failNames}`
    );
  }
  lines.push("");
  lines.push("## Best combos (by landing pass-rate, tie-break by spinCorrect-rate)");
  lines.push("");
  const sortedByLanding = [...summary].sort((a, b) => {
    if (b.okCount !== a.okCount) return b.okCount - a.okCount;
    return b.spinCorrectCount - a.spinCorrectCount;
  });
  for (const entry of sortedByLanding.slice(0, 10)) {
    lines.push(
      `- tiltY=${entry.tiltY} (${entry.angleDeg}°), wristBrakeRate=${entry.wristBrakeRate}: landing=${entry.okCount}/${entry.total}, spinCorrect=${entry.spinCorrectCount}/${entry.total}, spinFlipped=${entry.spinFlippedCount}/${entry.total}`
    );
  }
  lines.push("");
  lines.push("## Best combos (by spinCorrect-rate, tie-break by landing pass-rate)");
  lines.push("");
  const sortedBySpin = [...summary].sort((a, b) => {
    if (b.spinCorrectCount !== a.spinCorrectCount) return b.spinCorrectCount - a.spinCorrectCount;
    return b.okCount - a.okCount;
  });
  for (const entry of sortedBySpin.slice(0, 10)) {
    lines.push(
      `- tiltY=${entry.tiltY} (${entry.angleDeg}°), wristBrakeRate=${entry.wristBrakeRate}: landing=${entry.okCount}/${entry.total}, spinCorrect=${entry.spinCorrectCount}/${entry.total}, spinFlipped=${entry.spinFlippedCount}/${entry.total}`
    );
  }
  lines.push("");
  lines.push("## Full JSON");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      summary.map(({ tiltY, angleDeg, wristBrakeRate, okCount, spinCorrectCount, spinFlippedCount, total, rows }) => ({
        tiltY,
        angleDeg,
        wristBrakeRate,
        okCount,
        spinCorrectCount,
        spinFlippedCount,
        total,
        rows,
      })),
      null,
      2
    )
  );
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");
  console.table(
    summary.map((entry) => ({
      tiltY: entry.tiltY,
      angleDeg: entry.angleDeg,
      wristBrakeRate: entry.wristBrakeRate,
      landing: `${entry.okCount}/${entry.total}`,
      spinCorrect: `${entry.spinCorrectCount}/${entry.total}`,
    }))
  );
  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.message}`);
  process.exit(1);
}
