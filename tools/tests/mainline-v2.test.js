#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const V2_DIR = path.join(ROOT_DIR, "mainline-v2");
const CORE_FILE = path.join(ROOT_DIR, "shared-physics-core.js");

function loadCommonJs(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadCore() {
  const source = fs.readFileSync(CORE_FILE, "utf8");
  const names = [
    "BALL_RADIUS",
    "BALL_MASS",
    "BALL_INERTIA",
    "REAL_GRAVITY_Y",
    "physics3dAdvanceVelocity",
    "physics3dPhysicalSpinFromInput",
    "physics3dSolvePlaneContact",
    "physics3dSolveCompliantPlaneContact",
    "bounceWithSpinPhysical3D",
  ];
  return vm.runInNewContext(`(function(){${source}\nreturn {${names.join(",")}};})()`, {
    Math,
    Number,
    console,
  });
}

function assertFiniteOmega(spin, label) {
  assert.strictEqual(spin.schema, 2, `${label} must be schema 2`);
  for (const axis of ["x", "y", "z"]) {
    assert.ok(Number.isFinite(spin.omega[axis]), `${label}.omega.${axis} must be finite`);
  }
}

function assertNear(actual, expected, label, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}

function testLoader(data) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "physics-presets.json"), "utf8"));
  const presets = data.loadPresetCollection(raw);
  assert.ok(presets.length > 0, "canonical loader returned no presets");
  const mixed = data.findMixedPreset(presets);
  assert.ok(mixed, "canonical loader did not find a mixed-spin preset");
  assertFiniteOmega(mixed.variation.spin3d, "mixed preset spin3d");
  assert.ok(Math.abs(mixed.variation.spin3d.omega.x) > 0, "mixed preset omega.x is zero");
  assert.ok(Math.abs(mixed.variation.spin3d.omega.y) > 0, "mixed preset omega.y is zero");
  assert.ok(!Object.prototype.hasOwnProperty.call(mixed.variation, "spin"), "legacy spin leaked into v2 preset");

  assert.throws(
    () => data.loadPresetCollection({serves: [{id: "legacy-only", variation: {spin: {topspin: 1, sidespin: 2}}}]}),
    /schema-2.*spin3d|spin3d.*schema-2/,
    "legacy-only preset must fail closed"
  );
  assert.throws(
    () => data.assertCanonicalSpin3d({schema: 2, omega: {x: Infinity, y: 0, z: 0}}, "bad"),
    /finite/,
    "non-finite omega must fail closed"
  );
  return {presets, mixed};
}

function testSpinCases(stateApi, mixed) {
  const cases = [
    ["zero", {x: 0, y: 0, z: 0}],
    ["pure-x", {x: 15, y: 0, z: 0}],
    ["pure-y", {x: 0, y: -25, z: 0}],
    ["pure-z", {x: 0, y: 0, z: 35}],
    ["mixed", mixed.variation.spin3d.omega],
    ["sign-reversed", {x: -12, y: 24, z: -36}],
  ];
  for (const [label, omega] of cases) {
    const ball = stateApi.createBallState({
      position: {x: 0, y: 0.8, z: 0},
      velocity: {x: 0.2, y: -1.2, z: 2.4},
      spin3d: {schema: 2, omega},
    });
    assertFiniteOmega({schema: 2, omega: ball.omega}, `${label} BallState`);
    assert.deepStrictEqual(ball.omega, omega, `${label} omega changed at state boundary`);
    assert.ok(!Object.prototype.hasOwnProperty.call(ball, "spin"), `${label} has mutable spin field`);
  }
}

function assertFiniteBall(ball, label) {
  for (const field of ["position", "velocity", "omega"]) {
    for (const axis of ["x", "y", "z"]) {
      assert.ok(Number.isFinite(ball[field][axis]), `${label}.${field}.${axis} must be finite`);
    }
  }
}

function assertFiniteVector(value, label) {
  for (const axis of ["x", "y", "z"]) {
    assert.ok(Number.isFinite(value[axis]), `${label}.${axis} must be finite`);
  }
}

function rotateZ(value, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: c * value.x - s * value.y,
    y: s * value.x + c * value.y,
    z: value.z,
  };
}

function mirrorAxial(value) {
  return {
    x: -value.x,
    y: -value.y,
    z: value.z,
  };
}

function assertContactContract(result, label) {
  assertFiniteBall(result.state, `${label} state`);
  const diagnostics = result.diagnostics;
  for (const field of ["normalImpulse", "dwellTime", "energyDelta", "normalVelocityBefore"]) {
    assert.ok(Number.isFinite(diagnostics[field]), `${label} diagnostics.${field} must be finite`);
  }
  assertFiniteVector(diagnostics.tangentImpulse, `${label} diagnostics.tangentImpulse`);
  assert.ok(typeof diagnostics.frictionRegime === "string", `${label} has no friction regime`);
  assert.ok(typeof diagnostics.normalModel === "string", `${label} has no normal model`);
  assert.ok(typeof diagnostics.tangentModel === "string", `${label} has no tangent model`);
  assert.ok(Object.prototype.hasOwnProperty.call(diagnostics, "racketMass"),
    `${label} has no racket mass policy diagnostic`);
  assert.ok(Object.prototype.hasOwnProperty.call(diagnostics, "wristBrake"),
    `${label} has no wrist brake policy diagnostic`);
}

