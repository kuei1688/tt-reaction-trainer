#!/usr/bin/env node

// Group 4A/4B/4C: Sidespin cancellation sweep.
// 4A: sidespin × tiltX → outSidespin, landing.x, outTopspin
// 4B: sidespin × planeVel.x → outSidespin, landing.x, outTopspin
// 4C: sidespin × tiltX × planeVel.x → outSidespin, landing.x (3D grid)
//
// All spin values in real rad/s (×D=1.528 for output).
// Uses backspin_long_backhand's hitVel as the incoming ball, with overridden sidespin.
// Read-only research tool.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "sidespin_sweep_2026-07-14_raw.json");

const SIM_D = Math.sqrt(9.8 / 4.2);
const REPRESENTATIVE_PRESET_ID = "backspin_long_backhand";

// Must NOT include PUSH_TILT_Y directly (it's overridden via extraExternals).
// PADDLE_FRICTION included directly (not swept here).
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

let hitVelRef, hitPointRef, gravityRef, deployedTiltY, deployedLift, deployedDrive, TABLERef;

function runContact(loader, sidespinReal, tiltXOverride, planeVelXOverride) {
  const ext = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
  const tech = { ...ext.TECHNIQUES.push };
  const lift = deployedLift;
  const drive = deployedDrive;

  // Build planeVel with optional x override
  const planeVel = { x: planeVelXOverride != null ? planeVelXOverride : 0, y: lift, z: -drive };
  const tiltX = tiltXOverride != null ? tiltXOverride : 0;
  const tiltY = deployedTiltY;
  const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
  const epsilon = ext.dynamicPaddleEpsilon(hitVelRef, planeVel, racketNormal);
  const blend = ext.PADDLE_BLEND;

  // Override the incoming spin: keep topspin from preset, replace sidespin
  // hitSpinRef is sim-scale. Convert target real-scale sidespin to sim-scale.
  const incomingSpin = {
    topspin: hitVelRef._topspinSim || 0, // we'll set this from the preset
    sidespin: sidespinReal / SIM_D, // convert real → sim
  };

  const contactResult = ext.applyPushContact(hitVelRef, incomingSpin, racketNormal, planeVel, epsilon, tech, blend);
  const outPath = ext.simulatePath({ ...hitPointRef }, contactResult.vel, {
    gravity: gravityRef,
    spin: contactResult.spin,
    bounceBoost: tech.bounceBoost || 0,
  });

  const firstBounce = outPath.bounces[0] || null;
  const netClearance = outPath.netY == null ? null : outPath.netY - (TABLERef.height + TABLERef.net);
  let clearsNet = null;
  if (outPath.netY != null) clearsNet = netClearance >= 0;
  let landing = "no_bounce_recorded";
  let landingX = null;
  if (firstBounce) {
    landingX = round(firstBounce.x);
    if (firstBounce.z < 0) landing = "forward";
    else if (firstBounce.z > 0) landing = "back_own_side";
  }

  const outSpeed = Math.hypot(contactResult.vel.x, contactResult.vel.y, contactResult.vel.z);
  return {
    outTopspin: round((contactResult.spin.topspin || 0) * SIM_D),
    outSidespin: round((contactResult.spin.sidespin || 0) * SIM_D),
    outSpeed: round(outSpeed),
    netClearance: netClearance == null ? null : round(netClearance),
    clearsNet,
    landing,
    landingX,
    dwellMs: round(contactResult.dwellMs, 3),
  };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const preset = allPresets.find((p) => p.id === REPRESENTATIVE_PRESET_ID);
  if (!preset) throw new Error(`Preset ${REPRESENTATIVE_PRESET_ID} not found`);

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  TABLERef = loader.runtimeExternals.TABLE;
  const gravity = preset.solve?.gravity ?? -4.2;
  gravityRef = gravity;

  const ext0 = loader.instantiateGame4Symbols(SYMBOL_NAMES, {});
  const serve = ext0.simulateServe(preset);
  const hitIndex = ext0.findPushHitIndex(serve);
  hitPointRef = serve.points[hitIndex];
  hitVelRef = serve.velocities[hitIndex];
  // Store the sim-scale topspin on the hitVel object for later use
  hitVelRef._topspinSim = serve.spins[hitIndex].topspin || 0;
  deployedTiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");
  deployedLift = ext0.computeAdaptivePushLift(hitVelRef);
  deployedDrive = ext0.computeAdaptivePushDrive(hitVelRef);

  process.stderr.write(`[baseline] tiltY=${deployedTiltY} lift=${round(deployedLift)} drive=${round(deployedDrive)}\n`);

  const experiments = {};

  // ── 4A: sidespin × tiltX ───────────────────────────────────────────
  process.stderr.write("[4A] sidespin × tiltX sweep\n");
  const SIDESPIN_4A = linspace(-150, 150, 10);
  const TILTX_4A = linspace(-0.5, 0.5, 10);
  const grid4A = [];
  for (const ss of SIDESPIN_4A) {
    for (const tx of TILTX_4A) {
      grid4A.push({
        sidespin_in: round(ss),
        tiltX: round(tx),
        ...runContact(loader, ss, tx, null),
      });
    }
  }
  // Find cancellation points: outSidespin ≈ 0 AND landingX ≈ 0
  const cancel4A = grid4A
    .filter((r) => Math.abs(r.outSidespin) < 5 && Math.abs(r.landingX || 999) < 0.3)
    .map((r) => ({ sidespin: r.sidespin_in, tiltX: r.tiltX, outSidespin: r.outSidespin, landingX: r.landingX }));
  // Also find just outSidespin ≈ 0
  const zeroSidespin4A = grid4A
    .filter((r) => Math.abs(r.outSidespin) < 3)
    .map((r) => ({ sidespin: r.sidespin_in, tiltX: r.tiltX, outSidespin: r.outSidespin, landingX: r.landingX }));

  experiments["4A_sidespin_tiltX"] = {
    description: "sidespin × tiltX → outSidespin/landing.x/outTopspin",
    fixed: { topspin: -80, tiltY: deployedTiltY, lift: round(deployedLift), drive: round(deployedDrive), planeVelX: 0 },
    grid: { sidespin: SIDESPIN_4A.map(round), tiltX: TILTX_4A.map(round), totalPoints: grid4A.length },
    rows: grid4A,
    cancellationPoints: cancel4A,
    zeroSidespinPoints: zeroSidespin4A,
  };

  // ── 4B: sidespin × planeVel.x ──────────────────────────────────────
  process.stderr.write("[4B] sidespin × planeVel.x sweep\n");
  const SIDESPIN_4B = linspace(-150, 150, 10);
  const PVX_4B = linspace(-3, 3, 10);
  const grid4B = [];
  for (const ss of SIDESPIN_4B) {
    for (const pvx of PVX_4B) {
      grid4B.push({
        sidespin_in: round(ss),
        planeVelX: round(pvx),
        ...runContact(loader, ss, null, pvx),
      });
    }
  }
  const cancel4B = grid4B
    .filter((r) => Math.abs(r.outSidespin) < 5 && Math.abs(r.landingX || 999) < 0.3)
    .map((r) => ({ sidespin: r.sidespin_in, planeVelX: r.planeVelX, outSidespin: r.outSidespin, landingX: r.landingX }));
  const zeroSidespin4B = grid4B
    .filter((r) => Math.abs(r.outSidespin) < 3)
    .map((r) => ({ sidespin: r.sidespin_in, planeVelX: r.planeVelX, outSidespin: r.outSidespin, landingX: r.landingX }));

  experiments["4B_sidespin_planeVelX"] = {
    description: "sidespin × planeVel.x → outSidespin/landing.x/outTopspin",
    fixed: { topspin: -80, tiltY: deployedTiltY, tiltX: 0, lift: round(deployedLift), drive: round(deployedDrive) },
    grid: { sidespin: SIDESPIN_4B.map(round), planeVelX: PVX_4B.map(round), totalPoints: grid4B.length },
    rows: grid4B,
    cancellationPoints: cancel4B,
    zeroSidespinPoints: zeroSidespin4B,
  };

  // ── 4C: sidespin × tiltX × planeVel.x (3D, coarser) ────────────────
  process.stderr.write("[4C] sidespin × tiltX × planeVel.x sweep (3D)\n");
  const SIDESPIN_4C = linspace(-150, 150, 5);
  const TILTX_4C = linspace(-0.3, 0.3, 5);
  const PVX_4C = linspace(-2, 2, 5);
  const grid4C = [];
  for (const ss of SIDESPIN_4C) {
    for (const tx of TILTX_4C) {
      for (const pvx of PVX_4C) {
        grid4C.push({
          sidespin_in: round(ss),
          tiltX: round(tx),
          planeVelX: round(pvx),
          ...runContact(loader, ss, tx, pvx),
        });
      }
    }
  }
  const cancel4C = grid4C
    .filter((r) => Math.abs(r.outSidespin) < 5 && Math.abs(r.landingX || 999) < 0.3)
    .map((r) => ({ sidespin: r.sidespin_in, tiltX: r.tiltX, planeVelX: r.planeVelX, outSidespin: r.outSidespin, landingX: r.landingX }));

  experiments["4C_sidespin_tiltX_planeVelX"] = {
    description: "sidespin × tiltX × planeVel.x → outSidespin/landing.x (3D)",
    fixed: { topspin: -80, tiltY: deployedTiltY, lift: round(deployedLift), drive: round(deployedDrive) },
    grid: { sidespin: SIDESPIN_4C.map(round), tiltX: TILTX_4C.map(round), planeVelX: PVX_4C.map(round), totalPoints: grid4C.length },
    rows: grid4C,
    cancellationPoints: cancel4C,
  };

  // ── Output ─────────────────────────────────────────────────────────
  const output = {
    generatedAt: new Date().toISOString(),
    tool: "sidespin-sweep.js",
    note: "All spin values in real rad/s (×D=1.528). Incoming ball from backspin_long_backhand, sidespin overridden.",
    representativeCase: {
      presetId: REPRESENTATIVE_PRESET_ID,
      hitVel: { x: round(hitVelRef.x), y: round(hitVelRef.y), z: round(hitVelRef.z) },
      hitTopspin: round(hitVelRef._topspinSim * SIM_D),
      deployedTiltY, deployedLift: round(deployedLift), deployedDrive: round(deployedDrive),
    },
    experiments,
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  // Console summary
  console.log("=== 4A: sidespin × tiltX ===");
  console.log(`Grid: ${grid4A.length} points`);
  console.log("Cancellation points (outSidespin≈0 AND landingX≈0):");
  console.table(cancel4A.length > 0 ? cancel4A : "none found");
  console.log("Zero-sidespin points (outSidespin≈0):");
  console.table(zeroSidespin4A.length > 0 ? zeroSidespin4A.slice(0, 15) : "none found");
  // Show a representative slice: sidespin=-80, vary tiltX
  console.log("Slice at sidespin=-80:");
  console.table(grid4A.filter(r => r.sidespin_in === round(SIDESPIN_4C[1])).map(r => ({ tiltX: r.tiltX, outSidespin: r.outSidespin, outTopspin: r.outTopspin, landingX: r.landingX, netClearance: r.netClearance })));

  console.log("\n=== 4B: sidespin × planeVel.x ===");
  console.log(`Grid: ${grid4B.length} points`);
  console.log("Cancellation points:");
  console.table(cancel4B.length > 0 ? cancel4B : "none found");
  console.log("Zero-sidespin points:");
  console.table(zeroSidespin4B.length > 0 ? zeroSidespin4B.slice(0, 15) : "none found");

  console.log("\n=== 4C: sidespin × tiltX × planeVel.x (3D) ===");
  console.log(`Grid: ${grid4C.length} points`);
  console.log("Cancellation points:");
  console.table(cancel4C.length > 0 ? cancel4C : "none found");

  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}