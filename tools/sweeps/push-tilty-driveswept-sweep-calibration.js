#!/usr/bin/env node

// tiltY × drive-scale 聯合掃描：驗證 AI_CONTEXT/OPEN_ITEMS.md 提出的假設——
// push-tilty-sweep-calibration.js（單獨掃 tiltY，drive/lift 固定用
// computeAdaptivePushLift/computeAdaptivePushDrive 既有公式）觀察到 pass 率在
// tiltY 越過 ~1.0 後迅速崩潰，跟 docs/ARCHIVE/physics-engine-v2-plan.md:861
// 記載的「純被動幾何、swing velocity=0，tiltY 26.6°→60° 讓 apex 從
// 0.22m 拉高到 0.75m（暗示落點範圍很寬）」互相矛盾。
//
// 假設：矛盾的原因是現行公式 computeAdaptivePushLift/computeAdaptivePushDrive
// 只吃「來球速度」，完全不吃 tiltY——所以 tiltY 越大（拍面幾何redirect 越強），
// 疊加的 drive/lift 還是同一個量級，球被推出界，不是「大 tiltY 本身打不到界內」，
// 而是「公式沒有隨 tiltY 收斂 drive/lift」。
//
// 做法：對每個 tiltY 候選值，額外掃一個乘在 computeAdaptivePushLift/
// computeAdaptivePushDrive 輸出上的 driveScale 乘數（lift 和 drive 用同一個
// scale，因為兩者原本就是同一個「揮拍力道」概念拆出來的兩個分量，見
// return-studio.html:705-714 的中文註解）。用 instantiateReturnStudioSymbols
// 的 extraExternals 把 computeAdaptivePushLift/computeAdaptivePushDrive/
// PUSH_TILT_Y 換成外部注入的版本（external 優先於本地抽取，不需要整個重寫
// makeRacketReturnVelocity）——但只能請求 simulateReturnForPreset/judgeResult
// 當作直接抽取的 symbolNames，不能把 computeAdaptivePushLift/Drive 本身也放進
// 那份清單，理由見下方 REQUEST_SYMBOLS 旁的除錯記錄。
//
// 不是自動最佳化：只逐一算出每個 (tiltY, driveScale) 組合的分數，人工判讀。
//
// 資料集邊界：跟 push-tilty-sweep-calibration.js 用同一組 11 顆 preset
// （16 顆原始發球，排除 5 顆，理由抄自該檔案），forehand-only（push 的 side
// 參數目前函式體內未使用，見 AI_CONTEXT/OPEN_ITEMS.md VAL-005 Phase 2 註記）。

const fs = require("fs");
const path = require("path");
const { loadReturnStudioPhysics } = require("../load-return-studio-physics.js");

// 重要陷阱（除錯後才發現，務必留著這段註解）：instantiateReturnStudioSymbols
// 的 extraExternals 只有在某個 symbol 是「被別的 symbol 依賴」時才會生效——
// 如果同一個 symbol 名字同時也出現在直接請求的 symbolNames 清單裡，
// base.instantiateGame4Symbols 的 visit() 一律先做本地抽取（無條件把該
// symbol 的原始碼塞進 bundle），最後 bundle 內 `function
// computeAdaptivePushLift(...){...}` 這個宣告會蓋掉 sandbox 上預先塞好的
// 外部覆寫值（JS 全域 function 宣告提升時直接重新賦值該全域名稱）。
// 實測驗證過：一開始把 computeAdaptivePushLift/computeAdaptivePushDrive
// 放進要抽取的 symbolNames（照抄 push-tilty-sweep-calibration.js 用的
// RETURN_STUDIO_TARGETS.functions 整包），覆寫值完全不生效——8 組 driveScale
// 掃出來的 pass/total 全部一模一樣、連落地點座標小數點都相同，因為每次都在
// 跑原始未縮放公式。
// 修法：只請求真正要用到的「輸出」symbol（simulateReturnForPreset、
// judgeResult），不要把 computeAdaptivePushLift/Drive 放進 symbolNames——
// 這樣它們只會透過 makeRacketReturnVelocity 的依賴鏈被 classifyDependencies
// 分類成「external」，才會真正套用 extraExternals 覆寫的版本。
// PUSH_TILT_Y 沒有這個問題，因為它是「constant」而不是被直接請求的
// symbolNames 之一，一直是透過依賴鏈拿到的，這也是為什麼
// push-tilty-sweep-calibration.js 的 tiltY 單獨掃描結果是對的（它沒有直接
// 請求 PUSH_TILT_Y，只請求 computeAdaptivePushTiltY 之類的函式）。
const REQUEST_SYMBOLS = ["simulateReturnForPreset", "judgeResult"];

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(
  ROOT_DIR,
  "AI_CONTEXT",
  "push_tilty_driveswept_sweep_output.txt"
);