function testV3ContactPolicy(contact, stateApi, core) {
  const policy = contact.createContactPolicy();
  assert.deepStrictEqual(contact.R1_TABLE_CONTACT_PROFILE, {
    normalModel: "compliant",
    tangentModel: "coulomb",
    dwellTime: 0.003,
    dt: 0.00025,
    steps: 12,
    spring: 6000,
    damping: 4,
    tangentDamping: 0,
    penetrationProfile: "harmonic",
    contactModel: "mainline-v2-r1-compliant-3d-table",
  });
  assert.strictEqual(policy.table.mode.normalModel, "compliant");
  assert.strictEqual(policy.table.mode.tangentModel, "coulomb");
  assert.strictEqual(policy.table.mode.dwellTime, 0.003);
  assert.strictEqual(policy.table.mode.dt, 0.00025);
  assert.strictEqual(policy.table.mode.steps, 12);
  assert.strictEqual(policy.table.mode.spring, 6000);
  assert.strictEqual(policy.table.mode.damping, 4);
  assert.strictEqual(policy.table.mode.penetrationProfile, "harmonic");
  const rollbackPolicy = contact.createContactPolicy({tableNormalModel: "instantaneous"});
  assert.strictEqual(rollbackPolicy.table.mode.normalModel, "instantaneous");
  assert.strictEqual(rollbackPolicy.table.contactModel, "shared-3d-table");
  assert.strictEqual(policy.racket.mode.normalModel, "compliant");
  assert.strictEqual(policy.racket.mode.tangentModel, "viscous");
  assert.strictEqual(policy.racket.mode.dwellTime, 0.004);
  assert.strictEqual(policy.racket.mode.racketMass, 0.18);
  assert.strictEqual(policy.racket.mode.wristBrake, 20);
  assert.strictEqual(policy.racket.mode.dt, 0.0005);
  assert.strictEqual(policy.racket.mode.steps, 8);

  const incoming = stateApi.createBallState({
    position: {x: 0.2, y: 0.8, z: 0.3},
    velocity: {x: 0.6, y: -2.1, z: 0.4},
    spin3d: {schema: 2, omega: {x: 18, y: -11, z: 25}},
  });
  const tableResult = contact.solveContact({
    state: incoming,
    surface: policy.table,
    mode: policy.table.mode,
  }, core);
  assertContactContract(tableResult, "table V3 contact");
  assert.strictEqual(tableResult.diagnostics.contactModel, "mainline-v2-r1-compliant-3d-table");
  assert.strictEqual(tableResult.diagnostics.penetrationProfile, "harmonic");
  assert.strictEqual(tableResult.diagnostics.contactSteps, 12);
  assert.strictEqual(tableResult.diagnostics.contactDt, 0.00025);
  assertNear(tableResult.state.omega.y, incoming.omega.y, "table V3 axial omega.y");
  assert.ok(tableResult.diagnostics.normalImpulse > 0, "table V3 contact has no normal impulse");
  assert.ok(tableResult.state.velocity.y > 0, "R1 table contact did not produce outgoing normal velocity");
  assert.ok(tableResult.diagnostics.energyDelta <= 1e-9,
    `stationary table contact increased kinetic energy: ${tableResult.diagnostics.energyDelta}`);

  const racketIncoming = stateApi.createBallState({
    position: {x: 0.2, y: 0.4, z: 0.3},
    velocity: {x: 0.6, y: 1.8, z: 2.2},
    spin3d: {schema: 2, omega: {x: -14, y: 9, z: 21}},
  });
  const racketResult = contact.solveContact({
    state: racketIncoming,
    surface: policy.racket,
    mode: policy.racket.mode,
  }, core);
  assertContactContract(racketResult, "racket V3 contact");
  assert.strictEqual(racketResult.diagnostics.contactModel, "game5-racket-adapter-v2-temporary");
  assert.ok(racketResult.diagnostics.normalImpulse > 0, "racket V3 contact has no normal impulse");

  const angle = 0.37;
  const rotatedSurface = {
    ...policy.table,
    normal: rotateZ(policy.table.normal, angle),
    surfaceVelocity: rotateZ(policy.table.surfaceVelocity, angle),
  };
  const rotatedIncoming = stateApi.createBallState({
    position: rotateZ(incoming.position, angle),
    velocity: rotateZ(incoming.velocity, angle),
    spin3d: {schema: 2, omega: rotateZ(incoming.omega, angle)},
  });
  const rotatedResult = contact.solveContact({
    state: rotatedIncoming,
    surface: rotatedSurface,
    mode: policy.table.mode,
  }, core);
  assertContactContract(rotatedResult, "rotated table V3 contact");
  for (const field of ["velocity", "omega"]) {
    const expected = rotateZ(tableResult.state[field], angle);
    for (const axis of ["x", "y", "z"]) {
      assertNear(rotatedResult.state[field][axis], expected[axis],
        `rotated-frame ${field}.${axis}`, 1e-9);
    }
  }
  assertNear(rotatedResult.diagnostics.normalImpulse, tableResult.diagnostics.normalImpulse,
    "rotated-frame normal impulse", 1e-9);
  assertNear(rotatedResult.diagnostics.energyDelta, tableResult.diagnostics.energyDelta,
    "rotated-frame energy delta", 1e-9);

  const experimentalPolicy = contact.createContactPolicy({
    racketNormalModel: "compliant",
    racketTangentModel: "viscous",
    racketDwellTime: 0.004,
    racketMass: 0.18,
    racketWristBrake: 20,
    racketContactDt: 0.0005,
    racketContactSteps: 8,
    racketSpring: 5000,
    racketDamping: 4,
    racketTangentDamping: 0.5,
  });
  const experimentalResult = contact.solveContact({
    state: racketIncoming,
    surface: experimentalPolicy.racket,
    mode: experimentalPolicy.racket.mode,
  }, core);
  assertContactContract(experimentalResult, "experimental V3 racket contact");
  assert.strictEqual(experimentalResult.diagnostics.normalModel, "compliant");
  assert.strictEqual(experimentalResult.diagnostics.tangentModel, "viscous");
  assert.strictEqual(experimentalResult.diagnostics.finiteRacketMassApplied, true);
  assert.ok(experimentalResult.diagnostics.dwellTime > 0, "compliant V3 dwell time missing");
  assert.ok(experimentalResult.diagnostics.wristBrake > 0, "V3 wrist brake missing");
  assert.ok(
    experimentalResult.diagnostics.surfaceVelocityEffective.z < policy.racket.surfaceVelocity.z,
    "wrist brake did not change effective racket surface velocity"
  );
}

