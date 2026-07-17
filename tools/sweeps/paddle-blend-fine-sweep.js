#!/usr/bin/env node

// Step 1: PADDLE_BLEND fine calibration.
// Sweeps PADDLE_BLEND in [0.55, 0.75] at 0.01 resolution (21 points)
// across 3 representative presets to find the safe window where ALL presets
// have positive netClearance.
//
// Also sweeps wider [0.45, 0.85] at 0.02 resolution for context.
//
// Read-only research tool.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("../load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "paddle_blend_fine_sweep_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2);

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
function linspace(lo, hi, step) {
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(round(v, 4));
  return out;
}

function runOnce(loader, blend, hitVel, hitSpinSim, hitPoint, gravity, TABLE) {
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
  const tech = { ...ext.TECHNIQUES.push };
  const tiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");
  const lift = ext.computeAdaptivePushLift(hitVel);
  const drive = ext.computeAdaptivePushDrive(hitVel);
  const planeVel = { x: 0, y: lift, z: -drive };
  const tiltX = 0;
  const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
  const epsilon = ext.dynamicPaddleEpsilon(hitVel, planeVel, racketNormal);

  const contactResult = ext.applyPushContact(hitVel, hitSpinSim, racketNormal, planeVel, epsilon, tech, blend);
  const outPath = ext.simulatePath({ ...hitPoint }, contactResult.vel, {
    gravity, spin: contactResult.spin, bounceBoost: tech.bounceBoost || 0,
  });

  const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
  const firstBounce = outPath.bounces[0] || null;
  let clearsNet = null;
  if (outPath.netY != null) clearsNet = netClearance >= 0;
  let landing = "no_bounce";
  let landingX = null, inBounds = null;
  if (firstBounce) {
    landingX = round(firstBounce.x);
    landing = firstBounce.z < 0 ? "forward" : "back";
    inBounds = Math.abs(firstBounce.x) <= TABLE.width / 2 && Math.abs(firstBounce.z) <= TABLE.length / 2;
  }
  const outSpeed = Math.hypot(contactResult.vel.x, contactResult.vel.y, contactResult.vel.z);
  return {
    outTopspin: round((contactResult.spin.topspin || 0) * SIM_D),
    outSidespin: round((contactResult.spin.sidespin || 0) * SIM_D),
    outSpeed: round(outSpeed),
    netClearance: netClearance == null ? null : round(netClearance, 5),
    clearsNet,
    landing, landingX, inBounds,
    dwellMs: round(contactResult.dwellMs, 3),
  };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const presetIds = ["backspin_long_backhand", "no_spin_long_forehand", "backspin_long_forehand"];

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const TABLE = loader.runtimeExternals.TABLE;

  // Get hit conditions for each preset
  const presetCtx = {};
  for (const pid of presetIds) {
    const preset = allPresets.find(p => p.id === pid);
    if (!preset) continue;
    const ext0 = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
    const serve = ext0.simulateServe(preset);
    const hitIndex = ext0.findPushHitIndex(serve);
    presetCtx[pid] = {
      preset,
      hitPoint: serve.points[hitIndex],
      hitVel: serve.velocities[hitIndex],
      hitSpinSim: serve.spins[hitIndex],
      gravity: preset.solve?.gravity ?? -4.2,
      deployedLift: round(ext0.computeAdaptivePushLift(serve.velocities[hitIndex])),
      deployedDrive: round(ext0.computeAdaptivePushDrive(serve.velocities[hitIndex])),
    };
  }

  // Fine sweep: [0.55, 0.75] at 0.01 = 21 points
  const FINE = linspace(0.55, 0.75, 0.01);
  // Wide sweep: [0.45, 0.85] at 0.02 = 21 points
  const WIDE = linspace(0.45, 0.85, 0.02);

  const results = { fine: {}, wide: {} };

  for (const [sweepName, blendValues] of [["fine", FINE], ["wide", WIDE]]) {
    process.stderr.write(`[${sweepName}] sweep ${blendValues.length} points × ${presetIds.length} presets\n`);
    for (const pid of presetIds) {
      const ctx = presetCtx[pid];
      if (!ctx) continue;
      const rows = blendValues.map(b => ({ blend: b, ...runOnce(loader, b, ctx.hitVel, ctx.hitSpinSim, ctx.hitPoint, ctx.gravity, TABLE) }));
      results[sweepName][pid] = rows;

      // Find safe window: netClearance > 0
      const safeRows = rows.filter(r => r.clearsNet === true);
      const safeBlends = safeRows.map(r => r.blend);
      const safeBounds = safeBlends.length > 0 ? {
        blendMin: Math.min(...safeBlends),
        blendMax: Math.max(...safeBlends),
        midpoint: round((Math.min(...safeBlends) + Math.max(...safeBlends)) / 2, 4),
        halfWidth: round((Math.max(...safeBlends) - Math.min(...safeBlends)) / 2, 4),
        count: safeBlends.length,
      } : { count: 0 };

      results[sweepName][pid + "_safe"] = safeBounds;

      // Find netClearance = 0 crossing
      let crossing = null;
      for (let i = 0; i < rows.length - 1; i++) {
        if (rows[i].netClearance != null && rows[i+1].netClearance != null &&
            Math.sign(rows[i].netClearance) !== Math.sign(rows[i+1].netClearance) &&
            rows[i].netClearance !== 0) {
          crossing = { between: [rows[i].blend, rows[i+1].blend], values: [rows[i].netClearance, rows[i+1].netClearance] };
          break;
        }
      }
      results[sweepName][pid + "_crossing"] = crossing;
    }
  }

  // Find intersection of safe windows across all presets (fine sweep)
  const fineSafeRanges = presetIds.map(pid => results.fine[pid + "_safe"]).filter(s => s.count > 0);
  let intersection = null;
  if (fineSafeRanges.length === presetIds.length) {
    const lo = Math.max(...fineSafeRanges.map(s => s.blendMin));
    const hi = Math.min(...fineSafeRanges.map(s => s.blendMax));
    if (lo <= hi) {
      intersection = { blendMin: lo, blendMax: hi, midpoint: round((lo+hi)/2, 4), halfWidth: round((hi-lo)/2, 4) };
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    tool: "paddle-blend-fine-sweep.js",
    note: "Fine PADDLE_BLEND calibration. All spin in real rad/s (×D=1.528). Bypasses aim solver.",
    deployedValue: 0.65,
    presets: presetIds.reduce((acc, pid) => {
      const ctx = presetCtx[pid];
      if (ctx) acc[pid] = { lift: ctx.deployedLift, drive: ctx.deployedDrive };
      return acc;
    }, {}),
    fine: results.fine,
    wide: results.wide,
    safeWindowIntersection: intersection,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  // Console output
  console.log("=== PADDLE_BLEND Fine Sweep [0.55, 0.75] ===\n");
  for (const pid of presetIds) {
    const rows = results.fine[pid];
    const safe = results.fine[pid + "_safe"];
    const crossing = results.fine[pid + "_crossing"];
    console.log(`\n${pid}:`);
    console.table(rows.map(r => ({
      blend: r.blend,
      outTopspin: r.outTopspin,
      netClearance: r.netClearance,
      clearsNet: r.clearsNet,
      outSpeed: r.outSpeed,
      inBounds: r.inBounds,
    })));
    console.log(`  Safe window (netClearance>0):`, safe);
    console.log(`  Net crossing:`, crossing);
  }

  console.log("\n=== Safe Window Intersection (all presets) ===");
  if (intersection) {
    console.log(`  blend ∈ [${intersection.blendMin}, ${intersection.blendMax}]`);
    console.log(`  Recommended deployment: ${intersection.midpoint} ± ${intersection.halfWidth}`);
  } else {
    console.log("  No intersection found — not all presets have positive netClearance simultaneously.");
    // Show individual windows
    for (const pid of presetIds) {
      console.log(`  ${pid}:`, results.fine[pid + "_safe"]);
    }
  }

  // Also show wide sweep summary
  console.log("\n=== Wide Sweep [0.45, 0.85] Summary ===");
  for (const pid of presetIds) {
    const safe = results.wide[pid + "_safe"];
    const crossing = results.wide[pid + "_crossing"];
    console.log(`  ${pid}: safe=${JSON.stringify(safe)} crossing=${JSON.stringify(crossing)}`);
  }

  console.log(`\nFull JSON dump: ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}