const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

// 涵蓋 push-tilty-sweep-calibration.js 測過的窄範圍(1.0~1.73)，
// 也往下(0.5,0.8)、往上(2.5,4,6)大幅延伸，換算角度大約是 60°~9.5°。
const TILT_Y_CANDIDATES = [0.5, 0.8, 1.0, 1.3, 1.73, 2.5, 4, 6];
const DRIVE_SCALE_CANDIDATES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0];

function angleFromTiltY(tiltY) {
  return 90 - (Math.atan(tiltY) * 180) / Math.PI;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

// 原始公式的忠實複製（return-studio.html:715-724），只是額外接受一個
// driveScale 乘數。基準常數(BASE/K/FLOOR/NEUTRAL/MAX)跟原檔一致抄過來，
// K 目前都是 0，所以這兩個函式其實是常數，但仍保留完整公式以防未來
// 原檔把 K 改成非 0（那時這個掃描工具的假設也要跟著重新檢查）。
const PUSH_LIFT_BASE = 0.35,
  PUSH_LIFT_K = 0,
  PUSH_LIFT_FLOOR = 0,
  PUSH_LIFT_NEUTRAL = 2,
  PUSH_LIFT_MAX = 3.0;
const PUSH_DRIVE_BASE = 0.7,
  PUSH_DRIVE_K = 0,
  PUSH_DRIVE_FLOOR = 0.1,
  PUSH_DRIVE_NEUTRAL = 2,
  PUSH_DRIVE_MAX = 3.0;

function clampLocal(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function makeScaledLift(driveScale) {
  return function computeAdaptivePushLift(incomingVel) {
    const speed = Math.hypot(incomingVel.x, incomingVel.z);
    const base = clampLocal(
      PUSH_LIFT_BASE - PUSH_LIFT_K * (speed - PUSH_LIFT_NEUTRAL),
      PUSH_LIFT_FLOOR,
      PUSH_LIFT_MAX
    );
    return base * driveScale;
  };
}

function makeScaledDrive(driveScale) {
  return function computeAdaptivePushDrive(incomingVel) {
    const speed = Math.hypot(incomingVel.x, incomingVel.z);
    const base = clampLocal(
      PUSH_DRIVE_BASE - PUSH_DRIVE_K * (speed - PUSH_DRIVE_NEUTRAL),
      PUSH_DRIVE_FLOOR,
      PUSH_DRIVE_MAX
    );
    return base * driveScale;
  };
}

function apexHeight(result) {
  // simulatePath 回傳的 result.points 是「從球拍擊球那一刻(hitPoint)開始」的
  // 完整軌跡點序列(含最終落點/掛網點)，見 return-studio.html:797-871、1018。
  // apex = 這段軌跡裡的最大 y。
  return result.points.reduce((max, p) => Math.max(max, p.y), -Infinity);
}

function runOneCombo(tiltY, driveScale, presets, extracted) {
  const rows = [];
  for (const preset of presets) {
    const row = {
      preset: preset.id,
      ok: false,
      reason: null,
      netClearance: null,
      apex: null,
    };
    try {
      const sim = extracted.simulateReturnForPreset(preset, "forehand", "push");
      const judged = extracted.judgeResult(sim.result);
      row.ok = judged.ok;
      row.reason = judged.reason;
      row.netClearance =
        judged.netClearance != null ? round(judged.netClearance) : null;
      row.apex = round(apexHeight(sim.result));
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

  const tiltYSummaries = TILT_Y_CANDIDATES.map((tiltY) => {
    const comboResults = DRIVE_SCALE_CANDIDATES.map((driveScale) => {
      const loader = loadReturnStudioPhysics({});
      const extracted = loader.instantiateReturnStudioSymbols(
        REQUEST_SYMBOLS,
        {
          PUSH_TILT_Y: tiltY,
          computeAdaptivePushLift: makeScaledLift(driveScale),
          computeAdaptivePushDrive: makeScaledDrive(driveScale),
        }
      );
      const rows = runOneCombo(tiltY, driveScale, presets, extracted);
      const okCount = rows.filter((row) => row.ok).length;
      return { driveScale, okCount, total: rows.length, rows };
    });

    const best = comboResults.reduce((a, b) => (b.okCount > a.okCount ? b : a));

    return {
      tiltY,
      angleDeg: round(angleFromTiltY(tiltY)),
      comboResults,
      best,
    };
  });

  const lines = [];
  lines.push("# push tiltY × drive-scale 聯合掃描(return-studio.html, push 技術, forehand 側)");
  lines.push("");
  lines.push(
    "> 研究工具輸出，非 game4.html 正式驗收。驗證 AI_CONTEXT/OPEN_ITEMS.md 的假設："
  );
  lines.push(
    "> push-tilty-sweep-calibration.js 觀察到的窄成功窗口，是否是「drive/lift 沒有隨"
  );
  lines.push(
    "> tiltY 收斂」這個公式耦合問題造成的，而非幾何本身的物理限制。"
  );
  lines.push("");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(
    `Presets: ${presets.length}（原始16顆，排除 ${EXCLUDED_PRESET_IDS.size} 顆：${[...EXCLUDED_PRESET_IDS].join(", ")}）`
  );
  lines.push(`tiltY candidates: ${TILT_Y_CANDIDATES.join(", ")}`);
  lines.push(`driveScale candidates: ${DRIVE_SCALE_CANDIDATES.join(", ")}`);
  lines.push("");
  lines.push("## Summary（每個 tiltY 的最佳 driveScale）");
  lines.push("");
  lines.push("tiltY | 換算角度 | 最佳 driveScale | 最佳 pass/total | 該 driveScale 下失敗 preset");
  lines.push("--- | --- | --- | --- | ---");
  for (const entry of tiltYSummaries) {
    const failNames =
      entry.best.rows
        .filter((row) => !row.ok)
        .map((row) => `${row.preset}(${row.reason})`)
        .join("; ") || "-";
    lines.push(
      `${entry.tiltY} | ${entry.angleDeg}° | ${entry.best.driveScale} | ${entry.best.okCount}/${entry.best.total} | ${failNames}`
    );
  }
  lines.push("");
  lines.push("## 完整矩陣（每個 tiltY × 每個 driveScale 的 pass/total）");
  lines.push("");
  lines.push("tiltY \\ driveScale | " + DRIVE_SCALE_CANDIDATES.join(" | "));
  lines.push("--- | " + DRIVE_SCALE_CANDIDATES.map(() => "---").join(" | "));
  for (const entry of tiltYSummaries) {
    const cells = entry.comboResults
      .map((c) => `${c.okCount}/${c.total}`)
      .join(" | ");
    lines.push(`${entry.tiltY}(${entry.angleDeg}°) | ${cells}`);
  }
  lines.push("");
  lines.push("## Apex height spot-check（best combo per tiltY，含各 preset 的落地前最大 y）");
  lines.push("");
  lines.push(
    "對照 docs/ARCHIVE/physics-engine-v2-plan.md:861 的被動幾何發現（tiltY 26.6°→60°，"
  );
  lines.push("apex 0.22m→0.75m，swing velocity=0）：");
  lines.push("");
  lines.push("tiltY | 換算角度 | 最佳 driveScale | pass/total | apex 範圍(僅 ok 的 preset)");
  lines.push("--- | --- | --- | --- | ---");
  for (const entry of tiltYSummaries) {
    const okApexes = entry.best.rows.filter((row) => row.ok).map((row) => row.apex);
    const apexRange =
      okApexes.length > 0
        ? `${round(Math.min(...okApexes))}m ~ ${round(Math.max(...okApexes))}m`
        : "-（無成功案例）";
    lines.push(
      `${entry.tiltY} | ${entry.angleDeg}° | ${entry.best.driveScale} | ${entry.best.okCount}/${entry.best.total} | ${apexRange}`
    );
  }
  lines.push("");
  lines.push("## Full JSON");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      tiltYSummaries.map(({ tiltY, angleDeg, comboResults }) => ({
        tiltY,
        angleDeg,
        comboResults: comboResults.map(({ driveScale, okCount, total, rows }) => ({
          driveScale,
          okCount,
          total,
          rows,
        })),
      })),
      null,
      2
    )
  );
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");
  console.table(
    tiltYSummaries.map((entry) => ({
      tiltY: entry.tiltY,
      angleDeg: entry.angleDeg,
      bestDriveScale: entry.best.driveScale,
      bestPass: `${entry.best.okCount}/${entry.best.total}`,
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
