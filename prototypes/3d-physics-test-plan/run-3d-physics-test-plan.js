#!/usr/bin/env node

// Isolated execution harness for docs/3D_PHYSICS_TEST_PLAN.md.
// This file is deliberately kept under prototypes/: it produces evidence about
// the current 3D prototype, but does not change red-line source files.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {execFileSync} = require("child_process");
const {loadGame4Physics} = require("../../tools/load-game4-physics.js");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "AI_CONTEXT", "3d_baseline_2026-07-15");
const PRESETS = JSON.parse(fs.readFileSync(path.join(ROOT, "physics-presets.json"), "utf8")).serves || [];
const SIM_TIME_DILATION = Math.sqrt(9.8 / 4.2);
const TABLE = {width: 1.525, length: 2.74, height: 0.76, top: 0.781, net: 0.1525};

function round(value, digits = 5) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function vec(v, digits = 5) {
  return {x: round(v.x, digits), y: round(v.y, digits), z: round(v.z, digits)};
}

function copyVec(v) {
  return {x: v.x, y: v.y, z: v.z};
}

function copySpin(spin) {
  return {
    schema: 1,
    omega: copyVec(spin.omega || {x: 0, y: 0, z: 0}),
    axialSpin: spin.axialSpin || 0,
  };
}

function scaleSpin(spin, factor) {
  const out = copySpin(spin);
  out.omega.x *= factor;
  out.omega.y *= factor;
  out.omega.z *= factor;
  out.axialSpin *= factor;
  return out;
}

function realSpin(spin) {
  return {
    schema: 1,
    omega: vec({
      x: spin?.omega?.x || 0,
      y: spin?.omega?.y || 0,
      z: spin?.omega?.z || 0,
    }, 4),
    axialSpin: round((spin?.axialSpin || 0), 4),
    topspin: round((spin?.topspin || 0), 4),
    sidespin: round((spin?.sidespin || 0), 4),
  };
}

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT, "shared-physics-core.js"), "utf8");
  const names = [
    "AIR_DENSITY", "MAGNUS_LIFT_SLOPE", "MAGNUS_COEFFICIENT", "BALL_RADIUS",
    "BALL_MASS", "CONTACT_FRICTION_MU", "TABLE", "physics3dCopySpin",
    "physics3dMagnusAcceleration", "physics3dAdvanceVelocity",
    "bounceWithSpinPhysical3D",
  ];
  return vm.runInNewContext(
    `(function(){${source}\nreturn {${names.join(",")}};})()`,
    {Math, Number, console}
  );
}

function loadGame4() {
  const loader = loadGame4Physics({});
  const extracted = loader.instantiateGame4Symbols([
    "simulateServe", "simulatePath", "findPushHitIndex", "findHitIndex",
    "solveBaseVelocity", "solveServeBounceVelocity", "solveVelocity",
    "makeServeAimCandidate", "getServeLengthProfile", "findServeBounceTime",
    "getServeBounces", "serveBounceScore", "clone", "DT", "MAX_STEPS",
    "SIM_TIME_DILATION", "applyPushContact", "computeRacketNormal",
    "dynamicPaddleEpsilon", "computeAdaptivePushLift", "computeAdaptivePushDrive",
    "computeAdaptivePushTiltX", "TECHNIQUES", "PADDLE_FRICTION", "PADDLE_BLEND",
    "PUSH_TILT_Y",
  ]);
  return {loader, extracted};
}

function git(command, args) {
  try {
    return execFileSync(command, args, {cwd: ROOT, encoding: "utf8"}).trim();
  } catch (error) {
    return `error: ${error.message}`;
  }
}

function metadata(core) {
  return {
    generatedAt: new Date().toISOString(),
    tool: "prototypes/3d-physics-test-plan/run-3d-physics-test-plan.js",
    plan: "docs/3D_PHYSICS_TEST_PLAN.md",
    commit: git("git", ["rev-parse", "HEAD"]),
    gitStatus: git("git", ["status", "--short"]),
    scales: {
      gravitySimulation: -4.2,
      gravityReal: -9.8,
      simTimeDilation: SIM_TIME_DILATION,
      note: "E-01/E-02/E-03/E-05 use real-scale prototype integration; E-04/E-06/E-07 call page functions with simulation-scale inputs and rescale reported velocities/spins.",
    },
    parameters: {
      magnusLiftSlope: core.MAGNUS_LIFT_SLOPE,
      magnusCoefficient: core.MAGNUS_COEFFICIENT,
      airDensity: core.AIR_DENSITY,
      ballRadius: core.BALL_RADIUS,
      ballMass: core.BALL_MASS,
      contactFrictionMu: core.CONTACT_FRICTION_MU,
    },
  };
}

