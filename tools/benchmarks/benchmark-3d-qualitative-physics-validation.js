#!/usr/bin/env node
"use strict";

// Isolated qualitative validation for the schema-2 3D physical state.
//
// This tool reads mainline-v2 and shared-physics-core. It does not change
// either layer, does not tune parameters, and does not compare against the
// 2017 external benchmark. Its pass/fail checks are invariant and
// representability checks only.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const AI_CONTEXT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", "isolation-validation");
const REPORT_JSON = path.join(AI_CONTEXT_DIR, "3d_qualitative_physics_validation.json");
const REPORT_MD = path.join(AI_CONTEXT_DIR, "3d_qualitative_physics_validation.md");
const SCHEMA = 2;
const EPSILON = 1e-9;

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
    "BALL_RADIUS",
    "BALL_MASS",
    "BALL_INERTIA",
    "physics3dCross",
    "physics3dContactPointVelocity",
    "physics3dMagnusAcceleration",
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
const core = loadCore();

function vec(x, y, z) {
  return {x, y, z};
}

function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function sub(a, b) {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function scale(a, factor) {
  return vec(a.x * factor, a.y * factor, a.z * factor);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

function magnitude(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a) {
  return scale(a, 1 / magnitude(a));
}

function assertFiniteVector(value, label) {
  assert.ok(value && ["x", "y", "z"].every((axis) => Number.isFinite(value[axis])),
    `${label} must be finite`);
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

function canonicalBall(position, velocity, omega) {
  const state = stateApi.createBallState({
    position,
    velocity,
    spin3d: {schema: SCHEMA, omega},
  });
  assert.strictEqual(state.omega.x, omega.x);
  assert.strictEqual(state.omega.y, omega.y);
  assert.strictEqual(state.omega.z, omega.z);
  return state;
}

function kineticEnergy(state) {
  return 0.5 * state.mass * dot(state.velocity, state.velocity) +
    0.5 * state.inertia * dot(state.omega, state.omega);
}

function planeContact(state, normal, restitution = 0.76, friction = 0.13, surfaceVelocity = vec(0, 0, 0)) {
  return core.physics3dSolvePlaneContact(state, {
    normal,
    surfaceVelocity,
    restitution,
    friction,
    radius: core.BALL_RADIUS,
  });
}

function rotationMatrix(axis, angle) {
  const n = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    [t * n.x * n.x + c, t * n.x * n.y - s * n.z, t * n.x * n.z + s * n.y],
    [t * n.x * n.y + s * n.z, t * n.y * n.y + c, t * n.y * n.z - s * n.x],
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

function reflectX(value) {
  return vec(-value.x, value.y, value.z);
}

// Angular velocity is an axial (pseudovector), so it picks up det(R) under
// a reflection. This is the semantic detail that a scalar sidespin label
// cannot represent on its own.
function reflectOmegaX(value) {
  return vec(value.x, -value.y, -value.z);
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
    "# Qualitative 3D Physics Validation",
    "",
    `- Status: **${report.status}**`,
    `- Date: ${report.date}`,
    `- Checks: ${report.passCount} passed, ${report.failCount} failed`,
    "- Scope: schema-2 world-space BallState/omega and isolated 3D contact semantics",
    "- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence",
    "",
    "## Result",
    "",
    report.status === "pass"
      ? "All invariant checks passed. The current isolated 3D kernel is semantically representable for the tested cases."
      : "One or more invariant checks failed. These are model-semantic findings, not external benchmark mismatches.",
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
  const checks = [];

  runCheck(checks, "STATE-001", "schema-2 BallState preserves world-space omega", () => {
    const state = canonicalBall(vec(0.1, 0.8, -0.4), vec(1.1, -2.2, 0.3), vec(14, -9, 22));
    assert.strictEqual(stateApi.SCHEMA, SCHEMA);
    assertFiniteVector(state.position, "BallState.position");
    assertFiniteVector(state.velocity, "BallState.velocity");
    assertFiniteVector(state.omega, "BallState.omega");
    return {omega: state.omega, mass: state.mass, inertia: state.inertia};
  });

  runCheck(checks, "CONTACT-001", "contact-point velocity uses v + omega x r - surfaceVelocity", () => {
    const state = canonicalBall(vec(0, 0, 0), vec(1.2, -2.1, 0.4), vec(8, -3, 11));
    const offset = vec(0.011, -0.019, 0.007);
    const surfaceVelocity = vec(-0.2, 0.1, 0.35);
    const actual = core.physics3dContactPointVelocity(state, offset, surfaceVelocity);
    const expected = sub(add(state.velocity, cross(state.omega, offset)), surfaceVelocity);
    assertVectorNear(actual, expected, "contact point velocity", 1e-12);
    return {actual, expected};
  });

  runCheck(checks, "CONTACT-002", "horizontal-plane normal bounce reverses and attenuates approach speed", () => {
    const state = canonicalBall(vec(0, 0, 0), vec(0.6, -2.1, 0.4), vec(18, 2, -11));
    const response = planeContact(state, vec(0, 1, 0));
    const beforeNormal = response.normalVelocityBefore;
    const afterNormal = dot(response.contactPointVelocityAfter, vec(0, 1, 0));
    assert.ok(beforeNormal < 0, `expected approach, got ${beforeNormal}`);
    assert.ok(afterNormal > 0, `expected separation, got ${afterNormal}`);
    assertNear(afterNormal, -0.76 * beforeNormal, "normal restitution", 1e-8);
    return {beforeNormal, afterNormal, epsilon: 0.76, tangentImpulse: response.tangentImpulse};
  });

  runCheck(checks, "CONTACT-003", "arbitrary table normal uses the same normal/tangent semantics", () => {
    const normal = normalize(vec(0.33, 0.91, -0.21));
    const helper = Math.abs(normal.z) < 0.8 ? vec(0, 0, 1) : vec(1, 0, 0);
    const tangent1 = normalize(cross(helper, normal));
    const tangent2 = normalize(cross(normal, tangent1));
    const velocity = add(add(scale(normal, -2.4), scale(tangent1, 0.8)), scale(tangent2, 0.35));
    const state = canonicalBall(vec(0, 0, 0), velocity, vec(11, -7, 19));
    const response = planeContact(state, normal, 0.72, 0.2);
    const beforeNormal = response.normalVelocityBefore;
    const afterNormal = dot(response.contactPointVelocityAfter, normal);
    assert.ok(beforeNormal < 0, `expected tilted-plane approach, got ${beforeNormal}`);
    assert.ok(afterNormal > 0, `expected tilted-plane separation, got ${afterNormal}`);
    assertNear(afterNormal, -0.72 * beforeNormal, "tilted normal restitution", 1e-8);
    return {normal, beforeNormal, afterNormal, tangentImpulse: response.tangentImpulse};
  });

  runCheck(checks, "CONTACT-004", "pure axial spin does not invent tangential table velocity", () => {
    const state = canonicalBall(vec(0, 0, 0), vec(0, -2, 0), vec(0, 32, 0));
    const response = planeContact(state, vec(0, 1, 0), 0.76, 0.4);
    assertNear(response.tangentImpulse.x, 0, "axial tangent impulse x", 1e-12);
    assertNear(response.tangentImpulse.z, 0, "axial tangent impulse z", 1e-12);
    assertNear(response.state.velocity.x, 0, "axial output velocity x", 1e-12);
    assertNear(response.state.velocity.z, 0, "axial output velocity z", 1e-12);
    assertNear(response.state.omega.y, state.omega.y, "axial omega preservation", 1e-12);
    return {beforeOmega: state.omega, afterOmega: response.state.omega, tangentImpulse: response.tangentImpulse};
  });

  runCheck(checks, "CONTACT-005", "tangential contact spin changes both linear and angular state", () => {
    const state = canonicalBall(vec(0, 0, 0), vec(0, -2, 0), vec(14, 0, 0));
    const response = planeContact(state, vec(0, 1, 0), 0.76, 0.4);
    assert.ok(magnitude(response.tangentImpulse) > 1e-12, "expected non-zero tangent impulse");
    assert.ok(Math.abs(response.state.velocity.z) > 1e-6, "expected tangent linear response");
    assert.ok(Math.abs(response.state.omega.x - state.omega.x) > 1e-6, "expected tangent angular response");
    return {
      beforeVelocity: state.velocity,
      afterVelocity: response.state.velocity,
      beforeOmega: state.omega,
      afterOmega: response.state.omega,
      tangentImpulse: response.tangentImpulse,
    };
  });

  runCheck(checks, "ENERGY-001", "passive instantaneous contacts do not increase rigid-body kinetic energy", () => {
    const cases = [
      {velocity: vec(0.6, -2.1, 0.4), omega: vec(18, 2, -11)},
      {velocity: vec(-1.2, -1.7, 0.8), omega: vec(-24, 9, 7)},
      {velocity: vec(0.2, -2.8, -0.9), omega: vec(31, -17, -13)},
      {velocity: vec(2.1, -0.9, -1.5), omega: vec(-8, 41, 19)},
    ];
    const energies = cases.map((item, index) => {
      const state = canonicalBall(vec(0, 0, 0), item.velocity, item.omega);
      const response = planeContact(state, normalize(vec(0.3, 0.93, -0.1)), 0.76, 0.13);
      const before = kineticEnergy(state);
      const after = kineticEnergy(response.state);
      assert.ok(after <= before + 1e-10, `case ${index} energy increased: ${before} -> ${after}`);
      return {case: index, before, after, delta: after - before};
    });
    return {cases: energies};
  });

  runCheck(checks, "INVARIANT-001", "proper world rotation commutes with plane contact", () => {
    const normal = normalize(vec(0.24, 0.94, 0.25));
    const state = canonicalBall(vec(0.2, 0.8, -0.6), vec(0.7, -2.3, 1.1), vec(17, -8, 21));
    const surfaceVelocity = vec(0.12, 0.03, -0.18);
    const response = planeContact(state, normal, 0.71, 0.18, surfaceVelocity);
    const matrix = rotationMatrix(vec(0.4, -0.7, 0.5), 0.83);
    const rotatedState = canonicalBall(
      applyMatrix(matrix, state.position),
      applyMatrix(matrix, state.velocity),
      applyMatrix(matrix, state.omega)
    );
    const rotatedResponse = planeContact(
      rotatedState,
      applyMatrix(matrix, normal),
      0.71,
      0.18,
      applyMatrix(matrix, surfaceVelocity)
    );
    assertVectorNear(rotatedResponse.state.velocity, applyMatrix(matrix, response.state.velocity),
      "rotated velocity", 1e-8);
    assertVectorNear(rotatedResponse.state.omega, applyMatrix(matrix, response.state.omega),
      "rotated omega", 1e-8);
    assertNear(rotatedResponse.normalImpulse, response.normalImpulse, "rotated normal impulse", 1e-10);
    return {normalImpulse: response.normalImpulse, velocityError: magnitude(sub(
      rotatedResponse.state.velocity, applyMatrix(matrix, response.state.velocity)
    )), omegaError: magnitude(sub(
      rotatedResponse.state.omega, applyMatrix(matrix, response.state.omega)
    ))};
  });

  runCheck(checks, "INVARIANT-002", "mirror reflection preserves contact behavior with axial omega semantics", () => {
    const normal = normalize(vec(0.24, 0.94, 0.25));
    const state = canonicalBall(vec(0.2, 0.8, -0.6), vec(0.7, -2.3, 1.1), vec(17, -8, 21));
    const surfaceVelocity = vec(0.12, 0.03, -0.18);
    const response = planeContact(state, normal, 0.71, 0.18, surfaceVelocity);
    const reflectedState = canonicalBall(
      reflectX(state.position),
      reflectX(state.velocity),
      reflectOmegaX(state.omega)
    );
    const reflectedResponse = planeContact(
      reflectedState,
      reflectX(normal),
      0.71,
      0.18,
      reflectX(surfaceVelocity)
    );
    assertVectorNear(reflectedResponse.state.velocity, reflectX(response.state.velocity),
      "reflected velocity", 1e-8);
    assertVectorNear(reflectedResponse.state.omega, reflectOmegaX(response.state.omega),
      "reflected omega", 1e-8);
    return {normalImpulse: response.normalImpulse, reflectedNormalImpulse: reflectedResponse.normalImpulse};
  });

  runCheck(checks, "FLIGHT-001", "Magnus acceleration follows vector cross-product semantics", () => {
    const velocity = vec(2.2, 0.6, -1.1);
    const omega = {schema: SCHEMA, omega: vec(7, -4, 13)};
    const coefficient = 0.003;
    const actual = core.physics3dMagnusAcceleration(velocity, omega, coefficient);
    const expected = scale(cross(omega.omega, velocity), coefficient);
    assertVectorNear(actual, expected, "Magnus acceleration", 1e-12);
    const reverse = core.physics3dMagnusAcceleration(velocity, {
      schema: SCHEMA,
      omega: scale(omega.omega, -1),
    }, coefficient);
    assertVectorNear(reverse, scale(actual, -1), "reversed omega Magnus acceleration", 1e-12);
    const parallel = core.physics3dMagnusAcceleration(velocity, {
      schema: SCHEMA,
      omega: scale(velocity, 5),
    }, coefficient);
    assertNear(magnitude(parallel), 0, "parallel Magnus acceleration", 1e-12);
    return {actual, reverse, parallel};
  });

  runCheck(checks, "V2-CONTACT-001", "mainline-v2 contact policy accepts canonical BallState on a tilted plane", () => {
    const state = canonicalBall(vec(0, 0, 0), vec(0.4, -2, 0.9), vec(12, -5, 17));
    const normal = normalize(vec(0.2, 0.97, -0.12));
    const mode = contactApi.createMode({normalModel: "instantaneous", tangentModel: "coulomb"});
    const result = contactApi.solveTableContact({
      state,
      surface: {normal, surfaceVelocity: vec(0, 0, 0), friction: 0.13, restitution: 0.76},
      mode,
    }, core);
    assertFiniteVector(result.state.velocity, "v2 response velocity");
    assertFiniteVector(result.state.omega, "v2 response omega");
    assert.ok(dot(result.state.velocity, normal) > 0, "v2 response did not separate from tilted plane");
    assert.ok(result.diagnostics && result.diagnostics.frictionRegime,
      "v2 contact did not expose friction regime");
    assert.ok(result.diagnostics.energyDelta <= 1e-10,
      `v2 contact increased energy: ${result.diagnostics.energyDelta}`);
    return {
      frictionRegime: result.diagnostics.frictionRegime,
      energyDelta: result.diagnostics.energyDelta,
      normalImpulse: result.diagnostics.normalImpulse,
    };
  });

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  const report = {
    status: failCount === 0 ? "pass" : "review-required",
    date: new Date().toISOString(),
    scope: "qualitative schema-2 3D BallState/omega, plane contact, frame invariance, and Magnus vector semantics",
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
