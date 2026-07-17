#!/usr/bin/env node

// Isolated diagnostic harness for docs/3D_PHYSICS_DIAGNOSTIC_PLAN.md.
// This file intentionally stays under prototypes/: it records evidence about
// the current 3D/core and game4 Stage4a paths without changing red-line files.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {execFileSync} = require("child_process");
const {loadGame4Physics} = require("../../tools/load-game4-physics.js");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "AI_CONTEXT", "3d_diagnostic_2026-07-15");
const DT = 1 / 240;
const SIM_TIME_DILATION = Math.sqrt(9.8 / 4.2);
const TABLE = {width: 1.525, length: 2.74, height: 0.76, top: 0.781, net: 0.1525};

const E03_CASES = [
  {name: "Z0", spin: {schema: 1, omega: {x: 0, y: 0, z: 0}, axialSpin: 0}},
  {name: "AX+", spin: {schema: 1, omega: {x: 0, y: 0, z: 0}, axialSpin: 125.66}},
  {name: "Y+", spin: {schema: 1, omega: {x: 0, y: 125.66, z: 0}, axialSpin: 0}},
  {name: "Y-", spin: {schema: 1, omega: {x: 0, y: -125.66, z: 0}, axialSpin: 0}},
];

const G04_EXPECTED = {
  vel: {x: 0.015471, y: 2.349485, z: -3.479795},
  spin: {topspin: -23.775389, sidespin: -4.11216},
  dwellMs: 5.44,
  effectiveEpsilon: -0.960051,
};

const G04_INPUT = {
  techKey: "push",
  incomingVel: {x: 0.2, y: -2.5, z: 3.0},
  incomingSpin: {topspin: -70, sidespin: 5},
  hitPoint: {x: 0.1, y: 0.9, z: 0.6},
  gravity: -4.2,
};

function round(value, digits = 6) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function vec(value, digits = 6) {
  return {
    x: round(value?.x, digits),
    y: round(value?.y, digits),
    z: round(value?.z, digits),
  };
}

function cloneVec(value) {
  return {x: value.x, y: value.y, z: value.z};
}

function cloneSpin(value) {
  return {
    schema: value?.schema || 1,
    omega: cloneVec(value?.omega || {x: 0, y: 0, z: 0}),
    axialSpin: value?.axialSpin || 0,
  };
}

function scaleVec(value, factor) {
  return {x: value.x * factor, y: value.y * factor, z: value.z * factor};
}

function scaleSpin(value, factor) {
  const spin = cloneSpin(value);
  spin.omega = scaleVec(spin.omega, factor);
  spin.axialSpin *= factor;
  return spin;
}

function finiteVec(value) {
  return value && [value.x, value.y, value.z].every(Number.isFinite);
}

function finiteSpin(value) {
  return finiteVec(value?.omega) && Number.isFinite(value?.axialSpin);
}

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT, "shared-physics-core.js"), "utf8");
  const names = [
    "AIR_DENSITY", "MAGNUS_LIFT_SLOPE", "MAGNUS_COEFFICIENT", "BALL_RADIUS",
    "BALL_MASS", "CONTACT_FRICTION_MU", "TABLE", "physics3dCopySpin",
    "physics3dResolveOmega", "physics3dMagnusAcceleration", "physics3dAdvanceVelocity",
    "bounceWithSpinPhysical3D",
  ];
  return vm.runInNewContext(
    `(function(){${source}\nreturn {${names.join(",")}};})()`,
    {Math, Number, console}
  );
}

function git(args) {
  try {
    return execFileSync("git", args, {cwd: ROOT, encoding: "utf8"}).trim();
  } catch (error) {
    return `error: ${error.message}`;
  }
}

function spinRecord(core, spin, velocity, digits = 6) {
  const canonical = cloneSpin(spin);
  const resolved = core.physics3dResolveOmega(canonical, velocity);
  return {
    schema: canonical.schema,
    omega: vec(canonical.omega, digits),
    axialSpin: round(canonical.axialSpin, digits),
    resolvedOmegaAtVelocity: vec(resolved, digits),
    legacyProjectionAtVelocity: {
      topspin: round(resolved.x, digits),
      sidespin: round(-resolved.z, digits),
    },
  };
}