function realPath(core, options = {}) {
  const dt = options.dt || 1 / 240;
  const gravity = options.gravity ?? -9.8;
  const coefficient = options.coefficient ?? core.MAGNUS_COEFFICIENT;
  const maxSteps = options.maxSteps || 2400;
  const pos = copyVec(options.start || {x: 0, y: 0.95, z: -1.52});
  let velocity = copyVec(options.velocity || {x: 0, y: -0.8, z: 5});
  let spin = copySpin(options.spin || {omega: {x: 0, y: 0, z: 0}, axialSpin: 0});
  const points = [copyVec(pos)];
  const velocities = [copyVec(velocity)];
  const spins = [copySpin(spin)];
  const bounces = [];
  let net = null;
  let netHit = false;
  let crossedNet = false;

  for (let i = 0; i < maxSteps; i += 1) {
    const previous = copyVec(pos);
    velocity = core.physics3dAdvanceVelocity(velocity, spin, gravity, dt, coefficient);
    pos.x += velocity.x * dt;
    pos.y += velocity.y * dt;
    pos.z += velocity.z * dt;

    if (!crossedNet && previous.z < 0 && pos.z >= 0) {
      const ratio = (0 - previous.z) / (pos.z - previous.z || 1);
      const y = previous.y + (pos.y - previous.y) * ratio;
      const x = previous.x + (pos.x - previous.x) * ratio;
      net = {x: round(x), y: round(y), z: 0, clearance: round(y - (TABLE.height + TABLE.net))};
      netHit = y < TABLE.height + TABLE.net;
      crossedNet = true;
    }

    if (previous.y >= TABLE.top && pos.y <= TABLE.top && velocity.y < 0) {
      const ratio = (TABLE.top - previous.y) / (pos.y - previous.y || 1);
      const impact = {
        x: previous.x + (pos.x - previous.x) * ratio,
        y: TABLE.top,
        z: previous.z + (pos.z - previous.z) * ratio,
      };
      if (Math.abs(impact.x) <= TABLE.width / 2 && Math.abs(impact.z) <= TABLE.length / 2) {
        pos.x = impact.x;
        pos.y = impact.y;
        pos.z = impact.z;
        const beforeVelocity = copyVec(velocity);
        const beforeSpin = copySpin(spin);
        const bounced = core.bounceWithSpinPhysical3D(velocity, spin, core.CONTACT_FRICTION_MU);
        velocity = copyVec(bounced.vel);
        spin = copySpin(bounced.spin3d);
        bounces.push({
          index: i,
          position: vec(impact),
          velocityBefore: vec(beforeVelocity),
          velocityAfter: vec(velocity),
          spinBefore: spinRecord(beforeSpin),
          spinAfter: spinRecord(spin),
          epsilon: round(bounced.epsilon),
          regime: bounced.regime,
        });
      }
    }

    points.push(copyVec(pos));
    velocities.push(copyVec(velocity));
    spins.push(copySpin(spin));
    if (pos.y <= core.BALL_RADIUS && previous.y > core.BALL_RADIUS) break;
    if (bounces.length >= 2 && crossedNet) break;
  }

  return {
    points: points.map((p) => vec(p)),
    velocities: velocities.map((v) => vec(v)),
    spins: spins.map((s) => spinRecord(s)),
    net,
    netHit,
    bounces,
    firstBounce: bounces[0]?.position || null,
    secondBounce: bounces[1]?.position || null,
    finite: points.every((p) => Object.values(p).every(Number.isFinite)) && velocities.every((v) => Object.values(v).every(Number.isFinite)),
  };
}

function spinRecord(spin) {
  return {
    schema: 1,
    omega: vec(spin.omega, 4),
    axialSpin: round(spin.axialSpin, 4),
  };
}

function flightMetric(pathResult) {
  return {
    net: pathResult.net,
    netHit: pathResult.netHit,
    firstBounce: pathResult.firstBounce ? vec(pathResult.firstBounce) : null,
    secondBounce: pathResult.secondBounce ? vec(pathResult.secondBounce) : null,
    bounces: pathResult.bounces.length,
    finite: pathResult.finite,
  };
}

function runE01(core) {
  const values = [-150, -75, 0, 75, 150];
  const rows = values.map((omegaY) => {
    const result = realPath(core, {spin: {omega: {x: 0, y: omegaY, z: 0}, axialSpin: 0}});
    return {omegaY, ...flightMetric(result)};
  });
  const by = new Map(rows.map((row) => [row.omegaY, row]));
  const mirrorChecks = [-150, -75].map((magnitude) => {
    const negative = by.get(-magnitude);
    const positive = by.get(magnitude);
    return {
      magnitude,
      netXSum: round(negative.net.x + positive.net.x),
      netYZDelta: {y: round(negative.net.y - positive.net.y), z: round(negative.net.z - positive.net.z)},
      firstBounceXSum: round((negative.firstBounce?.x || 0) + (positive.firstBounce?.x || 0)),
      secondBounceXSum: round((negative.secondBounce?.x || 0) + (positive.secondBounce?.x || 0)),
    };
  });
  return {
    id: "E-01",
    description: "omega.y sign and left/right mirror behavior",
    expected: ["positive omega.y produces positive Magnus x acceleration", "negative omega.y produces negative Magnus x acceleration", "paired y/z remain close"],
    rows,
    mirrorChecks,
    pass: rows.find((r) => r.omegaY === 150).net.x > rows.find((r) => r.omegaY === 0).net.x && rows.find((r) => r.omegaY === -150).net.x < rows.find((r) => r.omegaY === 0).net.x && mirrorChecks.every((r) => Math.abs(r.netXSum) < 0.02 && Math.abs(r.netYZDelta.y) < 0.02 && Math.abs(r.netYZDelta.z) < 0.02),
  };
}

