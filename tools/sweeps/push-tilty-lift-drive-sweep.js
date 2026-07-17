#!/usr/bin/env node

// Group 2A-2E + Group 3: Paddle contact output curves with extended post-bounce tracking.
//
// 2A: tiltY sweep [0.3, 2.0] 16pts — extended with regime/dwellMs/post-bounce spin
// 2B: lift sweep [0, 1.5] 15pts
// 2C: drive sweep [0.1, 1.3] 13pts
// 2D: lift × drive 2D feasibility map 15×13=195 grid
// 2E: repeat 2D with no_spin_long_forehand + backspin_long_forehand
// Group 3: all curves extended to opponent table bounce + opponent receive point
//
// All spin values in real rad/s (×D=1.528).
// Bypasses solveRacketVelXForTargetLandingX (planeVel = {0, lift, -drive}).
// Read-only research tool.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("../load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_tilt_lift_drive_sweep_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2);

// Must NOT include PUSH_TILT_Y directly (overridden via extraExternals for 2A).
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
function linspace(lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * i) / (n - 1));
  return out;
}
function sensitivityReport(xs, ys, label) {
  const segments = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const dx = xs[i+1] - xs[i], dy = ys[i+1] - ys[i];
    const slope = dx !== 0 ? dy / dx : null;
    segments.push({ from: round(xs[i]), to: round(xs[i+1]), dx: round(dx), dy: round(dy), slope: round(slope, 4) });
  }
  const absSlopes = segments.map(s => Math.abs(s.slope)).filter(v => Number.isFinite(v));
  const sorted = [...absSlopes].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const flagged = [];
  for (const seg of segments) {
    if (median > 1e-6 && Math.abs(seg.slope) > 3 * median) {
      flagged.push({ ...seg, medianAbsSlope: round(median), ratio: round(Math.abs(seg.slope) / median, 2) });
    }
  }
  return { label, segments, medianAbsSlope: round(median), flagged };
}

function runContact(loader, tiltYOverride, liftOverride, driveOverride, hitVel, hitSpinSim, hitPoint, gravity, TABLE) {
  const extra = {};
  if (tiltYOverride != null) extra.PUSH_TILT_Y = tiltYOverride;
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES, extra);
  const tech = { ...ext.TECHNIQUES.push };

  // Use deployed lift/drive unless overridden
  const lift = liftOverride != null ? liftOverride : ext.computeAdaptivePushLift(hitVel);
  const drive = driveOverride != null ? driveOverride : ext.computeAdaptivePushDrive(hitVel);
  const tiltY = tiltYOverride != null ? tiltYOverride : loader.evaluateExtractedConstant("PUSH_TILT_Y");

  const planeVel = { x: 0, y: lift, z: -drive };
  const tiltX = 0;
  const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
  const epsilon = ext.dynamicPaddleEpsilon(hitVel, planeVel, racketNormal);
  const blend = ext.PADDLE_BLEND;

  const contactResult = ext.applyPushContact(hitVel, hitSpinSim, racketNormal, planeVel, epsilon, tech, blend);

  // Simulate return path (Group 3: extended tracking)
  const outPath = ext.simulatePath({ ...hitPoint }, contactResult.vel, {
    gravity, spin: contactResult.spin, bounceBoost: tech.bounceBoost || 0,
  });

  // Post-bounce tracking
  const returnBounces = outPath.bounces || [];
  const firstBounce = returnBounces[0] || null;
  const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
  let clearsNet = null;
  if (outPath.netY != null) clearsNet = netClearance >= 0;
  let landing = "no_bounce_recorded";
  let landingX = null, landingZ = null;
  if (firstBounce) {
    landingX = round(firstBounce.x);
    landingZ = round(firstBounce.z);
    if (firstBounce.z < 0) landing = "forward";
    else if (firstBounce.z > 0) landing = "back_own_side";
  }

  // Post-bounce spin (at first bounce point)
  let postBounceSpin = null;
  if (firstBounce && firstBounce.index < outPath.spins.length) {
    const afterIdx = Math.min(firstBounce.index + 1, outPath.spins.length - 1);
    postBounceSpin = {
      topspin: round((outPath.spins[afterIdx].topspin || 0) * SIM_D),
      sidespin: round((outPath.spins[afterIdx].sidespin || 0) * SIM_D),
    };
  }

  // Opponent receive point
  let oppReceive = null;
  try {
    const oppIdx = ext.findPushHitIndex(outPath);
    if (oppIdx != null && oppIdx < outPath.spins.length) {
      oppReceive = {
        index: oppIdx,
        spin: { topspin: round((outPath.spins[oppIdx].topspin || 0) * SIM_D), sidespin: round((outPath.spins[oppIdx].sidespin || 0) * SIM_D) },
        vel: { x: round(outPath.velocities[oppIdx].x), y: round(outPath.velocities[oppIdx].y), z: round(outPath.velocities[oppIdx].z) },
      };
    }
  } catch (e) { /* findPushHitIndex may fail for some trajectories */ }

  const outSpeed = Math.hypot(contactResult.vel.x, contactResult.vel.y, contactResult.vel.z);
  return {
    lift: round(lift), drive: round(drive), tiltY: round(tiltY),
    outTopspin: round((contactResult.spin.topspin || 0) * SIM_D),
    outSidespin: round((contactResult.spin.sidespin || 0) * SIM_D),
    outSpeed: round(outSpeed),
    netClearance: netClearance == null ? null : round(netClearance),
    clearsNet, landing, landingX, landingZ,
    dwellMs: round(contactResult.dwellMs, 3),
    regime: contactResult.regime || null,
    effectiveEpsilon: round(contactResult.effectiveEpsilon, 4),
    postBounceSpin,
    returnBounceCount: returnBounces.length,
    oppReceive,
  };
}