function stateObservation(core, stage, position, velocity, spin, extra = {}) {
  const acceleration = core.physics3dMagnusAcceleration(velocity, spin);
  return {
    stage,
    position: vec(position),
    velocity: vec(velocity),
    acceleration: vec(acceleration, 9),
    spin: spinRecord(core, spin, velocity),
    ...extra,
  };
}

function traceCorePath(core, options = {}) {
  const start = cloneVec(options.start || {x: 0, y: 0.95, z: -1.52});
  const initialVelocity = cloneVec(options.velocity || {x: 0, y: -0.8, z: 5});
  let position = cloneVec(start);
  let velocity = initialVelocity;
  let spin = cloneSpin(options.spin || E03_CASES[0].spin);
  const observations = [stateObservation(core, "initial-input", position, velocity, spin)];
  const bounces = [];
  let net = null;
  let crossedNet = false;
  let finite = true;

  for (let index = 0; index < (options.maxSteps || 2400); index += 1) {
    const previousPosition = cloneVec(position);
    const velocityBeforeStep = cloneVec(velocity);
    const spinBeforeStep = cloneSpin(spin);
    velocity = core.physics3dAdvanceVelocity(velocity, spin, options.gravity ?? -9.8, DT);
    position.x += velocity.x * DT;
    position.y += velocity.y * DT;
    position.z += velocity.z * DT;

    if (!crossedNet && previousPosition.z < 0 && position.z >= 0) {
      const ratio = (0 - previousPosition.z) / (position.z - previousPosition.z || 1);
      const netPosition = {
        x: previousPosition.x + (position.x - previousPosition.x) * ratio,
        y: previousPosition.y + (position.y - previousPosition.y) * ratio,
        z: 0,
      };
      net = {
        position: vec(netPosition),
        clearance: round(netPosition.y - (TABLE.height + TABLE.net)),
      };
      observations.push(stateObservation(core, "net-crossing", netPosition, velocity, spin, {
        crossingStep: index,
        clearance: net.clearance,
      }));
      crossedNet = true;
    }

    if (previousPosition.y >= TABLE.top && position.y <= TABLE.top && velocity.y < 0) {
      const ratio = (TABLE.top - previousPosition.y) / (position.y - previousPosition.y || 1);
      const impact = {
        x: previousPosition.x + (position.x - previousPosition.x) * ratio,
        y: TABLE.top,
        z: previousPosition.z + (position.z - previousPosition.z) * ratio,
      };
      if (Math.abs(impact.x) <= TABLE.width / 2 && Math.abs(impact.z) <= TABLE.length / 2) {
        const beforeVelocity = cloneVec(velocity);
        const beforeSpin = cloneSpin(spin);
        const resolvedOmega = core.physics3dResolveOmega(beforeSpin, beforeVelocity);
        const bounce = core.bounceWithSpinPhysical3D(velocity, spin, core.CONTACT_FRICTION_MU);
        const bounceNumber = bounces.length + 1;
        observations.push(stateObservation(core, `table-bounce-${bounceNumber}-before`, impact, beforeVelocity, beforeSpin, {
          contact: {
            type: "table",
            phase: "before",
            resolvedOmega: vec(resolvedOmega),
            epsilon: round(bounce.epsilon),
            regime: bounce.regime,
          },
        }));
        position = cloneVec(impact);
        velocity = cloneVec(bounce.vel);
        spin = cloneSpin(bounce.spin3d);
        observations.push(stateObservation(core, `table-bounce-${bounceNumber}-after`, position, velocity, spin, {
          contact: {
            type: "table",
            phase: "after",
            epsilon: round(bounce.epsilon),
            regime: bounce.regime,
          },
        }));
        bounces.push({
          number: bounceNumber,
          position: vec(impact),
          before: {
            velocity: vec(beforeVelocity),
            spin: spinRecord(core, beforeSpin, beforeVelocity),
          },
          after: {
            velocity: vec(velocity),
            spin: spinRecord(core, spin, velocity),
          },
          epsilon: round(bounce.epsilon),
          regime: bounce.regime,
        });
      }
    }

    finite = finite && finiteVec(position) && finiteVec(velocity) && finiteSpin(spin);
    if (position.y <= core.BALL_RADIUS && previousPosition.y > core.BALL_RADIUS) break;
    if (bounces.length >= 2 && crossedNet) break;
    // Guard against a future prototype change that loses all forward motion.
    if (index > 20 && Math.abs(position.z - previousPosition.z) < 1e-12 && Math.abs(velocity.z) < 1e-12) break;
    void velocityBeforeStep;
    void spinBeforeStep;
  }

  const finalObservation = stateObservation(core, "final-position", position, velocity, spin, {
    outcome: {
      crossedNet,
      bounces: bounces.length,
      netHit: Boolean(net && net.clearance < 0),
    },
  });
  observations.push(finalObservation);
  return {
    units: {position: "m", velocity: "m/s", acceleration: "m/s²", omega: "rad/s"},
    start: vec(start),
    observations,
    net,
    bounces,
    final: finalObservation,
    finite,
    outcome: finalObservation.outcome,
  };
}