function testVerticalSlice(data, physics, contact, stateApi, runtimeApi, mixed, core) {
  const ball = stateApi.createBallState({
    position: {x: 0.2, y: 0.95, z: -1.2},
    velocity: {x: 0.3, y: -1.4, z: 2.2},
    spin3d: mixed.variation.spin3d,
  });
  const adapter = physics.createScaleAdapter({
    core,
    timeDilation: 2,
    simulationGravity: -2,
  });
  const simulation = adapter.realToSimulationState(ball);
  for (const axis of ["x", "y", "z"]) {
    assertNear(simulation.velocity[axis], ball.velocity[axis] / adapter.timeDilation,
      `real-to-simulation velocity ${axis}`);
    assertNear(simulation.omega[axis], ball.omega[axis] / adapter.timeDilation,
      `real-to-simulation omega ${axis}`);
  }
  assert.strictEqual(simulation.mass, ball.mass, "real-to-simulation mass changed");
  assert.strictEqual(simulation.inertia, ball.inertia, "real-to-simulation inertia changed");
  const roundTrip = adapter.simulationToRealState(simulation);
  for (const axis of ["x", "y", "z"]) {
    assertNear(roundTrip.velocity[axis], ball.velocity[axis], `velocity round-trip ${axis}`);
    assertNear(roundTrip.omega[axis], ball.omega[axis], `omega round-trip ${axis}`);
  }
  const advanced = adapter.advanceSimulationState(ball, 1 / 60, 0);
  assertFiniteOmega({schema: 2, omega: advanced.omega}, "advanced BallState");
  const dtReal = (1 / 60) / adapter.timeDilation;
  const expectedVelocity = core.physics3dAdvanceVelocity(
    ball.velocity,
    {schema: 2, omega: ball.omega},
    adapter.realGravity,
    dtReal,
    0
  );
  for (const axis of ["x", "y", "z"]) {
    assertNear(advanced.velocity[axis], expectedVelocity[axis],
      `real-scale advance velocity ${axis}`);
    assertNear(
      advanced.position[axis],
      ball.position[axis] + ((ball.velocity[axis] + expectedVelocity[axis]) * 0.5 * dtReal),
      `real-scale advance position ${axis}`
    );
  }

  const policy = contact.createContactPolicy();
  const runtime = runtimeApi.createRuntime({
    core,
    preset: mixed,
    scaleAdapter: adapter,
    contactPolicy: policy,
    contactApi: contact,
    stateApi,
    serveData: data,
  });
  assert.strictEqual(runtime.snapshot().phase, "idle");
  let session = runtime.startServe();
  assert.strictEqual(session.phase, "serve");
  assertFiniteBall(session.ball, "serve BallState");
  assert.ok(session.ball.velocity.z > 0, "geometry-derived serve must travel toward receiver");
  assert.deepStrictEqual(
    session.ball.velocity,
    data.deriveServeVelocity(mixed, {
      timeDilation: adapter.timeDilation,
      realGravity: adapter.realGravity,
      solveLaunchVelocity: adapter.solveLaunchVelocity,
    }),
    "serve velocity must be resolved once at the v2 boundary"
  );
  assert.strictEqual(session.diagnostics.at(-1).velocitySource,
    "3d-forward-solved-real-scale",
    "serve must use the mainline 3D forward solver when no preset velocity is provided");
  assertFiniteOmega({schema: 2, omega: session.ball.omega}, "serve BallState");
  session = runtime.advanceToTable();
  assert.strictEqual(session.phase, "flight");
  assert.strictEqual(session.samples.at(-1).event, "flight-to-table");
  assert.ok(Math.abs(session.ball.position.y - mixed.firstBounce.y) < 1e-9, "flight event must reach table height");
  assertFiniteBall(session.ball, "table approach BallState");
  session = runtime.contact("table");
  assert.strictEqual(session.phase, "contact");
  assert.strictEqual(session.diagnostics.at(-1).contact, "table");
  assert.strictEqual(session.diagnostics.at(-1).contactModel, "mainline-v2-r1-compliant-3d-table");
  assert.strictEqual(session.diagnostics.at(-1).penetrationProfile, "harmonic");
  assert.strictEqual(session.diagnostics.at(-1).contactSteps, 12);
  assert.ok(session.diagnostics.at(-1).regime, "table contact has no friction regime diagnostic");
  assertNear(session.ball.omega.y, mixed.variation.spin3d.omega.y, "table axial omega.y");
  assertFiniteBall(session.ball, "table contact BallState");
  const tableBounceSample = session.samples.at(-1);
  assert.strictEqual(tableBounceSample.contact, "table", "actual table bounce sample missing contact tag");
  assert.deepStrictEqual(tableBounceSample.ball.omega, session.ball.omega,
    "actual table bounce sample did not record canonical omega");
  assert.strictEqual(tableBounceSample.diagnostic.scale.state, "real-scale",
    "actual table bounce sample is not real-scale");
  session = runtime.advanceToRacket({durationSimulation: 0.3});
  assert.strictEqual(session.phase, "flight");
  assert.strictEqual(session.samples.at(-1).event, "flight-to-racket");
  assert.strictEqual(session.samples.at(-1).leg, "post-table");
  assertFiniteBall(session.ball, "racket approach BallState");
  session = runtime.contact("racket");
  assert.strictEqual(session.phase, "contact");
  assert.strictEqual(session.diagnostics.at(-1).contact, "racket");
  assert.strictEqual(session.diagnostics.at(-1).adapter, "game5-racket-adapter-v2-temporary");
  assert.ok(session.diagnostics.at(-1).regime, "racket contact has no friction regime diagnostic");
  assertFiniteBall(session.ball, "racket contact BallState");
  const racketOmega = {...session.ball.omega};
  session = runtime.beginReturn();
  assert.strictEqual(session.phase, "return");
  assert.strictEqual(session.samples.at(-1).event, "return-start");
  session = runtime.advanceReturn(1 / 120);
  assert.strictEqual(session.phase, "return");
  assert.deepStrictEqual(session.ball.omega, racketOmega, "return flight must read racket canonical omega");
  assertFiniteBall(session.ball, "return flight BallState");
  session = runtime.finish({status: "ok"});
  assert.strictEqual(session.phase, "result");
  assert.deepStrictEqual(session.samples.map((sample) => sample.phase),
    ["serve", "flight", "contact", "flight", "contact", "return", "return"],
    "V2 vertical slice phases changed");
  assert.deepStrictEqual(session.samples.filter((sample) => sample.contact).map((sample) => sample.contact),
    ["table", "racket"], "V2 contact order changed");
  for (const sample of session.samples) {
    assertFiniteBall(sample.ball, `${sample.phase} sample`);
    assertFiniteOmega({schema: 2, omega: sample.ball.omega}, `${sample.phase} sample`);
    assert.ok(sample.diagnostic, `${sample.phase} sample has no diagnostic`);
    assert.ok(sample.diagnostic.scale && sample.diagnostic.scale.state === "real-scale",
      `${sample.phase} sample has no real-scale diagnostic`);
  }
}

function testLegacyBoundary(legacy, core, mixed) {
  const adapted = legacy.fromLegacySpin(
    {topspin: mixed.variation.spin3d.omega.x, sidespin: -mixed.variation.spin3d.omega.z},
    {x: 0, y: 0, z: 2},
    core
  );
  assertFiniteOmega(adapted, "explicit legacy adapter result");
}

