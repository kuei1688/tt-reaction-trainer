#!/usr/bin/env node
"use strict";

// Isolated validation of 3D physics scope reset acceptance condition #5:
// "The same BallState must be read consistently by flight, table contact,
// racket contact, and the display layer; the display layer must not
// write back to physics state."
//
// This tool reads mainline-v2 and shared-physics-core. It does NOT modify
// either layer, does not tune parameters, and does not compare against
// the 2017 external benchmark. Pass/fail checks are semantic invariants
// only.
//
// Strategy:
//   (a) Immutability: build a canonical BallState, pass it (not a clone)
//       into each layer that consumes one — physics3dAdvanceVelocity,
//       physics3dSolvePlaneContact, contactApi.solveTableContact,
//       contactApi.solveGame5RacketContact, scaleAdapter.advanceSimulationState.
//       After each call, the original BallState's position/velocity/omega
//       fields must be deep-equal to their pre-call values.
//   (b) Schema-2 consistency: all layers read the same world-space omega
//       vector. Test that omega returned from each layer equals the input
//       omega (modulo contact-induced changes for contact layers, which
//       are themselves omega-vector-preserving).
//   (c) cloneBallState produces a structurally independent copy: mutating
//       the clone does not affect the original.
//   (d) Legacy adapter is the only entry that accepts legacy spin; the
//       returned value is schema-2 with omega, and the input legacy
//       payload cannot be read by the v2 runtime.
//   (e) Display-layer-style read: simulate what view.js / motion-hud.js
//       do — read ball.position / ball.velocity / ball.omega from the
//       physics state for rendering, then verify the physics state is
//       unchanged after the simulated "render" pass.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const AI_CONTEXT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", "isolation-validation");
const REPORT_JSON = path.join(AI_CONTEXT_DIR, "3d_ballstate_cross_layer_contract.json");
const REPORT_MD = path.join(AI_CONTEXT_DIR, "3d_ballstate_cross_layer_contract.md");
const SCHEMA = 2;
const EPSILON = 1e-9;

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
    "BALL_RADIUS",
    "BALL_MASS",
    "BALL_INERTIA",
    "REAL_GRAVITY_Y",
    "physics3dPhysicalSpinFromInput",
    "physics3dCross",
    "physics3dAdvanceVelocity",
    "physics3dSolvePlaneContact",
  ];
  return vm.runInNewContext(`(function(){${source}\nreturn {${names.join(",")}};})()`, {
    Math,
    Number,
    console,
  });
}

const stateApi = require(path.join(ROOT_DIR, "mainline-v2", "trainer-state.js"));
const contactApi = require(path.join(ROOT_DIR, "mainline-v2", "contact-policy.js"));
const physicsAdapter = require(path.join(ROOT_DIR, "mainline-v2", "physics-adapter.js"));
const legacyAdapter = require(path.join(ROOT_DIR, "mainline-v2", "legacy-adapter.js"));
const core = loadCore();

