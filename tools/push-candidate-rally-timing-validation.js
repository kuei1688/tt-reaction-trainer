#!/usr/bin/env node

// Validates the tiltY≈1.0-1.1 / driveScale≈0.8 push candidate (found by
// push-tilty-driveswept-sweep-calibration.js / push-tilty-sweep-calibration.js
// at the single canonical findPushHitIndex point) against two criteria those
// single-point sweeps never checked:
//
// Layer 1 (rally stability): does return-studio.html's own continuous-rally
// simulator (runRallyReal, return-studio.html:1589-1626) stay bounded in
// outgoing speed / bounce-apex height over many rounds, or does energy
// visibly grow round-over-round (an unstable rally)? Compared against the
// currently-deployed baseline (tiltY=0.8, driveScale=1.0 i.e. unmodified
// engine).
//
// Layer 2 (timing-window robustness): findPushHitIndex only ever returns ONE
// canonical index inside the post-bounce descent window. In the actual game
// the player can hit at any point in that window. This layer samples every
// valid index in the window (same validity condition as findHitIndex/
// findPushHitIndex: path.points[i].y > TABLE.top, between the receiver bounce
// and the next bounce/end of path) and checks whether the candidate still
// lands safely across the whole window, or only near the one canonical point.
//
// Uses the same instantiateReturnStudioSymbols/extraExternals override
// mechanism as push-tilty-driveswept-sweep-calibration.js. Per that file's
// documented trap: computeAdaptivePushLift/computeAdaptivePushDrive/
// PUSH_TILT_Y must NOT appear in the symbolNames list passed to
// instantiateReturnStudioSymbols, only in extraExternals, or local extraction
// silently wins and the override becomes a no-op.
//
// Read-only research tool. Does not modify return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadReturnStudioPhysics } = require("./load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(
  ROOT_DIR,
  "AI_CONTEXT",
  "push_candidate_rally_and_timing_validation.txt"
);

// Same 11-preset calibration set as push-tilty-sweep-calibration.js.
const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

// Faithful copy of return-studio.html:90-99's adaptive push lift/drive base
// constants, with an extra driveScale multiplier (same approach as
// push-tilty-driveswept-sweep-calibration.js).
const PUSH_LIFT_BASE = 0.35,
  PUSH_LIFT_FLOOR = 0,
  PUSH_LIFT_MAX = 3.0;
const PUSH_DRIVE_BASE = 0.7,
  PUSH_DRIVE_FLOOR = 0.1,
  PUSH_DRIVE_MAX = 3.0;