function testV6OmegaHud(omegaHud) {
  const cases = [
    ["zero", {x: 0, y: 0, z: 0}, "無旋轉", 0],
    ["pure-x", {x: 12, y: 0, z: 0}, "上／下旋分量", 12],
    ["pure-y", {x: 0, y: -16, z: 0}, "側旋分量", 16],
    ["pure-z", {x: 0, y: 0, z: 20}, "軸向分量", 20],
    ["mixed", {x: 3, y: -4, z: 12}, "上／下旋分量＋側旋分量＋軸向分量", 13],
  ];
  for (const [label, omega, semanticLabel, magnitude] of cases) {
    const model = omegaHud.createModel(omega);
    assert.deepStrictEqual(model.raw, omega, `V6 ${label} HUD changed canonical omega`);
    assertNear(model.magnitude, magnitude, `V6 ${label} HUD magnitude`);
    assert.strictEqual(model.semanticLabel, semanticLabel, `V6 ${label} HUD semantic label`);
    for (const axis of ["x", "y", "z"]) {
      assert.ok(model.formatted[axis].endsWith("rad/s"),
        `V6 ${label} HUD ${axis} is not formatted as rad/s`);
    }
    assert.ok(model.formatted.magnitude.endsWith("rad/s"),
      `V6 ${label} HUD magnitude is not formatted as rad/s`);
  }
  assert.throws(
    () => omegaHud.createModel({x: 0, y: Infinity, z: 0}),
    /omega\.y must be finite/,
    "V6 HUD must reject non-finite canonical omega"
  );

  const indexSource = fs.readFileSync(path.join(V2_DIR, "index.html"), "utf8");
  const viewSource = fs.readFileSync(path.join(V2_DIR, "view.js"), "utf8");
  const hudSource = fs.readFileSync(path.join(V2_DIR, "omega-hud.js"), "utf8");
  for (const id of ["omegaHud", "omegaSemantic", "omegaX", "omegaY", "omegaZ", "omegaMagnitude"]) {
    assert.ok(indexSource.includes(`id="${id}"`), `V6 HUD missing DOM id ${id}`);
  }
  for (const axis of ["omega.x", "omega.y", "omega.z"]) {
    assert.ok(indexSource.includes(axis), `V6 HUD missing axis label ${axis}`);
  }
  assert.ok(indexSource.includes("aria-live=\"polite\""), "V6 HUD is not live-readable");
  assert.ok(/\.omega-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/.test(indexSource),
    "V6 HUD is not mobile-first two-column layout");
  assert.ok(/@media\s*\(min-width:\s*720px\)[\s\S]*\.omega-grid\s*\{[^}]*repeat\(4,/.test(indexSource),
    "V6 HUD desktop enhancement is missing");
  assert.ok(/MainlineV2OmegaHud\.createModel\(omega\)/.test(viewSource),
    "view does not resolve HUD from runtime canonical omega");
  assert.ok(/Math\.hypot\(omega\.x, omega\.y, omega\.z\)/.test(hudSource),
    "HUD norm is not computed from all three canonical axes");
  for (const source of [viewSource, hudSource]) {
    assert.ok(!/variation\.spin\b/.test(source), "V6 HUD reads legacy variation.spin");
    assert.ok(!/spin\.sidespin/.test(source), "V6 HUD reads legacy spin.sidespin");
  }
  assert.ok(indexSource.indexOf('src="omega-hud.js"') < indexSource.indexOf('src="view.js"'),
    "V6 HUD module must load before view");
}

function testMotionHud(motionHud) {
  const model = motionHud.createModel({
    productPhase: "serve",
    subphase: "serve-flight",
    physics: {
      phase: "flight",
      flightLeg: "serve",
      lastContact: null,
      contactCount: 0,
      ball: {
        position: {x: 0.32, y: 0.95, z: -1.52},
        velocity: {x: 0.08, y: 2.03, z: 1.30},
      },
    },
  });
  assert.strictEqual(model.hasBall, true, "motion HUD did not detect ball state");
  assert.strictEqual(model.stateLabel, "serve / serve-flight · flight / serve");
  assert.strictEqual(model.physicsLabel, "flight / serve");
  assert.strictEqual(model.contactLabel, "—");
  assert.strictEqual(model.contactCount, 0);
  assertNear(model.speed, Math.hypot(0.08, 2.03, 1.30), "motion HUD speed");
  assert.strictEqual(model.formatted.position, "(0.32, 0.95, -1.52) m");
  assert.strictEqual(model.formatted.velocity, "(0.08, 2.03, 1.30) m/s");
  assert.ok(model.formatted.speed.endsWith("m/s"), "motion HUD speed is not formatted as m/s");
  assert.strictEqual(
    motionHud.createModel({productPhase: "video", subphase: "video-playback", physics: null}).hasBall,
    false,
    "motion HUD should expose no-ball state before runtime starts"
  );
  assert.throws(
    () => motionHud.createModel({physics: {
      phase: "flight",
      ball: {
        position: {x: 0, y: 0, z: 0},
        velocity: {x: Infinity, y: 0, z: 0},
      },
    }}),
    /ball\.velocity\.x must be finite/,
    "motion HUD must reject non-finite velocity"
  );

  const indexSource = fs.readFileSync(path.join(V2_DIR, "index.html"), "utf8");
  const viewSource = fs.readFileSync(path.join(V2_DIR, "view.js"), "utf8");
  const hudSource = fs.readFileSync(path.join(V2_DIR, "motion-hud.js"), "utf8");
  for (const id of [
    "motionHud", "motionState", "motionPhase", "motionPosition", "motionVelocity",
    "motionSpeed", "motionContact", "motionContactCount",
  ]) {
    assert.ok(indexSource.includes(`id="${id}"`), `motion HUD missing DOM id ${id}`);
  }
  assert.ok(indexSource.includes('aria-label="ball motion diagnostics"'),
    "motion HUD accessibility label is missing");
  assert.ok(/\.motion-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/.test(indexSource),
    "motion HUD is not mobile-first two-column layout");
  assert.ok(/MainlineV2MotionHud\.createModel/.test(viewSource),
    "view does not resolve motion HUD from runtime state");
  assert.ok(/Math\.hypot\(velocity\.x, velocity\.y, velocity\.z\)/.test(hudSource),
    "motion HUD speed is not computed from all velocity axes");
  assert.ok(/\.ball\.bounce\s*\{/.test(indexSource),
    "ball bounce feedback style is missing");
  assert.ok(/triggerAnimation\(ball, "bounce"\)/.test(viewSource),
    "table bounce does not produce a visible ball feedback animation");
  assert.ok(indexSource.indexOf('src="motion-hud.js"') < indexSource.indexOf('src="view.js"'),
    "motion HUD module must load before view");
}

function testV71TableGeometry(geometry) {
  const reference = geometry.PHYSICAL_TABLE_REFERENCE;
  assert.deepStrictEqual(reference, {
    length: 2.74,
    width: 1.525,
    surfaceY: 0.781,
    netHeight: 0.1525,
    ballRadius: 0.02,
  }, "V7.1 display reference drifted from the existing table model");

  const projector = geometry.createProjector({width: 351, height: 382});
  const polygon = projector.tablePolygon();
  assert.strictEqual(polygon.length, 4, "V7.1 table polygon must have four corners");
  for (const [index, point] of polygon.entries()) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y),
      `V7.1 table corner ${index} is not finite`);
  }
  const farWidth = Math.abs(polygon[1].x - polygon[0].x);
  const nearWidth = Math.abs(polygon[2].x - polygon[3].x);
  assert.ok(nearWidth > farWidth, "V7.1 table projection is not a near-wide trapezoid");

  const surfacePoint = projector.projectWorld({x: 0, y: reference.surfaceY, z: 0});
  const airbornePoint = projector.projectWorld({x: 0, y: reference.surfaceY + 1, z: 0});
  assert.ok(airbornePoint.y < surfacePoint.y,
    "V7.1 airborne ball must project above the same table point");

  const outsideLanding = projector.projectTablePoint({x: 4, y: -20, z: 4});
  const edgeLanding = projector.projectTablePoint({
    x: reference.width / 2,
    y: reference.surfaceY,
    z: reference.length / 2,
  });
  assertNear(outsideLanding.x, edgeLanding.x, "V7.1 landing x clamp", 1e-9);
  assertNear(outsideLanding.y, edgeLanding.y, "V7.1 landing z clamp", 1e-9);

  for (const [label, segment] of [
    ["center", projector.centerSegment()],
    ["net", projector.netSegment()],
  ]) {
    for (const endpoint of [segment.a, segment.b]) {
      assert.ok(Number.isFinite(endpoint.x) && Number.isFinite(endpoint.y),
        `V7.1 ${label} endpoint is not finite`);
    }
  }
  assert.ok(projector.netSegment().b.x > projector.netSegment().a.x,
    "V7.1 net must span left to right across the table");

  const indexSource = fs.readFileSync(path.join(V2_DIR, "index.html"), "utf8");
  const viewSource = fs.readFileSync(path.join(V2_DIR, "view.js"), "utf8");
  for (const id of ["tableSurface", "tableCenterLine", "tableNet"]) {
    assert.ok(indexSource.includes(`id="${id}"`), `V7.1 table geometry is missing ${id}`);
  }
  assert.ok(indexSource.indexOf('src="table-geometry.js"') < indexSource.indexOf('src="view.js"'),
    "V7.1 geometry module must load before view");
  assert.ok(/MainlineV2TableGeometry\.createProjector/.test(viewSource),
    "view does not create the shared V7.1 geometry projector");
  assert.ok(/projectWorld\(ball\.position\)/.test(viewSource),
    "ball is not positioned through the shared world projector");
  assert.ok(/projectTablePoint/.test(viewSource),
    "landing marker is not positioned through the shared table projector");
  assert.ok(!/\/ 1\.4|\/ 3\.4|\/ 2\.5/.test(viewSource),
    "view still contains independent legacy visual scale ratios");
  assert.ok(!/perspective\(420px\)/.test(indexSource),
    "table surface still uses the independent CSS perspective transform");
  assert.ok(/clipPath/.test(viewSource), "table polygon is not applied to the visual surface");
}

