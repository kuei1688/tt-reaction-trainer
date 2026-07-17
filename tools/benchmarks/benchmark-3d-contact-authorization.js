#!/usr/bin/env node
"use strict";

// Isolated validation of 3D physics scope reset acceptance condition #4:
// "Normal velocity reverses across the contact; tangent response must not
// invent unauthorized lateral velocity or energy."
//
// This tool reads mainline-v2 and shared-physics-core. It does NOT modify
// either layer, does not tune parameters, and does not compare against
// the 2017 external benchmark. Pass/fail checks are semantic invariants
// only.
//
// Strategy: target specific channels where "unauthorized lateral velocity
// or energy" could leak in, and verify each is blocked:
//   (a) Pure vertical approach + arbitrary omega: the COM velocity has
//       zero tangential component before and after; omega only enters via
//       the contact-point velocity v + omega x r and drives friction, but
//       friction impulse on the COM cannot produce a net tangential COM
//       velocity unless the surface is also moving. Wait — friction impulse
//       on the COM does change tangential COM velocity (that's the point
//       of friction). The invariant is subtler: a pure-axial omega (along
//       the normal) gives zero contact-point tangential velocity, so it
//       must not produce any tangent impulse.
//   (b) Pure axial spin (omega parallel to table normal): zero tangent
//       impulse, regardless of approach.
//   (c) Moving surface with tangential velocity: the COM tangential delta
//       is bounded — the post-contact contact-point velocity is no faster
//       in tangent direction than the surface itself (friction brings the
//       contact point toward surface velocity, never past it).
//   (d) Energy non-increase across arbitrary contacts.
//   (e) Tilted table: normal-direction approach strictly reverses;
//       tangent response lies in the tangent plane (zero dot with normal).

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const AI_CONTEXT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", "isolation-validation");
const REPORT_JSON = path.join(AI_CONTEXT_DIR, "3d_contact_authorization.json");
const REPORT_MD = path.join(AI_CONTEXT_DIR, "3d_contact_authorization.md");
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
    "# 3D Contact Authorization",
    "",
    `- Status: **${report.status}**`,
    `- Date: ${report.date}`,
    `- Checks: ${report.passCount} passed, ${report.failCount} failed`,
    "- Scope: 3D physics scope reset acceptance condition #4 — tangent response must not invent unauthorized lateral velocity or energy.",
    "- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.",
    "",
    "## Result",
    "",
    report.status === "pass"
      ? "All contact-authorization invariants hold. The solver does not invent tangent COM velocity from axial spin, does not accelerate the COM past a moving surface, and confines tangent response to the tangent plane."
      : "One or more contact-authorization invariants failed.",
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

  // ── (a) Pure vertical approach + arbitrary omega: COM tangential velocity
  // stays zero IF AND ONLY IF omega is parallel to the normal (axial). For
  // a general omega, the contact-point velocity has a tangential component
  // (omega x r), and friction impulse on the COM DOES change tangential COM
  // velocity — that is physical. So the actual invariant is about axial
  // omega, covered by (b) below. The (a) case we test here is: zero omega
  // and pure vertical approach → zero tangent impulse and zero output
  // tangential COM velocity. This is the "do not invent" smoke test.

  runCheck(checks, "AUTH-001", "pure vertical approach + zero omega: zero tangent impulse, zero output tangential COM velocity, vertical restitution correct", () => {
    const normal = vec(0, 1, 0);
    const state = canonicalBall(vec(0, 0.05, 0), vec(0, -2.0, 0), vec(0, 0, 0));
    const response = planeContact(state, normal, 0.76, 0.4);
    assertNear(response.tangentImpulse.x, 0, "vertical zero-omega tangent impulse x", 1e-12);
    assertNear(response.tangentImpulse.z, 0, "vertical zero-omega tangent impulse z", 1e-12);
    assertNear(response.state.velocity.x, 0, "vertical zero-omega output COM x", 1e-12);
    assertNear(response.state.velocity.z, 0, "vertical zero-omega output COM z", 1e-12);
    assertNear(response.state.velocity.y, 0.76 * 2.0, "vertical zero-omega restitution y", 1e-10);
    return {velocity: response.state.velocity, tangentImpulse: response.tangentImpulse};
  });

  // ── (b) Pure axial spin (omega parallel to normal): zero tangent impulse
  // regardless of approach. The contact-point velocity v + omega x r has
  // no tangential contribution from omega (cross product of parallel
  // vectors is zero), so there is nothing for friction to act on from
  // spin. If the COM also has no tangential approach, tangent impulse is
  // exactly zero. If the COM has tangential approach, friction acts on
  // that — but the axial omega does not contribute.
  // Sub-case b1: axial omega + pure vertical approach → zero tangent impulse.

  runCheck(checks, "AUTH-002", "axial omega (parallel to normal) + pure vertical approach: zero tangent impulse, omega preserved", () => {
    const normal = vec(0, 1, 0);
    const state = canonicalBall(vec(0, 0.05, 0), vec(0, -2.0, 0), vec(0, 60, 0));
    const response = planeContact(state, normal, 0.76, 0.4);
    assertNear(response.tangentImpulse.x, 0, "axial+vertical tangent impulse x", 1e-12);
    assertNear(response.tangentImpulse.z, 0, "axial+vertical tangent impulse z", 1e-12);
    assertNear(response.state.omega.y, 60, "axial omega.y preserved", 1e-10);
    assertNear(response.state.velocity.y, 0.76 * 2.0, "axial+vertical restitution y", 1e-10);
    return {
      velocity: response.state.velocity,
      omega: response.state.omega,
      tangentImpulse: response.tangentImpulse,
    };
  });

  // ── (c) Moving surface with tangential velocity: friction must not
  // push the COM past the surface velocity. The invariant is:
  //   - the contact-point tangential velocity (v + omega x r - v_surface)
  //     projected on the tangent plane must not flip sign across the
  //     contact (friction reduces it, may zero it for sticking, must not
  //     reverse it — reversal would mean friction overshot).
  //   - the COM tangential velocity is bounded: |v_COM_t| <= |v_surface_t|
  //     (the ball cannot move faster in the surface direction than the
  //     surface itself; otherwise friction invented energy).
  // We test both. Sticking (tangent-after = 0) is the special case that
  // occurs when friction is large enough; with moderate friction the
  // contact-point tangential velocity after contact keeps the same sign
  // and smaller magnitude (sliding).

  runCheck(checks, "AUTH-003", "moving surface drags ball: COM tangential velocity same sign as surface, |v_t| <= |v_surface_t|, contact-point tangent does not flip sign", () => {
    const normal = vec(0, 1, 0);
    const surfaceVel = vec(2.0, 0, 0);
    const state = canonicalBall(vec(0, 0.05, 0), vec(0, -0.5, 0), vec(0, 0, 0));
    const response = planeContact(state, normal, 0.76, 0.6, surfaceVel);
    // Ball COM tangential velocity after must be +x (same sign as surface).
    assert.ok(response.state.velocity.x > 0,
      `expected COM dragged +x, got ${response.state.velocity.x}`);
    // Magnitude bounded by surface velocity (cannot overshoot).
    assert.ok(response.state.velocity.x <= surfaceVel.x + 1e-9,
      `expected |v_t| <= |v_surface_t|, got ${response.state.velocity.x} > ${surfaceVel.x}`);
    // Contact-point tangential velocity must not flip sign.
    const offset = scale(normal, -core.BALL_RADIUS);
    const before = sub(add(state.velocity, cross(state.omega, offset)), surfaceVel);
    const after = sub(add(response.state.velocity, cross(response.state.omega, offset)), surfaceVel);
    const tangentBefore = sub(before, scale(normal, dot(before, normal)));
    const tangentAfter = sub(after, scale(normal, dot(after, normal)));
    // Before: contact-point relative tangential velocity is -surfaceVel = -2 in x.
    // After: should still be <= 0 in x (friction reduced magnitude but did not reverse).
    assert.ok(tangentBefore.x < 0, `expected negative tangent before, got ${tangentBefore.x}`);
    assert.ok(tangentAfter.x <= 1e-9,
      `expected non-positive tangent after (no overshoot), got ${tangentAfter.x}`);
    assert.ok(Math.abs(tangentAfter.x) <= Math.abs(tangentBefore.x) + 1e-9,
      `sliding should reduce |tangent|, got |${tangentAfter.x}| > |${tangentBefore.x}|`);
    return {
      surfaceVelocity: surfaceVel,
      comVelocityAfter: response.state.velocity,
      contactPointTangentBefore: tangentBefore,
      contactPointTangentAfter: tangentAfter,
    };
  });

  // ── (c2) Stronger: with low friction, the contact-point tangential
  // velocity after contact must have the SAME SIGN as before (sliding
  // regime — friction reduces but does not reverse relative motion).
  runCheck(checks, "AUTH-004", "sliding regime (low friction): contact-point tangential velocity does not reverse sign", () => {
    const normal = vec(0, 1, 0);
    const surfaceVel = vec(0, 0, 0);
    const state = canonicalBall(vec(0, 0.05, 0), vec(1.5, -0.5, 0), vec(0, 0, 0));
    const response = planeContact(state, normal, 0.76, 0.05, surfaceVel);
    const offset = scale(normal, -core.BALL_RADIUS);
    const before = sub(add(state.velocity, cross(state.omega, offset)), surfaceVel);
    const tangentBefore = sub(before, scale(normal, dot(before, normal)));
    const after = sub(add(response.state.velocity, cross(response.state.omega, offset)), surfaceVel);
    const tangentAfter = sub(after, scale(normal, dot(after, normal)));
    // Both should have +x sign (sliding regime reduces magnitude).
    assert.ok(tangentBefore.x > 0, `expected +x tangent before, got ${tangentBefore.x}`);
    assert.ok(tangentAfter.x >= 0, `expected non-negative tangent after, got ${tangentAfter.x}`);
    assert.ok(magnitude(tangentAfter) <= magnitude(tangentBefore) + 1e-9,
      `sliding should reduce |tangent|, got ${magnitude(tangentAfter)} > ${magnitude(tangentBefore)}`);
    return {tangentBefore, tangentAfter};
  });

  // ── (d) Energy non-increase across a varied set of contact cases.
  runCheck(checks, "AUTH-005", "passive contact does not increase kinetic energy across varied cases", () => {
    const cases = [
      {velocity: vec(0.6, -2.1, 0.4), omega: vec(18, 2, -11), normal: vec(0, 1, 0), friction: 0.13, restitution: 0.76},
      {velocity: vec(-1.2, -1.7, 0.8), omega: vec(-24, 9, 7), normal: normalize(vec(0.3, 0.93, -0.1)), friction: 0.2, restitution: 0.7},
      {velocity: vec(0.2, -2.8, -0.9), omega: vec(31, -17, -13), normal: vec(0, 1, 0), friction: 0.4, restitution: 0.76},
      {velocity: vec(2.1, -0.9, -1.5), omega: vec(-8, 41, 19), normal: normalize(vec(-0.2, 0.95, 0.25)), friction: 0.13, restitution: 0.8},
      {velocity: vec(0.5, -1.5, 0.3), omega: vec(0, 50, 0), normal: vec(0, 1, 0), friction: 0.4, restitution: 0.9},
    ];
    const results = cases.map((item, index) => {
      const state = canonicalBall(vec(0, 0.05, 0), item.velocity, item.omega);
      const response = planeContact(state, item.normal, item.restitution, item.friction);
      const before = kineticEnergy(state);
      const after = kineticEnergy(response.state);
      assert.ok(after <= before + 1e-10,
        `case ${index} energy increased: ${before} -> ${after}`);
      return {case: index, before, after, delta: after - before};
    });
    return {cases: results};
  });

  // ── (e) Tilted table: normal-direction approach strictly reverses;
  // tangent response lies in the tangent plane (zero dot with normal).
  runCheck(checks, "AUTH-006", "tilted table: normal approach strictly reverses; tangent impulse is orthogonal to normal", () => {
    const normal = normalize(vec(0.24, 0.94, -0.25));
    const state = canonicalBall(
      vec(0.1, 0.05, -0.2),
      vec(0.4, -2.0, 0.7),
      vec(25, -18, 33)
    );
    const response = planeContact(state, normal, 0.72, 0.2, vec(0.05, -0.02, 0.08));
    const offset = scale(normal, -core.BALL_RADIUS);
    const before = sub(add(state.velocity, cross(state.omega, offset)), vec(0.05, -0.02, 0.08));
    const after = sub(add(response.state.velocity, cross(response.state.omega, offset)), vec(0.05, -0.02, 0.08));
    const beforeNormal = dot(before, normal);
    const afterNormal = dot(after, normal);
    assert.ok(beforeNormal < 0, `expected tilted approach, got ${beforeNormal}`);
    assert.ok(afterNormal > 0, `expected tilted separation, got ${afterNormal}`);
    assertNear(afterNormal, -0.72 * beforeNormal, "tilted restitution (contact-point frame)", 1e-8);
    // Tangent impulse must be orthogonal to the normal.
    const tangentImpulseDotNormal = dot(response.tangentImpulse, normal);
    assertNear(tangentImpulseDotNormal, 0, "tilted tangent impulse orthogonal to normal", 1e-10);
    // Also verify: response velocity change in normal direction matches
    // the normal impulse / mass.
    const deltaVelocityNormal = dot(sub(response.state.velocity, state.velocity), normal);
    const expectedDelta = response.normalImpulse / state.mass;
    assertNear(deltaVelocityNormal, expectedDelta, "tilted normal delta matches impulse/mass", 1e-8);
    return {
      normal,
      beforeNormal,
      afterNormal,
      tangentImpulseDotNormal,
      deltaVelocityNormal,
      expectedDelta,
    };
  });

  // ── (f) COM tangential velocity from axial omega only: friction does
  // not invent COM tangential velocity when contact-point velocity has no
  // tangential component. This is a stronger version of AUTH-002: even
  // with non-vertical approach, if the contact-point tangential velocity
  // (v + omega x r - surfaceVel) projected on the tangent plane is zero,
  // the tangent impulse must be zero. Construct: omega parallel to normal
  // AND approach has no tangential component → both sources of contact-
  // point tangential velocity are zero → zero tangent impulse.

  runCheck(checks, "AUTH-007", "zero contact-point tangential velocity → zero tangent impulse (no invention)", () => {
    const normal = vec(0, 1, 0);
    const surfaceVel = vec(0, 0, 0);
    // Approach exactly along -normal; omega exactly along +normal.
    const state = canonicalBall(vec(0, 0.05, 0), vec(0, -2.5, 0), vec(0, 35, 0));
    const response = planeContact(state, normal, 0.76, 0.4, surfaceVel);
    assertNear(response.tangentImpulse.x, 0, "zero-contact-tangent impulse x", 1e-12);
    assertNear(response.tangentImpulse.z, 0, "zero-contact-tangent impulse z", 1e-12);
    // COM tangential velocity stays zero.
    assertNear(response.state.velocity.x, 0, "zero-contact-tangent output COM x", 1e-12);
    assertNear(response.state.velocity.z, 0, "zero-contact-tangent output COM z", 1e-12);
    // Axial omega is preserved (no torque about y from bottom friction).
    assertNear(response.state.omega.y, 35, "zero-contact-tangent omega.y preserved", 1e-10);
    return {
      tangentImpulse: response.tangentImpulse,
      velocity: response.state.velocity,
      omega: response.state.omega,
    };
  });

  // ── (g) Surface velocity in normal direction does not create tangent
  // impulse: a surface moving in the normal direction (e.g. vertically
  // bouncing table) should only affect normal response, not invent a
  // tangent. This is an edge case worth confirming.
  runCheck(checks, "AUTH-008", "surface velocity purely along normal does not invent tangent impulse", () => {
    const normal = vec(0, 1, 0);
    const surfaceVel = vec(0, 0.5, 0);  // Surface moving up
    const state = canonicalBall(vec(0, 0.05, 0), vec(0, -1.5, 0), vec(0, 0, 0));
    const response = planeContact(state, normal, 0.76, 0.4, surfaceVel);
    assertNear(response.tangentImpulse.x, 0, "normal-surface-vel tangent impulse x", 1e-12);
    assertNear(response.tangentImpulse.z, 0, "normal-surface-vel tangent impulse z", 1e-12);
    assertNear(response.state.velocity.x, 0, "normal-surface-vel output COM x", 1e-12);
    assertNear(response.state.velocity.z, 0, "normal-surface-vel output COM z", 1e-12);
    // Normal response should reflect the relative normal velocity.
    const offset = scale(normal, -core.BALL_RADIUS);
    const before = sub(add(state.velocity, cross(state.omega, offset)), surfaceVel);
    const beforeNormal = dot(before, normal);
    const after = sub(add(response.state.velocity, cross(response.state.omega, offset)), surfaceVel);
    const afterNormal = dot(after, normal);
    assert.ok(beforeNormal < 0, `expected approach, got ${beforeNormal}`);
    assert.ok(afterNormal > 0, `expected separation, got ${afterNormal}`);
    assertNear(afterNormal, -0.76 * beforeNormal, "normal-surface-vel restitution", 1e-8);
    return {
      surfaceVel,
      beforeNormal,
      afterNormal,
      tangentImpulse: response.tangentImpulse,
    };
  });

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  const report = {
    status: failCount === 0 ? "pass" : "review-required",
    date: new Date().toISOString(),
    scope: "3D physics scope reset acceptance #4: normal restitution + tangent response must not invent unauthorized lateral velocity or energy",
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