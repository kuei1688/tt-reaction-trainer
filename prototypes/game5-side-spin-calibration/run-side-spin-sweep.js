#!/usr/bin/env node

// Isolated execution harness for docs/3D_SIDE_SPIN_CALIBRATION_EXECUTION_PLAN.md.
//
// This runner deliberately lives below prototypes/. It reads the current
// Game 5 / shared-core / preset inputs and writes only a dated evidence
// directory. It never writes red-line source or formal data files.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");

const {loadGame4Physics} = require("../../tools/load-game4-physics.js");
const {evaluateServeSuccess, isOnTable} = require("../../tools/serve-success-gate.js");

const ROOT = path.resolve(__dirname, "../..");
const GAME5_FILE = path.join(ROOT, "game5.html");
const CORE_FILE = path.join(ROOT, "shared-physics-core.js");
const PRESETS_FILE = path.join(ROOT, "physics-presets.json");
const PLAN_FILE = path.join(ROOT, "docs", "3D_SIDE_SPIN_CALIBRATION_EXECUTION_PLAN.md");
const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "AI_CONTEXT", `game5_side_spin_calibration_${DATE}`);

const DT = 1 / 120;
const GRAVITY = -4.2;
const SIM_TIME_DILATION = Math.sqrt(9.8 / 4.2);
const OMEGA_UNIT = 125.66;
const TABLE = {width: 1.525, length: 2.74, height: 0.76, top: 0.781, net: 0.1525};
const CALIBRATION_COUNT = 6;
const MAGNUS_COEFFICIENTS = [0, 0.0014, 0.0021, 0.0028, 0.0035, 0.0042];
const OMEGA_MAGNITUDES = [-1.25, -1, -0.5, 0, 0.5, 1, 1.25].map((value) => value * OMEGA_UNIT);
const PUSH_C_VALUES = [0, 1.45, 2.9, 3.4, 3.8, 4.5];
const G7_TECHNIQUE_Y = [0, 0.15, 0.3, 0.45];
const G7_DELAYS = [40, 60, 80, 100];
const G7_TILTX = [-0.25, 0, 0.25];
const SEEDS = {deterministic: 17072026, range: [17072026, 17072027, 17072028, 17072029, 17072030]};

const EXTRACTED_NAMES = [
  "TECHNIQUES", "simulatePath", "findHitIndex", "findPushHitIndex",
  "solveBaseVelocity", "solveServeBounceVelocity", "makeServeAimCandidate",
  "solveVelocity", "getServeLengthProfile", "findServeBounceTime",
  "getServeBounces", "serveBounceScore", "makeRacketReturnVelocity",
  "applyPushContact", "computeRacketNormal", "dynamicPaddleEpsilon",
  "speedScaledTechniqueVel", "computeAdaptivePushLift", "computeAdaptivePushDrive",
  "computeAdaptivePushTiltX", "computeAdaptivePushTiltY", "solveRacketVelXForTargetLandingX",
  "signOf", "DT", "SIM_TIME_DILATION", "PADDLE_BLEND", "PADDLE_FRICTION",
  "SIDESPIN_COMPENSATION_C", "RETURN_TARGET_X", "PUSH_TILT_Y"
];

function parseArgs(argv) {
  const options = {outputDir: DEFAULT_OUTPUT_DIR, groups: "all"};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output-dir") {
      const value = argv[++i];
      if (!value) throw new Error("Missing value for --output-dir");
      options.outputDir = path.isAbsolute(value) ? value : path.resolve(ROOT, value);
    } else if (arg === "--groups") {
      options.groups = argv[++i] || "all";
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node prototypes/game5-side-spin-calibration/run-side-spin-sweep.js [--groups all|g0-g4|g5-g7|g8-g9] [--output-dir <path>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!["all", "g0-g4", "g5-g7", "g8-g9"].includes(options.groups)) {
    throw new Error(`Unsupported groups value: ${options.groups}`);
  }
  return options;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function git(args) {
  const {execFileSync} = require("child_process");
  try {
    return execFileSync("git", args, {cwd: ROOT, encoding: "utf8"}).trim();
  } catch (error) {
    return `error: ${error.message}`;
  }
}

function round(value, digits = 6) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function vec(value) {
  return {x: value?.x || 0, y: value?.y || 0, z: value?.z || 0};
}

function scaleVec(value, factor) {
  return {x: (value?.x || 0) * factor, y: (value?.y || 0) * factor, z: (value?.z || 0) * factor};
}

function scaleSpin(value, factor) {
  return {
    schema: 1,
    omega: scaleVec(value?.omega, factor),
    axialSpin: (value?.axialSpin || 0) * factor
  };
}

function finiteVec(value) {
  return Boolean(value && [value.x, value.y, value.z].every(Number.isFinite));
}

function finiteSpin(value) {
  return Boolean(value && finiteVec(value.omega) && Number.isFinite(value.axialSpin));
}

function loadCore() {
  const source = fs.readFileSync(CORE_FILE, "utf8");
  const names = [
    "AIR_DENSITY", "MAGNUS_LIFT_SLOPE", "MAGNUS_COEFFICIENT", "BALL_RADIUS",
    "BALL_MASS", "CONTACT_FRICTION_MU", "TABLE", "physics3dCopySpin",
    "physics3dResolveOmega", "physics3dMagnusAcceleration", "physics3dAdvanceVelocity",
    "bounceWithSpinPhysical3D"
  ];
  return vm.runInNewContext(`(function(){${source}\nreturn {${names.join(",")}};})()`, {Math, Number, console});
}

function makeAdvance(core, coefficient) {
  return function physics3dAdvanceVelocityOverride(velocity, spin, gravity, dt) {
    const magnus = core.physics3dMagnusAcceleration(velocity, spin, coefficient);
    return {
      x: velocity.x + magnus.x * dt,
      y: velocity.y + ((Number.isFinite(gravity) ? gravity : 0) + magnus.y) * dt,
      z: velocity.z + magnus.z * dt
    };
  };
}

function patchGame5Source(params) {
  let source = fs.readFileSync(GAME5_FILE, "utf8");
  source = source.replace(/let selectedDirectionInput = null;/, "");
  source = source.replace(/\bselectedDirectionInput\b/g, "calibrationDirectionState.value");
  if (params.pushC != null) {
    source = source.replace(/const SIDESPIN_COMPENSATION_C = [^;]+;/, `const SIDESPIN_COMPENSATION_C = ${params.pushC};`);
  }
  if (params.attackSpeedY != null) {
    const pattern = /techniqueVel:\{x:0, y:-0\.234, z:-1\}/g;
    const replacement = `techniqueVel:{x:0, y:${params.attackSpeedY}, z:-1}`;
    const matches = source.match(pattern) || [];
    if (matches.length < 2) throw new Error(`Expected two attack technique velocity entries, found ${matches.length}`);
    source = source.replace(pattern, replacement);
  }
  return source;
}

function createEngine(core, params = {}) {
  const coefficient = params.magnusCoefficient ?? core.MAGNUS_COEFFICIENT;
  const tempFile = path.join(os.tmpdir(), `game5-side-spin-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.html`);
  fs.writeFileSync(tempFile, patchGame5Source(params), "utf8");
  const directionState = {value: null};
  try {
    const loader = loadGame4Physics({sourceFile: tempFile});
    const extracted = loader.instantiateGame4Symbols(EXTRACTED_NAMES, {
      calibrationDirectionState: directionState,
      physics3dAdvanceVelocity: makeAdvance(core, coefficient)
    });
    return {loader, extracted, directionState, coefficient, params};
  } finally {
    try { fs.unlinkSync(tempFile); } catch (_) { /* best effort */ }
  }
}

function nativeSpin(preset) {
  const spin = preset.variation?.spin3d;
  if (spin?.omega) return clone(spin);
  const legacy = preset.variation?.spin || {};
  return {schema: 1, omega: {x: legacy.topspin || 0, y: 0, z: 0}, axialSpin: 0};
}

function makeManifest(presets, hashes) {
  const by = (predicate) => presets.find(predicate);
  const selected = [
    by((p) => p.tags?.videoCategory === "contact_sidebackspin_left" && p.tags?.length === "long" && p.tags?.placement === "forehand"),
    by((p) => p.tags?.videoCategory === "contact_sidebackspin_right" && p.tags?.length === "short" && p.tags?.placement === "backhand"),
    by((p) => p.tags?.videoCategory === "contact_sidespin_left" && p.tags?.length === "long" && p.tags?.placement === "forehand"),
    by((p) => p.tags?.videoCategory === "contact_sidespin_right" && p.tags?.length === "short" && p.tags?.placement === "backhand"),
    by((p) => p.tags?.videoCategory === "contact_backspin" && p.tags?.length === "short" && p.tags?.placement === "backhand"),
    by((p) => p.tags?.videoCategory === "contact_nospin" && p.tags?.length === "long" && p.tags?.placement === "backhand")
  ].filter(Boolean);
  if (selected.length !== CALIBRATION_COUNT) throw new Error(`Could not construct Calibration-6; found ${selected.length}`);
  const calibrationIds = new Set(selected.map((p) => p.id));
  const row = (preset) => ({
    presetId: preset.id,
    videoId: preset.tags?.videoId || null,
    videoCategory: preset.tags?.videoCategory || null,
    spinType: preset.tags?.spinType || null,
    sideName: preset.tags?.sideName || null,
    curveDirection: preset.tags?.curveDirection || null,
    length: preset.tags?.length || null,
    placement: preset.tags?.placement || null,
    start: clone(preset.start),
    originalVariationSpin: clone(preset.variation?.spin || null),
    originalVariationSpin3d: clone(preset.variation?.spin3d || null),
    split: calibrationIds.has(preset.id) ? "Calibration-6" : "Holdout-41"
  });
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    source: {
      plan: path.relative(ROOT, PLAN_FILE).replaceAll(path.sep, "/"),
      game5Sha256: hashes[GAME5_FILE],
      sharedPhysicsCoreSha256: hashes[CORE_FILE],
      presetsSha256: hashes[PRESETS_FILE],
      gitCommit: git(["rev-parse", "HEAD"])
    },
    fixedRules: {
      seed: SEEDS.deterministic,
      dt: DT,
      gravity: GRAVITY,
      simTimeDilation: SIM_TIME_DILATION,
      coefficientValues: MAGNUS_COEFFICIENTS,
      omegaMagnitudeValues: OMEGA_MAGNITUDES,
      calibrationIds: [...calibrationIds],
      holdoutIds: presets.filter((p) => !calibrationIds.has(p.id)).map((p) => p.id)
    },
    presets: presets.map(row)
  };
}

