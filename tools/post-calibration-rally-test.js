#!/usr/bin/env node

// Post-calibration rally test: PADDLE_BLEND=0.605 + fallback fix.
//
// Two modes:
// A) Full-path rally: goes through makeRacketReturnVelocity (with aim solver + fallback fix)
//    for all 16 presets, up to 50 rounds. Collects per-round data.
// B) Aim-solver-bypassed sweep: same (tiltY, lift, drive) grid as Group 5
//    but now with PADDLE_BLEND=0.605. Shows if blend change alone improves stability.
//
// All spin in real rad/s (×D=1.528).
// Read-only research tool.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "post_calibration_rally_test_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2);
const MAX_ROUNDS = 50;
const SPEED_DIVERGE_THRESHOLD = 10.0;
const BACKSPIN_THRESHOLD = 0;

// Full symbol list for makeRacketReturnVelocity path
const SYMBOL_NAMES_FULL = [
  "simulateServe","simulatePath","solveBaseVelocity","solveServeBounceVelocity",
  "solveVelocity","makeServeAimCandidate","getServeLengthProfile","findServeBounceTime",
  "getServeBounces","serveBounceScore","clone","findPushHitIndex","findHitIndex",
  "TECHNIQUES","computeAdaptivePushLift","computeAdaptivePushDrive","computeAdaptivePushTiltX",
  "computeAdaptivePushTiltY","PADDLE_FRICTION","computeRacketNormal","dynamicPaddleEpsilon",
  "applyPushContact","PADDLE_BLEND","makeRacketReturnVelocity","solveRacketVelXForTargetLandingX",
  "speedScaledTechniqueVel","applyExecutionVariance","sampleReturnCorrectionFraction",
  "RETURN_TARGET_X","RETURN_SKILL_LEVEL","estimateFlightTimeToTable",
  "PUSH_TILT_Y","PUSH_LIFT_BASE","PUSH_LIFT_K","PUSH_LIFT_FLOOR","PUSH_LIFT_NEUTRAL","PUSH_LIFT_MAX",
  "PUSH_DRIVE_BASE","PUSH_DRIVE_K","PUSH_DRIVE_FLOOR","PUSH_DRIVE_NEUTRAL","PUSH_DRIVE_MAX",
  "PUSH_WRIST_BRAKE_RATE","PADDLE_SPRING_K","PADDLE_DAMPING_RATIO","TANGENT_KP",
  "BLADE_NODE_MASS","BLADE_SPRING_K","BLADE_DAMPING_RATIO",
  "PADDLE_RESTITUTION_LOW","PADDLE_RESTITUTION_HIGH","PADDLE_SPEED_LOW","PADDLE_SPEED_HIGH",
  "RANGE_SOLUTION_MODE",
];

// Bypassed-path symbols (no aim solver)
const SYMBOL_NAMES_BYPASS = [
  "simulateServe","simulatePath","solveBaseVelocity","solveServeBounceVelocity",
  "solveVelocity","makeServeAimCandidate","getServeLengthProfile","findServeBounceTime",
  "getServeBounces","serveBounceScore","clone","findPushHitIndex","findHitIndex",
  "TECHNIQUES","computeAdaptivePushLift","computeAdaptivePushDrive","computeAdaptivePushTiltX",
  "PADDLE_FRICTION","computeRacketNormal","dynamicPaddleEpsilon","applyPushContact","PADDLE_BLEND",
];

function round(v, digits = 4) {
  if (v == null || Number.isNaN(v)) return null;
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}
function mirrorVec(v) { return { x: v.x, y: v.y, z: -v.z }; }
function mirrorSpin(s) { return { topspin: -(s.topspin || 0), sidespin: s.sidespin || 0 }; }
function mirrorPathForDetection(p) {
  return {
    points: p.points.map(pt => ({ x: pt.x, y: pt.y, z: -pt.z })),
    velocities: p.velocities.map(v => mirrorVec(v)),
    spins: p.spins.map(s => mirrorSpin(s)),
    bounces: p.bounces.map(b => ({ ...b, z: -b.z })),
  };
}

