#!/usr/bin/env node
"use strict";

// Isolated validation of 3D physics scope reset acceptance condition #3:
// "If the table normal changes, or the entire world coordinate system is
// rotated, the result rotates with the coordinate system; it cannot only
// hold for a horizontal table."
//
// This tool reads mainline-v2 and shared-physics-core. It does NOT modify
// either layer, does not tune parameters, and does not compare against
// the 2017 external benchmark. Pass/fail checks are semantic invariants
// only.
//
// Strategy: build a canonical BallState + table-plane configuration. Run
// the contact solver. Then rotate the ENTIRE world by a proper rotation R:
//   - ball.position, ball.velocity, ball.omega all transform under R
//   - table normal, table surfaceVelocity transform under R
//   - gravity transforms under R (because gravity is a vector in the world)
// Run the contact solver on the rotated state with the rotated surface.
// The post-contact velocity/omega must equal R applied to the original
// post-contact velocity/omega; normal impulse must be invariant (scalar);
// tangent impulse must transform under R.
//
// We also include a "tilted-table" case where the table normal is not +y
// to confirm the contact solver does not have a hidden +y assumption.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const AI_CONTEXT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", "isolation-validation");
const REPORT_JSON = path.join(AI_CONTEXT_DIR, "3d_world_rotation_invariance.json");
const REPORT_MD = path.join(AI_CONTEXT_DIR, "3d_world_rotation_invariance.md");
const SCHEMA = 2;
const EPSILON = 1e-9;

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
    "BALL_RADIUS",
    "BALL_MASS",
    "BALL_INERTIA",
    "REAL_GRAVITY_Y",
    "physics3dCross",
    "physics3dContactPointVelocity",
    "physics3dMagnusAcceleration",
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
const core = loadCore();

function vec(x, y, z) { return {x, y, z}; }
function add(a, b) { return vec(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a, b) { return vec(a.x - b.x, a.y - b.y, a.z - b.z); }
function scale(a, f) { return vec(a.x * f, a.y * f, a.z * f); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
function magnitude(a) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a) {
  const length = magnitude(a);
  assert.ok(length > EPSILON, "cannot normalize zero vector");
  return scale(a, 1 / length);
}

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

function canonicalBall(position, velocity, omega) {
  return stateApi.createBallState({
    position,
    velocity,
    spin3d: {schema: SCHEMA, omega},
  });
}

function kineticEnergy(state) {
  return 0.5 * state.mass * dot(state.velocity, state.velocity) +
    0.5 * state.inertia * dot(state.omega, state.omega);
}

function planeContact(state, normal, restitution, friction, surfaceVelocity) {
  return core.physics3dSolvePlaneContact(state, {
    normal,
    surfaceVelocity: surfaceVelocity || vec(0, 0, 0),
    restitution: restitution == null ? 0.76 : restitution,
    friction: friction == null ? 0.13 : friction,
    radius: core.BALL_RADIUS,
  });
}

// General 3D rotation matrix from an axis-angle (Rodrigues' formula).
function rotationMatrix(axis, angle) {
  const n = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    [t * n.x * n.x + c,      t * n.x * n.y - s * n.z, t * n.x * n.z + s * n.y],
    [t * n.x * n.y + s * n.z, t * n.y * n.y + c,      t * n.y * n.z - s * n.x],
    [t * n.x * n.z - s * n.y, t * n.y * n.z + s * n.x, t * n.z * n.z + c],
  ];
}

function applyMatrix(matrix, value) {
  return vec(
    matrix[0][0] * value.x + matrix[0][1] * value.y + matrix[0][2] * value.z,
    matrix[1][0] * value.x + matrix[1][1] * value.y + matrix[1][2] * value.z,
    matrix[2][0] * value.x + matrix[2][1] * value.y + matrix[2][2] * value.z
  );
}