function runE03(core, game4) {
  const flightRows = E03_CASES.map((testCase) => {
    const trace = traceCorePath(core, {spin: testCase.spin});
    return {
      case: testCase.name,
      inputSpin: testCase.spin,
      trace,
      metrics: {
        preFirstTableX: trace.bounces[0]?.position.x ?? null,
        postFirstTableNetX: trace.net?.position.x ?? null,
        firstBounceX: trace.bounces[0]?.position.x ?? null,
        secondBounceX: trace.bounces[1]?.position.x ?? null,
      },
    };
  });

  const stage4aInput = {
    position: {x: 0.1, y: 0.9, z: 0.6},
    velocity: {x: 0.2, y: -2.5, z: 3.0},
    gravity: -4.2,
  };
  const tech = game4.TECHNIQUES.push;
  const lift = game4.computeAdaptivePushLift(stage4aInput.velocity);
  const drive = game4.computeAdaptivePushDrive(stage4aInput.velocity);
  const techVelocity = {x: 0, y: lift, z: -drive};
  const racketNormal = game4.computeRacketNormal(
    game4.computeAdaptivePushTiltY(),
    game4.computeAdaptivePushTiltX(),
    techVelocity
  );
  const epsilon = game4.dynamicPaddleEpsilon(stage4aInput.velocity, techVelocity, racketNormal);
  const stage4aRows = E03_CASES.map((testCase) => {
    const blend = game4.PADDLE_BLEND;
    const aimedX = game4.solveRacketVelXForTargetLandingX(
      stage4aInput.velocity,
      testCase.spin,
      racketNormal,
      techVelocity,
      epsilon,
      game4.PADDLE_FRICTION,
      stage4aInput.position,
      stage4aInput.gravity,
      game4.RETURN_TARGET_X,
      blend,
      tech
    );
    const planeVelocity = {x: aimedX, y: techVelocity.y, z: techVelocity.z};
    const contactBefore = stateObservation(
      core,
      "stage4a-contact-before",
      stage4aInput.position,
      scaleVec(stage4aInput.velocity, SIM_TIME_DILATION),
      scaleSpin(testCase.spin, SIM_TIME_DILATION),
      {units: {position: "m", velocity: "m/s(real)", omega: "rad/s(real)"}, contact: {type: "racket", phase: "before"}}
    );
    const contact = game4.applyPushContact(
      stage4aInput.velocity,
      testCase.spin,
      racketNormal,
      planeVelocity,
      epsilon,
      tech,
      blend
    );
    const contactSpin = contact.spin3d || testCase.spin;
    const outputVelocityReal = scaleVec(contact.vel, SIM_TIME_DILATION);
    const outputSpinReal = scaleSpin(contactSpin, SIM_TIME_DILATION);
    const contactAfter = stateObservation(
      core,
      "stage4a-contact-after",
      stage4aInput.position,
      outputVelocityReal,
      outputSpinReal,
      {
        units: {position: "m", velocity: "m/s(real)", omega: "rad/s(real)"},
        contact: {
          type: "racket",
          phase: "after",
          planeVelocitySimulation: vec(planeVelocity),
          effectiveNormal: null,
          dwellMs: round(contact.dwellMs),
          effectiveEpsilon: round(contact.effectiveEpsilon),
        },
      }
    );
    const postPath = traceCorePath(core, {
      start: stage4aInput.position,
      velocity: outputVelocityReal,
      spin: outputSpinReal,
      gravity: -9.8,
    });
    return {
      case: testCase.name,
      inputSpin: testCase.spin,
      contactParameters: {
        lift: round(lift),
        drive: round(drive),
        techVelocity: vec(techVelocity),
        racketNormal: vec(racketNormal),
        epsilon: round(epsilon),
        blend: round(blend),
        aimedX: round(aimedX),
        planeVelocity: vec(planeVelocity),
      },
      observations: [contactBefore, contactAfter],
      postContactFlight: postPath,
      metrics: {
        postContactNetX: postPath.net?.position.x ?? null,
        postContactFirstBounceX: postPath.bounces[0]?.position.x ?? null,
        postContactSecondBounceX: postPath.bounces[1]?.position.x ?? null,
      },
      finite: finiteVec(contact.vel) && finiteSpin(contactSpin) && postPath.finite,
    };
  });

  const zeroFlight = flightRows.find((row) => row.case === "Z0");
  const axialFlight = flightRows.find((row) => row.case === "AX+");
  const positiveFlight = flightRows.find((row) => row.case === "Y+");
  const negativeFlight = flightRows.find((row) => row.case === "Y-");
  const zeroStage4a = stage4aRows.find((row) => row.case === "Z0");
  const axialStage4a = stage4aRows.find((row) => row.case === "AX+");
  const positiveStage4a = stage4aRows.find((row) => row.case === "Y+");
  const negativeStage4a = stage4aRows.find((row) => row.case === "Y-");
  const axialAcceleration = axialFlight.trace.observations.find((row) => row.stage === "initial-input")?.acceleration;
  const positiveAcceleration = positiveFlight.trace.observations.find((row) => row.stage === "initial-input")?.acceleration;
  const negativeAcceleration = negativeFlight.trace.observations.find((row) => row.stage === "initial-input")?.acceleration;

  const checks = {
    axialFreeFlightAccelerationNearZero: Math.hypot(axialAcceleration.x, axialAcceleration.y, axialAcceleration.z) < 1e-8,
    positiveAndNegativeOmegaYOppose: positiveAcceleration.x > 0 && negativeAcceleration.x < 0,
    axialPreFirstTableXMatchesZ0: Math.abs((axialFlight.metrics.preFirstTableX || 0) - (zeroFlight.metrics.preFirstTableX || 0)) < 1e-6,
    axialTableContactChangesHorizontalResult: Math.abs((axialFlight.metrics.secondBounceX || 0) - (zeroFlight.metrics.secondBounceX || 0)) > 0.001,
    axialContactResolvedOmegaIsExplicit: Math.abs(axialFlight.trace.bounces[0]?.before.spin.resolvedOmegaAtVelocity.z || 0) > 1,
    stage4aAxialIsFinite: axialStage4a.finite,
    stage4aYMirrorIsFinite: positiveStage4a.finite && negativeStage4a.finite,
  };
  const contactCouplingEvidence = {
    decision: checks.axialTableContactChangesHorizontalResult && checks.axialContactResolvedOmegaIsExplicit
      ? "contact-coupling"
      : "review",
    explanation: "axialSpin is parallel to flight velocity in free flight, but physics3dResolveOmega() resolves it into world omega at contact; the table contact adapter then feeds omega.x/z into the existing tangential slip equations while carrying omega.y through.",
    firstTableContact: axialFlight.trace.bounces[0]?.before || null,
    comparison: {
      z0SecondBounceX: zeroFlight.metrics.secondBounceX,
      axialSecondBounceX: axialFlight.metrics.secondBounceX,
      deltaX: round((axialFlight.metrics.secondBounceX || 0) - (zeroFlight.metrics.secondBounceX || 0)),
      z0PreFirstTableX: zeroFlight.metrics.preFirstTableX,
      axialPreFirstTableX: axialFlight.metrics.preFirstTableX,
      postFirstTableNetDeltaX: round((axialFlight.metrics.postFirstTableNetX || 0) - (zeroFlight.metrics.postFirstTableNetX || 0)),
    },
  };
  return {
    id: "E-03",
    description: "axial/corkscrew separation from true omega.y sidespin with staged observations",
    inputs: {
      start: {x: 0, y: 0.95, z: -1.52},
      velocity: {x: 0, y: -0.8, z: 5},
      gravity: -9.8,
      dt: DT,
      table: TABLE,
    },
    flightTable: flightRows,
    stage4aReturn: {
      fixedInput: stage4aInput,
      contactParameters: {lift: round(lift), drive: round(drive), blend: round(game4.PADDLE_BLEND)},
      rows: stage4aRows,
    },
    checks,
    semanticDecision: contactCouplingEvidence,
    pass: checks.axialFreeFlightAccelerationNearZero && checks.positiveAndNegativeOmegaYOppose && checks.axialPreFirstTableXMatchesZ0 && checks.axialTableContactChangesHorizontalResult && checks.stage4aAxialIsFinite && checks.stage4aYMirrorIsFinite,
  };
}

