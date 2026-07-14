#!/usr/bin/env node

// tiltY x driveScale x 固定tiltX x 揮拍方向x過量修正 4軸聯合校準掃描：
// return-studio.html 的切球(push)路徑。
//
// 這是 push-tiltxy-sweep-calibration.js（tiltY x tiltX x 過量修正 3 軸）跟
// push-tilty-driveswept-sweep-calibration.js（tiltY x driveScale 2 軸）的合併版，
// 驗證假設：push-tiltxy-sweep-calibration.js 觀察到「tiltY>=1.1 分數全部下降」
// 可能是 driveScale 未解耦造成的假象——把 driveScale 修正也疊加進來後，
// tiltY 應該能舒適落在 30~45°（tiltY 1.0~1.73）目標範圍內，同時解決
// sidebackspin_* 系列的界外失敗。
//
// 做法：完全比照 push-tiltxy-sweep-calibration.js 的路線——不去覆寫
// computeAdaptivePushLift/computeAdaptivePushDrive 本身（那條路線在
// push-tilty-driveswept-sweep-calibration.js 裡有專門的地雷，必須把它們排除在
// symbolNames 之外才會生效），而是把兩者當「本地抽取的真正函式」正常呼叫，
// 在我們自己重寫的 makeRacketReturnVelocity 內部，把它們的回傳值再乘上
// driveScale。這樣完全不需要碰 computeAdaptivePushLift/Drive 的 external 覆寫，
// 兩個地雷（tiltxy 版的 makeReturnVelocity 地雷、driveswept 版的
// computeAdaptivePushLift/Drive 地雷）都不會踩到。
//
// 地雷提醒（沿用自兩份原始工具的註解，務必遵守）：
// instantiateGame4Symbols() 對「直接列在 symbolNames 清單裡」的符號一律做本地
// 抽取，抽取出的宣告會在 sandbox 內 hoist 成全域屬性、蓋掉預先塞進 sandbox 的
// external 值。要覆寫的 makeReturnVelocity 絕對不能出現在 symbolNames 裡，只能
// 透過 extraExternals 提供；本檔案不覆寫 computeAdaptivePushLift/Drive 本身，
// 所以它們可以照常留在 symbolNames 裡做本地抽取（跟 push-tiltxy-sweep-
// calibration.js 的作法完全一致）。
//
// 不是自動最佳化：只逐一算出每個 (tiltY, driveScale, tiltX, 過量修正) 組合的
// 分數，由人判斷。
//
// 資料集邊界：跟另外兩份工具完全相同的 11 顆 preset（16 顆原始發球排除 5 顆）。

const fs = require("fs");
const path = require("path");
const { loadReturnStudioPhysics } = require("./load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_tiltxy_drivescaled_sweep_output.txt");

const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

const STUBBORN_PRESET_IDS = ["sidebackspin_half_long_backhand", "sidebackspin_long_backhand"];

// 跟 push-tiltxy-sweep-calibration.js 完全一致的 symbolNames：makeReturnVelocity
// / makeRacketReturnVelocity 刻意不列在這裡（前者要被覆寫成我們的重寫版，
// 後者的邏輯直接逐字搬進本檔案）；computeAdaptivePushLift/Drive 正常留在清單
// 裡做本地抽取（本檔案不覆寫它們本身，只在重寫版內把它們的回傳值乘上
// driveScale）。
const SYMBOL_NAMES = [
  "simulatePath",
  "findHitIndex",
  "findPushHitIndex",
  "simulateReturnForPreset",
  "judgeResult",
  "bounceOffPlane",
  "bounceOffPlaneSubstepped",
  "computeBlendedNormal",
  "mirrorVec",
  "mirrorSpin",
  "computeAdaptivePushLift",
  "computeAdaptivePushDrive",
  "computeRacketNormal",
  "speedScaledTechniqueVel",
  "applyExecutionVariance",
  "dynamicPaddleEpsilon",
  "solveRacketVelXForTargetLandingX",
  "sampleReturnCorrectionFraction",
  "applyPushContact",
  "TECHNIQUES",
  "PADDLE_BLEND",
  "RETURN_TARGET_X",
  "RETURN_SKILL_LEVEL",
  "PADDLE_FRICTION",
  "DISABLE_AIM_CORRECTION",
];