function runE02(core) {
  const coefficients = [0, 0.0014, 0.0028, 0.0042];
  const cases = [
    {name: "no_spin", spin: {omega: {x: 0, y: 0, z: 0}, axialSpin: 0}},
    {name: "pure_omega_x", spin: {omega: {x: 150, y: 0, z: 0}, axialSpin: 0}},
    {name: "pure_sidespin", spin: {omega: {x: 0, y: 150, z: 0}, axialSpin: 0}},
  ];
  const rows = [];
  for (const testCase of cases) {
    const baseline = realPath(core, {coefficient: 0, spin: testCase.spin});
    for (const coefficient of coefficients) {
      const result = realPath(core, {coefficient, spin: testCase.spin});
      rows.push({
        case: testCase.name,
        coefficient,
        deltaXAtNet: round((result.net?.x || 0) - (baseline.net?.x || 0)),
        netClearance: result.net?.clearance,
        firstBounce: result.firstBounce ? vec(result.firstBounce) : null,
        secondBounce: result.secondBounce ? vec(result.secondBounce) : null,
        netHit: result.netHit,
        finite: result.finite,
      });
    }
  }
  const sideRows = rows.filter((row) => row.case === "pure_sidespin");
  const sideDeltas = sideRows.map((row) => row.deltaXAtNet);
  const noSpinRows = rows.filter((row) => row.case === "no_spin");
  const monotonic = sideDeltas.every((value, index) => index === 0 || Math.abs(value) >= Math.abs(sideDeltas[index - 1]) - 0.002);
  const noSpinStable = noSpinRows.every((row) => Math.abs(row.deltaXAtNet) < 1e-9);
  return {
    id: "E-02",
    description: "Magnus coefficient sensitivity",
    coefficientValues: coefficients,
    rows,
    checks: {noSpinStable, sideMagnitudeMonotonic: monotonic, allFinite: rows.every((row) => row.finite)},
    pass: noSpinStable && monotonic && rows.every((row) => row.finite),
  };
}

function runE03(core) {
  const cases = [
    {name: "zero_spin", spin: {omega: {x: 0, y: 0, z: 0}, axialSpin: 0}},
    {name: "axial_only", spin: {omega: {x: 0, y: 0, z: 0}, axialSpin: 125.66}},
    {name: "omega_y_positive", spin: {omega: {x: 0, y: 125.66, z: 0}, axialSpin: 0}},
    {name: "omega_y_negative", spin: {omega: {x: 0, y: -125.66, z: 0}, axialSpin: 0}},
  ];
  const rows = cases.map((testCase) => {
    const acceleration = core.physics3dMagnusAcceleration({x: 0, y: -0.8, z: 5}, testCase.spin);
    const result = realPath(core, {spin: testCase.spin});
    return {name: testCase.name, acceleration: vec(acceleration, 7), ...flightMetric(result)};
  });
  const axial = rows.find((row) => row.name === "axial_only");
  const positive = rows.find((row) => row.name === "omega_y_positive");
  const negative = rows.find((row) => row.name === "omega_y_negative");
  return {
    id: "E-03",
    description: "axial/corkscrew separation from true omega.y sidespin",
    rows,
    checks: {
      axialAccelerationNearZero: Math.hypot(axial.acceleration.x, axial.acceleration.y, axial.acceleration.z) < 1e-8,
      positiveAndNegativeOppose: positive.acceleration.x > 0 && negative.acceleration.x < 0,
      axialNetXMatchesZeroSpin: Math.abs(axial.net.x - rows[0].net.x) < 0.001,
    },
    pass: Math.hypot(axial.acceleration.x, axial.acceleration.y, axial.acceleration.z) < 1e-8 && positive.acceleration.x > 0 && negative.acceleration.x < 0 && Math.abs(axial.net.x - rows[0].net.x) < 0.001,
  };
}

function selectPreset(predicate, label) {
  const preset = PRESETS.find(predicate);
  if (!preset) throw new Error(`Missing representative preset: ${label}`);
  return preset;
}

function representativePresets() {
  return [
    selectPreset((p) => p.tags?.spinType === "backspin" && p.tags.length === "long" && p.tags.placement === "backhand", "backspin long backhand"),
    selectPreset((p) => p.tags?.spinType === "no_spin" && p.tags.length === "long" && p.tags.placement === "forehand", "no-spin long forehand"),
    selectPreset((p) => p.tags?.spinType === "backspin" && p.tags.length === "long" && p.tags.placement === "forehand", "backspin long forehand"),
    selectPreset((p) => p.tags?.spinType?.includes("side") && p.tags.sideName === "left", "left sidespin"),
    selectPreset((p) => p.tags?.spinType?.includes("side") && p.tags.sideName === "right", "right sidespin"),
  ];
}

