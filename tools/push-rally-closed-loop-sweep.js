#!/usr/bin/env node

// Group 5A/5B: Push rally closed-loop stability sweep.
// Sweeps (tiltY, lift, drive) 3D grid and simulates multi-round push-vs-push rallies.
// Each grid point is classified as: stable_cycle / spin_flip / speed_diverge / net / out_of_bounds
//
// 5A: backspin_long_backhand (80 grid points)
// 5B: no_spin_long_forehand + sidebackspin_long_forehand_2 (80 each)
//
// Bypasses solveRacketVelXForTargetLandingX. planeVel = {0, lift, -drive}.
// All spin values in real rad/s (×D=1.528).
// Read-only research tool.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_rally_closed_loop_sweep_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2);
const MAX_ROUNDS = 10;
const SPEED_DIVERGE_THRESHOLD = 8.0; // m/s, if outgoing speed exceeds this → diverging
const BACKSPIN_THRESHOLD = 0; // topspin <= 0 = backspin (in real rad/s)

const SYMBOL_NAMES = [
  "simulateServe", "simulatePath", "solveBaseVelocity", "solveServeBounceVelocity",
  "solveVelocity", "makeServeAimCandidate", "getServeLengthProfile", "findServeBounceTime",
  "getServeBounces", "serveBounceScore", "clone", "findPushHitIndex", "findHitIndex",
  "TECHNIQUES", "computeAdaptivePushLift", "computeAdaptivePushDrive", "computeAdaptivePushTiltX",
  "PADDLE_FRICTION", "computeRacketNormal", "dynamicPaddleEpsilon", "applyPushContact", "PADDLE_BLEND",
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

function runRally(loader, tiltY, lift, drive, preset, TABLE) {
  const extra = { PUSH_TILT_Y: tiltY };
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES, extra);
  const tech = { ...ext.TECHNIQUES.push };
  const gravity = preset.solve?.gravity ?? -4.2;

  // Generate serve
  const serve = ext.simulateServe(preset);
  const firstHitIndex = ext.findPushHitIndex(serve);
  let hitPoint = serve.points[firstHitIndex];
  let hitVel = serve.velocities[firstHitIndex];
  let hitSpin = serve.spins[firstHitIndex];
  let flip = false;
  let rounds = 0;
  let failReason = null;
  const roundStats = [];
  const blend = ext.PADDLE_BLEND;

  for (let roundNum = 1; roundNum <= MAX_ROUNDS; roundNum++) {
    // Mirror for canonical position (player always hits from "their" side)
    const canonicalHitPoint = flip ? mirrorVec(hitPoint) : hitPoint;
    const canonicalHitVel = flip ? mirrorVec(hitVel) : hitVel;
    const canonicalHitSpin = flip ? mirrorSpin(hitSpin) : hitSpin;

    // Direct push contact (bypass aim solver)
    const planeVel = { x: 0, y: lift, z: -drive };
    const tiltX = 0;
    const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
    const epsilon = ext.dynamicPaddleEpsilon(canonicalHitVel, planeVel, racketNormal);
    const contactResult = ext.applyPushContact(canonicalHitVel, canonicalHitSpin, racketNormal, planeVel, epsilon, tech, blend);

    // Mirror back for actual trajectory
    const returnVelReal = flip ? mirrorVec(contactResult.vel) : contactResult.vel;
    const returnSpinReal = flip ? mirrorSpin(contactResult.spin) : contactResult.spin;

    // Simulate return path
    const outPath = ext.simulatePath({ ...hitPoint }, returnVelReal, {
      gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0,
    });

    // Measurements
    const incomingTS_real = round((canonicalHitSpin.topspin || 0) * SIM_D);
    const outgoingTS_real = round((contactResult.spin.topspin || 0) * SIM_D);
    const outSpeed = round(Math.hypot(returnVelReal.x, returnVelReal.y, returnVelReal.z));

    const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
    const firstBounce = outPath.bounces[0];
    const expectedSign = flip ? 1 : -1;
    const inBounds = firstBounce && Math.abs(firstBounce.x) <= TABLE.width / 2 && Math.abs(firstBounce.z) <= TABLE.length / 2 && Math.sign(firstBounce.z) === expectedSign;
    const netOk = netClearance != null && netClearance >= 0;

    roundStats.push({
      round: roundNum,
      incomingTS: incomingTS_real,
      outgoingTS: outgoingTS_real,
      outSpeed,
      netClearance: netClearance == null ? null : round(netClearance),
      inBounds: !!inBounds,
      netOk: !!netOk,
      isBackspin: outgoingTS_real > BACKSPIN_THRESHOLD, // outgoing z<0: positive canonical topspin = backspin for opponent
    });

    // Check failure conditions
    if (!netOk) { failReason = "掛網"; break; }
    if (!inBounds) { failReason = "出界"; break; }
    if (outSpeed > SPEED_DIVERGE_THRESHOLD) { failReason = "速度發散"; break; }

    // Check spin flip: if outgoing is topspin (positive) when it should be backspin
    // We track whether the spin direction is maintained across rounds
    rounds = roundNum;

    // Find next hit point
    const detectionPath = flip ? outPath : mirrorPathForDetection(outPath);
    const nextIdx = ext.findPushHitIndex(detectionPath);
    if (nextIdx == null || nextIdx >= outPath.points.length || !outPath.velocities[nextIdx] || !outPath.spins[nextIdx]) {
      failReason = "找不到擊球點";
      break;
    }
    hitPoint = outPath.points[nextIdx];
    hitVel = outPath.velocities[nextIdx];
    hitSpin = outPath.spins[nextIdx];
    flip = !flip;
  }

  // Classify outcome
  let classification;
  if (rounds >= MAX_ROUNDS) {
    // Check if all rounds maintained backspin
    const allBackspin = roundStats.every(r => r.isBackspin);
    const speedTrend = roundStats.length >= 3 ? (roundStats[roundStats.length-1].outSpeed - roundStats[0].outSpeed) : 0;
    if (allBackspin && Math.abs(speedTrend) < 2.0) classification = "穩定循環";
    else if (!allBackspin) classification = "旋轉翻轉";
    else classification = "穩定循環(速度漂移)";
  } else if (failReason === "掛網") classification = "掛網";
  else if (failReason === "出界") classification = "飛出界";
  else if (failReason === "速度發散") classification = "速度發散";
  else classification = failReason || "中斷";

  return {
    rounds, failReason, classification,
    roundStats,
    summary: {
      maxOutSpeed: roundStats.length ? round(Math.max(...roundStats.map(r => r.outSpeed))) : null,
      minOutSpeed: roundStats.length ? round(Math.min(...roundStats.map(r => r.outSpeed))) : null,
      backspinRounds: roundStats.filter(r => r.isBackspin).length,
      spinFlipped: roundStats.some(r => !r.isBackspin),
      speedTrend: roundStats.length >= 2 ? round(roundStats[roundStats.length-1].outSpeed - roundStats[0].outSpeed) : null,
    },
  };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];

  // 5A grid: tiltY × lift × drive
  const TILTY_VALUES = [0.7, 0.85, 1.0, 1.15, 1.3];
  const LIFT_VALUES = [0.15, 0.22, 0.30, 0.40];
  const DRIVE_VALUES = [0.3, 0.45, 0.56, 0.70];

  const presetIds5A = ["backspin_long_backhand"];
  const presetIds5B = ["no_spin_long_forehand", "sidebackspin_long_forehand_2"];

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const TABLE = loader.runtimeExternals.TABLE;

  const allResults = {};

  // Run 5A + 5B presets
  for (const pid of [...presetIds5A, ...presetIds5B]) {
    const preset = allPresets.find(p => p.id === pid);
    if (!preset) { process.stderr.write(`[warn] ${pid} not found\n`); continue; }

    process.stderr.write(`[rally] ${pid} (${TILTY_VALUES.length * LIFT_VALUES.length * DRIVE_VALUES.length} grid points)\n`);
    const gridResults = [];

    for (const tiltY of TILTY_VALUES) {
      for (const lift of LIFT_VALUES) {
        for (const drive of DRIVE_VALUES) {
          try {
            const rally = runRally(loader, tiltY, lift, drive, preset, TABLE);
            gridResults.push({
              tiltY, lift, drive,
              ...rally,
            });
          } catch (e) {
            gridResults.push({ tiltY, lift, drive, error: e.message, classification: "error", rounds: 0 });
          }
        }
      }
      process.stderr.write(`  tiltY=${tiltY} done\n`);
    }

    // Summarize classifications
    const classCounts = {};
    for (const r of gridResults) {
      const c = r.classification || "error";
      classCounts[c] = (classCounts[c] || 0) + 1;
    }

    // Find stable region
    const stable = gridResults.filter(r => r.classification === "穩定循環");
    const stableBounds = stable.length > 0 ? {
      tiltYMin: Math.min(...stable.map(r => r.tiltY)),
      tiltYMax: Math.max(...stable.map(r => r.tiltY)),
      liftMin: Math.min(...stable.map(r => r.lift)),
      liftMax: Math.max(...stable.map(r => r.lift)),
      driveMin: Math.min(...stable.map(r => r.drive)),
      driveMax: Math.max(...stable.map(r => r.drive)),
      count: stable.length,
    } : { count: 0 };

    allResults[pid] = {
      presetId: pid,
      grid: { tiltY: TILTY_VALUES, lift: LIFT_VALUES, drive: DRIVE_VALUES, totalPoints: gridResults.length },
      rows: gridResults,
      classificationCounts: classCounts,
      stableBounds,
    };

    // Console output
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Preset: ${pid} — ${gridResults.length} grid points`);
    console.log("Classification counts:", classCounts);
    console.log("Stable region:", stableBounds);

    // Show grid as table
    console.log("\nGrid (tiltY × lift × drive → classification / rounds):");
    const gridDisplay = gridResults.map(r => ({
      tiltY: r.tiltY, lift: r.lift, drive: r.drive,
      rounds: r.rounds, class: r.classification,
      maxSpeed: r.summary?.maxOutSpeed, backspin: r.summary?.backspinRounds,
    }));
    console.table(gridDisplay);
  }

  // 5B comparison: how does stable region shift between presets?
  const stableComparison = {};
  for (const pid of [...presetIds5A, ...presetIds5B]) {
    stableComparison[pid] = allResults[pid]?.stableBounds;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    tool: "push-rally-closed-loop-sweep.js",
    note: "All spin in real rad/s (×D=1.528). Bypasses aim solver. MAX_ROUNDS=" + MAX_ROUNDS,
    grid: { tiltY: TILTY_VALUES, lift: LIFT_VALUES, drive: DRIVE_VALUES, totalPerPreset: TILTY_VALUES.length * LIFT_VALUES.length * DRIVE_VALUES.length },
    presets: allResults,
    stableRegionComparison: stableComparison,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`\n${"=".repeat(70)}`);
  console.log("5B: Stable region comparison across presets:");
  console.table(stableComparison);
  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}