// ── Mode A: Full-path rally through makeRacketReturnVelocity ─────────────
function runFullPathRally(loader, ext, preset, TABLE) {
  const gravity = preset.solve?.gravity ?? -4.2;
  const tech = { ...ext.TECHNIQUES.push };
  const serve = ext.simulateServe(preset);
  const firstHitIndex = ext.findPushHitIndex(serve);
  let hitPoint = serve.points[firstHitIndex];
  let hitVel = serve.velocities[firstHitIndex];
  let hitSpin = serve.spins[firstHitIndex];
  let flip = false;
  let rounds = 0;
  let failReason = null;
  let fallbackCount = 0;
  const roundStats = [];

  for (let roundNum = 1; roundNum <= MAX_ROUNDS; roundNum++) {
    const canonicalHitPoint = flip ? mirrorVec(hitPoint) : hitPoint;
    const canonicalHitVel = flip ? mirrorVec(hitVel) : hitVel;
    const canonicalHitSpin = flip ? mirrorSpin(hitSpin) : hitSpin;

    // Full path: makeRacketReturnVelocity (includes aim solver + fallback fix)
    const returnResult = ext.makeRacketReturnVelocity(canonicalHitVel, canonicalHitSpin, tech, canonicalHitPoint, gravity);
    const returnVelReal = flip ? mirrorVec(returnResult.vel) : returnResult.vel;
    const returnSpinReal = flip ? mirrorSpin(returnResult.spin) : returnResult.spin;

    const outPath = ext.simulatePath({ ...hitPoint }, returnVelReal, { gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0 });

    const incomingTS_real = round((canonicalHitSpin.topspin || 0) * SIM_D);
    const outgoingTS_real = round((returnResult.spin.topspin || 0) * SIM_D);
    const outgoingSS_real = round((returnResult.spin.sidespin || 0) * SIM_D);
    const outSpeed = round(Math.hypot(returnVelReal.x, returnVelReal.y, returnVelReal.z));

    const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
    const firstBounce = outPath.bounces[0];
    const expectedSign = flip ? 1 : -1;
    const netOk = netClearance != null && netClearance >= 0;
    const inBounds = firstBounce && Math.abs(firstBounce.x) <= TABLE.width / 2 && Math.abs(firstBounce.z) <= TABLE.length / 2 && Math.sign(firstBounce.z) === expectedSign;

    roundStats.push({
      round: roundNum,
      incomingTS: incomingTS_real,
      outgoingTS: outgoingTS_real,
      outgoingSS: outgoingSS_real,
      outSpeed,
      netClearance: netClearance == null ? null : round(netClearance * 100, 1), // cm
      inBounds: !!inBounds,
      netOk: !!netOk,
      isBackspin: outgoingTS_real > BACKSPIN_THRESHOLD, // outgoing z<0: positive canonical topspin = backspin for opponent (spin reversed)
      landingX: firstBounce ? round(firstBounce.x) : null,
      landingZ: firstBounce ? round(firstBounce.z) : null,
    });

    if (!netOk) { failReason = "掛網"; break; }
    if (!inBounds) { failReason = "出界"; break; }
    if (outSpeed > SPEED_DIVERGE_THRESHOLD) { failReason = "速度發散"; break; }
    rounds = roundNum;

    const detectionPath = flip ? outPath : mirrorPathForDetection(outPath);
    const nextIdx = ext.findPushHitIndex(detectionPath);
    if (nextIdx == null || nextIdx >= outPath.points.length || !outPath.velocities[nextIdx] || !outPath.spins[nextIdx]) {
      failReason = "找不到擊球點"; break;
    }
    hitPoint = outPath.points[nextIdx];
    hitVel = outPath.velocities[nextIdx];
    hitSpin = outPath.spins[nextIdx];
    flip = !flip;
  }

  // Classify
  let classification;
  if (rounds >= MAX_ROUNDS) {
    const allBackspin = roundStats.every(r => r.isBackspin);
    const speedTrend = roundStats.length >= 3 ? (roundStats[roundStats.length-1].outSpeed - roundStats[0].outSpeed) : 0;
    if (allBackspin && Math.abs(speedTrend) < 2.0) classification = "穩定循環";
    else if (!allBackspin) classification = "穩定循環(含上旋)";
    else classification = "穩定循環(速度漂移)";
  } else if (failReason === "掛網") classification = "掛網";
  else if (failReason === "出界") classification = "飛出界";
  else if (failReason === "速度發散") classification = "速度發散";
  else classification = failReason || "中斷";

  return {
    rounds, failReason, classification, fallbackCount, roundStats,
    summary: {
      maxOutSpeed: roundStats.length ? round(Math.max(...roundStats.map(r => r.outSpeed))) : null,
      minOutSpeed: roundStats.length ? round(Math.min(...roundStats.map(r => r.outSpeed))) : null,
      minNetClearance: roundStats.length ? round(Math.min(...roundStats.filter(r => r.netClearance != null).map(r => r.netClearance))) : null,
      backspinRounds: roundStats.filter(r => r.isBackspin).length,
      speedTrend: roundStats.length >= 2 ? round(roundStats[roundStats.length-1].outSpeed - roundStats[0].outSpeed) : null,
      avgLandingX: roundStats.filter(r => r.landingX != null).length ? round(roundStats.filter(r => r.landingX != null).reduce((s, r) => s + r.landingX, 0) / roundStats.filter(r => r.landingX != null).length) : null,
    },
  };
}