function testFull3DReset(data, physics, contact, stateApi, runtimeApi, mixed, core, presets, trajectoryDiagnostics, geometry) {
  const adapter = physics.createScaleAdapter({
    core,
    timeDilation: Math.sqrt(9.81 / 4.2),
    simulationGravity: -4.2,
  });
  const policy = contact.createContactPolicy();
  const createRuntime = (preset) => runtimeApi.createRuntime({
    core,
    preset,
    scaleAdapter: adapter,
    contactPolicy: policy,
    contactApi: contact,
    stateApi,
    serveData: data,
    trajectoryDiagnostics,
    tableGeometry: geometry.PHYSICAL_TABLE_REFERENCE,
  });

  const runtime = createRuntime(mixed);
  let state = runtime.startServe();
  state = runtime.advanceToTable();
  const tableCrossingDiagnostic = state.diagnostics.at(-1).tableCrossing;
  assert.ok(tableCrossingDiagnostic && tableCrossingDiagnostic.inBounds,
    "Full-3D Reset table approach did not produce an in-bounds crossing diagnostic");
  const expectedRawContact = contact.solveContact({
    state: state.ball,
    surface: policy.table,
    mode: policy.table.mode,
  }, core).state;
  state = runtime.contact("table");
  for (const field of ["position", "velocity", "omega"]) {
    for (const axis of ["x", "y", "z"]) {
      assertNear(state.ball[field][axis], expectedRawContact[field][axis],
        `Full-3D Reset raw table contact ${field}.${axis}`);
    }
  }
  assert.strictEqual(state.diagnostics.at(-1).trajectoryBridge, undefined,
    "Full-3D Reset table contact still exposes a trajectory bridge");

  const dt = 1 / 120;
  const expectedNext = adapter.advanceSimulationState(state.ball, dt);
  state = runtime.advanceFlight(dt);
  for (const field of ["position", "velocity", "omega"]) {
    for (const axis of ["x", "y", "z"]) {
      assertNear(state.ball[field][axis], expectedNext[field][axis],
        `Full-3D Reset post-table integration ${field}.${axis}`);
    }
  }
  const interceptRuntime = createRuntime(mixed);
  interceptRuntime.startServe();
  interceptRuntime.advanceToTable();
  interceptRuntime.contact("table");
  const interceptReference = {
    x: 0.12,
    y: 0.91,
    z: 0.22,
    meaning: "test-independent-racket-intercept-reference",
  };
  state = interceptRuntime.advanceToRacket({durationSimulation: 0.3, interceptReference});
  assert.deepStrictEqual(state.diagnostics.at(-1).interceptReference, interceptReference,
    "racket intercept reference must be independent from secondBounce");

  for (const preset of presets) {
    const presetRuntime = createRuntime(preset);
    presetRuntime.startServe();
    const presetApproach = presetRuntime.advanceToTable();
    const presetCrossing = presetApproach.diagnostics.at(-1).tableCrossing;
    assert.ok(presetCrossing,
      `Full-3D Reset preset ${preset.id} has no table-crossing diagnostic`);
    assertNear(presetCrossing.point.x, preset.firstBounce.x,
      `3D serve solve ${preset.id} first-bounce x`, 1e-3);
    assertNear(presetCrossing.point.z, preset.firstBounce.z,
      `3D serve solve ${preset.id} first-bounce z`, 1e-3);
    const presetState = presetRuntime.contact("table");
    assert.strictEqual(presetState.diagnostics.at(-1).trajectoryBridge, undefined,
      `Full-3D Reset preset ${preset.id} still uses a trajectory bridge`);
  }

  const pathSummary = {netCrossings: 0, netClearanceFailures: 0, secondTableContacts: 0};
  for (const preset of presets) {
    const presetRuntime = createRuntime(preset);
    presetRuntime.startServe();
    presetRuntime.advanceToTable();
    let stateAfterTable = presetRuntime.contact("table");
    let before = stateAfterTable.ball;
    for (let index = 0; index < 720; index += 1) {
      const after = adapter.advanceSimulationState(before, 1 / 240);
      const net = trajectoryDiagnostics.netCrossing(before, after, geometry.PHYSICAL_TABLE_REFERENCE);
      if (net) {
        pathSummary.netCrossings += 1;
        if (!net.passesNet) pathSummary.netClearanceFailures += 1;
      }
      const secondTable = trajectoryDiagnostics.tableCrossing(
        before, after, geometry.PHYSICAL_TABLE_REFERENCE, preset.firstBounce.y
      );
      if (secondTable) {
        pathSummary.secondTableContacts += 1;
        break;
      }
      before = after;
    }
  }
  assert.ok(pathSummary.netCrossings > 0 && pathSummary.netCrossings < presets.length,
    "Full-3D path diagnostics did not distinguish raw net crossings from non-crossing paths");
  assert.strictEqual(pathSummary.netClearanceFailures, 0,
    "R1 table contact candidate produced insufficient net clearance");
  assert.ok(pathSummary.secondTableContacts > 0,
    "Full-3D path diagnostics did not observe raw second table contacts");

  const indexSource = fs.readFileSync(path.join(V2_DIR, "index.html"), "utf8");
  const runtimeSource = fs.readFileSync(path.join(V2_DIR, "runtime.js"), "utf8");
  const productSource = fs.readFileSync(path.join(V2_DIR, "game5-product.js"), "utf8");
  const viewSource = fs.readFileSync(path.join(V2_DIR, "view.js"), "utf8");
  const diagnosticsSource = fs.readFileSync(path.join(V2_DIR, "trajectory-diagnostics.js"), "utf8");
  const forbiddenBridgeSource = /trajectoryBridge|createPostTableLaunch|postTableBridge|postTableTargetHeightOffset|MainlineV2TrajectoryBridge/;
  for (const [label, source] of [
    ["index", indexSource], ["runtime", runtimeSource], ["product", productSource], ["view", viewSource],
  ]) {
    assert.ok(!forbiddenBridgeSource.test(source),
      `Full-3D Reset ${label} source still contains V7.2 velocity replacement wiring`);
  }
  assert.ok(/racketInterceptDurationSimulation/.test(productSource),
    "product does not expose an independent racket intercept timing boundary");
  assert.ok(/racketInterceptPoint/.test(productSource),
    "product does not record the raw integrated racket intercept point");
  assert.ok(/secondBounce/.test(productSource),
    "product lost the validation-only secondBounce reference");
  assert.ok(!/secondBounce/.test(runtimeSource),
    "runtime still uses secondBounce during flight or contact");
  assert.ok(!/secondBounce/.test(viewSource),
    "view still uses secondBounce to position the racket or ball");
  assert.ok(!/secondBounce/.test(diagnosticsSource),
    "trajectory diagnostics must not use secondBounce as a physical target");
  assert.ok(/netCrossing/.test(diagnosticsSource) && /tableCrossing/.test(diagnosticsSource),
    "trajectory diagnostics do not expose net and table crossing checks");
  assert.ok(!indexSource.includes('src="trajectory-bridge.js"'),
    "Full-3D Reset page still loads the removed trajectory bridge");
  assert.ok(indexSource.indexOf('src="trajectory-diagnostics.js"') < indexSource.indexOf('src="runtime.js"'),
    "trajectory diagnostics must load before the runtime");
  assert.ok(/emit\("net-crossing"/.test(productSource),
    "product shell does not expose the raw-path net-crossing event");
  assert.ok(/\.ball\.net-crossing\s*\{/.test(indexSource),
    "net-crossing visual feedback style is missing");
  assert.ok(/triggerAnimation\(ball, "net-crossing"\)/.test(viewSource),
    "view does not pulse the ball when the raw path crosses the net");
  assert.ok(!/if \(physics\.phase === "contact"\) runtime\.advanceFlight/.test(productSource),
    "product shell freezes post-table flight after the first step");
}

function testV5ContractRegressions(data, physics, contact, stateApi, runtimeApi, mixed, core, legacy) {
  const policy = contact.createContactPolicy();
  const cases = [
    ["zero", {x: 0, y: 0, z: 0}],
    ["pure-topspin-x", {x: 18, y: 0, z: 0}],
    ["pure-axial-y", {x: 0, y: -24, z: 0}],
    ["pure-sidespin-z", {x: 0, y: 0, z: 32}],
    ["mixed", mixed.variation.spin3d.omega],
    ["sign-reversed", {x: -18, y: 24, z: -32}],
  ];

  for (const [label, omega] of cases) {
    const incoming = stateApi.createBallState({
      position: {x: 0.2, y: 0.8, z: 0.3},
      velocity: {x: 0.6, y: -2.1, z: 0.4},
      spin3d: {schema: 2, omega},
    });
    const result = contact.solveContact({
      state: incoming,
      surface: policy.table,
      mode: policy.table.mode,
    }, core);
    assertContactContract(result, `V5 ${label} table contact`);
    assert.ok(result.diagnostics.normalImpulse > 0, `V5 ${label} table contact has no normal impulse`);
    assert.ok(result.diagnostics.energyDelta <= 1e-9,
      `V5 ${label} stationary table contact increased kinetic energy: ${result.diagnostics.energyDelta}`);
    assert.ok(
      contact.kineticEnergy(result.state) <= contact.kineticEnergy(incoming) + 1e-9,
      `V5 ${label} table kinetic energy increased`
    );
  }

  const incoming = stateApi.createBallState({
    position: {x: 0.2, y: 0.8, z: 0.3},
    velocity: {x: 0.6, y: -2.1, z: 0.4},
    spin3d: {schema: 2, omega: mixed.variation.spin3d.omega},
  });
  const baseResult = contact.solveContact({
    state: incoming,
    surface: policy.table,
    mode: policy.table.mode,
  }, core);
  const mirroredIncoming = stateApi.createBallState({
    position: mirrorAxial(incoming.position),
    velocity: mirrorAxial(incoming.velocity),
    spin3d: {schema: 2, omega: mirrorAxial(incoming.omega)},
    mass: incoming.mass,
    inertia: incoming.inertia,
  });
  const mirroredSurface = {
    ...policy.table,
    normal: mirrorAxial(policy.table.normal),
    surfaceVelocity: mirrorAxial(policy.table.surfaceVelocity),
  };
  const mirroredResult = contact.solveContact({
    state: mirroredIncoming,
    surface: mirroredSurface,
    mode: policy.table.mode,
  }, core);
  assertContactContract(mirroredResult, "V5 axial mirror table contact");
  for (const field of ["velocity", "omega"]) {
    const expected = mirrorAxial(baseResult.state[field]);
    for (const axis of ["x", "y", "z"]) {
      assertNear(mirroredResult.state[field][axis], expected[axis],
        `V5 axial mirror ${field}.${axis}`, 1e-9);
    }
  }
  assertNear(mirroredResult.diagnostics.normalImpulse, baseResult.diagnostics.normalImpulse,
    "V5 axial mirror normal impulse", 1e-9);
  assertNear(mirroredResult.diagnostics.energyDelta, baseResult.diagnostics.energyDelta,
    "V5 axial mirror energy delta", 1e-9);
  assert.strictEqual(mirroredResult.diagnostics.frictionRegime, baseResult.diagnostics.frictionRegime,
    "V5 axial mirror friction regime changed");

  const racketIncoming = stateApi.createBallState({
    position: {x: 0.2, y: 0.4, z: 0.3},
    velocity: {x: 0.6, y: 1.8, z: 2.2},
    spin3d: {schema: 2, omega: {x: -14, y: 9, z: 21}},
  });
  const racketAngle = -0.41;
  const rotatedRacketSurface = {
    ...policy.racket,
    normal: rotateZ(policy.racket.normal, racketAngle),
    surfaceVelocity: rotateZ(policy.racket.surfaceVelocity, racketAngle),
  };
  const rotatedRacketIncoming = stateApi.createBallState({
    position: rotateZ(racketIncoming.position, racketAngle),
    velocity: rotateZ(racketIncoming.velocity, racketAngle),
    spin3d: {schema: 2, omega: rotateZ(racketIncoming.omega, racketAngle)},
  });
  const racketResult = contact.solveContact({
    state: racketIncoming,
    surface: policy.racket,
    mode: policy.racket.mode,
  }, core);
  const rotatedRacketResult = contact.solveContact({
    state: rotatedRacketIncoming,
    surface: rotatedRacketSurface,
    mode: policy.racket.mode,
  }, core);
  assertContactContract(rotatedRacketResult, "V5 rotated racket contact");
  for (const field of ["velocity", "omega"]) {
    const expected = rotateZ(racketResult.state[field], racketAngle);
    for (const axis of ["x", "y", "z"]) {
      assertNear(rotatedRacketResult.state[field][axis], expected[axis],
        `V5 rotated racket ${field}.${axis}`, 1e-9);
    }
  }
  assertNear(rotatedRacketResult.diagnostics.normalImpulse, racketResult.diagnostics.normalImpulse,
    "V5 rotated racket normal impulse", 1e-9);

  const productionFiles = [
    "serve-data.js",
    "physics-adapter.js",
    "contact-policy.js",
    "trainer-state.js",
    "runtime.js",
    "product-data.js",
    "game5-product.js",
    "view.js",
  ];
  for (const file of productionFiles) {
    const source = fs.readFileSync(path.join(V2_DIR, file), "utf8");
    assert.ok(!/variation\.spin\b/.test(source), `V5 ${file} reads legacy variation.spin`);
    assert.ok(!/spin\.sidespin/.test(source), `V5 ${file} reads legacy spin.sidespin`);
  }
  const legacySource = fs.readFileSync(path.join(V2_DIR, "legacy-adapter.js"), "utf8");
  assert.ok(/fromLegacySpin/.test(legacySource), "legacy adapter entry is missing");
  assert.ok(/fromLegacyVariation/.test(legacySource), "legacy variation adapter entry is missing");
  assert.throws(
    () => legacy.fromLegacyVariation({spin: {topspin: 1}, spin3d: {schema: 2}}, {x: 0, y: 0, z: 1}, core),
    /legacy variation must contain spin and no canonical spin3d/,
    "legacy adapter must not accept mixed legacy/canonical payloads"
  );

  const adapter = physics.createScaleAdapter({
    core,
    timeDilation: 2,
    simulationGravity: -2,
  });
  const runtime = runtimeApi.createRuntime({
    core,
    preset: mixed,
    scaleAdapter: adapter,
    contactPolicy: policy,
    contactApi: contact,
    stateApi,
    serveData: data,
  });
  let session = runtime.startServe();
  session = runtime.advanceToTable();
  session = runtime.contact("table");
  const tableSample = session.samples.at(-1);
  assert.strictEqual(tableSample.contact, "table", "V5 runtime table sample missing");
  assert.ok(Number.isFinite(tableSample.ball.omega.x), "V5 runtime table sample omega.x missing");
  assert.ok(Number.isFinite(tableSample.ball.omega.y), "V5 runtime table sample omega.y missing");
  assert.ok(Number.isFinite(tableSample.ball.omega.z), "V5 runtime table sample omega.z missing");
  assert.strictEqual(session.diagnostics.at(-1).scale.state, "real-scale",
    "V5 runtime table contact did not preserve real-scale state");
}

function testV4ProductFlow(productData, product, data, physics, contact, stateApi, runtimeApi, core, omegaHud, trajectoryDiagnostics, geometry) {
  const presetDocument = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "physics-presets.json"), "utf8"));
  const videoDocument = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "videos.json"), "utf8"));
  const presets = data.loadPresetCollection(presetDocument);
  const videos = productData.loadVideoCollection(videoDocument);
  const rounds = productData.buildRoundCatalog(presets, videos);
  assert.strictEqual(rounds.length, presets.length, "every canonical preset must have one product video");
  assert.strictEqual(new Set(rounds.map((round) => round.video.id)).size, rounds.length,
    "product video pairing must be 1:1");
  const mixedRound = productData.findMixedRound(rounds);
  assert.ok(mixedRound, "V4 product catalog did not find mixed-spin round");
  assert.strictEqual(mixedRound.video.id, mixedRound.preset.tags.videoId,
    "mixed round video must come from canonical tags.videoId");
  assert.strictEqual(mixedRound.video.reviewStatus, "approved");

  assert.throws(
    () => productData.buildRoundCatalog(
      [{...mixedRound.preset, tags: {...mixedRound.preset.tags, videoId: "missing-video"}}],
      videos
    ),
    /no approved video/,
    "missing approved video pairing must fail closed"
  );
  assert.throws(
    () => productData.buildRoundCatalog(
      [mixedRound.preset, {...mixedRound.preset, id: "duplicate-preset"}],
      videos
    ),
    /1:1/,
    "duplicate videoId pairing must fail closed"
  );
  assert.throws(
    () => productData.buildRoundCatalog(
      [{...mixedRound.preset, tags: {...mixedRound.preset.tags, videoId: undefined}}],
      videos
    ),
    /videoId/,
    "missing videoId tag must fail closed"
  );

  function runtimeFactory(preset) {
    const adapter = physics.createScaleAdapter({
      core,
      timeDilation: Math.sqrt(9.81 / 4.2),
      simulationGravity: -4.2,
    });
    return runtimeApi.createRuntime({
      core,
      preset,
      scaleAdapter: adapter,
      contactPolicy: contact.createContactPolicy(),
      contactApi: contact,
      stateApi,
      serveData: data,
      trajectoryDiagnostics,
      tableGeometry: geometry.PHYSICAL_TABLE_REFERENCE,
    });
  }

  let clock = 0;
  const events = [];
  const controller = product.createController({
    round: mixedRound,
    runtimeFactory,
    now: () => clock,
    swingDelayMs: 100,
    dtSimulation: 1 / 120,
    racketInterceptDurationSimulation: 0.3,
    returnDurationSimulation: 0.25,
    trajectoryDiagnostics,
    tableGeometry: geometry.PHYSICAL_TABLE_REFERENCE,
    onEvent: (event) => events.push(event),
  });
  let state = controller.startRound();
  assert.strictEqual(state.phase, "video");
  assert.strictEqual(state.videoId, mixedRound.video.id);
  state = controller.handoff("test-handoff");
  assert.strictEqual(state.phase, "serve");
  state = controller.chooseReturn({technique: "push", side: "forehand", direction: null});
  assert.strictEqual(state.pendingSwing.fireAt, 100);
  state = controller.updateDirection("left");
  assert.strictEqual(state.pendingSwing.direction, "left");
  for (let index = 0; index < 1000 && state.phase !== "result"; index += 1) {
    clock += 16;
    state = controller.step(1 / 120);
  }
  assert.strictEqual(state.phase, "result");
  assert.strictEqual(state.result.status, "success");
  assert.strictEqual(state.result.landing.kind, "validation-reference");
  assert.strictEqual(state.result.landing.validated, false);
  assert.strictEqual(state.result.landing.reference, "preset.secondBounce");
  const motionSamples = state.physics.samples.filter((sample) => sample && sample.ball);
  assert.ok(motionSamples.length > 8, "product flow did not record enough motion samples");
  const serveSamples = motionSamples.filter((sample) => sample.leg === "serve");
  assert.ok(serveSamples.length > 2, "product flow did not record serve-flight samples");
  const startPosition = serveSamples[0].ball.position;
  const furthestServePosition = serveSamples.reduce((furthest, sample) => {
    const distance = Math.hypot(
      sample.ball.position.x - startPosition.x,
      sample.ball.position.y - startPosition.y,
      sample.ball.position.z - startPosition.z
    );
    return distance > furthest.distance ? {distance, sample} : furthest;
  }, {distance: 0, sample: serveSamples[0]});
  assert.ok(furthestServePosition.distance > 0.25,
    `product ball did not visibly travel in world state: ${furthestServePosition.distance}`);
  const tableBounce = events.find((event) => event.type === "table-bounce");
  assert.ok(tableBounce && tableBounce.point, "product flow did not expose table-bounce point");
  assert.ok(
    Math.abs(tableBounce.point.z - startPosition.z) > 0.3,
    "table-bounce point did not differ from serve start"
  );
  const netCrossing = events.find((event) => event.type === "net-crossing");
  assert.strictEqual(state.netCrossed, Boolean(netCrossing),
    "product net-crossing state must reflect the raw integrated path");
  const tableBounceIndex = events.findIndex((event) => event.type === "table-bounce");
  const netCrossingIndex = events.findIndex((event) => event.type === "net-crossing");
  const racketContactIndex = events.findIndex((event) => event.type === "racket-contact");
  assert.ok(tableBounceIndex < racketContactIndex,
    "raw post-table event order must keep table bounce before racket contact");
  if (netCrossing) {
    assert.ok(netCrossing.point, "raw net-crossing event has no crossing point");
    assert.ok(tableBounceIndex < netCrossingIndex && netCrossingIndex < racketContactIndex,
      "raw event order must keep net crossing between table bounce and racket contact");
  }
  const racketContact = events.find((event) => event.type === "racket-contact");
  assert.ok(racketContact && racketContact.interceptPoint,
    "product flow did not expose the independent racket intercept point");
  assert.deepStrictEqual(state.racketInterceptPoint, racketContact.interceptPoint,
    "product state lost the raw integrated racket intercept point");
  const hudModel = omegaHud.createModel(state.physics.ball.omega);
  assert.deepStrictEqual(hudModel.raw, state.physics.ball.omega,
    "V6 HUD model must read the final resolved canonical omega");
  assertNear(hudModel.magnitude,
    Math.hypot(state.physics.ball.omega.x, state.physics.ball.omega.y, state.physics.ball.omega.z),
    "V6 HUD final omega norm");
  assert.strictEqual(events.find((event) => event.type === "racket-contact").direction, "left");
  for (const type of [
    "round-start", "phase-change", "video-handoff", "swing-start", "direction-change",
    "table-bounce", "swing-ready", "racket-contact", "return-start", "landing-marker", "result",
  ]) {
    assert.ok(events.some((event) => event.type === type), `V4 flow missing ${type} event`);
  }

  let failureClock = 0;
  const failureController = product.createController({
    round: mixedRound,
    runtimeFactory,
    now: () => failureClock,
    racketInterceptDurationSimulation: 0.3,
    onEvent: () => {},
  });
  let failureState = failureController.startRound();
  failureState = failureController.handoff("test-no-input");
  for (let index = 0; index < 1000 && failureState.phase !== "result"; index += 1) {
    failureClock += 16;
    failureState = failureController.step(1 / 120);
  }
  assert.strictEqual(failureState.result.status, "failure");
  assert.strictEqual(failureState.result.reason, "no-return-input");

  const productSources = ["product-data.js", "game5-product.js", "view.js"]
    .map((file) => fs.readFileSync(path.join(V2_DIR, file), "utf8"));
  for (const source of productSources) {
    assert.ok(!/variation\.spin\b/.test(source), "V4 product path reads legacy variation.spin");
    assert.ok(!/spin\.sidespin/.test(source), "V4 product path reads legacy spin.sidespin");
  }
  const indexSource = fs.readFileSync(path.join(V2_DIR, "index.html"), "utf8");
  assert.ok(indexSource.indexOf('data-region="video"') < indexSource.indexOf('data-region="table"'),
    "mobile-first product shell must place video before table");
  assert.ok(/@media\s*\(min-width:\s*720px\)[\s\S]*grid-template-columns/.test(indexSource),
    "desktop two-column layout must be opt-in at the media breakpoint");
  return rounds.length;
}