function writeBaselineFiles(outputDir, manifest, hashes) {
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "baseline_config.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceSha256: hashes,
    physics: {
      gravity: GRAVITY,
      dt: DT,
      simTimeDilation: SIM_TIME_DILATION,
      magnusCoefficient: null,
      magnusLiftSlope: null,
      contactFrictionMu: null
    },
    deployedCandidates: {pushCompensationC: 2.9, swingDelayMs: 100},
    redLineFilesModified: false,
    physicalTruthClaim: false
  }, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "git_status.txt"), git(["status", "--short", "--branch"]) + "\n", "utf8");
}

function manifestPresetMap(manifest) {
  return new Map(manifest.presets.map((row) => [row.presetId, row]));
}

function presetById(presets) {
  return new Map(presets.map((preset) => [preset.id, preset]));
}

function makeServeVelocityCache(engine, presets) {
  const cache = new Map();
  for (const preset of presets) cache.set(preset.id, engine.extracted.solveBaseVelocity(preset));
  return cache;
}

function runServe(engine, preset, velocityCache, spinOverride = {}) {
  const realSpin = nativeSpin(preset);
  if (spinOverride.omegaYReal != null) realSpin.omega.y = spinOverride.omegaYReal;
  if (spinOverride.omegaYScale != null) realSpin.omega.y *= spinOverride.omegaYScale;
  const velocity = velocityCache.get(preset.id);
  const pathResult = engine.extracted.simulatePath(preset.start, velocity, {
    gravity: preset.solve?.gravity ?? GRAVITY,
    spin3d: scaleSpin(realSpin, 1 / SIM_TIME_DILATION)
  });
  return {pathResult, realSpin, velocity: clone(velocity)};
}

function trajectoryFrame(pathResult, index) {
  const point = pathResult.points[index];
  const velocity = pathResult.velocities[index];
  const spin = pathResult.spins[index];
  return {
    time: round(index * DT, 9),
    position: vec(point),
    velocitySim: vec(velocity),
    velocityReal: scaleVec(velocity, SIM_TIME_DILATION),
    omegaSim: vec(spin?.omega),
    omegaReal: scaleVec(spin?.omega, SIM_TIME_DILATION),
    axialSpinSim: spin?.axialSpin || 0,
    axialSpinReal: (spin?.axialSpin || 0) * SIM_TIME_DILATION
  };
}

function serializeTrajectory(pathResult) {
  return (pathResult.points || []).map((_, index) => trajectoryFrame(pathResult, index));
}

function interpolate(a, b, ratio) {
  return a + (b - a) * ratio;
}

function interpolateFrame(a, b, ratio) {
  return {
    time: interpolate(a.time, b.time, ratio),
    position: {
      x: interpolate(a.position.x, b.position.x, ratio),
      y: interpolate(a.position.y, b.position.y, ratio),
      z: interpolate(a.position.z, b.position.z, ratio)
    },
    velocityReal: {
      x: interpolate(a.velocityReal.x, b.velocityReal.x, ratio),
      y: interpolate(a.velocityReal.y, b.velocityReal.y, ratio),
      z: interpolate(a.velocityReal.z, b.velocityReal.z, ratio)
    },
    omegaReal: {
      x: interpolate(a.omegaReal.x, b.omegaReal.x, ratio),
      y: interpolate(a.omegaReal.y, b.omegaReal.y, ratio),
      z: interpolate(a.omegaReal.z, b.omegaReal.z, ratio)
    },
    axialSpinReal: interpolate(a.axialSpinReal, b.axialSpinReal, ratio)
  };
}

function findNetFrame(pathResult, trajectory) {
  for (let i = 1; i < trajectory.length; i += 1) {
    const previous = trajectory[i - 1].position.z;
    const current = trajectory[i].position.z;
    if ((previous < 0 && current >= 0) || (previous > 0 && current <= 0)) {
      const ratio = (0 - previous) / (current - previous || 1);
      return interpolateFrame(trajectory[i - 1], trajectory[i], ratio);
    }
  }
  if (pathResult.netY != null) {
    const nearest = trajectory.reduce((best, frame) =>
      Math.abs(frame.position.z) < Math.abs(best.position.z) ? frame : best, trajectory[0]);
    return {...nearest, position: {...nearest.position, y: pathResult.netY, z: 0}};
  }
  return null;
}

function bounceFrame(pathResult, trajectory, bounce) {
  const index = Math.max(0, Math.min(trajectory.length - 1, bounce.index || 0));
  const before = trajectory[index];
  const after = trajectory[Math.min(trajectory.length - 1, index + 1)];
  return {
    position: {x: bounce.x, y: bounce.y, z: bounce.z},
    time: bounce.t ?? before.time,
    before,
    after,
    omegaYIn: before.omegaReal.y,
    omegaYOut: after.omegaReal.y,
    retentionY: Math.abs(before.omegaReal.y) < 1e-9 ? null : after.omegaReal.y / before.omegaReal.y
  };
}

function finiteTrajectory(trajectory) {
  return trajectory.every((frame) =>
    finiteVec(frame.position) && finiteVec(frame.velocityReal) && finiteVec(frame.omegaReal) &&
    Number.isFinite(frame.axialSpinReal) && Number.isFinite(frame.time));
}