// ── Mode B: Bypassed sweep (same grid as Group 5 but with PADDLE_BLEND=0.605) ──
function runBypassedRally(loader, tiltY, lift, drive, preset, TABLE) {
  const extra = { PUSH_TILT_Y: tiltY };
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES_BYPASS, extra);
  const tech = { ...ext.TECHNIQUES.push };
  const gravity = preset.solve?.gravity ?? -4.2;
  const blend = ext.PADDLE_BLEND; // should be 0.605 now

  const serve = ext.simulateServe(preset);
  const firstHitIndex = ext.findPushHitIndex(serve);
  let hitPoint = serve.points[firstHitIndex];
  let hitVel = serve.velocities[firstHitIndex];
  let hitSpin = serve.spins[firstHitIndex];
  let flip = false;
  let rounds = 0;
  let failReason = null;
  const roundStats = [];

  for (let roundNum = 1; roundNum <= MAX_ROUNDS; roundNum++) {
    const canonicalHitVel = flip ? mirrorVec(hitVel) : hitVel;
    const canonicalHitSpin = flip ? mirrorSpin(hitSpin) : hitSpin;

    const planeVel = { x: 0, y: lift, z: -drive };
    const tiltX = 0;
    const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
    const epsilon = ext.dynamicPaddleEpsilon(canonicalHitVel, planeVel, racketNormal);
    const contactResult = ext.applyPushContact(canonicalHitVel, canonicalHitSpin, racketNormal, planeVel, epsilon, tech, blend);

    const returnVelReal = flip ? mirrorVec(contactResult.vel) : contactResult.vel;
    const returnSpinReal = flip ? mirrorSpin(contactResult.spin) : contactResult.spin;
    const outPath = ext.simulatePath({ ...hitPoint }, returnVelReal, { gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0 });

    const outgoingTS_real = round((contactResult.spin.topspin || 0) * SIM_D);
    const outSpeed = round(Math.hypot(returnVelReal.x, returnVelReal.y, returnVelReal.z));
    const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
    const firstBounce = outPath.bounces[0];
    const expectedSign = flip ? 1 : -1;
    const netOk = netClearance != null && netClearance >= 0;
    const inBounds = firstBounce && Math.abs(firstBounce.x) <= TABLE.width / 2 && Math.abs(firstBounce.z) <= TABLE.length / 2 && Math.sign(firstBounce.z) === expectedSign;

    roundStats.push({
      round: roundNum,
      outgoingTS: outgoingTS_real,
      outSpeed,
      netClearance: netClearance == null ? null : round(netClearance * 100, 1),
      inBounds: !!inBounds, netOk: !!netOk,
      isBackspin: outgoingTS_real > BACKSPIN_THRESHOLD, // outgoing z<0: positive canonical topspin = backspin for opponent (spin reversed)
    });

    if (!netOk) { failReason = "掛網"; break; }
    if (!inBounds) { failReason = "出界"; break; }
    if (outSpeed > SPEED_DIVERGE_THRESHOLD) { failReason = "速度發散"; break; }
    rounds = roundNum;

    const detectionPath = flip ? outPath : mirrorPathForDetection(outPath);
    const nextIdx = ext.findPushHitIndex(detectionPath);
    if (nextIdx == null || nextIdx >= outPath.points.length || !outPath.velocities[nextIdx]) { failReason = "找不到擊球點"; break; }
    hitPoint = outPath.points[nextIdx];
    hitVel = outPath.velocities[nextIdx];
    hitSpin = outPath.spins[nextIdx];
    flip = !flip;
  }

  let classification;
  if (rounds >= MAX_ROUNDS) classification = "穩定循環";
  else if (failReason === "掛網") classification = "掛網";
  else if (failReason === "出界") classification = "飛出界";
  else if (failReason === "速度發散") classification = "速度發散";
  else classification = failReason || "中斷";

  return { rounds, failReason, classification, roundStats };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const TABLE = loader.runtimeExternals.TABLE;

  // ── Mode A: Full-path rally for all 16 presets ─────────────────────────
  process.stderr.write("[mode A] Full-path rally (aim solver + fallback fix + PADDLE_BLEND=0.605)\n");
  const extra = { RETURN_SKILL_LEVEL: 'advanced', RANGE_SOLUTION_MODE: false };
  const extFull = loader.instantiateGame4Symbols(SYMBOL_NAMES_FULL, extra);
  const deployedBlend = extFull.PADDLE_BLEND;
  process.stderr.write(`  PADDLE_BLEND = ${deployedBlend}\n`);

  const modeAResults = {};
  for (const preset of allPresets) {
    process.stderr.write(`  [rally] ${preset.id}\n`);
    modeAResults[preset.id] = runFullPathRally(loader, extFull, preset, TABLE);
  }

  // ── Mode B: Bypassed sweep with new blend ──────────────────────────────
  process.stderr.write("[mode B] Bypassed sweep (no aim solver, PADDLE_BLEND from game4.html)\n");
  const TILTY_VALUES = [0.7, 0.85, 1.0, 1.15, 1.3];
  const LIFT_VALUES = [0.15, 0.22, 0.30, 0.40];
  const DRIVE_VALUES = [0.3, 0.45, 0.56, 0.70];
  const sweepPresetIds = ["backspin_long_backhand", "no_spin_long_forehand", "sidebackspin_long_forehand_2"];
  const modeBResults = {};

  for (const pid of sweepPresetIds) {
    const preset = allPresets.find(p => p.id === pid);
    if (!preset) continue;
    process.stderr.write(`  [sweep] ${pid}\n`);
    const grid = [];
    for (const tiltY of TILTY_VALUES) {
      for (const lift of LIFT_VALUES) {
        for (const drive of DRIVE_VALUES) {
          const r = runBypassedRally(loader, tiltY, lift, drive, preset, TABLE);
          grid.push({ tiltY, lift, drive, ...r });
        }
      }
    }
    const classCounts = {};
    for (const r of grid) { classCounts[r.classification] = (classCounts[r.classification] || 0) + 1; }
    const stable = grid.filter(r => r.classification === "穩定循環");
    modeBResults[pid] = {
      grid: { tiltY: TILTY_VALUES, lift: LIFT_VALUES, drive: DRIVE_VALUES, totalPoints: grid.length },
      rows: grid,
      classificationCounts: classCounts,
      stableCount: stable.length,
    };
  }

  // ── Output ─────────────────────────────────────────────────────────────
  const output = {
    generatedAt: new Date().toISOString(),
    tool: "post-calibration-rally-test.js",
    note: `PADDLE_BLEND=${deployedBlend}, fallback fix active, MAX_ROUNDS=${MAX_ROUNDS}`,
    modeA_fullPath: modeAResults,
    modeB_bypassedSweep: modeBResults,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  // Console: Mode A summary
  console.log(`=== Mode A: Full-path rally (PADDLE_BLEND=${deployedBlend}, aim solver + fallback fix) ===`);
  console.log(`MAX_ROUNDS=${MAX_ROUNDS}\n`);
  console.log("Preset | Rounds | Classification | MinNetClr(cm) | BackspinRounds | SpeedTrend | AvgLandingX");
  console.log("---|---|---|---|---|---|---");
  let stableCount = 0;
  for (const preset of allPresets) {
    const r = modeAResults[preset.id];
    if (r.classification === "穩定循環" || r.classification.startsWith("穩定循環")) stableCount++;
    console.log(
      `${preset.id} | ${r.rounds} | ${r.classification} | ${r.summary.minNetClearance ?? 'null'} | ${r.summary.backspinRounds}/${r.roundStats.length} | ${r.summary.speedTrend ?? 'null'} | ${r.summary.avgLandingX ?? 'null'}`
    );
  }
  console.log(`\nStable (>= ${MAX_ROUNDS} rounds): ${stableCount}/${allPresets.length}`);

  // Show per-round detail for a few representative presets
  for (const pid of ["backspin_long_backhand", "no_spin_long_forehand"]) {
    const r = modeAResults[pid];
    if (!r) continue;
    console.log(`\n--- ${pid} per-round detail (${r.rounds} rounds) ---`);
    console.table(r.roundStats.map(s => ({
      round: s.round,
      outTS: s.outgoingTS,
      outSS: s.outgoingSS,
      speed: s.outSpeed,
      netClr: s.netClearance,
      inB: s.inBounds,
      backspin: s.isBackspin,
      landX: s.landingX,
    })));
  }

  // Console: Mode B summary
  console.log(`\n=== Mode B: Bypassed sweep (no aim solver, PADDLE_BLEND=${deployedBlend}) ===`);
  for (const pid of sweepPresetIds) {
    const r = modeBResults[pid];
    if (!r) continue;
    console.log(`\n${pid}: ${r.stableCount}/${r.grid.totalPoints} stable`);
    console.log("Classifications:", JSON.stringify(r.classificationCounts));
    // Show grid summary
    const stableRows = r.rows.filter(row => row.classification === "穩定循環");
    if (stableRows.length > 0) {
      console.log("Stable points:");
      console.table(stableRows.map(row => ({ tiltY: row.tiltY, lift: row.lift, drive: row.drive, rounds: row.rounds })));
    }
  }

  console.log(`\nFull JSON dump: ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}