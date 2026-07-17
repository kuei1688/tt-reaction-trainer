#!/usr/bin/env node

// tiltY x (固定 tiltX) x (揮拍方向 x 分量「過量修正」公式) 3 軸校準掃描：
// return-studio.html 的切球(push)路徑。
//
// 這是第二版設計，取代第一版「讓 tiltX 本身變成依 vx 迴歸的公式」的方向——
// 使用者澄清：拍面角度相對揮拍方向該保持固定（tiltX 是個小的固定常數，不是
// 側旋的函式），但拍面在「世界座標」裡的絕對角度仍然該回應側旋，做法是讓
// 揮拍方向本身（swingDirRef，也就是 tech.swingDirection）的 x 分量依來球
// 側向速度(vx)做「過量修正」——因為 computeRacketNormal(tiltY, tiltX, swingDirRef)
// 是繞 swingDirRef 這個軸把 verticalTilted 轉 tiltX 角度（Rodrigues 公式），
// tiltX 若是 0 則直接回傳 verticalTilted、完全不理會 swingDirRef（見
// return-studio.html:406-411）；所以要讓拍面角度跟著側旋變化，tiltX 必須是
// 一個非 0 的固定值，而「往哪個方向轉、轉多少」則由 swingDirRef 的方向決定。
//
// 呼叫鏈裡不能改的限制：baseTechVel.x（也就是 tech.swingDirection.x）在
// makeRacketReturnVelocity 內是寫死的字面常數 0（return-studio.html:746），
// 不是獨立可覆寫的具名符號，沒辦法只用 extraExternals 覆寫這一行。作法：
// 1) 把 makeRacketReturnVelocity 的直接依賴（computeAdaptivePushLift/Drive、
//    computeRacketNormal、speedScaledTechniqueVel、applyExecutionVariance、
//    dynamicPaddleEpsilon、solveRacketVelXForTargetLandingX、
//    sampleReturnCorrectionFraction、applyPushContact，以及常數 PADDLE_BLEND/
//    RETURN_TARGET_X/RETURN_SKILL_LEVEL/PADDLE_FRICTION）都當一般符號本地抽取。
// 2) 在本檔案裡逐字重寫 makeRacketReturnVelocity 本體（對齊
//    return-studio.html:740-774），只替換兩處：tiltX 固定候選值、
//    baseTechVel.x 過量修正公式；其餘呼叫的都是上一步驟本地抽取出來的真正函式。
// 3) 把這個重寫版本透過 extraExternals 命名為 makeReturnVelocity（見
//    return-studio.html:1004-1006，是呼叫 makeRacketReturnVelocity 的一層薄
//    wrapper，也是 simulateReturnForPreset 實際呼叫的名字），讓
//    simulateReturnForPreset 抽取時把它當外部依賴解析掉，不會去本地抽取
//    原始的 0-tiltX 版本。
//
// 已知地雷（第一版工具寫完後才發現、已回報給呼叫端修正認知）：
// instantiateGame4Symbols() 對「直接列在 symbolNames 清單裡」的符號一律做
// 本地抽取，不管 extraExternals 有沒有覆寫同名項目——本地抽取出的 function
// 宣告在 sandbox 執行時會 hoist 成全域屬性，蓋掉預先塞進 sandbox 的 external
// 值。external 只在「被其他抽取符號依賴、但自己不在 symbolNames 清單內」時
// 才會生效。所以要覆寫的 makeReturnVelocity 絕對不能出現在 symbolNames 裡，
// 只能透過 extraExternals 提供。
//
// 不是自動最佳化：只逐一算出每個 (tiltY, tiltX, 過量修正公式) 組合的分數，
// 由人判斷。
//
// 資料集邊界：跟 push-tilty-sweep-calibration.js 完全相同的 11 顆 preset。

const fs = require("fs");
const path = require("path");
const { loadReturnStudioPhysics } = require("../load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_tiltxy_sweep_output.txt");
const BASELINE_TILTY_REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_tilty_sweep_output.txt");

const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

// symbolNames 我們自己重寫版 makeRacketReturnVelocity 需要用到的所有本地
// helper（原始函式簽名/邏輯逐字對齊 return-studio.html:740-774 呼叫的東西），
// 加上 simulateReturnForPreset/judgeResult 這條路徑本身需要的符號。
// 注意：makeReturnVelocity / makeRacketReturnVelocity 兩個都刻意不列在這裡——
// 前者要被覆寫成我們的重寫版，後者的邏輯我們直接逐字搬進本檔案，不需要真正
// 呼叫原本的本地抽取版本。
const SYMBOL_NAMES = [
  // 模擬/落點判定主路徑
  "simulatePath",
  "findHitIndex",
  "findPushHitIndex",
  "simulateReturnForPreset",
  "judgeResult",
  // 碰撞力學（push 走 Stage 4a 逐步積分模型）
  "bounceOffPlane",
  "bounceOffPlaneSubstepped",
  "computeBlendedNormal",
  "mirrorVec",
  "mirrorSpin",
  // makeRacketReturnVelocity 的直接依賴，重寫版會逐一呼叫這些本地抽取版本
  "computeAdaptivePushLift",
  "computeAdaptivePushDrive",
  "computeRacketNormal",
  "speedScaledTechniqueVel",
  "applyExecutionVariance",
  "dynamicPaddleEpsilon",
  "solveRacketVelXForTargetLandingX",
  "sampleReturnCorrectionFraction",
  "applyPushContact",
  // 常數
  "TECHNIQUES",
  "PADDLE_BLEND",
  "RETURN_TARGET_X",
  "RETURN_SKILL_LEVEL",
  "PADDLE_FRICTION",
  "DISABLE_AIM_CORRECTION",
];