function main() {
  const data = loadCommonJs(path.join(V2_DIR, "serve-data.js"));
  const physics = loadCommonJs(path.join(V2_DIR, "physics-adapter.js"));
  const contact = loadCommonJs(path.join(V2_DIR, "contact-policy.js"));
  const stateApi = loadCommonJs(path.join(V2_DIR, "trainer-state.js"));
  const runtimeApi = loadCommonJs(path.join(V2_DIR, "runtime.js"));
  const legacy = loadCommonJs(path.join(V2_DIR, "legacy-adapter.js"));
  const productData = loadCommonJs(path.join(V2_DIR, "product-data.js"));
  const product = loadCommonJs(path.join(V2_DIR, "game5-product.js"));
  const omegaHud = loadCommonJs(path.join(V2_DIR, "omega-hud.js"));
  const motionHud = loadCommonJs(path.join(V2_DIR, "motion-hud.js"));
  const geometry = loadCommonJs(path.join(V2_DIR, "table-geometry.js"));
  const trajectoryDiagnostics = loadCommonJs(path.join(V2_DIR, "trajectory-diagnostics.js"));
  const core = loadCore();
  const loaded = testLoader(data);
  testSpinCases(stateApi, loaded.mixed);
  testVerticalSlice(data, physics, contact, stateApi, runtimeApi, loaded.mixed, core);
  testV3ContactPolicy(contact, stateApi, core);
  testLegacyBoundary(legacy, core, loaded.mixed);
  testV6OmegaHud(omegaHud);
  testMotionHud(motionHud);
  testV71TableGeometry(geometry);
  testFull3DReset(
    data, physics, contact, stateApi, runtimeApi, loaded.mixed, core, loaded.presets,
    trajectoryDiagnostics, geometry
  );
  testV5ContractRegressions(
    data, physics, contact, stateApi, runtimeApi, loaded.mixed, core, legacy
  );
  const v4RoundCount = testV4ProductFlow(
    productData, product, data, physics, contact, stateApi, runtimeApi, core, omegaHud,
    trajectoryDiagnostics, geometry
  );

  const runtimeSource = fs.readFileSync(path.join(V2_DIR, "runtime.js"), "utf8");
  assert.ok(!/variation\.spin\b/.test(runtimeSource), "runtime reads legacy variation.spin");
  console.log(JSON.stringify({
    status: "pass",
    scope: "mainline-v2 Phase V2/V3 canonical contact contract + V4 Game 5 product shell + V5 regressions + V6 omega HUD + V7 motion diagnostics + V7.1 unified table geometry + Full-3D Reset + R1 table-contact candidate",
    preset: loaded.mixed.id,
    presetCount: loaded.presets.length,
    phases: ["video", "serve", "table contact", "delayed racket contact", "return flight", "result"],
    rounds: v4RoundCount,
    interpretation: "canonical product-shell engineering evidence only; raw post-table integration is preserved, racket intercept is independently timed, secondBounce is validation-only, and this is not calibration or physical-truth evidence",
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`mainline-v2 contract failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}