function runE04(game4) {
  const records = PRESETS.map((preset) => {
    const result = game4.simulateServe(preset);
    return {
      id: preset.id,
      tags: preset.tags,
      points: (result.points || []).map((point) => vec(point)),
      velocities: (result.velocities || []).map((velocity) => vec({x: velocity.x * SIM_TIME_DILATION, y: velocity.y * SIM_TIME_DILATION, z: velocity.z * SIM_TIME_DILATION})),
      spins: (result.spins || []).map((spin) => realSpin({
        ...spin,
        omega: {
          x: (spin.omega?.x || 0) * SIM_TIME_DILATION,
          y: (spin.omega?.y || 0) * SIM_TIME_DILATION,
          z: (spin.omega?.z || 0) * SIM_TIME_DILATION,
        },
        axialSpin: (spin.axialSpin || 0) * SIM_TIME_DILATION,
        topspin: (spin.topspin || 0) * SIM_TIME_DILATION,
        sidespin: (spin.sidespin || 0) * SIM_TIME_DILATION,
      })),
      bounces: (result.bounces || []).map((bounce) => ({...bounce, x: round(bounce.x), y: round(bounce.y), z: round(bounce.z)})),
      netY: round(result.netY),
      netClearance: round(result.netY - (TABLE.height + TABLE.net)),
      netHit: Boolean(result.netHit),
      firstLanding: result.firstLanding ? vec(result.firstLanding) : null,
      groundLanding: result.groundLanding ? vec(result.groundLanding) : null,
      baseVelReal: result.baseVel ? vec({x: result.baseVel.x * SIM_TIME_DILATION, y: result.baseVel.y * SIM_TIME_DILATION, z: result.baseVel.z * SIM_TIME_DILATION}) : null,
    };
  });
  return {
    id: "E-04",
    description: "47-preset 3D serve trajectory baseline",
    presetCount: records.length,
    records,
    summary: {
      finite: records.every((record) => record.points.every((point) => Object.values(point).every(Number.isFinite))),
      withTwoBounces: records.filter((record) => record.bounces.length >= 2).length,
      netHits: records.filter((record) => record.netHit).length,
      averageNetClearance: round(records.reduce((sum, record) => sum + (record.netClearance || 0), 0) / records.length),
    },
  };
}

function serveContext(game4, preset) {
  const pathResult = game4.simulateServe(preset);
  const hitIndex = game4.findPushHitIndex(pathResult);
  const hitPoint = pathResult.points[hitIndex];
  const hitVel = pathResult.velocities[hitIndex];
  const hitSpin = pathResult.spins[hitIndex];
  return {preset, pathResult, hitIndex, hitPoint, hitVel, hitSpin, gravity: preset.solve?.gravity ?? -4.2};
}

function contactResult(game4, context, options = {}) {
  const ext = game4;
  const tiltY = options.tiltY ?? ext.PUSH_TILT_Y;
  const lift = options.lift ?? ext.computeAdaptivePushLift(context.hitVel);
  const drive = options.drive ?? ext.computeAdaptivePushDrive(context.hitVel);
  const planeVel = {x: options.planeVelX ?? 0, y: lift, z: -drive};
  const tiltX = options.tiltX ?? 0;
  const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
  const epsilon = ext.dynamicPaddleEpsilon(context.hitVel, planeVel, racketNormal);
  const incomingSpin = copySpin(context.hitSpin);
  if (options.omegaYReal != null) incomingSpin.omega.y = options.omegaYReal / SIM_TIME_DILATION;
  const contact = ext.applyPushContact(context.hitVel, incomingSpin, racketNormal, planeVel, epsilon, {...ext.TECHNIQUES.push}, ext.PADDLE_BLEND);
  const outPath = ext.simulatePath(context.hitPoint, contact.vel, {
    gravity: context.gravity,
    spin: contact.spin,
    spin3d: contact.spin3d,
  });
  const landing = outPath.bounces.find((bounce) => bounce.z < 0) || null;
  const netClearance = outPath.netY == null ? null : outPath.netY - (TABLE.height + TABLE.net);
  const outSpin3d = contact.spin3d || contact.spin;
  return {
    tiltY: round(tiltY),
    tiltX: round(tiltX),
    lift: round(lift),
    drive: round(drive),
    planeVelX: round(options.planeVelX ?? 0),
    omegaYIn: round(incomingSpin.omega.y * SIM_TIME_DILATION, 4),
    omegaOut: realSpin(scaleSpin(outSpin3d, SIM_TIME_DILATION)),
    outVelocity: vec({x: contact.vel.x * SIM_TIME_DILATION, y: contact.vel.y * SIM_TIME_DILATION, z: contact.vel.z * SIM_TIME_DILATION}),
    dwellMs: round(contact.dwellMs),
    effectiveEpsilon: round(contact.effectiveEpsilon),
    netClearance: round(netClearance),
    netHit: Boolean(outPath.netHit),
    landing: landing ? vec(landing) : null,
    landingInside: Boolean(landing && Math.abs(landing.x) <= TABLE.width / 2 && Math.abs(landing.z) <= TABLE.length / 2),
    finite: Boolean(contact.vel && Object.values(contact.vel).every(Number.isFinite)) && (!landing || Object.values(landing).filter((value) => typeof value === "number").every(Number.isFinite)),
  };
}

function mirrorVec(v) {
  return {x: v.x, y: v.y, z: -v.z};
}

// Reflection across the table's z=0 plane transforms the axial vector as a
// pseudovector: omega.x and omega.y change sign, omega.z remains unchanged.
function mirrorSpin3d(spin) {
  const out = copySpin(spin);
  out.omega.x = -out.omega.x;
  out.omega.y = -out.omega.y;
  return out;
}

function mirrorPath3d(pathResult) {
  return {
    ...pathResult,
    points: (pathResult.points || []).map(mirrorVec),
    velocities: (pathResult.velocities || []).map(mirrorVec),
    spins: (pathResult.spins || []).map(mirrorSpin3d),
    bounces: (pathResult.bounces || []).map((bounce) => ({...bounce, z: -bounce.z})),
    firstLanding: pathResult.firstLanding ? mirrorVec(pathResult.firstLanding) : null,
    groundLanding: pathResult.groundLanding ? mirrorVec(pathResult.groundLanding) : null,
  };
}

