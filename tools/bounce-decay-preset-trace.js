#!/usr/bin/env node

// Group 1C: Two-bounce cumulative spin decay using real preset trajectories.
// Uses loadGame4Physics to run simulateServe → findPushHitIndex → simulatePath,
// tracking spin through the serve trajectory's two table bounces.
// All spin values multiplied by D=1.528 to convert from sim-scale to real rad/s.
//
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "bounce_decay_preset_trace_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2); // 1.5275

const SYMBOL_NAMES = [
  "simulateServe",
  "simulatePath",
  "solveBaseVelocity",
  "solveServeBounceVelocity",
  "solveVelocity",
  "makeServeAimCandidate",
  "getServeLengthProfile",
  "findServeBounceTime",
  "getServeBounces",
  "serveBounceScore",
  "clone",
  "findPushHitIndex",
  "findHitIndex",
  "TECHNIQUES",
  "computeAdaptivePushLift",
  "computeAdaptivePushDrive",
  "computeAdaptivePushTiltX",
  "PADDLE_FRICTION",
  "computeRacketNormal",
  "dynamicPaddleEpsilon",
  "applyPushContact",
  "PADDLE_BLEND",
];

function round(v, digits = 4) {
  if (v == null || Number.isNaN(v)) return null;
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

function toRealSpin(simSpin) {
  return {
    topspin: round((simSpin.topspin || 0) * SIM_D),
    sidespin: round((simSpin.sidespin || 0) * SIM_D),
  };
}

function linspace(lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * i) / (n - 1));
  return out;
}

function sensitivityReport(xs, ys, label) {
  const segments = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    const dy = ys[i + 1] - ys[i];
    const slope = dx !== 0 ? dy / dx : null;
    segments.push({ from: round(xs[i]), to: round(xs[i + 1]), dx: round(dx), dy: round(dy), slope: round(slope, 4) });
  }
  const absSlopes = segments.map((s) => Math.abs(s.slope)).filter((v) => Number.isFinite(v));
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