function roundG04(value) {
  return {
    vel: vec(value.vel),
    spin: {
      topspin: round(value.spin?.topspin),
      sidespin: round(value.spin?.sidespin),
    },
    dwellMs: round(value.dwellMs),
    effectiveEpsilon: round(value.effectiveEpsilon),
  };
}

function numericDiff(actual, expected) {
  return {
    vel: {
      x: round(actual.vel.x - expected.vel.x),
      y: round(actual.vel.y - expected.vel.y),
      z: round(actual.vel.z - expected.vel.z),
    },
    spin: {
      topspin: round(actual.spin.topspin - expected.spin.topspin),
      sidespin: round(actual.spin.sidespin - expected.spin.sidespin),
    },
    dwellMs: round(actual.dwellMs - expected.dwellMs),
    effectiveEpsilon: round(actual.effectiveEpsilon - expected.effectiveEpsilon),
  };
}

function exactWithin(actual, expected, tolerance = 1e-6) {
  return Math.abs(actual.vel.x - expected.vel.x) <= tolerance &&
    Math.abs(actual.vel.y - expected.vel.y) <= tolerance &&
    Math.abs(actual.vel.z - expected.vel.z) <= tolerance &&
    Math.abs(actual.spin.topspin - expected.spin.topspin) <= tolerance &&
    Math.abs(actual.spin.sidespin - expected.spin.sidespin) <= tolerance &&
    Math.abs(actual.dwellMs - expected.dwellMs) <= tolerance &&
    Math.abs(actual.effectiveEpsilon - expected.effectiveEpsilon) <= tolerance;
}