const TILT_Y_CANDIDATES = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.73];
const TILT_X_FIXED_CANDIDATES = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

// game4.html 迴歸出的原始公式：clamp(-0.1436 - 0.5376*vx, -1.2, 1.2)。
// 這裡把整條公式的輸出當「揮拍方向 x 分量的過量修正量」，用一個純量 scale
// 縮放整個公式（scale=0 等同完全不修正，即現行 return-studio.html 行為）。
const OVERCORRECT_BASE_OFFSET = -0.1436;
const OVERCORRECT_BASE_SLOPE = -0.5376;
const OVERCORRECT_CLAMP_MIN = -1.2;
const OVERCORRECT_CLAMP_MAX = 1.2;
const OVERCORRECT_SCALE_CANDIDATES = [0, 0.25, 0.5, 0.75, 1.0, 1.5];

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

// 逐字對齊 return-studio.html:740-774 的 makeRacketReturnVelocity，唯二差異：
// 1) tiltX 固定用 tiltXFixed 候選值（原本 push 分支是 computeAdaptivePushTiltX()）。
// 2) baseTechVel.x 用 overcorrectFormula(incomingVel.x)（原本是字面常數 0）。
// 其餘呼叫的都是 extracted.* 本地抽取出的真正函式，行為跟原始碼一致。
function buildMakeRacketReturnVelocityOverride(extractedRef, tiltYCandidate, tiltXFixed, overcorrectFormula) {
  return function makeRacketReturnVelocityOverride(incomingVel, incomingSpin, tech, hitPoint, gravity) {
    const extracted = extractedRef.current;
    const spin = incomingSpin || { topspin: 0, sidespin: 0 };
    let baseTechVel = extracted.speedScaledTechniqueVel(incomingVel, tech);
    if (tech.adaptivePush) {
      const lift = extracted.computeAdaptivePushLift(incomingVel);
      const drive = extracted.computeAdaptivePushDrive(incomingVel);
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

function runOneCombo(tiltY, tiltXFixed, overcorrectFormula, presets) {
  const loader = loadReturnStudioPhysics({});

  // extractedRef.current 延遲賦值：makeReturnVelocityOverride 只有在
  // simulateReturnForPreset 實際跑到「打回球」那一步才會被呼叫，此時
  // instantiateReturnStudioSymbols 早已同步回傳完整物件、extractedRef.current
  // 已賦值完成，不需要真的做兩階段 instantiate。
  const extractedRef = { current: null };
  const makeReturnVelocityOverride = buildMakeRacketReturnVelocityOverride(
    extractedRef,
    tiltY,
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

// 健檢：tiltXFixed=0 + overcorrectFormula≡0 的重寫版必須跟「完全不覆寫、原始
// return-studio.html 邏輯本身」得出逐 preset 一致的 ok/reason/netClearance，
// 否則代表重寫版哪裡跟原始碼對不上，不該再往下跑掃描。用既有的
// push-tilty-sweep-calibration.js 掃描方式（只覆寫 PUSH_TILT_Y，不碰
// computeAdaptivePushTiltX/makeReturnVelocity）跑同一顆 tiltY 當基準。
function runBaselineUnmodified(tiltY, presets) {
  const loader = loadReturnStudioPhysics({});
  const { RETURN_STUDIO_TARGETS } = require("../load-return-studio-physics.js");
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
  const reimplRows = runOneCombo(sanityTiltY, 0, makeOvercorrectFormula(0), presets);

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

  const sidebackspinTotal = presets.filter((preset) => isSidebackspinPreset(preset.id)).length;

  console.log("Running sanity check (tiltXFixed=0, overcorrectScale=0 reimplementation vs. unmodified baseline)...");
  const sanity = runSanityCheck(presets);
  if (!sanity.ok) {
    console.error("SANITY CHECK FAILED — reimplementation does not match unmodified baseline. Aborting sweep.");
    console.error(JSON.stringify(sanity.mismatches, null, 2));
    process.exit(1);
  }
  console.log(`Sanity check passed at tiltY=${sanity.sanityTiltY} (${presets.length}/${presets.length} presets match baseline exactly).`);

  const summary = [];
  for (const tiltY of TILT_Y_CANDIDATES) {
    for (const tiltXFixed of TILT_X_FIXED_CANDIDATES) {
      for (const scale of OVERCORRECT_SCALE_CANDIDATES) {
        const overcorrectFormula = makeOvercorrectFormula(scale);
        const rows = runOneCombo(tiltY, tiltXFixed, overcorrectFormula, presets);
        const okCount = rows.filter((row) => row.ok).length;
        const sidebackspinOk = rows.filter((row) => row.sidebackspin && row.ok).length;
        const failing = rows.filter((row) => !row.ok);
        summary.push({
          tiltY,
          angleDeg: round(angleFromTiltY(tiltY)),
          tiltXFixed,
          overcorrectScale: scale,
          okCount,
          total: rows.length,
          sidebackspinOk,
          sidebackspinTotal,
          rows,
          failing,
        });
      }
    }
  }

  const lines = [];
  lines.push("# push tiltY x 固定tiltX x 揮拍方向x過量修正 3軸校準掃描(return-studio.html, push 技術, forehand 側)");
  lines.push("");
  lines.push("> 研究工具輸出，非 game4.html 正式驗收。只逐一計算每個組合的分數，不自動找最佳解。");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length}（原始16顆，排除 ${EXCLUDED_PRESET_IDS.size} 顆：${[...EXCLUDED_PRESET_IDS].join(", ")}）`);
  lines.push(`sidebackspin_* presets tracked: ${sidebackspinTotal}`);
  lines.push("");
  lines.push(
    `健檢（reimplementation vs. 未覆寫原始碼, tiltY=${sanity.sanityTiltY}, tiltXFixed=0, overcorrectScale=0）：${
      sanity.ok ? "PASS，逐 preset 完全一致" : "FAIL，見下方 mismatches"
    }`
  );
  if (!sanity.ok) {
    lines.push("```json");
    lines.push(JSON.stringify(sanity.mismatches, null, 2));
    lines.push("```");
  }
  lines.push("");
  lines.push("設計說明：tiltX 現在是固定候選值（不是 vx 的函式）；改成「揮拍方向 x 分量」");
  lines.push("依 vx 做過量修正，公式基礎迴歸（game4.html 來源）：");
  lines.push("clamp(-0.1436 - 0.5376*vx, -1.2, 1.2)，這裡整條乘上 overcorrectScale 縮放：");
  for (const scale of OVERCORRECT_SCALE_CANDIDATES) {
    lines.push(`- overcorrectScale=${scale}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("tiltY | 換算角度 | tiltX(固定) | overcorrectScale | pass/total | sidebackspin pass | 失敗 preset");
  lines.push("--- | --- | --- | --- | --- | --- | ---");
  for (const entry of summary) {
    const failNames = entry.failing.map((row) => `${row.preset}(${row.reason})`).join("; ") || "-";
    lines.push(
      `${entry.tiltY} | ${entry.angleDeg}° | ${entry.tiltXFixed} | ${entry.overcorrectScale} | ${entry.okCount}/${entry.total} | ${entry.sidebackspinOk}/${entry.sidebackspinTotal} | ${failNames}`
    );
  }
  lines.push("");
  lines.push("## Full JSON");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      summary.map(
        ({ tiltY, angleDeg, tiltXFixed, overcorrectScale, okCount, total, sidebackspinOk, sidebackspinTotal, rows }) => ({
          tiltY,
          angleDeg,
          tiltXFixed,
          overcorrectScale,
          okCount,
          total,
          sidebackspinOk,
          sidebackspinTotal,
          rows,
        })
      ),
      null,
      2
    )
  );
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

  const best = [...summary].sort((a, b) => {
    if (b.okCount !== a.okCount) return b.okCount - a.okCount;
    if (b.sidebackspinOk !== a.sidebackspinOk) return b.sidebackspinOk - a.sidebackspinOk;
    return 0;
  })[0];

  console.table(
    summary
      .filter((entry) => entry.okCount >= best.okCount - 1)
      .map((entry) => ({
        tiltY: entry.tiltY,
        angleDeg: entry.angleDeg,
        tiltXFixed: entry.tiltXFixed,
        overcorrectScale: entry.overcorrectScale,
        pass: `${entry.okCount}/${entry.total}`,
        sidebackspin: `${entry.sidebackspinOk}/${entry.sidebackspinTotal}`,
      }))
  );
  console.log(`Best by pass rate: tiltY=${best.tiltY} tiltXFixed=${best.tiltXFixed} overcorrectScale=${best.overcorrectScale} -> ${best.okCount}/${best.total} (sidebackspin ${best.sidebackspinOk}/${best.sidebackspinTotal})`);
  console.log(`Report written to ${REPORT_FILE}`);
  console.log(`(Old tiltY-only baseline for reference: ${BASELINE_TILTY_REPORT_FILE})`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