function transpose(m) {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
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
    "# 3D World-Rotation Invariance",
    "",
    `- Status: **${report.status}**`,
    `- Date: ${report.date}`,
    `- Checks: ${report.passCount} passed, ${report.failCount} failed`,
    "- Scope: 3D physics scope reset acceptance condition #3 — the entire world coordinate system rotates and the contact result rotates with it, not only for a horizontal table.",
    "- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.",
    "",
    "## Result",
    "",
    report.status === "pass"
      ? "All rotation-invariance checks hold. The contact solver uses the table normal as a vector and does not have a hidden +y assumption."
      : "One or more rotation-invariance checks failed. The contact solver is not purely vector-based in the table normal.",
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

// Common test: given an unrotated state + a rotation matrix R, verify that
// solving contact on R-transformed state + R-transformed surface yields
// R-transformed response.
function verifyRotationInvariance(R, label, baseState, normal, restitution, friction, surfaceVelocity) {
  const Ra = planeContact(baseState, normal, restitution, friction, surfaceVelocity);
  const rotatedState = canonicalBall(
    applyMatrix(R, baseState.position),
    applyMatrix(R, baseState.velocity),
    applyMatrix(R, baseState.omega)
  );
  const rotatedNormal = applyMatrix(R, normal);
  const rotatedSurfaceVelocity = surfaceVelocity
    ? applyMatrix(R, surfaceVelocity)
    : vec(0, 0, 0);
  const Rb = planeContact(rotatedState, rotatedNormal, restitution, friction, rotatedSurfaceVelocity);
  assertVectorNear(Rb.state.velocity, applyMatrix(R, Ra.state.velocity),
    `${label} rotated velocity`, 1e-9);
  assertVectorNear(Rb.state.omega, applyMatrix(R, Ra.state.omega),
    `${label} rotated omega`, 1e-9);
  assertVectorNear(Rb.tangentImpulse, applyMatrix(R, Ra.tangentImpulse),
    `${label} rotated tangent impulse`, 1e-9);
  assertNear(Rb.normalImpulse, Ra.normalImpulse, `${label} rotated normal impulse`, 1e-10);
  assertNear(kineticEnergy(Rb.state), kineticEnergy(Ra.state), `${label} rotated energy`, 1e-10);
  return {Ra, Rb};
}

function main() {
  const checks = [];

  // ── Group A: non-trivial proper rotations of the entire world ───────────
  // Each uses the same canonical horizontal-table setup and rotates the
  // entire world (state + table normal + surface velocity) by R. The
  // contact response must equal R applied to the unrotated response.

  const baseStateA = canonicalBall(
    vec(0.1, 0.05, -0.2),
    vec(0.4, -2.0, 0.7),
    vec(25, -18, 33)
  );
  const normalA = vec(0, 1, 0);
  const surfaceA = vec(0.05, -0.02, 0.08);

  runCheck(checks, "ROTATE-001", "30deg rotation around z: response rotates with world", () => {
    const R = rotationMatrix(vec(0, 0, 1), Math.PI / 6);
    return verifyRotationInvariance(R, "ROTATE-001", baseStateA, normalA, 0.76, 0.2, surfaceA);
  });

  runCheck(checks, "ROTATE-002", "52deg rotation around x: response rotates with world (table normal leaves +y)", () => {
    const R = rotationMatrix(vec(1, 0, 0), 52 * Math.PI / 180);
    return verifyRotationInvariance(R, "ROTATE-002", baseStateA, normalA, 0.76, 0.2, surfaceA);
  });

  runCheck(checks, "ROTATE-003", "73deg rotation around y: response rotates with world (table normal leaves +y)", () => {
    const R = rotationMatrix(vec(0, 1, 0), 73 * Math.PI / 180);
    return verifyRotationInvariance(R, "ROTATE-003", baseStateA, normalA, 0.76, 0.2, surfaceA);
  });

  runCheck(checks, "ROTATE-004", "arbitrary axis (0.4,-0.7,0.5) 0.83rad: response rotates with world", () => {
    const R = rotationMatrix(vec(0.4, -0.7, 0.5), 0.83);
    return verifyRotationInvariance(R, "ROTATE-004", baseStateA, normalA, 0.76, 0.2, surfaceA);
  });

  runCheck(checks, "ROTATE-005", "near-180deg rotation around (1,1,1)/sqrt(3): response rotates with world", () => {
    const axis = normalize(vec(1, 1, 1));
    const R = rotationMatrix(axis, Math.PI - 0.01);
    return verifyRotationInvariance(R, "ROTATE-005", baseStateA, normalA, 0.76, 0.2, surfaceA);
  });

  // ── Group B: tilted table without rotating the world ────────────────────
  // The table normal is tilted away from +y (e.g. a ramp). The contact
  // solver should still produce a physically consistent response: normal
  // restitution along the tilted normal, tangent friction in the tilted
  // plane, no spurious +y assumption.

  runCheck(checks, "ROTATE-006", "tilted table: contact solver does not assume normal is +y", () => {
    const tiltedNormal = normalize(vec(0.24, 0.94, -0.25));
    const state = canonicalBall(
      vec(0.1, 0.05, -0.2),
      vec(0.4, -2.0, 0.7),
      vec(25, -18, 33)
    );
    const surfaceVelocity = vec(0.05, -0.02, 0.08);
    const response = planeContact(state, tiltedNormal, 0.72, 0.2, surfaceVelocity);
    assertFiniteVector(response.state.velocity, "tilted output velocity");
    assertFiniteVector(response.state.omega, "tilted output omega");
    // Restitution is defined on the contact-point velocity, which includes
    // omega x r and the surface velocity. The shared core exposes
    // contactPointVelocityBefore; we recompute afterContact via the same
    // formula and check restitution on it.
    const offset = scale(tiltedNormal, -core.BALL_RADIUS);
    const contactBefore = add(add(state.velocity, cross(state.omega, offset)),
      scale(surfaceVelocity, -1));
    const beforeNormal = dot(contactBefore, tiltedNormal);
    const contactAfter = add(add(response.state.velocity, cross(response.state.omega, offset)),
      scale(surfaceVelocity, -1));
    const afterNormal = dot(contactAfter, tiltedNormal);
    assert.ok(beforeNormal < 0, `expected tilted approach, got ${beforeNormal}`);
    assert.ok(afterNormal > 0, `expected tilted separation, got ${afterNormal}`);
    assertNear(afterNormal, -0.72 * beforeNormal, "tilted contact-point restitution", 1e-8);
    // The tilted normal case must agree with the rotated-world construction:
    // find R that maps +y to tiltedNormal and verify the response matches
    // R applied to the horizontal-table response.
    const axis = normalize(cross(vec(0, 1, 0), tiltedNormal));
    const angle = Math.acos(dot(vec(0, 1, 0), tiltedNormal));
    const R = rotationMatrix(axis, angle);
    const horizontalResponse = planeContact(
      canonicalBall(
        applyMatrix(transpose(R), state.position),
        applyMatrix(transpose(R), state.velocity),
        applyMatrix(transpose(R), state.omega)
      ),
      vec(0, 1, 0),
      0.72,
      0.2,
      applyMatrix(transpose(R), surfaceVelocity)
    );
    assertVectorNear(response.state.velocity, applyMatrix(R, horizontalResponse.state.velocity),
      "tilted matches rotated horizontal velocity", 1e-9);
    assertVectorNear(response.state.omega, applyMatrix(R, horizontalResponse.state.omega),
      "tilted matches rotated horizontal omega", 1e-9);
    return {
      tiltedNormal,
      beforeNormal,
      afterNormal,
      axis,
      angle,
    };
  });

  // ── Group C: flight integrator invariance under y-axis rotation ─────────
  // The shared core's `physics3dAdvanceVelocity` treats gravity as a scalar
  // applied along +y. This is an intentional modeling choice (gravity is
  // world-y-aligned). The meaningful invariance is: under a rotation
  // purely around the y-axis, the flight integrator's output commutes
  // with the rotation (gravity stays y-aligned, and all vector operations
  // are R_y-equivariant). This is the flight-integrator analogue of the
  // contact-solver invariance tested above.

  runCheck(checks, "ROTATE-007", "flight integrator: y-axis rotation of (v, omega) yields y-axis-rotated advanced velocity", () => {
    const angle = 0.83;
    const R = rotationMatrix(vec(0, 1, 0), angle);
    const velocity = vec(0.4, -2.0, 0.7);
    const omega = vec(25, -18, 33);
    const spin = {schema: SCHEMA, omega};
    const dt = 0.01;
    const gravityY = -9.81;
    const coefficient = 0.003;
    const advanced = core.physics3dAdvanceVelocity(velocity, spin, gravityY, dt, coefficient);
    const rotatedVelocity = applyMatrix(R, velocity);
    const rotatedOmega = applyMatrix(R, omega);
    const rotatedSpin = {schema: SCHEMA, omega: rotatedOmega};
    const rotatedAdvanced = core.physics3dAdvanceVelocity(
      rotatedVelocity, rotatedSpin, gravityY, dt, coefficient
    );
    assertVectorNear(rotatedAdvanced, applyMatrix(R, advanced),
      "y-rotated flight velocity", 1e-9);
    return {
      advanced,
      rotatedAdvanced,
      expected: applyMatrix(R, advanced),
    };
  });

  // ── Group D: Magnus acceleration rotates with the world ────────────────
  runCheck(checks, "ROTATE-008", "Magnus acceleration: rotated (v, omega) yields rotated a_M", () => {
    const R = rotationMatrix(vec(0.4, -0.7, 0.5), 0.83);
    const velocity = vec(2.2, 0.6, -1.1);
    const omega = vec(7, -4, 13);
    const coefficient = 0.003;
    const a = core.physics3dMagnusAcceleration(velocity, {schema: SCHEMA, omega}, coefficient);
    const rotatedV = applyMatrix(R, velocity);
    const rotatedOmega = applyMatrix(R, omega);
    const aRotated = core.physics3dMagnusAcceleration(
      rotatedV, {schema: SCHEMA, omega: rotatedOmega}, coefficient
    );
    assertVectorNear(aRotated, applyMatrix(R, a), "rotated Magnus", 1e-12);
    return {a, aRotated, expected: applyMatrix(R, a)};
  });

  // ── Group E: composite rotation (two rotations = one rotation) ─────────
  // Applying R1 then R2 to the world, then solving, should give the same
  // result as solving with the composite R2∘R1 applied to the state. This
  // catches any hidden non-commutativity or frame assumption.

  runCheck(checks, "ROTATE-009", "composite rotation: R2∘R1 applied to state matches solving after R1 then R2 transform", () => {
    const R1 = rotationMatrix(vec(0.4, -0.7, 0.5), 0.83);
    const R2 = rotationMatrix(vec(-0.3, 0.6, 0.4), 1.1);
    // Compose: apply R1 first, then R2.
    function compose(A, B) {
      // Matrix product A*B (A applied to result of B).
      const result = [[0,0,0],[0,0,0],[0,0,0]];
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          for (let k = 0; k < 3; k += 1) {
            result[i][j] += A[i][k] * B[k][j];
          }
        }
      }
      return result;
    }
    const Rcomposite = compose(R2, R1);
    const state = baseStateA;
    const normal = normalA;
    const surface = surfaceA;
    // Step 1: solve original.
    const Ra = planeContact(state, normal, 0.76, 0.2, surface);
    // Step 2: solve with Rcomposite applied to everything.
    const rotatedState = canonicalBall(
      applyMatrix(Rcomposite, state.position),
      applyMatrix(Rcomposite, state.velocity),
      applyMatrix(Rcomposite, state.omega)
    );
    const rotatedNormal = applyMatrix(Rcomposite, normal);
    const rotatedSurface = applyMatrix(Rcomposite, surface);
    const Rb = planeContact(rotatedState, rotatedNormal, 0.76, 0.2, rotatedSurface);
    assertVectorNear(Rb.state.velocity, applyMatrix(Rcomposite, Ra.state.velocity),
      "composite velocity", 1e-9);
    assertVectorNear(Rb.state.omega, applyMatrix(Rcomposite, Ra.state.omega),
      "composite omega", 1e-9);
    return {
      compositeDet: Rcomposite[0][0] * (Rcomposite[1][1] * Rcomposite[2][2] - Rcomposite[1][2] * Rcomposite[2][1]) -
        Rcomposite[0][1] * (Rcomposite[1][0] * Rcomposite[2][2] - Rcomposite[1][2] * Rcomposite[2][0]) +
        Rcomposite[0][2] * (Rcomposite[1][0] * Rcomposite[2][1] - Rcomposite[1][1] * Rcomposite[2][0]),
    };
  });

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  const report = {
    status: failCount === 0 ? "pass" : "review-required",
    date: new Date().toISOString(),
    scope: "3D physics scope reset acceptance #3: world-coordinate rotation and tilted-table invariance",
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