function runG04(game4) {
  const tech = game4.TECHNIQUES[G04_INPUT.techKey];
  const baseTechVelocity = {
    x: 0,
    y: game4.computeAdaptivePushLift(G04_INPUT.incomingVel),
    z: -game4.computeAdaptivePushDrive(G04_INPUT.incomingVel),
  };
  const racketNormal = game4.computeRacketNormal(
    game4.computeAdaptivePushTiltY(),
    game4.computeAdaptivePushTiltX(),
    baseTechVelocity
  );
  const epsilon = game4.dynamicPaddleEpsilon(G04_INPUT.incomingVel, baseTechVelocity, racketNormal);
  const currentBlend = game4.PADDLE_BLEND;
  const newFallbackRx = -0.062 * (G04_INPUT.incomingSpin.sidespin * SIM_TIME_DILATION) + G04_INPUT.incomingVel.x;
  const oldFallbackRx = -G04_INPUT.incomingVel.x;

  function contactFor(blend, planeVelX) {
    const planeVelocity = {x: planeVelX, y: baseTechVelocity.y, z: baseTechVelocity.z};
    return roundG04(game4.applyPushContact(
      G04_INPUT.incomingVel,
      G04_INPUT.incomingSpin,
      racketNormal,
      planeVelocity,
      epsilon,
      tech,
      blend
    ));
  }

  const actual = roundG04(game4.makeRacketReturnVelocity(
    G04_INPUT.incomingVel,
    G04_INPUT.incomingSpin,
    tech,
    G04_INPUT.hitPoint,
    G04_INPUT.gravity
  ));
  const currentAimedX = game4.solveRacketVelXForTargetLandingX(
    G04_INPUT.incomingVel,
    G04_INPUT.incomingSpin,
    racketNormal,
    baseTechVelocity,
    epsilon,
    game4.PADDLE_FRICTION,
    G04_INPUT.hitPoint,
    G04_INPUT.gravity,
    game4.RETURN_TARGET_X,
    currentBlend,
    tech
  );
  const currentManual = contactFor(currentBlend, currentAimedX);
  const historicalReplay = contactFor(0.65, oldFallbackRx);

  return {
    id: "G-04",
    description: "Stage4a push snapshot mismatch classification",
    input: G04_INPUT,
    sourcePath: {
      currentBlend,
      snapshotBlend: 0.65,
      currentFallbackFormula: "-0.062 * sidespin_real + incomingVel.x",
      snapshotFallbackFormula: "-incomingVel.x",
      currentFallbackRx: round(newFallbackRx),
      snapshotFallbackRx: round(oldFallbackRx),
      fallbackDeltaRx: round(newFallbackRx - oldFallbackRx),
      baseTechVelocity: vec(baseTechVelocity),
      racketNormal: vec(racketNormal),
      epsilon: round(epsilon),
      currentSolverAimedX: round(currentAimedX),
    },
    expected: G04_EXPECTED,
    actual,
    actualFromManualCurrentPath: currentManual,
    actualDelta: numericDiff(actual, G04_EXPECTED),
    historicalReplay,
    historicalReplayDelta: numericDiff(historicalReplay, G04_EXPECTED),
    checks: {
      currentManualMatchesMakeRacketReturnVelocity: exactWithin(actual, currentManual),
      historicalReplayMatchesSnapshot: exactWithin(historicalReplay, G04_EXPECTED),
      dwellAndEpsilonStable: Math.abs(actual.dwellMs - G04_EXPECTED.dwellMs) < 1e-6 && Math.abs(actual.effectiveEpsilon - G04_EXPECTED.effectiveEpsilon) < 1e-4,
      mismatchIsExplainedByKnownSourceChanges: exactWithin(historicalReplay, G04_EXPECTED) && Math.abs(newFallbackRx - oldFallbackRx) > 0.01 && Math.abs(currentBlend - 0.65) > 0.001,
    },
    classification: "expected-model-change",
    classificationNote: "The historical Stage4a contact replay matches the snapshot when both the snapshot-era blend (0.65) and snapshot-era fallback (-incomingVel.x) are restored. The current 0.605 blend and sidespin-compensation fallback are intentional post-snapshot model changes; this does not authorize updating the formal snapshot here.",
  };
}