function flightSummary(preset, pathResult, trajectory, realSpin) {
  const net = findNetFrame(pathResult, trajectory);
  const bounces = (pathResult.bounces || []).map((bounce) => bounceFrame(pathResult, trajectory, bounce));
  const firstBounce = bounces.find((bounce) => bounce.position.z < 0) || null;
  const secondBounce = bounces.find((bounce) => bounce.position.z > 0) || null;
  const gate = evaluateServeSuccess(pathResult, TABLE);
  const deltaX = (point) => point ? point.position.x - preset.start.x : null;
  const allX = trajectory.map((frame) => frame.position.x - preset.start.x);
  const finite = finiteTrajectory(trajectory);
  const netClearance = net ? net.position.y - (TABLE.height + TABLE.net) : null;
  const lateralSigns = [];
  for (let i = 1; i < trajectory.length; i += 1) {
    const dz = trajectory[i].position.z - trajectory[i - 1].position.z;
    const dx = trajectory[i].position.x - trajectory[i - 1].position.x;
    if (Math.abs(dz) > 1e-9 && Math.abs(dx) > 1e-9) lateralSigns.push(Math.sign(dx / dz));
  }
  const nonFinite = !finite || !Number.isFinite(pathResult.netY ?? 0) ||
    (pathResult.bounces || []).some((bounce) => ![bounce.x, bounce.y, bounce.z, bounce.t].every(Number.isFinite));
  return {
    presetId: preset.id,
    sideName: preset.tags?.sideName || null,
    curveDirection: preset.tags?.curveDirection || null,
    inputOmega: clone(realSpin.omega),
    net: net ? {
      position: net.position,
      velocity: net.velocityReal,
      omega: net.omegaReal,
      axialSpin: net.axialSpinReal,
      netClearance
    } : null,
    netClearance,
    firstBounce,
    secondBounce,
    bounces,
    deltaXAtNet: net ? deltaX(net) : null,
    deltaXAtFirstBounce: firstBounce ? deltaX(firstBounce) : null,
    deltaXAtSecondBounce: secondBounce ? deltaX(secondBounce) : null,
    maxAbsLateralOffset: allX.length ? Math.max(...allX.map(Math.abs)) : null,
    curveMonotonicSign: lateralSigns.length && lateralSigns.every((value) => value === lateralSigns[0]) ? lateralSigns[0] : null,
    curveDirectionObserved: net && Math.abs(net.position.x - preset.start.x) > 1e-8
      ? (net.position.x > preset.start.x ? "right" : "left") : "none",
    legalServe: gate,
    finite,
    nonFinite,
    netHit: Boolean(pathResult.netHit),
    pointCount: trajectory.length,
    trajectory
  };
}

function baseServeRow(groupId, engine, preset, velocityCache, spinOverride = {}, extra = {}) {
  const serve = runServe(engine, preset, velocityCache, spinOverride);
  return {
    runId: `${groupId}:${preset.id}:${extra.variant || "baseline"}`,
    groupId,
    seed: SEEDS.deterministic,
    sourceSha: null,
    presetId: preset.id,
    videoId: preset.tags?.videoId || null,
    sideName: preset.tags?.sideName || null,
    curveDirection: preset.tags?.curveDirection || null,
    length: preset.tags?.length || null,
    placement: preset.tags?.placement || null,
    omega: clone(serve.realSpin.omega),
    axialSpin: serve.realSpin.axialSpin,
    magnusCoefficient: engine.coefficient,
    magnusLiftSlope: null,
    gravity: preset.solve?.gravity ?? GRAVITY,
    dt: DT,
    simTimeDilation: SIM_TIME_DILATION,
    technique: extra.technique || "control",
    swingDelayMs: extra.swingDelayMs ?? 0,
    tiltX: extra.tiltX ?? 0,
    tiltY: extra.tiltY ?? 0,
    planeVel: extra.planeVel || {x: 0, y: 0, z: 0},
    directionInput: extra.directionInput ?? null,
    aimedSign: extra.aimedSign ?? null,
    compensationX: extra.compensationX ?? null,
    variant: extra.variant || "baseline",
    ...flightSummary(preset, serve.pathResult, serializeTrajectory(serve.pathResult), serve.realSpin)
  };
}

function syntheticTrace(core, omegaY, coefficient) {
  const start = {x: 0, y: 0.95, z: -1.52};
  let position = {...start};
  let velocity = {x: 0, y: 0.8, z: 5};
  const spin = {schema: 1, omega: {x: 0, y: omegaY, z: 0}, axialSpin: 0};
  const trajectory = [];
  for (let i = 0; i < 180; i += 1) {
    trajectory.push({
      time: round(i * DT, 9),
      position: {...position},
      velocitySim: {...velocity},
      velocityReal: {...velocity},
      omegaSim: {...spin.omega},
      omegaReal: {...spin.omega},
      axialSpinSim: 0,
      axialSpinReal: 0
    });
    velocity = core.physics3dAdvanceVelocity(velocity, spin, GRAVITY, DT, coefficient);
    position = {
      x: position.x + velocity.x * DT,
      y: position.y + velocity.y * DT,
      z: position.z + velocity.z * DT
    };
    if (position.z >= 0) break;
  }
  const acceleration = core.physics3dMagnusAcceleration({x: 0, y: 0, z: 5}, spin, coefficient);
  const first = trajectory[0];
  const last = trajectory[trajectory.length - 1];
  return {
    omegaY,
    magnusCoefficient: coefficient,
    acceleration,
    trajectory,
    deltaXAtNet: last.position.x - first.position.x,
    finite: finiteTrajectory(trajectory)
  };
}

function runG0(core) {
  const rows = [-150, -75, 0, 75, 150].map((omegaY) => syntheticTrace(core, omegaY, core.MAGNUS_COEFFICIENT));
  const positive = rows.find((row) => row.omegaY > 0);
  const negative = rows.find((row) => row.omegaY < 0);
  return {
    groupId: "G0",
    input: {omegaY: [-150, -75, 0, 75, 150], velocity: {x: 0, y: 0.8, z: 5}, axialSpin: 0},
    rows,
    checks: {
      finite: rows.every((row) => row.finite),
      positiveAccelerationX: positive.acceleration.x > 0,
      negativeAccelerationX: negative.acceleration.x < 0,
      positiveNegativeDeltaOppose: positive.deltaXAtNet > 0 && negative.deltaXAtNet < 0,
      zeroNoCurve: Math.abs(rows.find((row) => row.omegaY === 0).deltaXAtNet) < 1e-12,
      axialSeparated: (() => {
        const axial = core.physics3dMagnusAcceleration({x: 0, y: 0, z: 5}, {schema: 1, omega: {x: 0, y: 0, z: 0}, axialSpin: 125.66}, core.MAGNUS_COEFFICIENT);
        return Math.abs(axial.x) < 1e-12 && Math.abs(axial.y) < 1e-12 && Math.abs(axial.z) < 1e-12;
      })()
    }
  };
}

function metricSignature(row) {
  return {
    legal: row.legalServe?.pass || false,
    netClearance: row.netClearance,
    firstLandingX: row.firstBounce?.position?.x ?? null,
    secondLandingX: row.secondBounce?.position?.x ?? null,
    firstLandingZ: row.firstBounce?.position?.z ?? null,
    secondLandingZ: row.secondBounce?.position?.z ?? null,
    outcome: row.outcome || null,
    success: row.success ?? null,
    landingX: row.landingX ?? null,
    outOmegaY: row.outOmegaY ?? null,
    inOmegaY: row.inOmegaY ?? null,
    retentionY: row.retentionY ?? null,
    fallbackSolver: row.fallbackSolver ?? null
  };
}