function canonicalContactPath(game4, context) {
  const tiltY = game4.PUSH_TILT_Y;
  const lift = game4.computeAdaptivePushLift(context.hitVel);
  const drive = game4.computeAdaptivePushDrive(context.hitVel);
  const planeVel = {x: 0, y: lift, z: -drive};
  const racketNormal = game4.computeRacketNormal(tiltY, 0, planeVel);
  const epsilon = game4.dynamicPaddleEpsilon(context.hitVel, planeVel, racketNormal);
  const contact = game4.applyPushContact(context.hitVel, context.hitSpin, racketNormal, planeVel, epsilon, {...game4.TECHNIQUES.push}, game4.PADDLE_BLEND);
  const outPath = game4.simulatePath(context.hitPoint, contact.vel, {
    gravity: context.gravity,
    spin: contact.spin,
    spin3d: contact.spin3d,
  });
  return {contact, outPath};
}

function runCanonicalRally(game4, preset) {
  const serve = game4.simulateServe(preset);
  const firstHitIndex = game4.findPushHitIndex(serve);
  let hitPoint = serve.points[firstHitIndex];
  let hitVel = serve.velocities[firstHitIndex];
  let hitSpin = serve.spins[firstHitIndex];
  let flip = false;
  let rounds = 0;
  let failReason = null;
  const roundStats = [];
  const gravity = preset.solve?.gravity ?? -4.2;

  for (let roundNumber = 1; roundNumber <= 12; roundNumber += 1) {
    const canonicalContext = flip
      ? {hitPoint: mirrorVec(hitPoint), hitVel: mirrorVec(hitVel), hitSpin: mirrorSpin3d(hitSpin), gravity}
      : {hitPoint, hitVel, hitSpin, gravity};
    const canonical = canonicalContactPath(game4, canonicalContext);
    const actualPath = flip ? mirrorPath3d(canonical.outPath) : canonical.outPath;
    const firstBounce = actualPath.bounces[0] || null;
    const expectedSign = flip ? 1 : -1;
    const netClearance = actualPath.netY == null ? null : actualPath.netY - (TABLE.height + TABLE.net);
    const inBounds = Boolean(firstBounce && Math.abs(firstBounce.x) <= TABLE.width / 2 && Math.abs(firstBounce.z) <= TABLE.length / 2 && Math.sign(firstBounce.z) === expectedSign);
    const netOk = netClearance != null && netClearance >= 0;
    const actualOutgoingSpin = flip ? mirrorSpin3d(canonical.contact.spin3d) : canonical.contact.spin3d;
    roundStats.push({
      round: roundNumber,
      netClearance: round(netClearance),
      inBounds,
      netOk,
      landing: firstBounce ? vec(firstBounce) : null,
      outgoingSpin: realSpin(scaleSpin(actualOutgoingSpin, SIM_TIME_DILATION)),
      outgoingSpeed: round(Math.hypot(canonical.contact.vel.x, canonical.contact.vel.y, canonical.contact.vel.z) * SIM_TIME_DILATION),
    });
    if (!netOk) { failReason = "net"; break; }
    if (!inBounds) { failReason = "out_of_bounds"; break; }
    rounds = roundNumber;

    const detectionPath = flip ? actualPath : mirrorPath3d(actualPath);
    const nextIndex = game4.findPushHitIndex(detectionPath);
    if (nextIndex == null || nextIndex >= actualPath.points.length || !actualPath.velocities[nextIndex] || !actualPath.spins[nextIndex]) {
      failReason = "no_next_hit";
      break;
    }
    hitPoint = actualPath.points[nextIndex];
    hitVel = actualPath.velocities[nextIndex];
    hitSpin = actualPath.spins[nextIndex];
    flip = !flip;
  }
  return {
    presetId: preset.id,
    rounds,
    failReason,
    stable12: rounds === 12,
    roundStats,
  };
}

function runE08(game4) {
  const rows = representativePresets().map((preset) => runCanonicalRally(game4, preset));
  return {
    id: "E-08",
    description: "canonical 3D push-vs-push closed-loop rally stability",
    maxRounds: 12,
    rows,
    summary: {
      stableCount: rows.filter((row) => row.stable12).length,
      total: rows.length,
      failReasons: rows.reduce((counts, row) => { if (row.failReason) counts[row.failReason] = (counts[row.failReason] || 0) + 1; return counts; }, {}),
    },
  };
}

function sweepContact(game4, context, parameterRows) {
  return parameterRows.map((parameters) => {
    try {
      return {...parameters, ...contactResult(game4, context, parameters)};
    } catch (error) {
      return {...parameters, exception: error.message, finite: false};
    }
  });
}

function linspace(lo, hi, count) {
  return Array.from({length: count}, (_, index) => lo + (hi - lo) * index / (count - 1));
}