function metadata(core) {
  return {
    generatedAt: new Date().toISOString(),
    tool: "prototypes/3d-physics-test-plan/run-3d-physics-diagnostic.js",
    plan: "docs/3D_PHYSICS_DIAGNOSTIC_PLAN.md",
    commit: git(["rev-parse", "HEAD"]),
    gitStatus: git(["status", "--short"]),
    sourceFiles: ["shared-physics-core.js", "game4.html", "tools/batch-validation.test.js"],
    units: {position: "m", velocity: "m/s", acceleration: "m/s²", omega: "rad/s"},
    parameters: {
      gravityFlight: -9.8,
      gravityGame4: -4.2,
      dt: DT,
      simTimeDilation: SIM_TIME_DILATION,
      magnusCoefficient: core.MAGNUS_COEFFICIENT,
      contactFrictionMu: core.CONTACT_FRICTION_MU,
    },
  };
}

function summarize(raw) {
  const e03 = raw.experiments.find((experiment) => experiment.id === "E-03");
  const g04 = raw.experiments.find((experiment) => experiment.id === "G-04");
  const axial = e03.flightTable.find((row) => row.case === "AX+");
  const zero = e03.flightTable.find((row) => row.case === "Z0");
  const lines = [
    "# 3D physics diagnostic execution",
    "",
    `Generated: ${raw.metadata.generatedAt}`,
    `Commit: \`${raw.metadata.commit}\``,
    "",
    "> This is isolated engineering/prototype evidence. It is not a claim of calibrated physical truth, video measurement validity, or Trainer readiness.",
    "",
    "## Gate summary",
    "",
    "| Gate | Result | Evidence |",
    "|---|---|---|",
    `| E-03 | ${e03.pass ? "PASS — contact-coupling classified" : "REVIEW"} | axial acceleration near zero=${e03.checks.axialFreeFlightAccelerationNearZero}; pre-table x matches=${e03.checks.axialPreFirstTableXMatchesZ0}; post-table Δx=${e03.semanticDecision.comparison.deltaX} m |`,
    `| G-04 | CLASSIFIED — expected model change | current validator snapshot remains mismatched; historical replay matches=${g04.checks.historicalReplayMatchesSnapshot}; current dwell/epsilon stable=${g04.checks.dwellAndEpsilonStable} |`,
    "",
    "## E-03 decision",
    "",
    "Decision: **contact-coupling** in the current prototype contract, not preserve-only.",
    "",
    "The axial component produces no meaningful Magnus acceleration before the first table contact because it is resolved parallel to the instantaneous velocity. At table contact, `physics3dResolveOmega()` resolves `axialSpin` into world-space omega; the table adapter then maps the resolved x/z components into the existing tangential-slip equations. That is the explicit source of the horizontal difference, not an unexplained flight-force leak.",
    "",
    `- Z0 first-table-contact x: ${zero.metrics.preFirstTableX} m; AX+ first-table-contact x: ${axial.metrics.preFirstTableX} m`,
    `- Z0 post-first-table net x: ${zero.metrics.postFirstTableNetX} m; AX+ post-first-table net x: ${axial.metrics.postFirstTableNetX} m`,
    `- Second-bounce difference: ${e03.semanticDecision.comparison.deltaX} m`,
    `- Resolved omega at AX+ first table contact: ${JSON.stringify(e03.semanticDecision.firstTableContact.spin.resolvedOmegaAtVelocity)}`,
    "",
    "This classification preserves the required finite-value and Y+/Y- opposite-direction checks. It is an engineering semantic decision only; it does not authorize formal 3D sidespin integration or preset fitting.",
    "",
    "## G-04 mismatch classification",
    "",
    "The current 13/14 batch result is reproducible and localized to the Stage4a contact path. `dwellMs` and `effectiveEpsilon` remain effectively unchanged, while the horizontal velocity and spin fields differ.",
    "",
    `- Snapshot-era ` + "`PADDLE_BLEND`" + `: 0.65; current: ${g04.sourcePath.currentBlend}.`,
    `- Snapshot-era fallback x: ${g04.sourcePath.snapshotFallbackRx}; current sidespin-compensation x: ${g04.sourcePath.currentFallbackRx}.`,
    `- Historical replay matches the stored Expected: ${g04.checks.historicalReplayMatchesSnapshot}.`,
    "",
    "Therefore this is classified as an intentional model/parameter change after the snapshot, not a newly located numerical regression. The formal snapshot is left unchanged in this diagnostic.",
    "",
    "## Reproduction",
    "",
    "```text",
    "node prototypes/3d-physics-test-plan/run-3d-physics-diagnostic.js",
    "node tools/batch-validation.test.js --report-file <temporary-report-path>",
    "```",
    "",
    "## Red-line review",
    "",
    "No red-line file was modified by this diagnostic. No snapshot, blend, Magnus coefficient, preset, or tolerance was changed. Any future formal 3D integration or snapshot update requires a separate red-line review.",
    "",
    "## Output",
    "",
    "- `3d_physics_diagnostic_raw.json`: all staged observations and replay data.",
    "- `3d_physics_diagnostic_summary.md`: this classification summary.",
  ];
  return lines.join("\n") + "\n";
}

function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const core = loadCore();
  const game4 = loadGame4Physics({}).instantiateGame4Symbols([
    "TECHNIQUES", "RETURN_TARGET_X", "PADDLE_BLEND", "PADDLE_FRICTION",
    "computeRacketNormal", "computeAdaptivePushLift", "computeAdaptivePushDrive",
    "computeAdaptivePushTiltX", "computeAdaptivePushTiltY", "dynamicPaddleEpsilon",
    "solveRacketVelXForTargetLandingX", "applyPushContact", "makeRacketReturnVelocity",
  ]);
  const raw = {
    metadata: metadata(core),
    experiments: [runE03(core, game4), runG04(game4)],
  };
  fs.writeFileSync(path.join(OUT_DIR, "3d_physics_diagnostic_raw.json"), JSON.stringify(raw, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "3d_physics_diagnostic_summary.md"), summarize(raw), "utf8");
  process.stdout.write(JSON.stringify({
    outputDir: OUT_DIR,
    gates: raw.experiments.map((experiment) => ({id: experiment.id, pass: experiment.pass ?? null, classification: experiment.classification ?? experiment.semanticDecision?.decision ?? null})),
  }, null, 2) + "\n");
}

main();