function clampLocal(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function makeScaledLift(driveScale) {
  return function computeAdaptivePushLift() {
    return clampLocal(PUSH_LIFT_BASE, PUSH_LIFT_FLOOR, PUSH_LIFT_MAX) * driveScale;
  };
}
function makeScaledDrive(driveScale) {
  return function computeAdaptivePushDrive() {
    return clampLocal(PUSH_DRIVE_BASE, PUSH_DRIVE_FLOOR, PUSH_DRIVE_MAX) * driveScale;
  };
}

function round(value, digits = 4) {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

const PARAM_SETS = [
  { key: "baseline_deployed", label: "Deployed baseline (tiltY=0.8, driveScale=1.0)", tiltY: 0.8, driveScale: 1.0 },
  { key: "candidate_tiltY_1.0", label: "Candidate (tiltY=1.0, driveScale=0.8)", tiltY: 1.0, driveScale: 0.8 },
  { key: "candidate_tiltY_1.1", label: "Candidate (tiltY=1.1, driveScale=0.8)", tiltY: 1.1, driveScale: 0.8 },
];

function extractForParams(loader, tiltY, driveScale) {
  // Only request the top-level output symbols we actually call. Everything
  // else (simulateServe, simulatePath, findPushHitIndex, findHitIndex,
  // makeReturnVelocity, mirrorVec, mirrorSpin, mirrorPathForDetection,
  // judgeResult, TECHNIQUES) is pulled in transitively as local dependencies,
  // and computeAdaptivePushLift/Drive/PUSH_TILT_Y resolve to our external
  // overrides along that dependency chain.
  return loader.instantiateReturnStudioSymbols(
    ["runRallyReal", "simulateServe", "findPushHitIndex", "simulatePath", "makeReturnVelocity", "mirrorVec", "mirrorSpin", "mirrorPathForDetection", "judgeResult", "TECHNIQUES"],
    {
      PUSH_TILT_Y: tiltY,
      computeAdaptivePushLift: makeScaledLift(driveScale),
      computeAdaptivePushDrive: makeScaledDrive(driveScale),
    }
  );
}

// ── Layer 1: instrumented rally (copy of return-studio.html's runRallyReal,
// return-studio.html:1589-1626, with per-round speed/apex tracking added).
// Logic must stay in lockstep with the original; if that function changes
// this copy needs to be re-synced by hand (documented risk, same tradeoff as
// every other tool in this directory that re-implements page logic locally
// to add instrumentation the original doesn't expose).
function runInstrumentedRally(ext, preset, maxRounds) {
  const gravity = preset.solve?.gravity ?? -4.2;
  const tech = ext.TECHNIQUES.push;
  const serve = ext.simulateServe(preset);
  const firstHitIndex = ext.findPushHitIndex(serve);
  let hitPoint = serve.points[firstHitIndex];
  let hitVel = serve.velocities[firstHitIndex];
  let hitSpin = serve.spins[firstHitIndex];
  let flip = false;
  let rounds = 0;
  let failReason = null;
  const roundStats = [];

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    const canonicalHitPoint = flip ? ext.mirrorVec(hitPoint) : hitPoint;
    const canonicalHitVel = flip ? ext.mirrorVec(hitVel) : hitVel;
    const canonicalHitSpin = flip ? ext.mirrorSpin(hitSpin) : hitSpin;
    const returnHitCanonical = ext.makeReturnVelocity(canonicalHitVel, canonicalHitSpin, tech, canonicalHitPoint, gravity);
    const returnVelReal = flip ? ext.mirrorVec(returnHitCanonical.vel) : returnHitCanonical.vel;
    const returnSpinReal = flip ? ext.mirrorSpin(returnHitCanonical.spin) : returnHitCanonical.spin;
    const outPath = ext.simulatePath({ ...hitPoint }, returnVelReal, { gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0 });

    const outSpeed = round(Math.hypot(returnVelReal.x, returnVelReal.y, returnVelReal.z));
    const apex = round(outPath.points.reduce((max, p) => Math.max(max, p.y), -Infinity));

    const netClearance = outPath.netY == null ? null : outPath.netY - (0.76 + 0.1525);
    const firstBounce = outPath.bounces[0];
    const expectedSign = flip ? 1 : -1;
    const inBounds = firstBounce && Math.abs(firstBounce.x) <= 1.525 / 2 && Math.abs(firstBounce.z) <= 2.74 / 2 && Math.sign(firstBounce.z) === expectedSign;
    const netOk = netClearance != null && netClearance >= 0;

    roundStats.push({ round: roundNum, outSpeed, apex, netClearance: netClearance == null ? null : round(netClearance), inBounds: !!inBounds });

    if (!netOk || !inBounds) {
      failReason = !netOk ? "掛網" : "出界";
      break;
    }
    rounds = roundNum;
    const detectionPath = flip ? outPath : ext.mirrorPathForDetection(outPath);
    const nextIdx = ext.findPushHitIndex(detectionPath);
    if (nextIdx == null || nextIdx >= outPath.points.length || !outPath.velocities[nextIdx] || !outPath.spins[nextIdx]) {
      failReason = "找不到下一次擊球點";
      break;
    }
    hitPoint = outPath.points[nextIdx];
    hitVel = outPath.velocities[nextIdx];
    hitSpin = outPath.spins[nextIdx];
    flip = !flip;
  }

  return { rounds, failReason, roundStats };
}

// ── Layer 2: timing-window sampler.
// Window definition (per task spec): receiver-side bounce via
// path.bounces.findIndex(b=>b.z>0) (same as findPushHitIndex's primary
// branch), scanning i from bounce.index+1 up to the next bounce (or end of
// path), keeping every i where path.points[i].y > TABLE.top (findHitIndex/
// findPushHitIndex's own validity condition), i.e. every point still above
// table height during the post-bounce descent/ascent, not just the one
// index findPushHitIndex itself would pick.
const TABLE_TOP = 0.781;
const TABLE_HEIGHT = 0.76,
  TABLE_NET = 0.1525;
const TABLE_WIDTH = 1.525,
  TABLE_LENGTH = 2.74;

function timingWindowIndices(path) {
  const receiverBounceIdx = path.bounces.findIndex((b) => b.z > 0);
  if (receiverBounceIdx < 0) return [];
  const receiverBounce = path.bounces[receiverBounceIdx];
  const nextBounce = path.bounces[receiverBounceIdx + 1];
  const hardStop = nextBounce ? nextBounce.index : path.points.length;
  const start = receiverBounce.index + 1;
  const indices = [];
  for (let i = start; i < Math.min(hardStop, path.points.length); i++) {
    if (path.points[i].y > TABLE_TOP) indices.push(i);
  }
  return indices;
}

function judgeAtIndex(ext, preset, serve, index) {
  const gravity = preset.solve?.gravity ?? -4.2;
  const tech = ext.TECHNIQUES.push;
  const hitPoint = serve.points[index];
  const hitVel = serve.velocities[index];
  const hitSpin = serve.spins[index];
  const returnHit = ext.makeReturnVelocity(hitVel, hitSpin, tech, hitPoint, gravity);
  const result = ext.simulatePath({ ...hitPoint }, returnHit.vel, { gravity, spin: returnHit.spin, bounceBoost: tech.bounceBoost ?? 0 });
  const judged = ext.judgeResult(result);
  const outSpeed = round(Math.hypot(returnHit.vel.x, returnHit.vel.y, returnHit.vel.z));
  const outSpin = { topspin: round(returnHit.spin.topspin), sidespin: round(returnHit.spin.sidespin) };
  return { index, ok: judged.ok, reason: judged.reason, outSpeed, outSpin };
}

function runLayer1(loader, presets) {
  const results = {};
  for (const paramSet of PARAM_SETS) {
    process.stderr.write(`[layer1] ${paramSet.key}\n`);
    const ext = extractForParams(loader, paramSet.tiltY, paramSet.driveScale);
    const perPreset = presets.map((preset) => {
      const rally = runInstrumentedRally(ext, preset, 60);
      const speeds = rally.roundStats.map((r) => r.outSpeed);
      const apexes = rally.roundStats.map((r) => r.apex);
      const firstSpeed = speeds[0] ?? null;
      const lastSpeed = speeds.length ? speeds[speeds.length - 1] : null;
      const maxSpeed = speeds.length ? Math.max(...speeds) : null;
      const firstApex = apexes[0] ?? null;
      const maxApex = apexes.length ? Math.max(...apexes) : null;
      return {
        preset: preset.id,
        roundsSurvived: rally.rounds,
        failReason: rally.failReason,
        totalRoundsAttempted: rally.roundStats.length,
        firstSpeed,
        lastSpeed,
        maxSpeed,
        firstApex,
        maxApex,
        speedGrowthRatio: firstSpeed ? round(maxSpeed / firstSpeed) : null,
        apexGrowthRatio: firstApex ? round(maxApex / firstApex) : null,
        roundStats: rally.roundStats,
      };
    });
    results[paramSet.key] = { paramSet, perPreset };
  }
  return results;
}

function runLayer2(loader, presets) {
  const results = {};
  for (const paramSet of PARAM_SETS) {
    process.stderr.write(`[layer2] ${paramSet.key}\n`);
    const ext = extractForParams(loader, paramSet.tiltY, paramSet.driveScale);
    const perPreset = presets.map((preset) => {
      const serve = ext.simulateServe(preset);
      const canonicalIdx = ext.findPushHitIndex(serve);
      const windowIdx = timingWindowIndices(serve);
      const samples = windowIdx.map((idx) => judgeAtIndex(ext, preset, serve, idx));
      const okCount = samples.filter((s) => s.ok).length;
      const canonicalSample = samples.find((s) => s.index === canonicalIdx) || null;
      return {
        preset: preset.id,
        windowSize: windowIdx.length,
        canonicalIdx,
        canonicalInWindow: windowIdx.includes(canonicalIdx),
        okCount,
        passRate: windowIdx.length ? round(okCount / windowIdx.length) : null,
        canonicalOk: canonicalSample ? canonicalSample.ok : null,
        samples,
      };
    });
    results[paramSet.key] = { paramSet, perPreset };
  }
  return results;
}

function fmtPct(x) {
  return x == null ? "-" : `${round(x * 100, 1)}%`;
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const presets = allPresets.filter((preset) => !EXCLUDED_PRESET_IDS.has(preset.id));
  if (presets.length !== allPresets.length - EXCLUDED_PRESET_IDS.size) {
    throw new Error("Preset exclusion mismatch — check EXCLUDED_PRESET_IDS against physics-presets.json.");
  }

  const loader = loadReturnStudioPhysics({});

  const layer1 = runLayer1(loader, presets);
  const layer2 = runLayer2(loader, presets);

  const lines = [];
  lines.push("# Push candidate validation: continuous-rally stability + timing-window robustness");
  lines.push("");
  lines.push("> Research tool output (return-studio.html), not game4.html acceptance. Does not modify return-studio.html.");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length} (11-preset calibration set, same exclusions as push-tilty-sweep-calibration.js: ${[...EXCLUDED_PRESET_IDS].join(", ")})`);
  lines.push(`Param sets compared: ${PARAM_SETS.map((p) => p.label).join(" | ")}`);
  lines.push("");

  // ── Layer 1 report ──
  lines.push("## Layer 1: Continuous-rally stability (runRallyReal, maxRounds=60)");
  lines.push("");
  lines.push("Per param set, per preset: rounds survived before failure, first-round vs max outgoing speed/apex (growth ratio = max/first; ~1.0 = stable, >>1 = diverging).");
  lines.push("");
  for (const paramSet of PARAM_SETS) {
    lines.push(`### ${paramSet.label}`);
    lines.push("");
    lines.push("preset | rounds survived | fail reason | first speed (m/s) | max speed | speed growth | first apex (m) | max apex | apex growth");
    lines.push("--- | --- | --- | --- | --- | --- | --- | --- | ---");
    const data = layer1[paramSet.key].perPreset;
    for (const row of data) {
      lines.push(
        `${row.preset} | ${row.roundsSurvived} | ${row.failReason ?? "-"} | ${row.firstSpeed ?? "-"} | ${row.maxSpeed ?? "-"} | ${row.speedGrowthRatio ?? "-"} | ${row.firstApex ?? "-"} | ${row.maxApex ?? "-"} | ${row.apexGrowthRatio ?? "-"}`
      );
    }
    const avgRounds = round(data.reduce((s, r) => s + r.roundsSurvived, 0) / data.length, 2);
    const avgSpeedGrowth = round(
      data.filter((r) => r.speedGrowthRatio != null).reduce((s, r) => s + r.speedGrowthRatio, 0) /
        data.filter((r) => r.speedGrowthRatio != null).length,
      2
    );
    lines.push("");
    lines.push(`Average rounds survived: ${avgRounds}. Average speed growth ratio (max/first): ${avgSpeedGrowth}.`);
    lines.push("");
  }

  // ── Layer 2 report ──
  lines.push("## Layer 2: Timing-window robustness");
  lines.push("");
  lines.push("Per param set, per preset: size of the valid post-bounce hit window (points[i].y > TABLE.top, between receiver bounce and next bounce/end), pass-rate across that whole window, and whether the one canonical findPushHitIndex point itself passes.");
  lines.push("");
  for (const paramSet of PARAM_SETS) {
    lines.push(`### ${paramSet.label}`);
    lines.push("");
    lines.push("preset | window size | canonical idx in window | canonical passes | window pass-rate (ok/total)");
    lines.push("--- | --- | --- | --- | ---");
    const data = layer2[paramSet.key].perPreset;
    for (const row of data) {
      lines.push(
        `${row.preset} | ${row.windowSize} | ${row.canonicalInWindow} | ${row.canonicalOk} | ${fmtPct(row.passRate)} (${row.okCount}/${row.windowSize})`
      );
    }
    const totalOk = data.reduce((s, r) => s + r.okCount, 0);
    const totalWindow = data.reduce((s, r) => s + r.windowSize, 0);
    const canonicalOkCount = data.filter((r) => r.canonicalOk).length;
    lines.push("");
    lines.push(
      `Aggregate window pass-rate: ${fmtPct(totalOk / totalWindow)} (${totalOk}/${totalWindow} samples across all presets). Canonical-point pass count: ${canonicalOkCount}/${data.length} presets.`
    );
    lines.push("");
  }

  lines.push("## Full JSON (Layer 1 + Layer 2, all rounds/samples)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ layer1, layer2 }, null, 2));
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

  console.log("=== Layer 1 summary (avg rounds survived, avg speed growth ratio) ===");
  console.table(
    PARAM_SETS.map((paramSet) => {
      const data = layer1[paramSet.key].perPreset;
      const avgRounds = round(data.reduce((s, r) => s + r.roundsSurvived, 0) / data.length, 2);
      const growthVals = data.filter((r) => r.speedGrowthRatio != null).map((r) => r.speedGrowthRatio);
      const avgGrowth = growthVals.length ? round(growthVals.reduce((s, v) => s + v, 0) / growthVals.length, 2) : null;
      return { paramSet: paramSet.key, avgRoundsSurvived: avgRounds, avgSpeedGrowthRatio: avgGrowth };
    })
  );

  console.log("=== Layer 2 summary (aggregate window pass-rate) ===");
  console.table(
    PARAM_SETS.map((paramSet) => {
      const data = layer2[paramSet.key].perPreset;
      const totalOk = data.reduce((s, r) => s + r.okCount, 0);
      const totalWindow = data.reduce((s, r) => s + r.windowSize, 0);
      const canonicalOkCount = data.filter((r) => r.canonicalOk).length;
      return {
        paramSet: paramSet.key,
        windowPassRate: fmtPct(totalOk / totalWindow),
        canonicalPointPass: `${canonicalOkCount}/${data.length}`,
      };
    })
  );

  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}