function runE06(game4) {
  const contexts = representativePresets().map((preset) => serveContext(game4, preset));
  const results = contexts.map((context) => {
    const tiltY = linspace(0.3, 2.0, 16).map((value) => ({tiltY: round(value)}));
    const lift = linspace(0, 1.5, 15).map((value) => ({lift: round(value)}));
    const drive = linspace(0.1, 1.3, 13).map((value) => ({drive: round(value)}));
    const grid = [];
    for (const liftValue of linspace(0, 1.5, 15)) {
      for (const driveValue of linspace(0.1, 1.3, 13)) grid.push({lift: round(liftValue), drive: round(driveValue)});
    }
    const output = {
      presetId: context.preset.id,
      hitIndex: context.hitIndex,
      hitPoint: vec(context.hitPoint),
      incomingVelocity: vec({x: context.hitVel.x * SIM_TIME_DILATION, y: context.hitVel.y * SIM_TIME_DILATION, z: context.hitVel.z * SIM_TIME_DILATION}),
      incomingSpin: realSpin(scaleSpin(context.hitSpin, SIM_TIME_DILATION)),
      tiltYSweep: sweepContact(game4, context, tiltY),
      liftSweep: sweepContact(game4, context, lift),
      driveSweep: sweepContact(game4, context, drive),
      liftDriveGrid: sweepContact(game4, context, grid),
    };
    const allRows = [...output.tiltYSweep, ...output.liftSweep, ...output.driveSweep, ...output.liftDriveGrid];
    output.summary = {
      totalRows: allRows.length,
      exceptions: allRows.filter((row) => row.exception).length,
      finite: allRows.filter((row) => row.finite).length,
      clearsNet: allRows.filter((row) => row.netClearance != null && row.netClearance >= 0).length,
      inBounds: allRows.filter((row) => row.landingInside).length,
      landingXBounds: bounds(allRows.map((row) => row.landing?.x)),
      landingZBounds: bounds(allRows.map((row) => row.landing?.z)),
    };
    return output;
  });
  return {id: "E-06", description: "post-bounce receive curves across representative serves", presets: results};
}

function bounds(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? {min: round(Math.min(...finite)), max: round(Math.max(...finite))} : null;
}

function runE07(game4) {
  const preset = representativePresets()[0];
  const context = serveContext(game4, preset);
  const sideValues = linspace(-150, 150, 10);
  const tiltValues = linspace(-0.5, 0.5, 10);
  const planeValues = linspace(-3, 3, 10);
  const rows4A = [];
  const rows4B = [];
  const rows4C = [];
  for (const omegaYReal of sideValues) {
    for (const tiltX of tiltValues) rows4A.push({...contactResult(game4, context, {omegaYReal, tiltX}), omegaYReal: round(omegaYReal)});
    for (const planeVelX of planeValues) rows4B.push({...contactResult(game4, context, {omegaYReal, planeVelX}), omegaYReal: round(omegaYReal)});
  }
  for (const omegaYReal of linspace(-150, 150, 5)) {
    for (const tiltX of linspace(-0.3, 0.3, 5)) {
      for (const planeVelX of linspace(-2, 2, 5)) rows4C.push({...contactResult(game4, context, {omegaYReal, tiltX, planeVelX}), omegaYReal: round(omegaYReal)});
    }
  }
  return {
    id: "E-07",
    description: "canonical omega.y × racket tilt / plane velocity compensation",
    presetId: preset.id,
    sweeps: {omegaYValues: sideValues.map((value) => round(value)), tiltXValues: tiltValues.map((value) => round(value)), planeVelXValues: planeValues.map((value) => round(value))},
    rows4A,
    rows4B,
    rows4C,
    checks: {
      exceptions: [...rows4A, ...rows4B, ...rows4C].filter((row) => row.exception).length,
      finite: [...rows4A, ...rows4B, ...rows4C].every((row) => row.finite),
    },
  };
}

