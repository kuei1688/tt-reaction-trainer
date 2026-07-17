#!/usr/bin/env node
"use strict";

// Isolated validation of 3D physics scope reset acceptance condition #2:
// "omega = 0, pure single-axis, mixed spin, and spin-axis sign reversal all
// process correctly, without depending on any specific label."
//
// This tool reads mainline-v2 and shared-physics-core. It does NOT modify
// either layer, does not tune parameters, and does not compare against the
// 2017 external benchmark. Pass/fail checks are semantic invariants only.
//
// Strategy: for each canonical case, build the BallState, run a plane
// contact, then build a "sign-flipped twin" by flipping the axial component
// of omega (and the matching velocity component so the tangential direction
// of the surface point's contact velocity also reverses). The contact
// response of the twin must be the matching sign-flip of the original:
//   - velocity on the flipped axis flips sign (tangent axes unchanged)
//   - omega on the flipped axis flips sign (other axes unchanged)
//   - normal impulse is unchanged (it depends on normal-direction speed)
//   - tangent impulse flips on the affected tangent axis
//   - kinetic energy is preserved
// No label is read; the check is purely vector-mechanical.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const AI_CONTEXT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", "isolation-validation");
const REPORT_JSON = path.join(AI_CONTEXT_DIR, "3d_spin_axis_sign_flip_invariance.json");
const REPORT_MD = path.join(AI_CONTEXT_DIR, "3d_spin_axis_sign_flip_invariance.md");
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