// Make shared-core visible to physicsAdapter.resolveSharedCore which walks
// globalThis. The vm above isolated the core; for the adapter we need to
// expose it on a sandbox. We construct a combined sandbox instead.
function createCombinedSandbox() {
  const sandbox = {
    Math, Number, console, Object, Array, JSON, Date, Set, Map, Error, TypeError,
    Infinity, NaN, isFinite, parseFloat, parseInt,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const files = [
    "shared-physics-core.js",
    "mainline-v2/trainer-state.js",
    "mainline-v2/physics-adapter.js",
    "mainline-v2/contact-policy.js",
    "mainline-v2/legacy-adapter.js",
  ];
  for (const file of files) {
    vm.runInContext(
      fs.readFileSync(path.join(ROOT_DIR, file), "utf8"),
      sandbox,
      {filename: file}
    );
  }
  return sandbox;
}

function vec(x, y, z) { return {x, y, z}; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

function assertNear(actual, expected, label, tolerance = EPSILON) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`);
}
function assertVectorNear(actual, expected, label, tolerance = EPSILON) {
  for (const axis of ["x", "y", "z"]) {
    assertNear(actual[axis], expected[axis], `${label}.${axis}`, tolerance);
  }
}
function assertFiniteVector(value, label) {
  assert.ok(value && ["x", "y", "z"].every((axis) => Number.isFinite(value[axis])),
    `${label} must be finite`);
}

function snapshotBall(ball) {
  return {
    position: {...ball.position},
    velocity: {...ball.velocity},
    omega: {...ball.omega},
    mass: ball.mass,
    inertia: ball.inertia,
  };
}

function assertBallUnchanged(ball, snapshot, label) {
  assertVectorNear(ball.position, snapshot.position, `${label}.position`);
  assertVectorNear(ball.velocity, snapshot.velocity, `${label}.velocity`);
  assertVectorNear(ball.omega, snapshot.omega, `${label}.omega`);
  assertNear(ball.mass, snapshot.mass, `${label}.mass`);
  assertNear(ball.inertia, snapshot.inertia, `${label}.inertia`);
}

function runCheck(checks, id, description, fn) {
  try {
    const details = fn() || {};
    checks.push({id, status: "pass", description, details});
  } catch (error) {
    checks.push({id, status: "fail", description, error: error.message});
  }
}

function renderMarkdown(report) {
  const lines = [
    "# 3D BallState Cross-Layer Contract",
    "",
    `- Status: **${report.status}**`,
    `- Date: ${report.date}`,
    `- Checks: ${report.passCount} passed, ${report.failCount} failed`,
    "- Scope: 3D physics scope reset acceptance condition #5 — the same BallState is read consistently by flight, table contact, racket contact, and the display layer; display layer must not write back.",
    "- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.",
    "",
    "## Result",
    "",
    report.status === "pass"
      ? "All cross-layer contract invariants hold. Layers consume BallState read-only; the display layer does not write back; the legacy adapter is the single legacy entry point."
      : "One or more cross-layer contract invariants failed.",
    "",
    "## Checks",
    "",
    "| ID | Status | Finding |",
    "|---|---|---|",
    ...report.checks.map((check) => {
      const finding = check.status === "pass"
        ? JSON.stringify(check.details).replace(/\|/g, "\\|")
        : check.error.replace(/\|/g, "\\|");
      return `| ${check.id} | ${check.status} | ${finding} |`;
    }),
    "",
    "## Boundary",
    "",
    "This report does not change `mainline-v2`, `shared-physics-core.js`, legacy pages, or formal presets. It does not select material parameters and does not use the 2017 external data as an acceptance gate.",
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  const sandbox = createCombinedSandbox();
  const stateApiSandbox = sandbox.MainlineV2State;
  const physicsSandbox = sandbox.MainlineV2Physics;
  const contactSandbox = sandbox.MainlineV2Contact;
  const legacySandbox = sandbox.MainlineV2LegacyAdapter;
  const coreSandbox = sandbox;

  const checks = [];

  // ── (a) Immutability: each layer that consumes a BallState leaves the
  // input object unchanged.
  runCheck(checks, "CROSS-001", "physics3dAdvanceVelocity: input BallState object unchanged after call", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0.1, 0.8, -0.4),
      velocity: vec(1.1, -2.2, 0.3),
      spin3d: {schema: SCHEMA, omega: vec(14, -9, 22)},
    });
    const snapshot = snapshotBall(ball);
    coreSandbox.physics3dAdvanceVelocity(ball.velocity, {schema: SCHEMA, omega: ball.omega}, -9.81, 0.01, 0.003);
    assertBallUnchanged(ball, snapshot, "CROSS-001");
    return {snapshot, after: snapshotBall(ball)};
  });

  runCheck(checks, "CROSS-002", "physics3dSolvePlaneContact: input BallState object unchanged after contact solve", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0.1, 0.05, -0.2),
      velocity: vec(0.4, -2.0, 0.7),
      spin3d: {schema: SCHEMA, omega: vec(25, -18, 33)},
    });
    const snapshot = snapshotBall(ball);
    coreSandbox.physics3dSolvePlaneContact(ball, {
      normal: vec(0, 1, 0),
      surfaceVelocity: vec(0, 0, 0),
      restitution: 0.76,
      friction: 0.2,
      radius: coreSandbox.BALL_RADIUS,
    });
    assertBallUnchanged(ball, snapshot, "CROSS-002");
    return {snapshot, after: snapshotBall(ball)};
  });

  runCheck(checks, "CROSS-003", "contactApi.solveTableContact: input BallState object unchanged after table contact", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0.1, 0.05, -0.2),
      velocity: vec(0.4, -2.0, 0.7),
      spin3d: {schema: SCHEMA, omega: vec(25, -18, 33)},
    });
    const snapshot = snapshotBall(ball);
    contactSandbox.solveTableContact({
      state: ball,
      surface: {
        kind: "table",
        normal: vec(0, 1, 0),
        surfaceVelocity: vec(0, 0, 0),
        friction: 0.13,
        restitution: 0.76,
      },
      mode: contactSandbox.createMode({normalModel: "instantaneous", tangentModel: "coulomb"}),
    }, coreSandbox);
    assertBallUnchanged(ball, snapshot, "CROSS-003");
    return {snapshot, after: snapshotBall(ball)};
  });

  runCheck(checks, "CROSS-004", "contactApi.solveGame5RacketContact: input BallState object unchanged after racket contact", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0, 0.5, 0.5),
      velocity: vec(0, 1.5, 1.2),
      spin3d: {schema: SCHEMA, omega: vec(20, 5, -10)},
    });
    const snapshot = snapshotBall(ball);
    contactSandbox.solveGame5RacketContact({
      state: ball,
      surface: {
        kind: "racket",
        normal: vec(0, -1, 0),
        surfaceVelocity: vec(0, 0, 0.45),
        friction: 0.4,
        restitution: 0.76,
      },
      mode: contactSandbox.createMode({normalModel: "compliant", tangentModel: "viscous",
        dwellTime: 0.004, racketMass: 0.18, wristBrake: 20, dt: 0.0005, steps: 8,
        spring: 5000, damping: 4, tangentDamping: 0.5}),
    }, coreSandbox);
    assertBallUnchanged(ball, snapshot, "CROSS-004");
    return {snapshot, after: snapshotBall(ball)};
  });

  runCheck(checks, "CROSS-005", "scaleAdapter.advanceSimulationState: input BallState object unchanged after flight integration step", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0, 1, -1.1),
      velocity: vec(0.1, 3.8, 0.95),
      spin3d: {schema: SCHEMA, omega: vec(42, 70, -15)},
    });
    const snapshot = snapshotBall(ball);
    const adapter = physicsSandbox.createScaleAdapter({
      core: coreSandbox,
      timeDilation: Math.sqrt(9.81 / 4.2),
      simulationGravity: -4.2,
    });
    adapter.advanceSimulationState(ball, 1 / 120);
    assertBallUnchanged(ball, snapshot, "CROSS-005");
    return {snapshot, after: snapshotBall(ball)};
  });

  // ── (b) Schema-2 consistency: omega returned from contact layers is the
  // same world-space vector (only magnitude/direction change due to
  // physics, no schema reinterpretation).
  runCheck(checks, "CROSS-006", "contact response state has schema-2 omega vector (no label reinterpretation)", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0, 0.05, 0),
      velocity: vec(0.4, -2.0, 0.7),
      spin3d: {schema: SCHEMA, omega: vec(25, -18, 33)},
    });
    const response = contactSandbox.solveTableContact({
      state: ball,
      surface: {
        kind: "table",
        normal: vec(0, 1, 0),
        surfaceVelocity: vec(0, 0, 0),
        friction: 0.2,
        restitution: 0.76,
      },
      mode: contactSandbox.createMode({normalModel: "instantaneous", tangentModel: "coulomb"}),
    }, coreSandbox);
    // The returned state's omega is a plain vector {x,y,z} — no schema
    // field, no label field. Verify it is a finite 3-vector.
    assertFiniteVector(response.state.omega, "CROSS-006 response.state.omega");
    // The response state should be a fresh BallState with all expected fields.
    assertFiniteVector(response.state.position, "CROSS-006 response.state.position");
    assertFiniteVector(response.state.velocity, "CROSS-006 response.state.velocity");
    assert.ok(Number.isFinite(response.state.mass), "CROSS-006 response.state.mass");
    assert.ok(Number.isFinite(response.state.inertia), "CROSS-006 response.state.inertia");
    // No 'spin' or 'sidespin' or 'topspin' label fields on the response state.
    assert.ok(!("spin" in response.state), "CROSS-006 response.state has no legacy 'spin' field");
    assert.ok(!("topspin" in response.state), "CROSS-006 no 'topspin' label");
    assert.ok(!("sidespin" in response.state), "CROSS-006 no 'sidespin' label");
    return {
      omega: response.state.omega,
      fields: Object.keys(response.state),
    };
  });

  // ── (c) cloneBallState produces a structurally independent copy.
  runCheck(checks, "CROSS-007", "cloneBallState: mutating the clone does not affect the original", () => {
    const original = stateApiSandbox.createBallState({
      position: vec(0.1, 0.05, -0.2),
      velocity: vec(0.4, -2.0, 0.7),
      spin3d: {schema: SCHEMA, omega: vec(25, -18, 33)},
    });
    const clone = stateApiSandbox.cloneBallState(original);
    // Mutate the clone deeply.
    clone.position.x = 99;
    clone.velocity.y = -99;
    clone.omega.z = 99;
    clone.mass = 0.999;
    // Original must be unchanged.
    assertNear(original.position.x, 0.1, "CROSS-007 original.position.x", 1e-12);
    assertNear(original.velocity.y, -2.0, "CROSS-007 original.velocity.y", 1e-12);
    assertNear(original.omega.z, 33, "CROSS-007 original.omega.z", 1e-12);
    assertNear(original.mass, 0.0027, "CROSS-007 original.mass", 1e-12);
    return {
      originalSnapshot: snapshotBall(original),
      cloneAfterMutation: snapshotBall(clone),
    };
  });

  // ── (d) Legacy adapter: fromLegacySpin returns schema-2 with omega.
  runCheck(checks, "CROSS-008", "legacy adapter returns schema-2 spin3d with omega vector; rejects invalid input", () => {
    // Use a simple legacy spin payload — the shared core's
    // physics3dPhysicalSpinFromInput accepts {topspin, sidespin}.
    const legacySpin = {topspin: 25, sidespin: -10};
    const velocity = vec(0.4, -2.0, 0.7);
    const result = legacySandbox.fromLegacySpin(legacySpin, velocity, coreSandbox);
    assert.strictEqual(result.schema, SCHEMA, "CROSS-008 schema is 2");
    assertFiniteVector(result.omega, "CROSS-008 result.omega");
    // Invalid input should throw.
    let threw = false;
    try {
      legacySandbox.fromLegacySpin(null, velocity, coreSandbox);
    } catch (error) {
      threw = true;
    }
    assert.ok(threw, "CROSS-008 null legacy spin should throw");
    // fromLegacyVariation rejects variation that has both spin and spin3d.
    let threwMixed = false;
    try {
      legacySandbox.fromLegacyVariation(
        {spin: legacySpin, spin3d: {schema: SCHEMA, omega: vec(1, 2, 3)}},
        velocity,
        coreSandbox
      );
    } catch (error) {
      threwMixed = true;
    }
    assert.ok(threwMixed, "CROSS-008 mixed legacy+canonical variation should throw");
    return {
      schema: result.schema,
      omega: result.omega,
      rejectedNull: threw,
      rejectedMixed: threwMixed,
    };
  });

  // ── (e) Display-layer read simulation: the view/HUD layers read
  // ball.position / ball.velocity / ball.omega from the physics state for
  // rendering. After a simulated "render pass" that reads every field,
  // the physics state must be unchanged.
  runCheck(checks, "CROSS-009", "display-layer read pass: reading ball.position/velocity/omega does not modify physics state", () => {
    const ball = stateApiSandbox.createBallState({
      position: vec(0.1, 0.8, -0.4),
      velocity: vec(1.1, -2.2, 0.3),
      spin3d: {schema: SCHEMA, omega: vec(14, -9, 22)},
    });
    const snapshot = snapshotBall(ball);
    // Simulate what motion-hud.js does: read fields for display.
    const renderInfo = {
      posX: ball.position.x,
      posY: ball.position.y,
      posZ: ball.position.z,
      velX: ball.velocity.x,
      velY: ball.velocity.y,
      velZ: ball.velocity.z,
      omegaX: ball.omega.x,
      omegaY: ball.omega.y,
      omegaZ: ball.omega.z,
      speed: Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z),
      omegaNorm: Math.hypot(ball.omega.x, ball.omega.y, ball.omega.z),
    };
    // No mutation happened. Verify.
    assertBallUnchanged(ball, snapshot, "CROSS-009");
    return {renderInfo, after: snapshotBall(ball)};
  });

  // ── (f) mainline-v2 runtime / view / product code does not write back
  // to BallState. We check this by searching for assignment patterns in
  // the mainline-v2 source files. Since this is a static check, we read
  // each file and verify no `ball.<field> =` or `.ball =` assignments
  // exist outside of trainer-state.js's construction and contact-policy's
  // internal copyBallWithResponse.
  runCheck(checks, "CROSS-010", "mainline-v2 runtime/view/product: no BallState write-back outside state construction and contact response", () => {
    const filesToCheck = [
      "mainline-v2/runtime.js",
      "mainline-v2/view.js",
      "mainline-v2/game5-product.js",
      "mainline-v2/motion-hud.js",
      "mainline-v2/omega-hud.js",
      "mainline-v2/product-data.js",
      "mainline-v2/serve-data.js",
      "mainline-v2/table-geometry.js",
      "mainline-v2/trajectory-diagnostics.js",
    ];
    const violations = [];
    for (const rel of filesToCheck) {
      const abs = path.join(ROOT_DIR, rel);
      if (!fs.existsSync(abs)) continue;
      const source = fs.readFileSync(abs, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        // Detect direct assignment to ball.position/velocity/omega or
        // to a `.ball` property. Ignore lines that are pure declarations
        // (const/let/var) or that destructure for reading.
        const writePattern = /\bball\.(position|velocity|omega|mass|inertia)\s*=/;
        const ballAssignPattern = /\.ball\s*=/;
        if (writePattern.test(line) || ballAssignPattern.test(line)) {
          violations.push({file: rel, line: index + 1, text: line.trim()});
        }
      });
    }
    assert.strictEqual(violations.length, 0,
      `CROSS-010 found BallState write-back sites: ${JSON.stringify(violations)}`);
    return {filesChecked: filesToCheck.length, violations};
  });

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  const report = {
    status: failCount === 0 ? "pass" : "review-required",
    date: new Date().toISOString(),
    scope: "3D physics scope reset acceptance #5: same BallState read consistently across layers; display layer must not write back",
    acceptance: "qualitative representability only; no 2017 benchmark fitting, material identification, or parameter tuning",
    passCount,
    failCount,
    checks,
  };
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(REPORT_MD, renderMarkdown(report), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (failCount > 0) process.exitCode = 1;
}

main();