function summarizeGroup(groupId, rows, extras = {}) {
  const finite = rows.filter((row) => row.finite !== false && row.nonFinite !== true).length;
  const hasLegalField = rows.some((row) => row.legalServe || row.serveLegal);
  const legal = hasLegalField ? rows.filter((row) => (row.legalServe || row.serveLegal)?.pass).length : null;
  return {
    groupId,
    rows: rows.length,
    finite,
    nonfinite: rows.length - finite,
    legal,
    legalRate: hasLegalField && rows.length ? legal / rows.length : null,
    netClearanceP10: percentile(rows.map((row) => row.netClearance).filter(Number.isFinite), 0.1),
    medianLandingError: median(rows.map((row) => row.landingError).filter(Number.isFinite)),
    ...extras
  };
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function median(values) {
  return percentile(values, 0.5);
}

function directionClass(direction, correctDirection) {
  if (!correctDirection) return "not_applicable";
  if (direction == null) return "none";
  return direction === correctDirection ? "correct" : "wrong";
}

function returnOutcome(pathResult) {
  const first = pathResult.bounces?.find((bounce) => bounce.z < 0) || null;
  const netHit = Boolean(pathResult.netHit);
  if (netHit) return {outcome: "net", success: false, firstBounce: first};
  if (!first) return {outcome: "no_landing", success: false, firstBounce: null};
  if (!isOnTable(first, TABLE)) return {outcome: "out", success: false, firstBounce: first};
  return {outcome: "success", success: true, firstBounce: first};
}

function makeReturnInputs(engine, incomingVel, incomingSpin, hitPoint, techniqueKey, pushC, tiltX = 0) {
  const tech = clone(engine.extracted.TECHNIQUES[techniqueKey]);
  let techVel = engine.extracted.speedScaledTechniqueVel(incomingVel, tech);
  if (tech.adaptivePush) {
    const lift = engine.extracted.computeAdaptivePushLift(incomingVel);
    const drive = engine.extracted.computeAdaptivePushDrive(incomingVel);
    techVel = {x: 0, y: lift, z: -drive};
    tech.swingDirection = techVel;
  }
  const swingDirRef = tech.adaptivePush ? tech.swingDirection : techVel;
  const appliedTiltX = tech.adaptivePush ? tiltX : (tech.racketNormalTiltX || 0) + tiltX;
  const tiltY = tech.adaptivePush ? engine.extracted.computeAdaptivePushTiltY() : tech.racketNormalTiltY;
  const racketNormal = engine.extracted.computeRacketNormal(tiltY, appliedTiltX, swingDirRef);
  const epsilon = engine.extracted.dynamicPaddleEpsilon(incomingVel, techVel, racketNormal);
  const blend = tech.model === "push" ? engine.extracted.PADDLE_BLEND : 0;
  const aimedX = engine.extracted.solveRacketVelXForTargetLandingX(
    incomingVel, incomingSpin, racketNormal, techVel, epsilon,
    engine.extracted.PADDLE_FRICTION, hitPoint, GRAVITY,
    engine.extracted.RETURN_TARGET_X, blend, tech
  );
  const aimedSign = engine.extracted.signOf(aimedX);
  const compensationX = tech.model === "push" ? 0 : 0;
  return {tech, techVel, racketNormal, epsilon, blend, aimedX, aimedSign, compensationX, tiltX: appliedTiltX, tiltY};
}

function runReturnCase(engine, preset, velocityCache, options) {
  const serve = runServe(engine, preset, velocityCache, {omegaYReal: options.omegaYReal, omegaYScale: options.omegaYScale});
  const serveTrajectory = serializeTrajectory(serve.pathResult);
  const hitIndexBase = options.technique === "push"
    ? engine.extracted.findPushHitIndex(serve.pathResult)
    : engine.extracted.findHitIndex(serve.pathResult);
  const delayFrames = Math.max(0, Math.round((options.swingDelayMs || 0) / 1000 / DT));
  const hitIndex = Math.min(serve.pathResult.points.length - 1, hitIndexBase + delayFrames);
  const hitPoint = serve.pathResult.points[hitIndex];
  const hitVel = serve.pathResult.velocities[hitIndex];
  const hitSpin = serve.pathResult.spins[hitIndex];
  const side = hitPoint?.x < 0 ? "backhand" : "forehand";
  const techniqueKey = options.technique === "attack" ? `${side}_attack` : "push";
  const inputs = makeReturnInputs(engine, hitVel, hitSpin, hitPoint, techniqueKey, options.pushC, options.tiltX || 0);
  engine.directionState.value = options.directionInput ?? null;
  const returnHit = engine.extracted.makeRacketReturnVelocity(
    hitVel, hitSpin, inputs.tech, hitPoint, preset.solve?.gravity ?? GRAVITY
  );
  const returnPath = engine.extracted.simulatePath(hitPoint, returnHit.vel, {
    gravity: preset.solve?.gravity ?? GRAVITY,
    spin: returnHit.spin,
    bounceBoost: 0
  });
  const returnTrajectory = serializeTrajectory(returnPath);
  const outcome = returnOutcome(returnPath);
  const first = outcome.firstBounce;
  const net = findNetFrame(returnPath, returnTrajectory);
  const realOutSpin = returnHit.spin?.omega ? scaleSpin(returnHit.spin, SIM_TIME_DILATION) : null;
  const correctDirection = inputs.aimedSign < 0 ? "left" : inputs.aimedSign > 0 ? "right" : null;
  const planeVel = {
    x: options.technique === "push" && options.directionInput && inputs.aimedSign !== 0
      ? (options.directionInput === (inputs.aimedSign < 0 ? "left" : "right") ? 1 : -1) * options.pushC
      : 0,
    y: inputs.techVel.y,
    z: inputs.techVel.z
  };
  return {
    runId: `${options.groupId}:${preset.id}:${options.variant || "return"}:${options.directionInput || "none"}`,
    groupId: options.groupId,
    seed: SEEDS.deterministic,
    presetId: preset.id,
    videoId: preset.tags?.videoId || null,
    sideName: preset.tags?.sideName || null,
    curveDirection: preset.tags?.curveDirection || null,
    length: preset.tags?.length || null,
    placement: preset.tags?.placement || null,
    sourceSha: null,
    omega: clone(serve.realSpin.omega),
    axialSpin: serve.realSpin.axialSpin,
    magnusCoefficient: engine.coefficient,
    magnusLiftSlope: null,
    gravity: preset.solve?.gravity ?? GRAVITY,
    dt: DT,
    simTimeDilation: SIM_TIME_DILATION,
    technique: options.technique,
    swingDelayMs: options.swingDelayMs || 0,
    tiltX: options.tiltX || 0,
    tiltY: inputs.tiltY,
    planeVel,
    planeVelReal: scaleVec(planeVel, SIM_TIME_DILATION),
    racketNormal: inputs.racketNormal,
    blend: inputs.blend,
    directionInput: options.directionInput ?? null,
    aimedSign: inputs.aimedSign,
    aimedX: inputs.aimedX,
    compensationX: planeVel.x,
    correctDirection,
    directionClass: directionClass(options.directionInput ?? null, correctDirection),
    fallbackSolver: null,
    inOmegaY: hitSpin?.omega?.y * SIM_TIME_DILATION,
    outOmegaY: realOutSpin?.omega?.y ?? null,
    retentionY: hitSpin?.omega?.y ? (realOutSpin?.omega?.y ?? 0) / (hitSpin.omega.y * SIM_TIME_DILATION) : null,
    hitIndexBase,
    hitIndex,
    hitPoint,
    hitVelocitySim: hitVel,
    hitVelocityReal: scaleVec(hitVel, SIM_TIME_DILATION),
    hitOmegaReal: scaleVec(hitSpin?.omega, SIM_TIME_DILATION),
    returnVelocitySim: returnHit.vel,
    returnVelocityReal: scaleVec(returnHit.vel, SIM_TIME_DILATION),
    returnSpinReal: realOutSpin,
    netClearance: net ? net.position.y - (TABLE.height + TABLE.net) : null,
    landingX: first?.x ?? null,
    landingZ: first?.z ?? null,
    landingError: first ? Math.abs(first.x) : null,
    outcome: outcome.outcome,
    success: outcome.success,
    serveLegal: evaluateServeSuccess(serve.pathResult, TABLE),
    serveNetClearance: serve.pathResult.netY == null ? null : serve.pathResult.netY - (TABLE.height + TABLE.net),
    serveFirstBounce: serve.pathResult.bounces?.find((bounce) => bounce.z < 0) || null,
    serveSecondBounce: serve.pathResult.bounces?.find((bounce) => bounce.z > 0) || null,
    finite: finiteTrajectory(serveTrajectory) && finiteTrajectory(returnTrajectory),
    nonFinite: !finiteTrajectory(serveTrajectory) || !finiteTrajectory(returnTrajectory),
    trajectory: returnTrajectory,
    serveTrajectory
  };
}

function rowsBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = typeof key === "function" ? key(row) : row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function annotateRelative(rows, zeroRows) {
  const zeroBy = new Map(zeroRows.map((row) => [`${row.presetId}|${row.magnusCoefficient}`, row]));
  return rows.map((row) => {
    const zero = zeroBy.get(`${row.presetId}|${row.magnusCoefficient}`);
    return {
      ...row,
      deltaXAtNetRelativeToZero: zero && row.deltaXAtNet != null && zero.deltaXAtNet != null ? row.deltaXAtNet - zero.deltaXAtNet : null,
      deltaXAtFirstBounceRelativeToZero: zero && row.deltaXAtFirstBounce != null && zero.deltaXAtFirstBounce != null ? row.deltaXAtFirstBounce - zero.deltaXAtFirstBounce : null,
      deltaXAtSecondBounceRelativeToZero: zero && row.deltaXAtSecondBounce != null && zero.deltaXAtSecondBounce != null ? row.deltaXAtSecondBounce - zero.deltaXAtSecondBounce : null
    };
  });
}

function groupPass(rows) {
  return rows.every((row) => row.finite && !row.nonFinite && !row.netHit);
}

function runG1(engine, presets, velocityCache) {
  const rows = presets.map((preset) => baseServeRow("G1", engine, preset, velocityCache));
  return {groupId: "G1", rows, summary: summarizeGroup("G1", rows, {all47: rows.length === 47, gatePass: rows.every((row) => row.legalServe.pass)})};
}

function runG2(engine, presets, calibrationPresets, velocityCache) {
  const rows = [];
  for (const preset of calibrationPresets) {
    for (const omegaY of OMEGA_MAGNITUDES) {
      rows.push(baseServeRow("G2", engine, preset, velocityCache, {omegaYReal: omegaY}, {variant: `omegaY-${omegaY}`}));
    }
  }
  const zeros = rows.filter((row) => row.omega.y === 0);
  const annotated = annotateRelative(rows, zeros);
  const byPreset = rowsBy(annotated, "presetId");
  const monotonic = [...byPreset.values()].every((group) => {
    const ordered = group.filter((row) => row.deltaXAtNetRelativeToZero != null).sort((a, b) => a.omega.y - b.omega.y);
    return ordered.every((row, index) => index === 0 || row.deltaXAtNetRelativeToZero >= ordered[index - 1].deltaXAtNetRelativeToZero - 1e-8);
  });
  return {groupId: "G2", rows: annotated, summary: summarizeGroup("G2", annotated, {monotonicMagnitude: monotonic, zeroDriftP95: percentile(zeros.map((row) => Math.abs(row.deltaXAtNet || 0)), 0.95)})};
}

function runG3(engineFactory, calibrationPresets, velocityCache, currentCoefficient) {
  const rows = [];
  const coefficients = [...new Set([...MAGNUS_COEFFICIENTS, currentCoefficient])].sort((a, b) => a - b);
  for (const coefficient of coefficients) {
    const engine = engineFactory({magnusCoefficient: coefficient});
    for (const preset of calibrationPresets) {
      rows.push(baseServeRow("G3", engine, preset, velocityCache, {omegaYReal: (nativeSpin(preset).omega.y || OMEGA_UNIT)}, {variant: `C-${coefficient}`, magnusCoefficient: coefficient}));
    }
  }
  const byCoefficient = rowsBy(rows, "magnusCoefficient");
  const coefficientSummary = [...byCoefficient.entries()].map(([coefficient, group]) => ({
    coefficient: Number(coefficient),
    legalRate: group.filter((row) => row.legalServe.pass).length / group.length,
    finite: group.every((row) => row.finite),
    meanDeltaXAtNet: mean(group.map((row) => row.deltaXAtNet).filter(Number.isFinite)),
    p10NetClearance: percentile(group.map((row) => row.netClearance).filter(Number.isFinite), 0.1),
    hardStop: group.some((row) => row.nonFinite || row.netHit)
  })).sort((a, b) => a.coefficient - b.coefficient);
  return {groupId: "G3", rows, coefficientSummary, summary: summarizeGroup("G3", rows, {coefficientSummary})};
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function runG4(core, engine, presets, velocityCache) {
  const rows = [];
  for (const preset of presets) {
    const serve = runServe(engine, preset, velocityCache);
    const trajectory = serializeTrajectory(serve.pathResult);
    const bounces = (serve.pathResult.bounces || []).map((bounce) => bounceFrame(serve.pathResult, trajectory, bounce));
    for (const bounce of bounces) {
      const beforeVelocity = bounce.before.velocityReal;
      const beforeSpin = {schema: 1, omega: bounce.before.omegaReal, axialSpin: bounce.before.axialSpinReal};
      const direct = core.bounceWithSpinPhysical3D(beforeVelocity, beforeSpin, core.CONTACT_FRICTION_MU);
      rows.push({
        runId: `G4:${preset.id}:bounce-${bounce.time}`,
        groupId: "G4",
        seed: SEEDS.deterministic,
        presetId: preset.id,
        sideName: preset.tags?.sideName || null,
        curveDirection: preset.tags?.curveDirection || null,
        bounceTime: bounce.time,
        bouncePosition: bounce.position,
        velocityBefore: beforeVelocity,
        velocityAfter: direct.vel,
        omegaBefore: beforeSpin.omega,
        omegaAfter: direct.spin3d.omega,
        axialSpinBefore: beforeSpin.axialSpin,
        axialSpinAfter: direct.spin3d.axialSpin,
        retentionY: Math.abs(beforeSpin.omega.y) < 1e-9 ? null : direct.spin3d.omega.y / beforeSpin.omega.y,
        epsilon: direct.epsilon,
        regime: direct.regime,
        finite: finiteVec(direct.vel) && finiteSpin(direct.spin3d),
        lateralAfterBounce: syntheticPostBounceCurve(core, direct.vel, direct.spin3d),
        trajectory
      });
    }
  }
  const spinYCarry = rows.every((row) => Math.abs(row.omegaAfter.y - row.omegaBefore.y) < 1e-9);
  const finite = rows.every((row) => row.finite);
  return {groupId: "G4", rows, summary: summarizeGroup("G4", rows, {spinYCarry, finite})};
}

function syntheticPostBounceCurve(core, velocity, spin) {
  let v = {...velocity};
  let x = 0;
  for (let i = 0; i < 24; i += 1) {
    v = core.physics3dAdvanceVelocity(v, spin, GRAVITY, DT);
    x += v.x * DT;
  }
  return {deltaX24Frames: x, finite: finiteVec(v) && Number.isFinite(x)};
}

function runG5(engine, calibrationPresets, velocityCache) {
  const rows = [];
  const omegaValues = [-OMEGA_UNIT, 0, OMEGA_UNIT];
  const tiltValues = [-0.25, 0, 0.25];
  const planeValues = [-2.9, 0, 2.9];
  for (const preset of calibrationPresets) {
    for (const omegaYReal of omegaValues) for (const tiltX of tiltValues) for (const planeVelX of planeValues) {
      const serve = runServe(engine, preset, velocityCache, {omegaYReal});
      const trajectory = serializeTrajectory(serve.pathResult);
      const hitIndex = engine.extracted.findPushHitIndex(serve.pathResult);
      const hitPoint = serve.pathResult.points[hitIndex];
      const hitVel = serve.pathResult.velocities[hitIndex];
      const hitSpin = serve.pathResult.spins[hitIndex];
      const tech = clone(engine.extracted.TECHNIQUES.push);
      const techVel = {x: 0, y: engine.extracted.computeAdaptivePushLift(hitVel), z: -engine.extracted.computeAdaptivePushDrive(hitVel)};
      const racketNormal = engine.extracted.computeRacketNormal(engine.extracted.computeAdaptivePushTiltY(), tiltX, techVel);
      const epsilon = engine.extracted.dynamicPaddleEpsilon(hitVel, techVel, racketNormal);
      const planeVel = {x: planeVelX, y: techVel.y, z: techVel.z};
      const contact = engine.extracted.applyPushContact(hitVel, hitSpin, racketNormal, planeVel, epsilon, tech, engine.extracted.PADDLE_BLEND);
      const outPath = engine.extracted.simulatePath(hitPoint, contact.vel, {gravity: GRAVITY, spin: contact.spin});
      const outTrajectory = serializeTrajectory(outPath);
      const out = returnOutcome(outPath);
      const outSpin = contact.spin?.omega ? scaleSpin(contact.spin, SIM_TIME_DILATION) : null;
      const net = findNetFrame(outPath, outTrajectory);
      rows.push({
        runId: `G5:${preset.id}:y${omegaYReal}:t${tiltX}:x${planeVelX}`,
        groupId: "G5",
        seed: SEEDS.deterministic,
        presetId: preset.id,
        sideName: preset.tags?.sideName || null,
        curveDirection: preset.tags?.curveDirection || null,
        omega: {x: hitSpin.omega.x * SIM_TIME_DILATION, y: omegaYReal, z: hitSpin.omega.z * SIM_TIME_DILATION},
        axialSpin: (hitSpin.axialSpin || 0) * SIM_TIME_DILATION,
        magnusCoefficient: engine.coefficient,
        gravity: GRAVITY,
        dt: DT,
        simTimeDilation: SIM_TIME_DILATION,
        technique: "push",
        swingDelayMs: 0,
        tiltX,
        tiltY: engine.extracted.computeAdaptivePushTiltY(),
        planeVel,
        planeVelReal: scaleVec(planeVel, SIM_TIME_DILATION),
        racketNormal,
        blend: engine.extracted.PADDLE_BLEND,
        directionInput: null,
        aimedSign: null,
        compensationX: planeVelX,
        hitIndex,
        hitPoint,
        hitVelocityReal: scaleVec(hitVel, SIM_TIME_DILATION),
        outVelocityReal: scaleVec(contact.vel, SIM_TIME_DILATION),
        inOmegaY: omegaYReal,
        outOmegaY: outSpin?.omega.y ?? null,
        retentionY: omegaYReal ? (outSpin?.omega.y ?? 0) / omegaYReal : null,
        netClearance: net ? net.position.y - (TABLE.height + TABLE.net) : null,
        landingX: out.firstBounce?.x ?? null,
        landingZ: out.firstBounce?.z ?? null,
        landingError: out.firstBounce ? Math.abs(out.firstBounce.x) : null,
        outOutcome: out.outcome,
        success: out.success,
        serveLegal: evaluateServeSuccess(serve.pathResult, TABLE),
        finite: finiteTrajectory(trajectory) && finiteTrajectory(outTrajectory),
        nonFinite: !finiteTrajectory(trajectory) || !finiteTrajectory(outTrajectory),
        trajectory: outTrajectory,
        serveTrajectory: trajectory
      });
    }
  }
  return {groupId: "G5", rows, summary: summarizeGroup("G5", rows, {gridRows: rows.length, finite: rows.every((row) => row.finite)})};
}

function runG6(engineFactory, calibrationPresets, velocityCache) {
  const rows = [];
  for (const pushC of PUSH_C_VALUES) {
    const engine = engineFactory({pushC});
    for (const preset of calibrationPresets) {
      for (const directionInput of ["left", "right", null]) {
        rows.push(runReturnCase(engine, preset, velocityCache, {
          groupId: "G6", technique: "push", pushC, directionInput,
          swingDelayMs: 0, variant: `C-${pushC}`
        }));
      }
    }
  }
  const buckets = rowsBy(rows, (row) => `${row.magnusCoefficient}|${row.compensationX}|${row.directionClass}`);
  const byC = rowsBy(rows, (row) => row.runId.match(/C-([^:]+)/)?.[1] || "unknown");
  const cSummary = [...byC.entries()].map(([pushC, group]) => {
    const classes = {};
    for (const row of group) {
      const key = row.directionClass;
      classes[key] ||= {rows: 0, successCount: 0, outcomeCounts: {}};
      classes[key].rows += 1;
      classes[key].successCount += row.success ? 1 : 0;
      classes[key].outcomeCounts[row.outcome] = (classes[key].outcomeCounts[row.outcome] || 0) + 1;
    }
    for (const item of Object.values(classes)) item.rate = item.rows ? item.successCount / item.rows : null;
    return {pushC: Number(pushC), classes, correctGtNoneGtWrong: (classes.correct?.rate ?? -1) > (classes.none?.rate ?? -1) && (classes.none?.rate ?? -1) > (classes.wrong?.rate ?? -1)};
  }).sort((a, b) => a.pushC - b.pushC);
  return {groupId: "G6", rows, cSummary, summary: summarizeGroup("G6", rows, {gridRows: rows.length, cSummary, directionBuckets: buckets.size})};
}

function runG7(engineFactory, calibrationPresets, velocityCache) {
  const rows = [];
  for (const attackSpeedY of G7_TECHNIQUE_Y) {
    const engine = engineFactory({attackSpeedY});
    for (const swingDelayMs of G7_DELAYS) for (const tiltX of G7_TILTX) for (const preset of calibrationPresets) {
      rows.push(runReturnCase(engine, preset, velocityCache, {
        groupId: "G7", technique: "attack", pushC: 2.9,
        directionInput: null, swingDelayMs, tiltX,
        variant: `vy-${attackSpeedY}:delay-${swingDelayMs}:tilt-${tiltX}`
      }));
      rows[rows.length - 1].attackTechniqueVelY = attackSpeedY;
    }
  }
  const controlRows = [];
  for (const pushC of [0, 2.9, 4.5]) {
    const engine = engineFactory({attackSpeedY: 0.3, pushC});
    for (const preset of calibrationPresets) {
      const row = runReturnCase(engine, preset, velocityCache, {
        groupId: "G7-C-control", technique: "attack", pushC,
        directionInput: "right", swingDelayMs: 60, tiltX: 0,
        variant: `C-${pushC}`
      });
      controlRows.push({...row, attackCControl: pushC});
    }
  }
  const controlByPreset = rowsBy(controlRows, "presetId");
  const cInvariant = [...controlByPreset.values()].every((group) => {
    const reference = metricSignature(group[0]);
    return group.slice(1).every((row) => JSON.stringify(metricSignature(row)) === JSON.stringify(reference));
  });
  return {groupId: "G7", rows, controlRows, summary: summarizeGroup("G7", rows, {gridRows: rows.length, cInvariant, controlRows: controlRows.length})};
}

function selectCandidates(core, g3, g6) {
  const baseline = core.MAGNUS_COEFFICIENT;
  const baselineSummary = g3.coefficientSummary.find((item) => Math.abs(item.coefficient - baseline) < 1e-12);
  const safe = g3.coefficientSummary.filter((item) => item.finite && !item.hardStop && (item.legalRate >= (baselineSummary?.legalRate ?? 0)));
  const safeMin = safe.length ? safe[0].coefficient : baseline;
  const safeMax = safe.length ? safe[safe.length - 1].coefficient : baseline;
  const validC = g6.cSummary.filter((item) => item.correctGtNoneGtWrong);
  const bestC = validC.length ? validC.sort((a, b) => (b.classes.correct.rate - b.classes.none.rate) - (a.classes.correct.rate - a.classes.none.rate))[0].pushC : 2.9;
  const midpoint = safe.length ? (safeMin + safeMax) / 2 : baseline;
  return [
    {name: "current-baseline", magnusCoefficient: baseline, omegaYScale: 1, pushC: 2.9},
    {name: "safe-center-selected-C", magnusCoefficient: midpoint, omegaYScale: 1, pushC: bestC},
    {name: "safe-range-high-selected-C", magnusCoefficient: safeMax, omegaYScale: 1, pushC: bestC}
  ];
}

function runG8G9(engineFactory, presets, calibrationIds, candidates, velocityCache) {
  const holdoutPresets = presets.filter((preset) => !calibrationIds.has(preset.id));
  const g8Rows = [];
  const g9Rows = [];
  for (const candidate of candidates) {
    const engine = engineFactory(candidate);
    for (const preset of holdoutPresets) {
      // G6 already contains the full correct/none/wrong direction matrix.
      // Keep G8 at the registered 41×candidate size and use the manifest's
      // sideName as the semantic input for this holdout replay.
      g8Rows.push({...runReturnCase(engine, preset, velocityCache, {groupId: "G8", technique: "push", pushC: candidate.pushC, directionInput: preset.tags?.sideName || null, swingDelayMs: 0, variant: candidate.name}), candidate: candidate.name, holdout: true, directionSource: "manifest.sideName"});
    }
    for (const preset of presets) {
      g9Rows.push({...runReturnCase(engine, preset, velocityCache, {groupId: "G9", technique: "push", pushC: candidate.pushC, directionInput: preset.tags?.sideName || null, swingDelayMs: 0, variant: candidate.name}), candidate: candidate.name, holdout: false, directionSource: "manifest.sideName"});
    }
  }
  const aggregate = (rows) => [...rowsBy(rows, "candidate").entries()].map(([candidate, group]) => {
    const classes = {};
    for (const row of group) {
      const key = row.directionClass;
      classes[key] ||= {rows: 0, success: 0};
      classes[key].rows += 1;
      classes[key].success += row.success ? 1 : 0;
    }
    for (const value of Object.values(classes)) value.rate = value.rows ? value.success / value.rows : null;
    return {candidate, rows: group.length, classes, p10NetClearance: percentile(group.map((row) => row.netClearance).filter(Number.isFinite), 0.1), medianLandingError: median(group.map((row) => row.landingError).filter(Number.isFinite))};
  });
  return {
    groupId: "G8-G9",
    candidates,
    holdoutIds: holdoutPresets.map((preset) => preset.id),
    g8Rows,
    g9Rows,
    g8Summary: aggregate(g8Rows),
    g9Summary: aggregate(g9Rows),
    summary: {g8: summarizeGroup("G8", g8Rows), g9: summarizeGroup("G9", g9Rows)}
  };
}

function curveData(g2, g3, g5) {
  return {
    g2: g2.rows.map((row) => ({presetId: row.presetId, omegaY: row.omega.y, deltaXAtNet: row.deltaXAtNetRelativeToZero, deltaXAtFirstBounce: row.deltaXAtFirstBounceRelativeToZero})),
    g3: g3.rows.map((row) => ({presetId: row.presetId, magnusCoefficient: row.magnusCoefficient, deltaXAtNet: row.deltaXAtNet, netClearance: row.netClearance})),
    g5: g5.rows.map((row) => ({presetId: row.presetId, omegaY: row.omega.y, tiltX: row.tiltX, planeVelX: row.planeVel.x, landingX: row.landingX, outOmegaY: row.outOmegaY, netClearance: row.netClearance, outcome: row.outOutcome}))
  };
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function makeMetricsCsv(raw) {
  const rows = [];
  const push = (group, list) => (list || []).forEach((row) => rows.push({group, ...metricSignature(row), presetId: row.presetId, candidate: row.candidate || "", directionClass: row.directionClass || "", technique: row.technique || ""}));
  push("G1", raw.g1?.rows); push("G2", raw.g2?.rows); push("G3", raw.g3?.rows); push("G4", raw.g4?.rows); push("G5", raw.g5?.rows); push("G6", raw.g6?.rows); push("G7", raw.g7?.rows); push("G8", raw.g8g9?.g8Rows); push("G9", raw.g8g9?.g9Rows);
  const columns = ["group", "presetId", "candidate", "directionClass", "technique", "legal", "netClearance", "firstLandingX", "secondLandingX", "firstLandingZ", "secondLandingZ", "outcome", "success", "landingX", "outOmegaY", "inOmegaY", "retentionY", "fallbackSolver"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n") + "\n";
}

function manualMatrix(manifest) {
  const representative = manifest.presets.filter((row) => row.split === "Calibration-6");
  const lines = [
    "# G10 manual video / browser check matrix",
    "",
    "> This is a required human-observation record. Numerical sweep output cannot prove camera viewpoint, visual curve direction, or Game 5 gesture semantics.",
    "",
    "| Video ID | Category | Viewpoint | Spin label | Curve direction | Contact frame/time | Game 5 gesture matches | Confidence | Evidence |",
    "|---|---|---|---|---|---|---|---|---|",
    ...representative.map((row) => `| ${row.videoId || ""} | ${row.videoCategory || ""} | TODO | TODO | ${row.curveDirection || "TODO"} | TODO | TODO | TODO | TODO |`),
    "",
    "## Browser evidence",
    "",
    "- Browser page: `game5.html` served locally.",
    "- Screenshots / notes: TODO until the six representative clips are inspected by a human in the browser.",
    "- Do not promote this document to physical calibration evidence until all TODO cells have an observation or an explicit blocker."
  ];
  return lines.join("\n") + "\n";
}

function decision(raw) {
  const g0 = raw.g0.checks;
  const g1Pass = raw.g1.summary.gatePass;
  const g2Pass = raw.g2.summary.monotonicMagnitude;
  const g3Pass = raw.g3.coefficientSummary.some((item) => item.finite && !item.hardStop);
  const g4Pass = raw.g4.summary.spinYCarry && raw.g4.summary.finite;
  const g5Pass = raw.g5.summary.finite;
  const g6Evidence = raw.g6.cSummary.some((item) => item.correctGtNoneGtWrong);
  const g7Approx = raw.g7.summary.cInvariant;
  const numeric = Object.values(g0).every(Boolean) && g1Pass && g2Pass && g3Pass && g4Pass && g5Pass && g6Evidence && g7Approx;
  const status = numeric ? "Evidence insufficient" : "Prototype with blockers";
  return [
    "# Decision",
    "",
    `Decision: **${status}**`,
    "",
    "> This report is prototype evidence. It does not claim physically calibrated truth and does not authorize red-line integration.",
    "",
    "## Gate classification",
    "",
    `- G0 contract: ${Object.values(g0).every(Boolean) ? "PASS" : "BLOCKED"}`,
    `- G1 47-ball baseline legal gate: ${g1Pass ? "PASS" : "REVIEW"}`,
    `- G2 magnitude monotonicity: ${g2Pass ? "PASS" : "REVIEW"}`,
    `- G3 Magnus sensitivity: ${g3Pass ? "PASS" : "REVIEW"}`,
    `- G4 bounce transfer: ${g4Pass ? "PASS" : "REVIEW"}`,
    `- G5 paddle coupling: ${g5Pass ? "PASS" : "REVIEW"}`,
    `- G6 push direction separation: ${g6Evidence ? "PASS" : "EVIDENCE INSUFFICIENT"}`,
    `- G7 attack: ${g7Approx ? "controlled approximation control passed" : "REVIEW"}`,
    `- G10 video/browser semantics: pending manual matrix; not promoted by numerical output.`,
    "",
    "## Parameter interpretation",
    "",
    `- Magnus coefficient current value: ${raw.metadata.currentMagnusCoefficient}`,
    `- Candidate coefficient summary: ${JSON.stringify(raw.g3.coefficientSummary)}`,
    `- Push compensation summary: ${JSON.stringify(raw.g6.cSummary)}`,
    "- omega.y values are canonical world-space spin inputs; legacy `sidespin` is not used as a new sign truth.",
    "- No formal HTML, shared core, or preset file was modified by this run.",
    ""
  ].join("\n");
}

function summary(raw) {
  const lines = [
    "# 3D side-spin calibration execution",
    "",
    `Generated: ${raw.metadata.generatedAt}`,
    `Git commit: \`${raw.metadata.gitCommit}\``,
    "",
    "> Isolated prototype evidence only. It is not a claim of physical truth, visual acceptance, or Trainer readiness.",
    "",
    "## Group results",
    "",
    "| Group | Rows | Finite | Legal / key check | Result |",
    "|---|---:|---:|---|---|",
    `| G0 | ${raw.g0.rows.length} | ${raw.g0.checks.finite ? "yes" : "no"} | ±omega.y oppose, zero/axial separation | ${Object.values(raw.g0.checks).every(Boolean) ? "PASS" : "REVIEW"} |`,
    `| G1 | ${raw.g1.rows.length} | ${raw.g1.summary.finite}/${raw.g1.rows.length} | ${raw.g1.summary.legal}/${raw.g1.rows.length} legal | ${raw.g1.summary.gatePass ? "PASS" : "REVIEW"} |`,
    `| G2 | ${raw.g2.rows.length} | ${raw.g2.summary.finite}/${raw.g2.rows.length} | monotonic=${raw.g2.summary.monotonicMagnitude} | ${raw.g2.summary.monotonicMagnitude ? "PASS" : "REVIEW"} |`,
    `| G3 | ${raw.g3.rows.length} | ${raw.g3.summary.finite}/${raw.g3.rows.length} | coefficient rows=${raw.g3.coefficientSummary.length} | ${raw.g3.coefficientSummary.some((item) => item.finite && !item.hardStop) ? "PASS" : "REVIEW"} |`,
    `| G4 | ${raw.g4.rows.length} | ${raw.g4.summary.finite}/${raw.g4.rows.length} | omega.y carry=${raw.g4.summary.spinYCarry} | ${raw.g4.summary.spinYCarry ? "PASS" : "REVIEW"} |`,
    `| G5 | ${raw.g5.rows.length} | ${raw.g5.summary.finite}/${raw.g5.rows.length} | tiltX × planeVel.x coupling | ${raw.g5.summary.finite ? "PASS" : "REVIEW"} |`,
    `| G6 | ${raw.g6.rows.length} | ${raw.g6.summary.finite}/${raw.g6.rows.length} | correct>none>wrong candidates=${raw.g6.cSummary.filter((item) => item.correctGtNoneGtWrong).length} | ${raw.g6.cSummary.some((item) => item.correctGtNoneGtWrong) ? "PASS" : "EVIDENCE INSUFFICIENT"} |`,
    `| G7 | ${raw.g7.rows.length} + ${raw.g7.controlRows.length} controls | ${raw.g7.summary.finite}/${raw.g7.rows.length} | attack C-invariant=${raw.g7.summary.cInvariant} | ${raw.g7.summary.cInvariant ? "controlled approximation" : "REVIEW"} |`,
    `| G8 | ${raw.g8g9.g8Rows.length} | ${raw.g8g9.summary.g8.finite}/${raw.g8g9.g8Rows.length} | candidates=${raw.g8g9.candidates.length} | report |`,
    `| G9 | ${raw.g8g9.g9Rows.length} | ${raw.g8g9.summary.g9.finite}/${raw.g8g9.g9Rows.length} | all47 replay | report |`,
    "",
    "## Shortlist",
    "",
    ...raw.g8g9.candidates.map((candidate) => `- ${candidate.name}: C=${candidate.pushC}, Magnus=${candidate.magnusCoefficient}, omega scale=${candidate.omegaYScale}`),
    "",
    "## Known gaps",
    "",
    "- G10 remains a human video/browser semantic check; see `manual-check-matrix.md`.",
    "- A pass here is a controlled approximation / candidate range result, not physical truth.",
    "- Fallback solver was not exposed by the page API and is recorded as `null`; this is a tooling gap to resolve before red-line integration.",
    "- All source hashes and the pre-run dirty-worktree snapshot are recorded in `manifest.json`, `baseline_config.json`, and `git_status.txt`.",
    ""
  ];
  return lines.join("\n");
}

function writeGroupFiles(outputDir, raw) {
  const files = {
    g0_contract_raw: raw.g0,
    g1_baseline_raw: raw.g1,
    g2_magnitude_raw: raw.g2,
    g3_magnus_raw: raw.g3,
    g4_bounce_transfer_raw: raw.g4,
    g5_paddle_coupling_raw: raw.g5,
    g6_push_compensation_raw: raw.g6,
    g7_attack_raw: raw.g7,
    g8_holdout_raw: {groupId: "G8", candidates: raw.g8g9.candidates, rows: raw.g8g9.g8Rows, summary: raw.g8g9.g8Summary},
    g9_all47_raw: {groupId: "G9", candidates: raw.g8g9.candidates, rows: raw.g8g9.g9Rows, summary: raw.g8g9.g9Summary}
  };
  for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "metrics.csv"), makeMetricsCsv(raw), "utf8");
  fs.writeFileSync(path.join(outputDir, "curve-data.json"), JSON.stringify(curveData(raw.g2, raw.g3, raw.g5), null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "summary.md"), summary(raw), "utf8");
  fs.writeFileSync(path.join(outputDir, "manual-check-matrix.md"), manualMatrix(raw.manifest), "utf8");
  fs.writeFileSync(path.join(outputDir, "decision.md"), decision(raw), "utf8");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = options.outputDir;
  fs.mkdirSync(outputDir, {recursive: true});
  const core = loadCore();
  const presetsDocument = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8"));
  const presets = presetsDocument.serves || [];
  if (presets.length !== 47) throw new Error(`Expected 47 presets, found ${presets.length}`);
  const hashes = {[GAME5_FILE]: sha256(GAME5_FILE), [CORE_FILE]: sha256(CORE_FILE), [PRESETS_FILE]: sha256(PRESETS_FILE)};
  const manifest = makeManifest(presets, hashes);
  writeBaselineFiles(outputDir, manifest, hashes);
  const byId = presetById(presets);
  const calibrationIds = new Set(manifest.fixedRules.calibrationIds);
  const calibrationPresets = manifest.fixedRules.calibrationIds.map((id) => byId.get(id));
  const baselineEngine = createEngine(core);
  const velocityCache = makeServeVelocityCache(baselineEngine, presets);
  const engineFactory = (params = {}) => createEngine(core, params);
  const raw = {
    metadata: {
      generatedAt: new Date().toISOString(),
      tool: "prototypes/game5-side-spin-calibration/run-side-spin-sweep.js",
      plan: path.relative(ROOT, PLAN_FILE).replaceAll(path.sep, "/"),
      gitCommit: git(["rev-parse", "HEAD"]),
      currentMagnusCoefficient: core.MAGNUS_COEFFICIENT,
      sourceSha256: hashes,
      redLineFilesModified: false,
      physicalTruthClaim: false,
      seed: SEEDS.deterministic,
      dt: DT,
      gravity: GRAVITY,
      simTimeDilation: SIM_TIME_DILATION
    },
    manifest
  };

  if (options.groups === "all" || options.groups === "g0-g4") {
    console.log("[G0] coordinate/sign contract");
    raw.g0 = runG0(core);
    console.log("[G1] 47-serve baseline");
    raw.g1 = runG1(baselineEngine, presets, velocityCache);
    console.log("[G2] omega magnitude sensitivity");
    raw.g2 = runG2(baselineEngine, presets, calibrationPresets, velocityCache);
    console.log("[G3] Magnus coefficient sensitivity");
    raw.g3 = runG3(engineFactory, calibrationPresets, velocityCache, core.MAGNUS_COEFFICIENT);
    console.log("[G4] table bounce transfer");
    raw.g4 = runG4(core, baselineEngine, presets, velocityCache);
  }
  if (options.groups === "all" || options.groups === "g5-g7") {
    if (!raw.g1) {
      raw.g1 = runG1(baselineEngine, presets, velocityCache);
      raw.g2 = runG2(baselineEngine, presets, calibrationPresets, velocityCache);
      raw.g3 = runG3(engineFactory, calibrationPresets, velocityCache, core.MAGNUS_COEFFICIENT);
      raw.g4 = runG4(core, baselineEngine, presets, velocityCache);
      raw.g0 = runG0(core);
    }
    console.log("[G5] paddle coupling");
    raw.g5 = runG5(baselineEngine, calibrationPresets, velocityCache);
    console.log("[G6] push compensation");
    raw.g6 = runG6(engineFactory, calibrationPresets, velocityCache);
    console.log("[G7] attack independent sweep");
    raw.g7 = runG7(engineFactory, calibrationPresets, velocityCache);
  }
  if (options.groups === "all" || options.groups === "g8-g9") {
    if (!raw.g3 || !raw.g6) {
      raw.g0 ||= runG0(core); raw.g1 ||= runG1(baselineEngine, presets, velocityCache); raw.g2 ||= runG2(baselineEngine, presets, calibrationPresets, velocityCache); raw.g3 ||= runG3(engineFactory, calibrationPresets, velocityCache, core.MAGNUS_COEFFICIENT); raw.g4 ||= runG4(core, baselineEngine, presets, velocityCache); raw.g5 ||= runG5(baselineEngine, calibrationPresets, velocityCache); raw.g6 ||= runG6(engineFactory, calibrationPresets, velocityCache); raw.g7 ||= runG7(engineFactory, calibrationPresets, velocityCache);
    }
    const candidates = selectCandidates(core, raw.g3, raw.g6);
    console.log("[G8/G9] holdout and all-47 replay");
    raw.g8g9 = runG8G9(engineFactory, presets, calibrationIds, candidates, velocityCache);
  }
  raw.g0 ||= runG0(core);
  raw.g1 ||= {rows: [], summary: summarizeGroup("G1", [])};
  raw.g2 ||= {rows: [], summary: summarizeGroup("G2", [])};
  raw.g3 ||= {rows: [], coefficientSummary: [], summary: summarizeGroup("G3", [])};
  raw.g4 ||= {rows: [], summary: summarizeGroup("G4", [])};
  raw.g5 ||= {rows: [], summary: summarizeGroup("G5", [])};
  raw.g6 ||= {rows: [], cSummary: [], summary: summarizeGroup("G6", [])};
  raw.g7 ||= {rows: [], controlRows: [], summary: summarizeGroup("G7", [])};
  raw.g8g9 ||= {candidates: [], g8Rows: [], g9Rows: [], g8Summary: [], g9Summary: [], summary: {g8: summarizeGroup("G8", []), g9: summarizeGroup("G9", [])}};
  writeGroupFiles(outputDir, raw);
  console.log(JSON.stringify({outputDir, groups: {G0: raw.g0.checks, G1: raw.g1.summary, G2: raw.g2.summary, G3: raw.g3.coefficientSummary, G4: raw.g4.summary, G5: raw.g5.summary, G6: raw.g6.cSummary, G7: raw.g7.summary, G8: raw.g8g9.g8Summary, G9: raw.g8g9.g9Summary}}, null, 2));
}

main();