function tracePreset(loader, preset, initialTopspinScale) {
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
  const gravity = preset.solve?.gravity ?? -4.2;

  // If we're overriding initial spin, we need to modify the preset's hitSpin
  let modifiedPreset = preset;
  if (initialTopspinScale != null) {
    modifiedPreset = JSON.parse(JSON.stringify(preset));
    // Scale the preset's solve spin to create different initial topspin values
    // The preset's spin is in real rad/s in the solve config
    if (modifiedPreset.solve && modifiedPreset.solve.hitSpin) {
      modifiedPreset.solve.hitSpin.topspin = initialTopspinScale;
    }
  }

  const serve = ext.simulateServe(modifiedPreset);

  // Find the push hit index (where the receiver would contact the ball)
  const hitIndex = ext.findPushHitIndex(serve);
  const hitPoint = serve.points[hitIndex];
  const hitVel = serve.velocities[hitIndex];
  const hitSpinSim = serve.spins[hitIndex]; // sim-scale
  const hitSpinReal = toRealSpin(hitSpinSim);

  // Track bounces in the serve trajectory (before the receiver hits)
  const serveBounces = serve.bounces || [];
  const bounceData = serveBounces.map((b, i) => {
    // Get spin just before and after each bounce
    const beforeIdx = b.index > 0 ? b.index - 1 : 0;
    const afterIdx = b.index < serve.spins.length - 1 ? b.index + 1 : b.index;
    const spinBeforeSim = serve.spins[beforeIdx] || hitSpinSim;
    const spinAfterSim = serve.spins[afterIdx] || hitSpinSim;
    const velBefore = serve.velocities[beforeIdx] || hitVel;
    const velAfter = serve.velocities[afterIdx] || hitVel;
    return {
      bounceNumber: i + 1,
      position: { x: round(b.x), y: round(b.y), z: round(b.z) },
      spinBefore: toRealSpin(spinBeforeSim),
      spinAfter: toRealSpin(spinAfterSim),
      velBefore: { x: round(velBefore.x), y: round(velBefore.y), z: round(velBefore.z) },
      velAfter: { x: round(velAfter.x), y: round(velAfter.y), z: round(velAfter.z) },
    };
  });

  // Now simulate the receiver's push return and track the return trajectory
  const tech = { ...ext.TECHNIQUES.push };
  const lift = ext.computeAdaptivePushLift(hitVel);
  const drive = ext.computeAdaptivePushDrive(hitVel);
  const planeVel = { x: 0, y: lift, z: -drive };
  const tiltX = 0;
  const tiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");
  const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
  const epsilon = ext.dynamicPaddleEpsilon(hitVel, planeVel, racketNormal);
  const blend = ext.PADDLE_BLEND;

  const contactResult = ext.applyPushContact(hitVel, hitSpinSim, racketNormal, planeVel, epsilon, tech, blend);

  // Simulate the return path
  const returnPath = ext.simulatePath({ ...hitPoint }, contactResult.vel, {
    gravity,
    spin: contactResult.spin,
    bounceBoost: tech.bounceBoost || 0,
  });

  // Track return bounces
  const returnBounces = returnPath.bounces || [];
  const returnBounceData = returnBounces.map((b, i) => {
    const beforeIdx = b.index > 0 ? b.index - 1 : 0;
    const afterIdx = b.index < returnPath.spins.length - 1 ? b.index + 1 : b.index;
    const spinBeforeSim = returnPath.spins[beforeIdx] || contactResult.spin;
    const spinAfterSim = returnPath.spins[afterIdx] || contactResult.spin;
    const velBefore = returnPath.velocities[beforeIdx] || contactResult.vel;
    const velAfter = returnPath.velocities[afterIdx] || contactResult.vel;
    return {
      bounceNumber: i + 1,
      position: { x: round(b.x), y: round(b.y), z: round(b.z) },
      spinBefore: toRealSpin(spinBeforeSim),
      spinAfter: toRealSpin(spinAfterSim),
      velBefore: { x: round(velBefore.x), y: round(velBefore.y), z: round(velBefore.z) },
      velAfter: { x: round(velAfter.x), y: round(velAfter.y), z: round(velAfter.z) },
    };
  });

  // Find where opponent would receive the return
  const oppHitIndex = ext.findPushHitIndex(returnPath);
  const oppHitSpinSim = returnPath.spins[oppHitIndex] || contactResult.spin;
  const oppHitVel = returnPath.velocities[oppHitIndex] || contactResult.vel;

  return {
    presetId: preset.id,
    hitPoint: { x: round(hitPoint.x), y: round(hitPoint.y), z: round(hitPoint.z) },
    hitVel: { x: round(hitVel.x), y: round(hitVel.y), z: round(hitVel.z) },
    hitSpinReal,
    contactResult: {
      outTopspin: round((contactResult.spin.topspin || 0) * SIM_D),
      outSidespin: round((contactResult.spin.sidespin || 0) * SIM_D),
      outSpeed: round(Math.hypot(contactResult.vel.x, contactResult.vel.y, contactResult.vel.z)),
      dwellMs: round(contactResult.dwellMs, 3),
      regime: contactResult.regime || null,
    },
    serveBounces: bounceData,
    returnBounces: returnBounceData,
    opponentReceive: {
      index: oppHitIndex,
      spinReal: toRealSpin(oppHitSpinSim),
      vel: { x: round(oppHitVel.x), y: round(oppHitVel.y), z: round(oppHitVel.z) },
    },
  };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];

  // Representative presets for the trace
  const presetIds = [
    "backspin_long_backhand",
    "no_spin_long_forehand",
    "backspin_long_forehand",
  ];

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});

  const results = [];
  for (const presetId of presetIds) {
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) {
      process.stderr.write(`[warn] preset ${presetId} not found, skipping\n`);
      continue;
    }
    process.stderr.write(`[trace] ${presetId}\n`);
    const trace = tracePreset(loader, preset, null);
    results.push(trace);

    console.log(`\n=== ${presetId} ===`);
    console.log(`  Hit: spin=${JSON.stringify(trace.hitSpinReal)} vel=${JSON.stringify(trace.hitVel)}`);
    console.log(`  Contact: outTopspin=${trace.contactResult.outTopspin} outSpeed=${trace.contactResult.outSpeed} dwellMs=${trace.contactResult.dwellMs}`);
    console.log(`  Serve bounces: ${trace.serveBounces.length}`);
    for (const b of trace.serveBounces) {
      console.log(`    #${b.bounceNumber}: spin ${JSON.stringify(b.spinBefore)} → ${JSON.stringify(b.spinAfter)}`);
    }
    console.log(`  Return bounces: ${trace.returnBounces.length}`);
    for (const b of trace.returnBounces) {
      console.log(`    #${b.bounceNumber}: spin ${JSON.stringify(b.spinBefore)} → ${JSON.stringify(b.spinAfter)}`);
    }
    console.log(`  Opponent receives: spin=${JSON.stringify(trace.opponentReceive.spinReal)} vel=${JSON.stringify(trace.opponentReceive.vel)}`);
  }

  // Now run the topspin sweep using bounceWithSpinPhysical directly with each preset's bounce velocities.
  // This properly traces two-bounce cumulative spin decay as a function of initial topspin,
  // using the real impact velocities/angles from each preset's serve trajectory.
  const { bounceWithSpinPhysical } = require("./physics-v2-contact-mechanics.js");
  const MU_TABLE = 0.13;
  const TOPSPIN_SWEEP = linspace(-250, 0, 15); // real rad/s, only backspin

  const sweepByPreset = {};
  for (const trace of results) {
    const presetId = trace.presetId;
    process.stderr.write(`[1C-sweep] topspin sweep for ${presetId}\n`);
    // Extract bounce velocities from serve bounces (real scale, multiply by D)
    const bounceVels = trace.serveBounces.map(b => ({
      velBefore: { x: b.velBefore.x * SIM_D, y: b.velBefore.y * SIM_D, z: b.velBefore.z * SIM_D },
    }));

    const rows = [];
    for (const ts of TOPSPIN_SWEEP) {
      let currentSpin = { topspin: ts, sidespin: 0 };
      const bounceResults = [];
      for (const bv of bounceVels) {
        const result = bounceWithSpinPhysical(bv.velBefore, currentSpin, MU_TABLE);
        bounceResults.push({
          topspinAfter: round(result.spin.topspin),
          sidespinAfter: round(result.spin.sidespin),
          epsilon: round(result.epsilon, 4),
          regime: result.regime?.topspin || null,
        });
        currentSpin = result.spin;
      }
      rows.push({
        initialTopspin: round(ts),
        bounce1_topspin: bounceResults[0]?.topspinAfter ?? null,
        bounce1_regime: bounceResults[0]?.regime ?? null,
        bounce2_topspin: bounceResults[1]?.topspinAfter ?? null,
        bounce2_regime: bounceResults[1]?.regime ?? null,
        finalRetention: round(ts !== 0 ? ((bounceResults[bounceResults.length-1]?.topspinAfter ?? 0) / ts) * 100 : null, 2),
      });
    }
    sweepByPreset[presetId] = {
      presetId,
      bounceCount: bounceVels.length,
      topspinValues: TOPSPIN_SWEEP.map(round),
      rows,
      sensitivity: sensitivityReport(TOPSPIN_SWEEP, rows.map(r => r.bounce2_topspin ?? r.bounce1_topspin ?? NaN), `topspin→final_after_2bounces (${presetId})`),
    };
  }

  const tsSensitivity = sweepByPreset["backspin_long_backhand"]?.sensitivity || { flagged: [] };

  const output = {
    generatedAt: new Date().toISOString(),
    tool: "bounce-decay-preset-trace.js",
    note: "All spin values in real rad/s (multiplied by D=1.528). Uses real preset trajectories with two-bounce tracking.",
    simTimeDilation: round(SIM_D, 4),
    presetTraces: results,
    topspinSweepByPreset: sweepByPreset,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  for (const [pid, sweep] of Object.entries(sweepByPreset)) {
    console.log(`\n=== 1C Sweep: topspin → 2-bounce decay (${pid}) ===`);
    console.table(sweep.rows.map(r => ({
      ts_in: r.initialTopspin,
      b1_out: r.bounce1_topspin,
      b1_reg: r.bounce1_regime,
      b2_out: r.bounce2_topspin,
      b2_reg: r.bounce2_regime,
      ret_pct: r.finalRetention,
    })));
    console.log(`Sensitivity flagged jumps (${pid}):`, sweep.sensitivity.flagged);
  }
  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}