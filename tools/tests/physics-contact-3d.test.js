#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const CORE_FILE = path.join(ROOT_DIR, "shared-physics-core.js");

function loadCore() {
  const source = fs.readFileSync(CORE_FILE, "utf8");
  const names = [
    "BALL_MASS",
    "BALL_INERTIA",
    "BALL_RADIUS",
    "physics3dAdd",
    "physics3dCross",
    "physics3dDot",
    "physics3dNorm",
    "physics3dSolveCompliantPlaneContact",
    "physics3dSolvePlaneContact",
  ];
  return vm.runInNewContext(
    `(function(){${source}\nreturn {${names.join(",")}};})()`,
    { Math, Number, console }
  );
}

function rotateZ(value, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * value.x - s * value.y, y: s * value.x + c * value.y, z: value.z };
}

function rotateState(state, angle) {
  return {
    ...state,
    position: rotateZ(state.position, angle),
    velocity: rotateZ(state.velocity, angle),
    omega: rotateZ(state.omega, angle),
  };
}

function rotateContact(contact, angle) {
  return {
    ...contact,
    normal: rotateZ(contact.normal, angle),
    surfaceVelocity: rotateZ(contact.surfaceVelocity, angle),
    contactOffset: rotateZ(contact.contactOffset, angle),
  };
}

function energy(core, state) {
  return 0.5 * state.mass * core.physics3dDot(state.velocity, state.velocity) +
    0.5 * state.inertia * core.physics3dDot(state.omega, state.omega);
}

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} within ${tolerance} of ${expected}`);
}

function nearVec(actual, expected, tolerance, label) {
  for (const axis of ["x", "y", "z"]) near(actual[axis], expected[axis], tolerance, `${label}.${axis}`);
}

function main() {
  const core = loadCore();
  const table = {
    normal: { x: 0, y: 1, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
    restitution: 0.86,
    friction: 0.13,
    radius: core.BALL_RADIUS,
  };
  const initial = {
    position: { x: 0.15, y: core.BALL_RADIUS, z: 0.2 },
    velocity: { x: 0.8, y: -2.4, z: 4.1 },
    omega: { x: 35, y: 120, z: -70 },
    mass: core.BALL_MASS,
    inertia: core.BALL_INERTIA,
  };
  const response = core.physics3dSolvePlaneContact(initial, table);
  assert.ok(response.normalImpulse > 0, "approaching ball must receive a normal impulse");
  assert.ok(response.state.velocity.y > 0, "normal velocity must reverse");
  assert.ok(energy(core, response.state) <= energy(core, initial) + 1e-8,
    "fixed-plane contact must not add kinetic energy");

  const normalSpin = core.physics3dSolvePlaneContact({
    ...initial,
    velocity: { x: 0, y: -2, z: 0 },
    omega: { x: 0, y: 120, z: 0 },
  }, table);
  nearVec(normalSpin.state.omega, { x: 0, y: 120, z: 0 }, 1e-9, "normal-axis omega");

  const rolling = core.physics3dSolvePlaneContact({
    ...initial,
    velocity: { x: 0, y: -2, z: 2 },
    omega: { x: 100, y: 0, z: 0 },
  }, table);
  near(core.physics3dNorm(rolling.tangentImpulse), 0, 1e-9, "rolling tangent impulse");

  const angle = 0.71;
  const rotatedResponse = core.physics3dSolvePlaneContact(rotateState(initial, angle), rotateContact({
    ...table,
    contactOffset: { x: 0, y: -core.BALL_RADIUS, z: 0 },
  }, angle));
  const baseResponse = core.physics3dSolvePlaneContact(initial, {
    ...table,
    contactOffset: { x: 0, y: -core.BALL_RADIUS, z: 0 },
  });
  nearVec(rotatedResponse.state.velocity, rotateZ(baseResponse.state.velocity, angle), 1e-8, "rotated velocity");
  nearVec(rotatedResponse.state.omega, rotateZ(baseResponse.state.omega, angle), 1e-8, "rotated omega");

  const movingPlane = core.physics3dSolvePlaneContact({
    ...initial,
    velocity: { x: 0, y: -2, z: 0 },
    omega: { x: 0, y: 0, z: 0 },
  }, {
    ...table,
    surfaceVelocity: { x: 1.25, y: 0, z: 0 },
  });
  assert.ok(movingPlane.normalImpulse > 0, "moving plane must still resolve normal contact");
  assert.ok(Number.isFinite(movingPlane.tangentImpulse.x), "moving-plane friction impulse must be finite");

  const compliant = core.physics3dSolveCompliantPlaneContact(initial, {
    ...table,
    penetration: 0.001,
  }, {
    spring: 1200,
    damping: 2,
    dt: 1 / 240,
    steps: 8,
  });
  assert.strictEqual(compliant.mode, "compliant");
  assert.ok(compliant.normalImpulse > 0, "compliant contact must apply a spring-damper impulse");
  assert.ok(Number.isFinite(compliant.state.velocity.x), "compliant contact state must remain finite");

  console.log("3D contact core tests OK");
}

main();