function runPreset(loader, preset, TABLE) {
  const gravity = preset.solve?.gravity ?? -4.2;
  const ext0 = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
  const serve = ext0.simulateServe(preset);
  const hitIndex = ext0.findPushHitIndex(serve);
  const hitPoint = serve.points[hitIndex];
  const hitVel = serve.velocities[hitIndex];
  const hitSpinSim = serve.spins[hitIndex];
  const hitTopspinReal = round((hitSpinSim.topspin || 0) * SIM_D);
  const hitSidespinReal = round((hitSpinSim.sidespin || 0) * SIM_D);
  const deployedLift = ext0.computeAdaptivePushLift(hitVel);
  const deployedDrive = ext0.computeAdaptivePushDrive(hitVel);
  const deployedTiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");

  const ctx = { hitVel, hitSpinSim, hitPoint, gravity, TABLE, deployedLift, deployedDrive, deployedTiltY };

  // ── 2A: tiltY sweep ────────────────────────────────────────────
  process.stderr.write(`  [2A] tiltY sweep\n`);
  const TILTY = linspace(0.3, 2.0, 16);
  const sweep2A = TILTY.map(ty => ({ tiltY: round(ty), ...runContact(loader, ty, null, null, ctx.hitVel, ctx.hitSpinSim, ctx.hitPoint, ctx.gravity, ctx.TABLE) }));
  const sens2A = {
    outTopspin: sensitivityReport(TILTY, sweep2A.map(r => r.outTopspin), "tiltY→outTopspin"),
    outSpeed: sensitivityReport(TILTY, sweep2A.map(r => r.outSpeed), "tiltY→outSpeed"),
    netClearance: sensitivityReport(TILTY, sweep2A.map(r => r.netClearance ?? NaN), "tiltY→netClearance"),
  };

  // ── 2B: lift sweep ─────────────────────────────────────────────
  process.stderr.write(`  [2B] lift sweep\n`);
  const LIFT = linspace(0, 1.5, 15);
  const sweep2B = LIFT.map(l => ({ lift: round(l), ...runContact(loader, null, l, null, ctx.hitVel, ctx.hitSpinSim, ctx.hitPoint, ctx.gravity, ctx.TABLE) }));
  const sens2B = {
    outTopspin: sensitivityReport(LIFT, sweep2B.map(r => r.outTopspin), "lift→outTopspin"),
    outSpeed: sensitivityReport(LIFT, sweep2B.map(r => r.outSpeed), "lift→outSpeed"),
    netClearance: sensitivityReport(LIFT, sweep2B.map(r => r.netClearance ?? NaN), "lift→netClearance"),
  };

  // ── 2C: drive sweep ────────────────────────────────────────────
  process.stderr.write(`  [2C] drive sweep\n`);
  const DRIVE = linspace(0.1, 1.3, 13);
  const sweep2C = DRIVE.map(d => ({ drive: round(d), ...runContact(loader, null, null, d, ctx.hitVel, ctx.hitSpinSim, ctx.hitPoint, ctx.gravity, ctx.TABLE) }));
  const sens2C = {
    outTopspin: sensitivityReport(DRIVE, sweep2C.map(r => r.outTopspin), "drive→outTopspin"),
    outSpeed: sensitivityReport(DRIVE, sweep2C.map(r => r.outSpeed), "drive→outSpeed"),
    netClearance: sensitivityReport(DRIVE, sweep2C.map(r => r.netClearance ?? NaN), "drive→netClearance"),
  };

  // ── 2D: lift × drive 2D feasibility map ────────────────────────
  process.stderr.write(`  [2D] lift × drive 2D grid\n`);
  const LIFT2D = linspace(0, 1.5, 15);
  const DRIVE2D = linspace(0.1, 1.3, 13);
  const grid2D = [];
  for (const l of LIFT2D) {
    for (const d of DRIVE2D) {
      const r = runContact(loader, null, l, d, ctx.hitVel, ctx.hitSpinSim, ctx.hitPoint, ctx.gravity, ctx.TABLE);
      const feasible = r.clearsNet === true && r.landing === "forward";
      const inBounds = r.landingX != null && Math.abs(r.landingX) <= TABLE.width / 2;
      grid2D.push({
        lift: round(l), drive: round(d),
        outTopspin: r.outTopspin, outSpeed: r.outSpeed,
        netClearance: r.netClearance, clearsNet: r.clearsNet,
        landing: r.landing, landingX: r.landingX, landingZ: r.landingZ,
        feasible: feasible && inBounds,
        feasibilityReason: !r.clearsNet ? "net" : r.landing !== "forward" ? "direction" : !inBounds ? "out_of_bounds" : "ok",
        outTopspinSign: Math.sign(r.outTopspin),
        postBounceSpin: r.postBounceSpin,
        oppReceive: r.oppReceive,
      });
    }
  }
  // Extract feasible region bounds
  const feasibleRows = grid2D.filter(r => r.feasible);
  const feasibleBounds = feasibleRows.length > 0 ? {
    liftMin: round(Math.min(...feasibleRows.map(r => r.lift))),
    liftMax: round(Math.max(...feasibleRows.map(r => r.lift))),
    driveMin: round(Math.min(...feasibleRows.map(r => r.drive))),
    driveMax: round(Math.max(...feasibleRows.map(r => r.drive))),
    count: feasibleRows.length,
  } : { count: 0 };

  return {
    presetId: preset.id,
    hitVel: { x: round(hitVel.x), y: round(hitVel.y), z: round(hitVel.z) },
    hitSpin: { topspin: hitTopspinReal, sidespin: hitSidespinReal },
    deployedTiltY, deployedLift: round(deployedLift), deployedDrive: round(deployedDrive),
    sweep2A: { tiltYValues: TILTY.map(round), rows: sweep2A, sensitivity: sens2A },
    sweep2B: { liftValues: LIFT.map(round), rows: sweep2B, sensitivity: sens2B },
    sweep2C: { driveValues: DRIVE.map(round), rows: sweep2C, sensitivity: sens2C },
    sweep2D: { liftValues: LIFT2D.map(round), driveValues: DRIVE2D.map(round), rows: grid2D, feasibleBounds },
  };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];

  const presetIds = [
    "backspin_long_backhand",
    "no_spin_long_forehand",
    "backspin_long_forehand",
  ];

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const TABLE = loader.runtimeExternals.TABLE;

  const allResults = {};
  for (const pid of presetIds) {
    const preset = allPresets.find(p => p.id === pid);
    if (!preset) { process.stderr.write(`[warn] ${pid} not found\n`); continue; }
    process.stderr.write(`[preset] ${pid}\n`);
    allResults[pid] = runPreset(loader, preset, TABLE);
  }

  // Compute intersection of feasible regions (2E)
  process.stderr.write("[2E] feasible region intersection\n");
  const feasibleIntersect = {
    backspin_long_backhand: allResults["backspin_long_backhand"]?.sweep2D.feasibleBounds,
    no_spin_long_forehand: allResults["no_spin_long_forehand"]?.sweep2D.feasibleBounds,
    backspin_long_forehand: allResults["backspin_long_forehand"]?.sweep2D.feasibleBounds,
  };

  const output = {
    generatedAt: new Date().toISOString(),
    tool: "push-tilty-lift-drive-sweep.js",
    note: "All spin in real rad/s (×D=1.528). Bypasses aim solver. Group 3 extensions: post-bounce + opponent receive tracked.",
    presets: allResults,
    feasibleRegionIntersection: feasibleIntersect,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  // Console summary per preset
  for (const pid of presetIds) {
    const r = allResults[pid];
    if (!r) continue;
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Preset: ${pid}`);
    console.log(`  Hit: spin={ts:${r.hitSpin.topspin}, ss:${r.hitSpin.sidespin}} vel=${JSON.stringify(r.hitVel)}`);
    console.log(`  Deployed: tiltY=${r.deployedTiltY} lift=${r.deployedLift} drive=${r.deployedDrive}`);

    console.log(`\n  2A: tiltY sweep (16 pts)`);
    console.table(r.sweep2A.rows.map(row => ({ tiltY: row.tiltY, outTopspin: row.outTopspin, outSpeed: row.outSpeed, netClearance: row.netClearance, clearsNet: row.clearsNet, dwellMs: row.dwellMs, postBounceTS: row.postBounceSpin?.topspin })));
    console.log(`  Flagged (outTopspin):`, r.sweep2A.sensitivity.outTopspin.flagged.length);
    console.log(`  Flagged (netClearance):`, r.sweep2A.sensitivity.netClearance.flagged.length);

    console.log(`\n  2B: lift sweep (15 pts)`);
    console.table(r.sweep2B.rows.map(row => ({ lift: row.lift, outTopspin: row.outTopspin, outSpeed: row.outSpeed, netClearance: row.netClearance, clearsNet: row.clearsNet })));
    console.log(`  Flagged (outTopspin):`, r.sweep2B.sensitivity.outTopspin.flagged.length);

    console.log(`\n  2C: drive sweep (13 pts)`);
    console.table(r.sweep2C.rows.map(row => ({ drive: row.drive, outTopspin: row.outTopspin, outSpeed: row.outSpeed, netClearance: row.netClearance, clearsNet: row.clearsNet })));
    console.log(`  Flagged (outTopspin):`, r.sweep2C.sensitivity.outTopspin.flagged.length);

    console.log(`\n  2D: lift × drive feasibility (${r.sweep2D.rows.length} pts)`);
    console.log(`  Feasible: ${r.sweep2D.feasibleBounds.count} / ${r.sweep2D.rows.length}`);
    console.log(`  Bounds:`, r.sweep2D.feasibleBounds);
    // Show feasibility grid (compact)
    const feasMap = r.sweep2D.rows.map(row => row.feasible ? "✓" : row.feasibilityReason === "net" ? "N" : row.feasibilityReason === "direction" ? "D" : "X");
    let gridStr = "";
    for (let i = 0; i < 15; i++) {
      gridStr += `L${r.sweep2D.liftValues[i].toFixed(1)}: `;
      for (let j = 0; j < 13; j++) {
        gridStr += feasMap[i * 13 + j] + " ";
      }
      gridStr += "\n";
    }
    console.log("  Grid (N=net, D=direction, X=out_of_bounds, ✓=feasible):");
    console.log(gridStr);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("2E: Feasible region intersection:");
  console.table(feasibleIntersect);
  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}