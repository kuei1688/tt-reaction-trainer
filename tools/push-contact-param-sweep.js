#!/usr/bin/env node

// Group 6A-6F: Contact model parameter calibration sweep.
// For each untested parameter, sweep ±50% around deployment value and measure
// output spin/speed/netClearance, checking for regime discontinuities.
//
// Parameters swept:
//   6A: TANGENT_KP        [0.5, 1.5]     10 pts
//   6B: PADDLE_BLEND       [0.3, 0.95]    10 pts  (passed directly, not via loader)
//   6C: PADDLE_SPRING_K    [3ms, 7ms]     10 pts  (half-period → springK formula)
//   6D: PADDLE_RESTITUTION_LOW  [0.7, 1.0]   8 pts
//   6E: PADDLE_RESTITUTION_HIGH [0.6, 0.9]   8 pts
//   6F: PADDLE_FRICTION    [0.2, 0.6]     10 pts
//
// Uses backspin_long_backhand + deployed tiltY/lift/drive.
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_contact_param_sweep_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2);
const REPRESENTATIVE_PRESET_ID = "backspin_long_backhand";

// SYMBOL_NAMES: deliberately excludes PADDLE_FRICTION so it can be overridden
// via extraExternals. PADDLE_FRICTION is a transitive dependency of applyPushContact.
// PADDLE_BLEND is included (we override the blend parameter directly, not via loader).
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
  "PADDLE_BLEND",
  "computeRacketNormal",
  "dynamicPaddleEpsilon",
  "applyPushContact",
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

function runOnce(loader, extraExternals, blendOverride) {
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES, extraExternals);
  const tech = { ...ext.TECHNIQUES.push };
  const tiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");
  const lift = ext.computeAdaptivePushLift(hitVelRef);
  const drive = ext.computeAdaptivePushDrive(hitVelRef);
  const planeVel = { x: 0, y: lift, z: -drive };
  const tiltX = 0;
  const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
  const epsilon = ext.dynamicPaddleEpsilon(hitVelRef, planeVel, racketNormal);
  const blend = blendOverride != null ? blendOverride : ext.PADDLE_BLEND;

  const contactResult = ext.applyPushContact(hitVelRef, hitSpinRef, racketNormal, planeVel, epsilon, tech, blend);
  const outPath = ext.simulatePath({ ...hitPointRef }, contactResult.vel, {
    gravity: gravityRef,
    spin: contactResult.spin,
    bounceBoost: tech.bounceBoost || 0,
  });

  const TABLE = loader.runtimeExternals.TABLE;
  const firstBounce = outPath.bounces[0] || null;
  const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
  let clearsNet = null;
  if (outPath.netY != null) clearsNet = netClearance >= 0;
  let landing = "no_bounce_recorded";
  if (firstBounce) {
    if (firstBounce.z < 0) landing = "forward_opponent_side";
    else if (firstBounce.z > 0) landing = "back_on_own_side";
  }

  const outSpeed = Math.hypot(contactResult.vel.x, contactResult.vel.y, contactResult.vel.z);
  return {
    outTopspin: round((contactResult.spin.topspin || 0) * SIM_D),
    outSidespin: round((contactResult.spin.sidespin || 0) * SIM_D),
    outSpeed: round(outSpeed),
    netClearance: netClearance == null ? null : round(netClearance),
    clearsNet,
    landing,
    dwellMs: round(contactResult.dwellMs, 3),
    regime: contactResult.regime || null,
    effectiveEpsilon: round(contactResult.effectiveEpsilon, 4),
  };
}