function summarize(raw) {
  const e01 = raw.experiments.find((experiment) => experiment.id === "E-01");
  const e02 = raw.experiments.find((experiment) => experiment.id === "E-02");
  const e03 = raw.experiments.find((experiment) => experiment.id === "E-03");
  const e04 = raw.experiments.find((experiment) => experiment.id === "E-04");
  const e05 = raw.experiments.find((experiment) => experiment.id === "E-05");
  const e06 = raw.experiments.find((experiment) => experiment.id === "E-06");
  const e07 = raw.experiments.find((experiment) => experiment.id === "E-07");
  const e08 = raw.experiments.find((experiment) => experiment.id === "E-08");
  const lines = [
    "# 3D physics baseline execution",
    "",
    `Generated: ${raw.metadata.generatedAt}`,
    `Commit: \`${raw.metadata.commit}\``,
    "",
    "> This is engineering/prototype evidence from the current code. It is not a claim of physically calibrated truth or Trainer readiness.",
    "",
    "## Gate and experiment summary",
    "",
    "| ID | Result | Evidence |",
    "|---|---|---|",
    `| E-01 | ${e01.pass ? "PASS" : "REVIEW"} | mirror checks: ${e01.mirrorChecks.map((row) => `±${row.magnitude}: Δx=${row.netXSum}`).join(", ")} |`,
    `| E-02 | ${e02.pass ? "PASS" : "REVIEW"} | no-spin stable=${e02.checks.noSpinStable}; side magnitude monotonic=${e02.checks.sideMagnitudeMonotonic}; finite=${e02.checks.allFinite} |`,
    `| E-03 | ${e03.pass ? "PASS" : "REVIEW"} | axial acceleration near zero=${e03.checks.axialAccelerationNearZero}; ±omega.y oppose=${e03.checks.positiveAndNegativeOppose}; axial post-bounce x matches zero=${e03.checks.axialNetXMatchesZeroSpin} |`,
    `| E-04 | ${e04.summary.finite ? "PASS" : "REVIEW"} | ${e04.presetCount} presets; two bounces=${e04.summary.withTwoBounces}; net hits=${e04.summary.netHits}; avg net clearance=${e04.summary.averageNetClearance} m |`,
    `| E-05 | ${e05.checks.spinYCarry ? "PASS" : "REVIEW"} | ${e05.rows.length} bounce cases; omega.y carried=${e05.checks.spinYCarry}; finite=${e05.checks.finite} |`,
    `| E-06 | ${e06.presets.length} representative presets | ${e06.presets.reduce((sum, item) => sum + item.summary.totalRows, 0)} contact/flight rows; exceptions=${e06.presets.reduce((sum, item) => sum + item.summary.exceptions, 0)} |`,
    `| E-07 | ${e07.checks.finite ? "PASS" : "REVIEW"} | 4A=${e07.rows4A.length}; 4B=${e07.rows4B.length}; 4C=${e07.rows4C.length}; exceptions=${e07.checks.exceptions} |`,
    `| E-08 | ${e08.summary.stableCount === e08.summary.total ? "PASS" : "REVIEW"} | ${e08.summary.stableCount}/${e08.summary.total} representative rallies reached ${e08.maxRounds} rounds; failures=${JSON.stringify(e08.summary.failReasons)} |`,
    "",
    "## Important interpretation",
    "",
    "- E-01–E-03 are controlled mathematical/prototype checks with a real-scale isolated integrator.",
    "- E-04–E-07 exercise the current page extraction path and report velocities/spins back in real units using D.",
    "- E-04's 47/47 baseline is a data-flow baseline; it does not validate the preset library against video measurements.",
    "- E-06/E-07 contain sweep rows for inspection, not automatic physical acceptance.",
    "- Visual/manual checks are recorded separately because a numerical pass cannot prove curve readability or Game 5 input semantics.",
    "",
    "## Known observations",
    "",
    `- E-05 regime counts: ${JSON.stringify(e05.regimeCounts)}; epsilon range ${e05.epsilonRange.min}–${e05.epsilonRange.max}.`,
    `- E-06 representative presets: ${e06.presets.map((item) => `${item.presetId} (${item.summary.clearsNet}/${item.summary.totalRows} clear-net rows)`).join(", ")}.`,
    `- E-07 canonical side-spin uses omega.y directly; legacy sidespin is not used as the sweep input.`,
    `- E-08 is a current-preset representative rally harness; the named legacy validator was also rerun separately and failed before simulation because its hard-coded exclusions no longer match the 47 generated preset IDs.`,
    "",
    "## Files",
    "",
    "- `3d_physics_test_plan_raw.json`: versioned raw experiment output.",
    "- `3d_physics_test_plan_summary.md`: this summary.",
    "- `representative-curves.svg`: compact curve plot for E-01/E-02/E-05.",
    "- `visual-check.md`: manual-check record and the browser-sandbox limitation.",
  ];
  return lines.join("\n") + "\n";
}

function plotSvg(raw) {
  const e01 = raw.experiments.find((experiment) => experiment.id === "E-01");
  const e02 = raw.experiments.find((experiment) => experiment.id === "E-02");
  const e05 = raw.experiments.find((experiment) => experiment.id === "E-05");
  const W = 960, H = 560;
  const panels = [
    {x: 20, y: 20, w: 440, h: 240, title: "E-01 net x vs omega.y", rows: e01.rows.map((row) => ({x: row.omegaY, y: row.net.x})), xLabel: "omega.y (rad/s)", yLabel: "net x (m)", color: "#2563eb"},
    {x: 500, y: 20, w: 440, h: 240, title: "E-02 pure sidespin delta x", rows: e02.rows.filter((row) => row.case === "pure_sidespin").map((row) => ({x: row.coefficient, y: row.deltaXAtNet})), xLabel: "C", yLabel: "delta x at net (m)", color: "#c2410c"},
    {x: 20, y: 300, w: 920, h: 240, title: "E-05 omega.y carry through table bounce", rows: e05.rows.filter((row) => row.omegaX === 0 && row.omegaZ === 0 && row.vx === 0 && row.vy === 3).map((row) => ({x: row.omegaY, y: row.after.omega.y, y2: row.before.omega.y})), xLabel: "incoming omega.y (rad/s)", yLabel: "bounce omega.y (rad/s)", color: "#15803d"},
  ];
  function panelMarkup(panel) {
    const values = panel.rows.flatMap((row) => [row.y, row.y2]).filter(Number.isFinite);
    const xs = panel.rows.map((row) => row.x).filter(Number.isFinite);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...values), maxY = Math.max(...values);
    const padX = (maxX - minX) || 1, padY = (maxY - minY) || 1;
    const plotX = panel.x + 52, plotY = panel.y + 34, plotW = panel.w - 72, plotH = panel.h - 64;
    const px = (value) => plotX + ((value - minX) / padX) * plotW;
    const py = (value) => plotY + plotH - ((value - minY) / padY) * plotH;
    const points = panel.rows.map((row) => `${px(row.x).toFixed(1)},${py(row.y).toFixed(1)}`).join(" ");
    const second = panel.rows.some((row) => Number.isFinite(row.y2)) ? `<polyline points="${panel.rows.map((row) => `${px(row.x).toFixed(1)},${py(row.y2).toFixed(1)}`).join(" ")}" fill="none" stroke="#6b7280" stroke-width="2" stroke-dasharray="5 4"/>` : "";
    const circles = panel.rows.map((row) => `<circle cx="${px(row.x).toFixed(1)}" cy="${py(row.y).toFixed(1)}" r="3.5" fill="${panel.color}"/>`).join("");
    return `<g><text x="${panel.x}" y="${panel.y + 16}" font-size="14" font-weight="600">${panel.title}</text><line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="#888"/><line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotH}" stroke="#888"/><polyline points="${points}" fill="none" stroke="${panel.color}" stroke-width="2.5"/>${second}${circles}<text x="${plotX + plotW / 2}" y="${panel.y + panel.h - 4}" text-anchor="middle" font-size="11">${panel.xLabel}</text><text x="${panel.x + 12}" y="${plotY + plotH / 2}" transform="rotate(-90 ${panel.x + 12} ${plotY + plotH / 2})" text-anchor="middle" font-size="11">${panel.yLabel}</text><text x="${plotX}" y="${plotY + plotH + 16}" font-size="10">${round(minX)}</text><text x="${plotX + plotW}" y="${plotY + plotH + 16}" text-anchor="end" font-size="10">${round(maxX)}</text><text x="${plotX - 6}" y="${plotY + plotH}" text-anchor="end" font-size="10">${round(minY)}</text><text x="${plotX - 6}" y="${plotY + 4}" text-anchor="end" font-size="10">${round(maxY)}</text></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="3D physics representative curves"><rect width="100%" height="100%" fill="#ffffff"/>${panels.map(panelMarkup).join("")}</svg>\n`;
}