// 網格：優先在 30~45° 目標範圍內加密解析度。
const TILT_Y_CANDIDATES = [0.8, 1.0, 1.1, 1.2, 1.3, 1.5, 1.73];
const DRIVE_SCALE_CANDIDATES = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0];
const TILT_X_FIXED_CANDIDATES = [0, 0.1, 0.2];
const OVERCORRECT_SCALE_CANDIDATES = [0.25, 0.5, 0.75, 1.0];

// game4.html 迴歸出的原始公式：clamp(-0.1436 - 0.5376*vx, -1.2, 1.2)。
const OVERCORRECT_BASE_OFFSET = -0.1436;
const OVERCORRECT_BASE_SLOPE = -0.5376;
const OVERCORRECT_CLAMP_MIN = -1.2;
const OVERCORRECT_CLAMP_MAX = 1.2;

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function makeOvercorrectFormula(scale) {
  return function overcorrectFormula(vx) {
    const raw = OVERCORRECT_BASE_OFFSET + OVERCORRECT_BASE_SLOPE * vx;
    return clamp(scale * raw, OVERCORRECT_CLAMP_MIN, OVERCORRECT_CLAMP_MAX);
  };
}

function angleFromTiltY(tiltY) {
  return 90 - (Math.atan(tiltY) * 180) / Math.PI;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function isSidebackspinPreset(presetId) {
  return presetId.startsWith("sidebackspin_");
}

// 逐字對齊 return-studio.html:740-774 的 makeRacketReturnVelocity，四處差異：
// 1) computeAdaptivePushLift/Drive 的回傳值乘上 driveScale。
// 2) tiltX 固定用 tiltXFixed 候選值（原本 push 分支是 computeAdaptivePushTiltX()）。
// 3) baseTechVel.x 用 overcorrectFormula(incomingVel.x)（原本是字面常數 0）。
// 其餘呼叫的都是 extracted.* 本地抽取出的真正函式，行為跟原始碼一致。
function buildMakeRacketReturnVelocityOverride(
  extractedRef,
  tiltYCandidate,
  driveScale,
  tiltXFixed,
  overcorrectFormula
) {
  return function makeRacketReturnVelocityOverride(incomingVel, incomingSpin, tech, hitPoint, gravity) {
    const extracted = extractedRef.current;
    const spin = incomingSpin || { topspin: 0, sidespin: 0 };
    let baseTechVel = extracted.speedScaledTechniqueVel(incomingVel, tech);
    if (tech.adaptivePush) {
      const lift = extracted.computeAdaptivePushLift(incomingVel) * driveScale;
      const drive = extracted.computeAdaptivePushDrive(incomingVel) * driveScale;
      const overcorrectX = overcorrectFormula(incomingVel.x);
      baseTechVel = { x: overcorrectX, y: lift, z: -drive };
      tech.swingDirection = baseTechVel;
    }
    const swingDirRef = tech.adaptivePush ? tech.swingDirection : baseTechVel;
    const tiltX = tech.adaptivePush ? tiltXFixed : tech.racketNormalTiltX;
    const tiltY = tech.adaptivePush ? tiltYCandidate : tech.racketNormalTiltY;
    const racketNormalBase = extracted.computeRacketNormal(tiltY, tiltX, swingDirRef);
    const { techVel, racketNormal } = extracted.applyExecutionVariance(baseTechVel, racketNormalBase, tech);
    const epsilon = extracted.dynamicPaddleEpsilon(incomingVel, techVel, racketNormal);
    const blend = tech.model === "push" ? extracted.PADDLE_BLEND : 0;
    if (extracted.DISABLE_AIM_CORRECTION) {
      const planeVel = { x: techVel.x, y: techVel.y, z: techVel.z };
      return extracted.applyPushContact(incomingVel, spin, racketNormal, planeVel, epsilon, tech, blend);
    }
    const aimedX = extracted.solveRacketVelXForTargetLandingX(
      incomingVel,
      spin,
      racketNormal,
      techVel,
      epsilon,
      extracted.PADDLE_FRICTION,
      hitPoint,
      gravity,
      extracted.RETURN_TARGET_X,
      blend,
      tech
    );
    const correction = extracted.sampleReturnCorrectionFraction(extracted.RETURN_SKILL_LEVEL);
    const planeVel = { x: aimedX * correction, y: techVel.y, z: techVel.z };
    return extracted.applyPushContact(incomingVel, spin, racketNormal, planeVel, epsilon, tech, blend);
  };
}

function runOneCombo(tiltY, driveScale, tiltXFixed, overcorrectFormula, presets) {
  const loader = loadReturnStudioPhysics({});

  const extractedRef = { current: null };
  const makeReturnVelocityOverride = buildMakeRacketReturnVelocityOverride(
    extractedRef,
    tiltY,
    driveScale,
    tiltXFixed,
    overcorrectFormula
  );

  const extracted = loader.instantiateReturnStudioSymbols(SYMBOL_NAMES, {
    makeReturnVelocity: makeReturnVelocityOverride,
  });
  extractedRef.current = extracted;

  const rows = [];
  for (const preset of presets) {
    const row = {
      preset: preset.id,
      sidebackspin: isSidebackspinPreset(preset.id),
      ok: false,
      reason: null,
      netClearance: null,
    };
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

// 健檢：driveScale=1.0 + tiltXFixed=0 + overcorrectFormula≡0 的重寫版必須跟
// 「完全不覆寫、原始 return-studio.html 邏輯本身」得出逐 preset 一致的
// ok/reason/netClearance，否則代表重寫版哪裡跟原始碼對不上，不該再往下跑掃描。
function runBaselineUnmodified(tiltY, presets) {
  const loader = loadReturnStudioPhysics({});
  const { RETURN_STUDIO_TARGETS } = require("./load-return-studio-physics.js");
  const extracted = loader.instantiateReturnStudioSymbols(RETURN_STUDIO_TARGETS.functions, {
    PUSH_TILT_Y: tiltY,
  });
  const rows = [];
  for (const preset of presets) {
    const sim = extracted.simulateReturnForPreset(preset, "forehand", "push");
    const judged = extracted.judgeResult(sim.result);
    rows.push({
      preset: preset.id,
      ok: judged.ok,
      reason: judged.reason,
      netClearance: judged.netClearance != null ? round(judged.netClearance) : null,
    });
  }
  return rows;
}

function runSanityCheck(presets) {
  const sanityTiltY = 1.0;
  const baselineRows = runBaselineUnmodified(sanityTiltY, presets);
  const reimplRows = runOneCombo(sanityTiltY, 1.0, 0, makeOvercorrectFormula(0), presets);

  const mismatches = [];
  for (let i = 0; i < baselineRows.length; i++) {
    const a = baselineRows[i];
    const b = reimplRows[i];
    if (a.preset !== b.preset || a.ok !== b.ok || a.reason !== b.reason || a.netClearance !== b.netClearance) {
      mismatches.push({ preset: a.preset, baseline: a, reimplementation: b });
    }
  }

  return { sanityTiltY, ok: mismatches.length === 0, mismatches, baselineRows, reimplRows };
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

  const sidebackspinPresets = presets.filter((preset) => isSidebackspinPreset(preset.id));
  const sidebackspinTotal = sidebackspinPresets.length;
  for (const id of STUBBORN_PRESET_IDS) {
    if (!presets.some((preset) => preset.id === id)) {
      throw new Error(`Expected stubborn preset id "${id}" to exist in dataset after exclusion filter.`);
    }
  }

  console.log("Running sanity check (driveScale=1.0, tiltXFixed=0, overcorrectScale=0 reimplementation vs. unmodified baseline)...");
  const sanity = runSanityCheck(presets);
  if (!sanity.ok) {
    console.error("SANITY CHECK FAILED — reimplementation does not match unmodified baseline. Aborting sweep.");
    console.error(JSON.stringify(sanity.mismatches, null, 2));
    process.exit(1);
  }
  console.log(`Sanity check passed at tiltY=${sanity.sanityTiltY} (${presets.length}/${presets.length} presets match baseline exactly).`);

  const summary = [];
  for (const tiltY of TILT_Y_CANDIDATES) {
    for (const driveScale of DRIVE_SCALE_CANDIDATES) {
      for (const tiltXFixed of TILT_X_FIXED_CANDIDATES) {
        for (const scale of OVERCORRECT_SCALE_CANDIDATES) {
          const overcorrectFormula = makeOvercorrectFormula(scale);
          const rows = runOneCombo(tiltY, driveScale, tiltXFixed, overcorrectFormula, presets);
          const okCount = rows.filter((row) => row.ok).length;
          const sidebackspinOk = rows.filter((row) => row.sidebackspin && row.ok).length;
          const stubbornStatus = {};
          for (const id of STUBBORN_PRESET_IDS) {
            const row = rows.find((r) => r.preset === id);
            stubbornStatus[id] = row ? row.ok : null;
          }
          const failing = rows.filter((row) => !row.ok);
          summary.push({
            tiltY,
            angleDeg: round(angleFromTiltY(tiltY)),
            driveScale,
            tiltXFixed,
            overcorrectScale: scale,
            okCount,
            total: rows.length,
            sidebackspinOk,
            sidebackspinTotal,
            stubbornStatus,
            rows,
            failing,
          });
        }
      }
    }
  }

  const bothStubbornResolved = (entry) => STUBBORN_PRESET_IDS.every((id) => entry.stubbornStatus[id] === true);

  const lines = [];
  lines.push("# push tiltY x driveScale x 固定tiltX x 揮拍方向x過量修正 4軸聯合校準掃描(return-studio.html, push 技術, forehand 側)");
  lines.push("");
  lines.push("> 研究工具輸出，非 game4.html 正式驗收。合併 push-tiltxy-sweep-calibration.js 跟");
  lines.push("> push-tilty-driveswept-sweep-calibration.js 兩份工具的機制，驗證「tiltY>=1.1 分數");
  lines.push("> 下降是 driveScale 未解耦造成的假象」這個假設。只逐一計算每個組合的分數，不自動找");
  lines.push("> 最佳解。");
  lines.push("");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length}（原始16顆，排除 ${EXCLUDED_PRESET_IDS.size} 顆：${[...EXCLUDED_PRESET_IDS].join(", ")}）`);
  lines.push(`sidebackspin_* presets tracked: ${sidebackspinTotal}（${sidebackspinPresets.map((p) => p.id).join(", ")}）`);
  lines.push(`先前頑固失敗 preset: ${STUBBORN_PRESET_IDS.join(", ")}`);
  lines.push("");
  lines.push(
    `健檢（reimplementation vs. 未覆寫原始碼, tiltY=${sanity.sanityTiltY}, driveScale=1.0, tiltXFixed=0, overcorrectScale=0）：${
      sanity.ok ? "PASS，逐 preset 完全一致" : "FAIL，見下方 mismatches"
    }`
  );
  if (!sanity.ok) {
    lines.push("```json");
    lines.push(JSON.stringify(sanity.mismatches, null, 2));
    lines.push("```");
  }
  lines.push("");
  lines.push(`Grid: tiltY × driveScale × tiltX × overcorrectScale = ${TILT_Y_CANDIDATES.length} × ${DRIVE_SCALE_CANDIDATES.length} × ${TILT_X_FIXED_CANDIDATES.length} × ${OVERCORRECT_SCALE_CANDIDATES.length} = ${summary.length} combos × ${presets.length} presets = ${summary.length * presets.length} sims`);
  lines.push("");
  lines.push("## Summary（依 pass率 desc, sidebackspin pass desc, tiltY asc 排序，只列 top 60）");
  lines.push("");
  lines.push("tiltY | 角度 | driveScale | tiltX | overcorrectScale | pass/total | sidebackspin pass | 兩顆頑固preset | 失敗 preset");
  lines.push("--- | --- | --- | --- | --- | --- | --- | --- | ---");
  const sortedSummary = [...summary].sort((a, b) => {
    if (b.okCount !== a.okCount) return b.okCount - a.okCount;
    if (b.sidebackspinOk !== a.sidebackspinOk) return b.sidebackspinOk - a.sidebackspinOk;
    return a.tiltY - b.tiltY;
  });
  for (const entry of sortedSummary.slice(0, 60)) {
    const failNames = entry.failing.map((row) => `${row.preset}(${row.reason})`).join("; ") || "-";
    const stubbornStr = STUBBORN_PRESET_IDS.map((id) => `${id.replace("sidebackspin_", "")}=${entry.stubbornStatus[id] ? "PASS" : "fail"}`).join(", ");
    lines.push(
      `${entry.tiltY} | ${entry.angleDeg}° | ${entry.driveScale} | ${entry.tiltXFixed} | ${entry.overcorrectScale} | ${entry.okCount}/${entry.total} | ${entry.sidebackspinOk}/${entry.sidebackspinTotal} | ${stubbornStr} | ${failNames}`
    );
  }
  lines.push("");

  const best = sortedSummary[0];
  const bestWithBothStubbornResolved = sortedSummary.find(bothStubbornResolved);
  const midRangeGood = sortedSummary.find(
    (entry) => entry.tiltY >= 1.0 && entry.tiltY <= 1.73 && entry.okCount === best.okCount
  );

  lines.push("## 最佳解摘要");
  lines.push("");
  lines.push(
    `- 全域最佳（pass率優先）：tiltY=${best.tiltY}(${best.angleDeg}°) driveScale=${best.driveScale} tiltX=${best.tiltXFixed} overcorrectScale=${best.overcorrectScale} -> ${best.okCount}/${best.total}，sidebackspin ${best.sidebackspinOk}/${best.sidebackspinTotal}，兩顆頑固preset：${STUBBORN_PRESET_IDS.map((id) => `${id}=${best.stubbornStatus[id] ? "PASS" : "fail"}`).join(", ")}`
  );
  if (bestWithBothStubbornResolved) {
    const e = bestWithBothStubbornResolved;
    lines.push(
      `- 兩顆頑固preset皆解決的最佳解：tiltY=${e.tiltY}(${e.angleDeg}°) driveScale=${e.driveScale} tiltX=${e.tiltXFixed} overcorrectScale=${e.overcorrectScale} -> ${e.okCount}/${e.total}，sidebackspin ${e.sidebackspinOk}/${e.sidebackspinTotal}`
    );
  } else {
    lines.push("- 沒有任何組合能讓兩顆頑固 preset 同時 PASS。");
  }
  if (midRangeGood) {
    const e = midRangeGood;
    lines.push(
      `- tiltY 落在 1.0~1.73(45°~30°) 舒適範圍內且達到全域最佳 pass 率的解：tiltY=${e.tiltY}(${e.angleDeg}°) driveScale=${e.driveScale} tiltX=${e.tiltXFixed} overcorrectScale=${e.overcorrectScale} -> ${e.okCount}/${e.total}`
    );
  } else {
    lines.push("- 沒有 tiltY 落在 1.0~1.73 範圍內且達到全域最佳 pass 率的解。");
  }
  lines.push("");

  lines.push("## Full JSON");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      summary.map(
        ({ tiltY, angleDeg, driveScale, tiltXFixed, overcorrectScale, okCount, total, sidebackspinOk, sidebackspinTotal, stubbornStatus, rows }) => ({
          tiltY,
          angleDeg,
          driveScale,
          tiltXFixed,
          overcorrectScale,
          okCount,
          total,
          sidebackspinOk,
          sidebackspinTotal,
          stubbornStatus,
          rows,
        })
      ),
      null,
      2
    )
  );
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

  console.table(
    sortedSummary.slice(0, 30).map((entry) => ({
      tiltY: entry.tiltY,
      angleDeg: entry.angleDeg,
      driveScale: entry.driveScale,
      tiltX: entry.tiltXFixed,
      overcorrectScale: entry.overcorrectScale,
      pass: `${entry.okCount}/${entry.total}`,
      sidebackspin: `${entry.sidebackspinOk}/${entry.sidebackspinTotal}`,
    }))
  );
  console.log(`Best by pass rate: tiltY=${best.tiltY} driveScale=${best.driveScale} tiltXFixed=${best.tiltXFixed} overcorrectScale=${best.overcorrectScale} -> ${best.okCount}/${best.total} (sidebackspin ${best.sidebackspinOk}/${best.sidebackspinTotal})`);
  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