// Global references set in main()
let hitVelRef, hitSpinRef, hitPointRef, gravityRef;

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const preset = allPresets.find((p) => p.id === REPRESENTATIVE_PRESET_ID);
  if (!preset) throw new Error(`Preset ${REPRESENTATIVE_PRESET_ID} not found`);

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const gravity = preset.solve?.gravity ?? -4.2;

  // Get representative case
  const ext0 = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
  const serve = ext0.simulateServe(preset);
  const hitIndex = ext0.findPushHitIndex(serve);
  hitPointRef = serve.points[hitIndex];
  hitVelRef = serve.velocities[hitIndex];
  hitSpinRef = serve.spins[hitIndex]; // sim-scale
  gravityRef = gravity;
  const deployedTiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");
  const deployedLift = ext0.computeAdaptivePushLift(hitVelRef);
  const deployedDrive = ext0.computeAdaptivePushDrive(hitVelRef);

  process.stderr.write(`[baseline] tiltY=${deployedTiltY} lift=${round(deployedLift)} drive=${round(deployedDrive)}\n`);

  const BALL_MASS = loader.runtimeExternals.BALL_MASS;
  const experiments = {};

  // ── 6A: TANGENT_KP [0.5, 1.5] 10 pts ──────────────────────────────
  process.stderr.write("[6A] TANGENT_KP sweep\n");
  const kpValues = linspace(0.5, 1.5, 10);
  const kpRows = kpValues.map((v) => ({ param: "TANGENT_KP", value: round(v), ...runOnce(loader, { TANGENT_KP: v }, null) }));
  experiments["6A_TANGENT_KP"] = {
    param: "TANGENT_KP", deployed: 1.0, range: [0.5, 1.5], values: kpValues.map(round),
    rows: kpRows,
    sensitivity: {
      outTopspin: sensitivityReport(kpValues, kpRows.map(r => r.outTopspin), "TANGENT_KP→outTopspin"),
      outSpeed: sensitivityReport(kpValues, kpRows.map(r => r.outSpeed), "TANGENT_KP→outSpeed"),
      netClearance: sensitivityReport(kpValues, kpRows.map(r => r.netClearance ?? NaN), "TANGENT_KP→netClearance"),
    },
  };

  // ── 6B: PADDLE_BLEND [0.3, 0.95] 10 pts (passed directly) ─────────
  process.stderr.write("[6B] PADDLE_BLEND sweep\n");
  const blendValues = linspace(0.3, 0.95, 10);
  const blendRows = blendValues.map((v) => ({ param: "PADDLE_BLEND", value: round(v), ...runOnce(loader, {}, round(v, 4)) }));
  experiments["6B_PADDLE_BLEND"] = {
    param: "PADDLE_BLEND", deployed: 0.605, range: [0.3, 0.95], values: blendValues.map(round),
    rows: blendRows,
    sensitivity: {
      outTopspin: sensitivityReport(blendValues, blendRows.map(r => r.outTopspin), "PADDLE_BLEND→outTopspin"),
      outSpeed: sensitivityReport(blendValues, blendRows.map(r => r.outSpeed), "PADDLE_BLEND→outSpeed"),
      netClearance: sensitivityReport(blendValues, blendRows.map(r => r.netClearance ?? NaN), "PADDLE_BLEND→netClearance"),
    },
  };

  // ── 6C: PADDLE_SPRING_K half-period [3ms, 7ms] 10 pts ─────────────
  // PADDLE_SPRING_K = BALL_MASS * (π/T)² where T = half-period in seconds
  process.stderr.write("[6C] PADDLE_SPRING_K (half-period) sweep\n");
  const halfPeriods = linspace(0.003, 0.007, 10);
  const springRows = halfPeriods.map((T) => {
    const springK = BALL_MASS * Math.pow(Math.PI / T, 2);
    return { param: "PADDLE_SPRING_K", halfPeriod_ms: round(T * 1000, 2), springK: round(springK, 2), ...runOnce(loader, { PADDLE_SPRING_K: springK }, null) };
  });
  experiments["6C_PADDLE_SPRING_K"] = {
    param: "PADDLE_SPRING_K", deployed_halfPeriod_ms: 5.0, range_ms: [3, 7], values_ms: halfPeriods.map(v => round(v * 1000, 2)),
    rows: springRows,
    sensitivity: {
      outTopspin: sensitivityReport(halfPeriods, springRows.map(r => r.outTopspin), "halfPeriod→outTopspin"),
      outSpeed: sensitivityReport(halfPeriods, springRows.map(r => r.outSpeed), "halfPeriod→outSpeed"),
      netClearance: sensitivityReport(halfPeriods, springRows.map(r => r.netClearance ?? NaN), "halfPeriod→netClearance"),
    },
  };

  // ── 6D: PADDLE_RESTITUTION_LOW [0.7, 1.0] 8 pts ───────────────────
  process.stderr.write("[6D] PADDLE_RESTITUTION_LOW sweep\n");
  const restLowValues = linspace(0.7, 1.0, 8);
  const restLowRows = restLowValues.map((v) => ({ param: "PADDLE_RESTITUTION_LOW", value: round(v), ...runOnce(loader, { PADDLE_RESTITUTION_LOW: v }, null) }));
  experiments["6D_PADDLE_RESTITUTION_LOW"] = {
    param: "PADDLE_RESTITUTION_LOW", deployed: 0.9, range: [0.7, 1.0], values: restLowValues.map(round),
    rows: restLowRows,
    sensitivity: {
      outTopspin: sensitivityReport(restLowValues, restLowRows.map(r => r.outTopspin), "REST_LOW→outTopspin"),
      outSpeed: sensitivityReport(restLowValues, restLowRows.map(r => r.outSpeed), "REST_LOW→outSpeed"),
      netClearance: sensitivityReport(restLowValues, restLowRows.map(r => r.netClearance ?? NaN), "REST_LOW→netClearance"),
    },
  };

  // ── 6E: PADDLE_RESTITUTION_HIGH [0.6, 0.9] 8 pts ──────────────────
  process.stderr.write("[6E] PADDLE_RESTITUTION_HIGH sweep\n");
  const restHighValues = linspace(0.6, 0.9, 8);
  const restHighRows = restHighValues.map((v) => ({ param: "PADDLE_RESTITUTION_HIGH", value: round(v), ...runOnce(loader, { PADDLE_RESTITUTION_HIGH: v }, null) }));
  experiments["6E_PADDLE_RESTITUTION_HIGH"] = {
    param: "PADDLE_RESTITUTION_HIGH", deployed: 0.75, range: [0.6, 0.9], values: restHighValues.map(round),
    rows: restHighRows,
    sensitivity: {
      outTopspin: sensitivityReport(restHighValues, restHighRows.map(r => r.outTopspin), "REST_HIGH→outTopspin"),
      outSpeed: sensitivityReport(restHighValues, restHighRows.map(r => r.outSpeed), "REST_HIGH→outSpeed"),
      netClearance: sensitivityReport(restHighValues, restHighRows.map(r => r.netClearance ?? NaN), "REST_HIGH→netClearance"),
    },
  };

  // ── 6F: PADDLE_FRICTION [0.2, 0.6] 10 pts ─────────────────────────
  process.stderr.write("[6F] PADDLE_FRICTION sweep\n");
  const frictionValues = linspace(0.2, 0.6, 10);
  const frictionRows = frictionValues.map((v) => ({ param: "PADDLE_FRICTION", value: round(v), ...runOnce(loader, { PADDLE_FRICTION: v }, null) }));
  experiments["6F_PADDLE_FRICTION"] = {
    param: "PADDLE_FRICTION", deployed: 0.4, range: [0.2, 0.6], values: frictionValues.map(round),
    rows: frictionRows,
    sensitivity: {
      outTopspin: sensitivityReport(frictionValues, frictionRows.map(r => r.outTopspin), "FRICTION→outTopspin"),
      outSpeed: sensitivityReport(frictionValues, frictionRows.map(r => r.outSpeed), "FRICTION→outSpeed"),
      netClearance: sensitivityReport(frictionValues, frictionRows.map(r => r.netClearance ?? NaN), "FRICTION→netClearance"),
    },
  };

  // ── Output ─────────────────────────────────────────────────────────
  const output = {
    generatedAt: new Date().toISOString(),
    tool: "push-contact-param-sweep.js",
    note: "All spin values in real rad/s (×D=1.528). Fixed: backspin_long_backhand, deployed tiltY/lift/drive.",
    representativeCase: {
      presetId: REPRESENTATIVE_PRESET_ID,
      hitVel: { x: round(hitVelRef.x), y: round(hitVelRef.y), z: round(hitVelRef.z) },
      hitSpin: { topspin: round(hitSpinRef.topspin * SIM_D), sidespin: round(hitSpinRef.sidespin * SIM_D) },
      deployedTiltY, deployedLift: round(deployedLift), deployedDrive: round(deployedDrive),
    },
    experiments,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  // Console summary
  for (const [expId, exp] of Object.entries(experiments)) {
    console.log(`\n=== ${expId}: ${exp.param} sweep (${exp.range || exp.range_ms}) ===`);
    const valKey = exp.param === "PADDLE_SPRING_K" ? "halfPeriod_ms" : "value";
    console.table(exp.rows.map(r => ({
      [valKey]: r[valKey] ?? r.value,
      outTopspin: r.outTopspin,
      outSpeed: r.outSpeed,
      netClearance: r.netClearance,
      dwellMs: r.dwellMs,
      regime: r.regime,
    })));
    console.log(`Flagged jumps (outTopspin):`, exp.sensitivity.outTopspin.flagged);
    console.log(`Flagged jumps (outSpeed):`, exp.sensitivity.outSpeed.flagged);
    console.log(`Flagged jumps (netClearance):`, exp.sensitivity.netClearance.flagged);
  }

  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}