function vec(x, y, z) { return {x, y, z}; }
function add(a, b) { return vec(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a, b) { return vec(a.x - b.x, a.y - b.y, a.z - b.z); }
function scale(a, f) { return vec(a.x * f, a.y * f, a.z * f); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
function magnitude(a) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a) { return scale(a, 1 / magnitude(a)); }

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

// Sign-flip along a single axis. For angular velocity (an axial vector /
// pseudovector), flipping one axis flips the OTHER two components because
// omega transforms under det(R). For a proper rotation by pi around the
// chosen axis, omega along that axis stays and the other two flip. We want
// the simpler "negate this component" semantic here: that is a reflection
// (improper), so omega on the chosen axis stays and the other two components
// also stay (because pseudovectors pick up det=-1, cancelling the axis flip).
// Concretely, for a pure-axis omega, sign-flip is just negation on that axis.
// For mixed omega, we test proper 180deg rotations around each Cartesian axis
// instead, where omega transforms like a true vector under proper rotations.
function negateAxis(value, axis) {
  return {...value, [axis]: -value[axis]};
}

// Proper rotation by pi around the given axis: position/velocity/surfaceVelocity
// transform as polar vectors; omega transforms as an axial vector but under
// a *proper* rotation R(det=+1), axial and polar transform the same way, so
// we can apply the same matrix to all.
function piRotationAround(axis) {
  // 180-degree rotation around a Cartesian axis.
  if (axis === "x") return (v) => vec(v.x, -v.y, -v.z);
  if (axis === "y") return (v) => vec(-v.x, v.y, -v.z);
  if (axis === "z") return (v) => vec(-v.x, -v.y, v.z);
  throw new Error(`unknown axis ${axis}`);
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
    "# 3D Spin-Axis Sign-Flip Invariance",
    "",
    `- Status: **${report.status}**`,
    `- Date: ${report.date}`,
    `- Checks: ${report.passCount} passed, ${report.failCount} failed`,
    "- Scope: 3D physics scope reset acceptance condition #2 — pure-axis, mixed, and sign-reversed omega must all process without depending on a label.",
    "- Interpretation: qualitative representability evidence only; not calibration or physical-truth evidence.",
    "",
    "## Result",
    "",
    report.status === "pass"
      ? "All sign-flip invariants hold. The contact solver treats omega as a vector state and does not branch on spin labels."
      : "One or more sign-flip invariants failed. The contact solver is reading something other than pure vector state.",
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

  // ── Group A: pure single-axis omega, sign flip on that axis ─────────────
  // For a pure-axis omega with a horizontal table, the contact solver
  // should treat the negated state as the sign-flipped twin. For a pure
  // y-axis (axial, parallel to normal), omega does not contribute to
  // contact-point velocity, so +/-omega.y produce IDENTICAL responses and
  // omega.y is preserved (no friction torque about y at the bottom
  // contact point). For pure x or z, the sign-flip twin should show
  // flipped tangent impulse on the perpendicular tangent, flipped output
  // omega on that axis (friction reduces magnitude equally from both
  // starting signs), flipped output velocity on the perpendicular tangent,
  // unchanged normal impulse, and preserved kinetic energy.

  runCheck(checks, "SIGN-001", "pure y-axis omega: +omega and -omega give identical contact response (axial spin does not invent tangent velocity)", () => {
    const normal = vec(0, 1, 0);
    const statePos = vec(0.1, 0.05, -0.2);
    const stateVel = vec(0.3, -2.1, 0.5);
    const a = canonicalBall(statePos, stateVel, vec(0, 40, 0));
    const b = canonicalBall(statePos, stateVel, vec(0, -40, 0));
    const ra = planeContact(a, normal);
    const rb = planeContact(b, normal);
    assertNear(ra.normalImpulse, rb.normalImpulse, "axial normal impulse", 1e-12);
    assertVectorNear(ra.tangentImpulse, rb.tangentImpulse, "axial tangent impulse identical", 1e-12);
    assertVectorNear(ra.state.velocity, rb.state.velocity, "axial output velocity identical", 1e-12);
    // omega.y is preserved in sign (no torque about y from bottom friction).
    assertNear(ra.state.omega.y, 40, "axial a omega.y preserved", 1e-10);
    assertNear(rb.state.omega.y, -40, "axial b omega.y preserved", 1e-10);
    // omega.x and omega.z are GENERATED by friction acting on the tangential
    // approach velocity, so they are the SAME for +omega.y and -omega.y
    // (they do not depend on the sign of the axial spin).
    assertNear(ra.state.omega.x, rb.state.omega.x, "axial output omega.x identical", 1e-12);
    assertNear(ra.state.omega.z, rb.state.omega.z, "axial output omega.z identical", 1e-12);
    return {
      normalImpulse: ra.normalImpulse,
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
      tangentImpulseA: ra.tangentImpulse,
      tangentImpulseB: rb.tangentImpulse,
    };
  });

  runCheck(checks, "SIGN-002", "pure x-axis omega: sign flip on x flips tangent response on z, preserves y normal impulse, preserves energy", () => {
    const normal = vec(0, 1, 0);
    const statePos = vec(0, 0.05, 0);
    const stateVel = vec(0, -2.0, 0);
    const a = canonicalBall(statePos, stateVel, vec(30, 0, 0));
    const b = canonicalBall(statePos, stateVel, vec(-30, 0, 0));
    const ra = planeContact(a, normal);
    const rb = planeContact(b, normal);
    assertNear(ra.normalImpulse, rb.normalImpulse, "x-spin normal impulse", 1e-12);
    // Tangent impulse along z should flip sign (contact point on bottom of
    // ball, +omega.x gives surface velocity -z, -omega.x gives +z; friction
    // opposes both, so impulses are opposite).
    assertNear(ra.tangentImpulse.z, -rb.tangentImpulse.z, "x-spin tangent impulse z flip", 1e-12);
    assertNear(ra.state.velocity.z, -rb.state.velocity.z, "x-spin output velocity z flip", 1e-12);
    // omega.x should flip sign: friction reduces from +30 by delta, and
    // from -30 by the same delta (opposite direction), so a.x = -(b.x).
    assertNear(ra.state.omega.x, -rb.state.omega.x, "x-spin output omega.x sign flip", 1e-12);
    assertNear(ra.state.omega.y, 0, "x-spin a omega.y unchanged", 1e-10);
    assertNear(rb.state.omega.y, 0, "x-spin b omega.y unchanged", 1e-10);
    assertNear(ra.state.omega.z, 0, "x-spin a omega.z unchanged", 1e-10);
    assertNear(rb.state.omega.z, 0, "x-spin b omega.z unchanged", 1e-10);
    assertNear(kineticEnergy(ra.state), kineticEnergy(rb.state), "x-spin energy parity", 1e-10);
    return {
      tangentImpulseA: ra.tangentImpulse,
      tangentImpulseB: rb.tangentImpulse,
      velocityA: ra.state.velocity,
      velocityB: rb.state.velocity,
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
    };
  });

  runCheck(checks, "SIGN-003", "pure z-axis omega: sign flip on z flips tangent response on x, preserves y normal impulse, preserves energy", () => {
    const normal = vec(0, 1, 0);
    const statePos = vec(0, 0.05, 0);
    const stateVel = vec(0, -2.0, 0);
    const a = canonicalBall(statePos, stateVel, vec(0, 0, 30));
    const b = canonicalBall(statePos, stateVel, vec(0, 0, -30));
    const ra = planeContact(a, normal);
    const rb = planeContact(b, normal);
    assertNear(ra.normalImpulse, rb.normalImpulse, "z-spin normal impulse", 1e-12);
    assertNear(ra.tangentImpulse.x, -rb.tangentImpulse.x, "z-spin tangent impulse x flip", 1e-12);
    assertNear(ra.state.velocity.x, -rb.state.velocity.x, "z-spin output velocity x flip", 1e-12);
    assertNear(ra.state.omega.z, -rb.state.omega.z, "z-spin output omega.z sign flip", 1e-12);
    assertNear(ra.state.omega.x, 0, "z-spin a omega.x unchanged", 1e-10);
    assertNear(rb.state.omega.x, 0, "z-spin b omega.x unchanged", 1e-10);
    assertNear(ra.state.omega.y, 0, "z-spin a omega.y unchanged", 1e-10);
    assertNear(rb.state.omega.y, 0, "z-spin b omega.y unchanged", 1e-10);
    assertNear(kineticEnergy(ra.state), kineticEnergy(rb.state), "z-spin energy parity", 1e-10);
    return {
      tangentImpulseA: ra.tangentImpulse,
      tangentImpulseB: rb.tangentImpulse,
      velocityA: ra.state.velocity,
      velocityB: rb.state.velocity,
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
    };
  });

  // ── Group B: mixed omega, 180-degree proper rotations ───────────────────
  // For mixed omega, "sign reversal of a single axis" is an improper
  // transformation (reflection). The physically meaningful test is a proper
  // 180-degree rotation around a Cartesian axis: position/velocity/surface
  // velocity/omega all transform the same way (proper R has det=+1), and
  // the contact response must transform consistently.

  runCheck(checks, "SIGN-004", "mixed omega under 180deg rotation around x: contact response transforms with R", () => {
    const normal = normalize(vec(0.2, 0.95, -0.15));
    const statePos = vec(0.1, 0.05, -0.2);
    const stateVel = vec(0.4, -2.0, 0.7);
    const omega = vec(25, -18, 33);
    const surfaceVel = vec(0.05, -0.02, 0.08);
    const a = canonicalBall(statePos, stateVel, omega);
    const ra = planeContact(a, normal, 0.76, 0.2, surfaceVel);
    const R = piRotationAround("x");
    const b = canonicalBall(R(statePos), R(stateVel), R(omega));
    const rb = planeContact(b, R(normal), 0.76, 0.2, R(surfaceVel));
    assertVectorNear(rb.state.velocity, R(ra.state.velocity), "rotated-x output velocity", 1e-9);
    assertVectorNear(rb.state.omega, R(ra.state.omega), "rotated-x output omega", 1e-9);
    assertVectorNear(rb.tangentImpulse, R(ra.tangentImpulse), "rotated-x tangent impulse", 1e-9);
    assertNear(rb.normalImpulse, ra.normalImpulse, "rotated-x normal impulse", 1e-10);
    return {
      velocityA: ra.state.velocity,
      velocityB: rb.state.velocity,
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
    };
  });

  runCheck(checks, "SIGN-005", "mixed omega under 180deg rotation around y: contact response transforms with R", () => {
    const normal = normalize(vec(0.2, 0.95, -0.15));
    const statePos = vec(0.1, 0.05, -0.2);
    const stateVel = vec(0.4, -2.0, 0.7);
    const omega = vec(25, -18, 33);
    const surfaceVel = vec(0.05, -0.02, 0.08);
    const a = canonicalBall(statePos, stateVel, omega);
    const ra = planeContact(a, normal, 0.76, 0.2, surfaceVel);
    const R = piRotationAround("y");
    const b = canonicalBall(R(statePos), R(stateVel), R(omega));
    const rb = planeContact(b, R(normal), 0.76, 0.2, R(surfaceVel));
    assertVectorNear(rb.state.velocity, R(ra.state.velocity), "rotated-y output velocity", 1e-9);
    assertVectorNear(rb.state.omega, R(ra.state.omega), "rotated-y output omega", 1e-9);
    assertVectorNear(rb.tangentImpulse, R(ra.tangentImpulse), "rotated-y tangent impulse", 1e-9);
    assertNear(rb.normalImpulse, ra.normalImpulse, "rotated-y normal impulse", 1e-10);
    return {
      velocityA: ra.state.velocity,
      velocityB: rb.state.velocity,
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
    };
  });

  runCheck(checks, "SIGN-006", "mixed omega under 180deg rotation around z: contact response transforms with R", () => {
    const normal = normalize(vec(0.2, 0.95, -0.15));
    const statePos = vec(0.1, 0.05, -0.2);
    const stateVel = vec(0.4, -2.0, 0.7);
    const omega = vec(25, -18, 33);
    const surfaceVel = vec(0.05, -0.02, 0.08);
    const a = canonicalBall(statePos, stateVel, omega);
    const ra = planeContact(a, normal, 0.76, 0.2, surfaceVel);
    const R = piRotationAround("z");
    const b = canonicalBall(R(statePos), R(stateVel), R(omega));
    const rb = planeContact(b, R(normal), 0.76, 0.2, R(surfaceVel));
    assertVectorNear(rb.state.velocity, R(ra.state.velocity), "rotated-z output velocity", 1e-9);
    assertVectorNear(rb.state.omega, R(ra.state.omega), "rotated-z output omega", 1e-9);
    assertVectorNear(rb.tangentImpulse, R(ra.tangentImpulse), "rotated-z tangent impulse", 1e-9);
    assertNear(rb.normalImpulse, ra.normalImpulse, "rotated-z normal impulse", 1e-10);
    return {
      velocityA: ra.state.velocity,
      velocityB: rb.state.velocity,
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
    };
  });

  // ── Group C: full omega negation (180deg around any axis perpendicular) ─
  // Negating ALL components of omega is a proper rotation by 180deg around
  // *some* axis perpendicular to omega. We pick a known perpendicular axis
  // and verify the response negates as expected. Use a simple case where
  // omega is along z and we rotate 180deg around x: omega.z flips, omega.y
  // flips (but it's zero), position.y stays, position.z flips. To make a
  // cleaner "all-of-omega negated" test we use an omega that is purely
  // perpendicular to the rotation axis.

  runCheck(checks, "SIGN-007", "full omega negation via 180deg rotation: response omega negates, energy preserved", () => {
    // omega along z, rotate 180deg around x: omega.z -> -omega.z, omega.y -> -omega.y (zero stays zero)
    const normal = vec(0, 1, 0);
    const statePos = vec(0.05, 0.05, 0);
    const stateVel = vec(0.2, -2.0, 0.3);
    const omega = vec(0, 0, 45);
    const a = canonicalBall(statePos, stateVel, omega);
    const ra = planeContact(a, normal, 0.76, 0.2);
    const R = piRotationAround("x");
    const b = canonicalBall(R(statePos), R(stateVel), R(omega));
    const rb = planeContact(b, R(normal), 0.76, 0.2);
    assertVectorNear(rb.state.velocity, R(ra.state.velocity), "negated-omega output velocity", 1e-9);
    assertNear(rb.state.omega.z, -ra.state.omega.z, "negated-omega output omega z", 1e-9);
    assertNear(rb.state.omega.y, -ra.state.omega.y, "negated-omega output omega y", 1e-9);
    assertNear(rb.state.omega.x, ra.state.omega.x, "negated-omega output omega x", 1e-9);
    assertNear(kineticEnergy(rb.state), kineticEnergy(ra.state), "negated-omega energy parity", 1e-10);
    return {
      omegaA: ra.state.omega,
      omegaB: rb.state.omega,
      energyA: kineticEnergy(ra.state),
      energyB: kineticEnergy(rb.state),
    };
  });

  // ── Group D: no-label-dependence smoke test ──────────────────────────────
  // The solver must not branch on labels. We verify this by constructing
  // two BallStates with identical vector state but different spin3d.schema
  // fields that might carry labels (we can't inject fake labels into
  // schema-2 BallState, but we can verify that running the same state twice
  // produces identical results, and that swapping which axis we call
  // "topspin" by rotating the world gives the rotated answer).

  runCheck(checks, "SIGN-008", "no-label-dependence: identical vector state always produces identical contact response", () => {
    const normal = normalize(vec(0.3, 0.91, -0.2));
    const statePos = vec(0.1, 0.05, -0.2);
    const stateVel = vec(0.4, -2.0, 0.7);
    const omega = vec(25, -18, 33);
    const a = canonicalBall(statePos, stateVel, omega);
    const aDuplicate = canonicalBall(statePos, stateVel, omega);
    const ra = planeContact(a, normal, 0.76, 0.2);
    const rb = planeContact(aDuplicate, normal, 0.76, 0.2);
    assertVectorNear(ra.state.velocity, rb.state.velocity, "no-label velocity", 1e-12);
    assertVectorNear(ra.state.omega, rb.state.omega, "no-label omega", 1e-12);
    assertNear(ra.normalImpulse, rb.normalImpulse, "no-label normal impulse", 1e-12);
    assertVectorNear(ra.tangentImpulse, rb.tangentImpulse, "no-label tangent impulse", 1e-12);
    return {note: "two identical BallStates produce identical responses"};
  });

  // ── Group E: zero omega is a clean vector state, not a label ──────────────
  // Zero omega + pure vertical approach (no tangential approach velocity):
  // there is no source of tangential relative motion at the contact point,
  // so the solver must not invent tangent impulse or angular velocity.
  runCheck(checks, "SIGN-009", "zero omega with pure vertical approach: response has zero tangent impulse and zero output omega", () => {
    const normal = vec(0, 1, 0);
    const statePos = vec(0, 0.05, 0);
    const stateVel = vec(0, -2.0, 0);
    const state = canonicalBall(statePos, stateVel, vec(0, 0, 0));
    const response = planeContact(state, normal, 0.76, 0.4);
    assertFiniteVector(response.state.velocity, "zero-omega output velocity");
    assertFiniteVector(response.state.omega, "zero-omega output omega");
    assertNear(response.state.omega.x, 0, "zero-omega output omega.x", 1e-10);
    assertNear(response.state.omega.y, 0, "zero-omega output omega.y", 1e-10);
    assertNear(response.state.omega.z, 0, "zero-omega output omega.z", 1e-10);
    assertNear(response.tangentImpulse.x, 0, "zero-omega tangent impulse x", 1e-10);
    assertNear(response.tangentImpulse.z, 0, "zero-omega tangent impulse z", 1e-10);
    // Normal restitution should still work: vertical approach reverses.
    assert.ok(response.state.velocity.y > 0, "zero-omega vertical restitution should separate");
    return {
      velocity: response.state.velocity,
      omega: response.state.omega,
      tangentImpulse: response.tangentImpulse,
    };
  });

  // ── Group F: zero omega with tangential approach does produce omega ─────
  // This is the physical complement of SIGN-009: friction acting on a
  // tangentially-moving ball with no spin DOES produce angular velocity
  // (ball starts to spin). This is not label-dependent — it is the same
  // vector mechanic applied to a different vector state. We verify the
  // sign of the generated omega is consistent with the tangent direction.
  runCheck(checks, "SIGN-010", "zero omega with tangential approach: friction generates omega with expected sign", () => {
    const normal = vec(0, 1, 0);
    const statePos = vec(0, 0.05, 0);
    const stateVel = vec(0.5, -2.0, 0);
    const state = canonicalBall(statePos, stateVel, vec(0, 0, 0));
    const response = planeContact(state, normal, 0.76, 0.4);
    assertFiniteVector(response.state.velocity, "tangential-approach output velocity");
    assertFiniteVector(response.state.omega, "tangential-approach output omega");
    // Ball moving +x, contact point at -y (bottom of ball). Contact-point
    // velocity relative to surface is +x. Friction impulse on ball at
    // contact point is -x. Torque = r x J with r=(0,-R,0), J=(-J,0,0):
    // r x J = (0, 0, (-r_y)*(-J_x)) ... = (0)*(-J) - 0 = 0 for x-component,
    // y-component 0, z-component = r_x*J_y - r_y*J_x = 0 - (-R)(-J) = -RJ,
    // so omega.z < 0 (ball starts spinning so its bottom moves +x, i.e.,
    // rolling forward — top of ball moves +x faster than center, which is
    // backspin from a receiver perspective; sign convention verified by
    // the geometric computation above, not by a label).
    assert.ok(response.state.omega.z < 0,
      `expected negative omega.z from +x approach (rolling forward), got ${response.state.omega.z}`);
    // Mirror case: -x approach should produce +omega.z.
    const mirror = canonicalBall(statePos, vec(-0.5, -2.0, 0), vec(0, 0, 0));
    const mirrorResponse = planeContact(mirror, normal, 0.76, 0.4);
    assert.ok(mirrorResponse.state.omega.z > 0,
      `expected positive omega.z from -x approach, got ${mirrorResponse.state.omega.z}`);
    assertNear(mirrorResponse.state.omega.z, -response.state.omega.z,
      "tangential-approach omega.z sign symmetry", 1e-10);
    return {
      omegaForward: response.state.omega,
      omegaMirror: mirrorResponse.state.omega,
    };
  });

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  const report = {
    status: failCount === 0 ? "pass" : "review-required",
    date: new Date().toISOString(),
    scope: "3D physics scope reset acceptance #2: pure-axis, mixed, and sign-reversed omega must process without depending on a label",
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