function runE05(core) {
  const omegaXValues = [-250, -125, 0, 125, 250];
  const omegaYValues = [-200, -100, 0, 100, 200];
  const omegaZValues = [-100, -50, 0, 50, 100];
  const vyValues = [1, 2, 3, 4, 5, 6];
  const vxValues = [-3, -1.5, 0, 1.5, 3];
  const rows = [];
  for (const omegaX of omegaXValues) for (const omegaY of omegaYValues) for (const omegaZ of omegaZValues) for (const vy of vyValues) for (const vx of vxValues) {
    const before = {omega: {x: omegaX, y: omegaY, z: omegaZ}, axialSpin: 0};
    const result = core.bounceWithSpinPhysical3D({x: vx, y: -vy, z: 3}, before, core.CONTACT_FRICTION_MU);
    rows.push({
      omegaX, omegaY, omegaZ, vx, vy,
      before: spinRecord(before),
      after: spinRecord(result.spin3d),
      velocityBefore: {x: vx, y: -vy, z: 3},
      velocityAfter: vec(result.vel),
      epsilon: round(result.epsilon),
      regime: result.regime,
      retention: round(Math.hypot(result.spin3d.omega.x, result.spin3d.omega.y, result.spin3d.omega.z) / Math.max(1e-9, Math.hypot(omegaX, omegaY, omegaZ)), 5),
      finite: Object.values(result.vel).every(Number.isFinite),
    });
  }
  const regimeCounts = {};
  for (const row of rows) {
    const key = `${row.regime?.topspin || "?"}/${row.regime?.sidespin || "?"}`;
    regimeCounts[key] = (regimeCounts[key] || 0) + 1;
  }
  const epsilonValues = rows.map((row) => row.epsilon);
  return {
    id: "E-05",
    description: "3D table-contact spin transfer sweep",
    grid: {omegaX: omegaXValues, omegaY: omegaYValues, omegaZ: omegaZValues, vy: vyValues, vx: vxValues, totalPoints: rows.length},
    rows,
    regimeCounts,
    epsilonRange: {min: Math.min(...epsilonValues), max: Math.max(...epsilonValues)},
    checks: {
      spinYCarry: rows.every((row) => Math.abs(row.after.omega.y - row.before.omega.y) < 1e-9),
      finite: rows.every((row) => row.finite),
    },
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const core = loadCore();
  const {extracted: game4} = loadGame4();
  const raw = {
    metadata: metadata(core),
    experiments: [
      runE01(core),
      runE02(core),
      runE03(core),
      runE04(game4),
      runE05(core),
      runE06(game4),
      runE07(game4),
      runE08(game4),
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, "3d_physics_test_plan_raw.json"), JSON.stringify(raw, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "3d_physics_test_plan_summary.md"), summarize(raw), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "representative-curves.svg"), plotSvg(raw), "utf8");
  console.log(JSON.stringify({
    outputDir: OUT_DIR,
    experiments: raw.experiments.map((experiment) => ({id: experiment.id, pass: experiment.pass ?? null})),
    e04Presets: raw.experiments.find((experiment) => experiment.id === "E-04").presetCount,
    e05Rows: raw.experiments.find((experiment) => experiment.id === "E-05").rows.length,
    e06Rows: raw.experiments.find((experiment) => experiment.id === "E-06").presets.reduce((sum, item) => sum + item.summary.totalRows, 0),
    e07Rows: raw.experiments.find((experiment) => experiment.id === "E-07").rows4A.length + raw.experiments.find((experiment) => experiment.id === "E-07").rows4B.length + raw.experiments.find((experiment) => experiment.id === "E-07").rows4C.length,
    e08: raw.experiments.find((experiment) => experiment.id === "E-08").summary,
  }, null, 2));
}

main();
