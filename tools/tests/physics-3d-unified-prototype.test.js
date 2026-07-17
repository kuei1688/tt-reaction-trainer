#!/usr/bin/env node
"use strict";

const assert = require("assert");
const spin = require("../prototypes/3d-unified-physics/canonical-spin.js");
const contact = require("../prototypes/3d-unified-physics/contact-solver.js");
const flight = require("../prototypes/3d-unified-physics/flight-kernel.js");

const EPS = 1e-9;

function near(actual, expected, tolerance = EPS, label = "value") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function nearVec(actual, expected, tolerance = EPS, label = "vector") {
  for (const axis of ["x", "y", "z"]) near(actual[axis], expected[axis], tolerance, `${label}.${axis}`);
}

function rotateZ(value, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return spin.vec(c * value.x - s * value.y, s * value.x + c * value.y, value.z);
}

function rotateState(state, angle) {
  return {
    ...state,
    position: rotateZ(state.position, angle),
    velocity: rotateZ(state.velocity, angle),
    omega: rotateZ(state.omega, angle),
  };
}

function rotateContact(input, angle) {
  return {
    ...input,
    normal: rotateZ(input.normal, angle),
    surfaceVelocity: rotateZ(input.surfaceVelocity, angle),
    contactOffset: rotateZ(input.contactOffset, angle),
  };
}

function kineticEnergy(state) {
  return 0.5 * state.mass * contact.dot(state.velocity, state.velocity) +
    0.5 * state.inertia * contact.dot(state.omega, state.omega);
}

function makeState(overrides = {}) {
  return flight.createState({
    position: { x: 0.15, y: 0.86, z: 0.2 },
    velocity: { x: 0.8, y: -2.4, z: 4.1 },
    omega: { x: 35, y: 120, z: -70 },
    ...overrides,
  });
}

function run() {
  const forward = spin.vec(0, 0, 6);
  const left = spin.physicalSpinFromOmega({ x: 0, y: 150, z: 0 });
  const right = spin.physicalSpinFromOmega({ x: 0, y: -150, z: 0 });
  const leftLift = flight.magnusAcceleration({ velocity: forward, omega: left.omega }, 0.01);
  const rightLift = flight.magnusAcceleration({ velocity: forward, omega: right.omega }, 0.01);
  assert.ok(leftLift.x > 0, "+omega.y must curve toward +X");
  assert.ok(rightLift.x < 0, "-omega.y must curve toward -X");
  near(leftLift.y, 0);
  near(leftLift.z, 0);
  near(leftLift.x, -rightLift.x);

  const axial = spin.physicalSpinFromIntent({ axialSpinRelativeToVelocity: 125.66 }, forward);
  assert.strictEqual(axial.schema, 2);
  nearVec(axial.omega, { x: 0, y: 0, z: 125.66 });
  assert.ok(!Object.prototype.hasOwnProperty.call(axial, "axialSpin"), "physical state must not retain axialSpin");
  const axialLift = flight.magnusAcceleration({ velocity: forward, omega: axial.omega }, 0.01);
  nearVec(axialLift, { x: 0, y: 0, z: 0 });

  const legacy = spin.physicalSpinFromLegacy({ topspin: -80, sidespin: -40 }, forward);
  nearVec(legacy.omega, { x: -80, y: 0, z: 40 });
  const oldSchema = spin.physicalSpinFromInput({
    schema: 1,
    omega: { x: 10, y: 20, z: 30 },
    axialSpin: 40,
  }, forward);
  nearVec(oldSchema.omega, { x: 10, y: 20, z: 70 }, 1e-8, "schema-1 boundary conversion");

  const initial = makeState();
  const table = {
    normal: spin.vec(0, 1, 0),
    surfaceVelocity: spin.vec(0, 0, 0),
    restitution: 0.86,
    friction: 0.13,
    radius: 0.02,
  };
  const response = contact.solvePlaneContact(initial, table);
  assert.ok(response.normalImpulse > 0, "approaching ball must receive a normal impulse");
  assert.ok(response.state.velocity.y > 0, "table normal velocity must reverse");
  assert.ok(Number.isFinite(response.state.omega.x + response.state.omega.y + response.state.omega.z));
  assert.ok(kineticEnergy(response.state) <= kineticEnergy(initial) + 1e-8, "fixed-plane contact must not add energy");

  const pureNormalSpin = makeState({
    velocity: { x: 0, y: -2, z: 0 },
    omega: { x: 0, y: 120, z: 0 },
  });
  const normalSpinResponse = contact.solvePlaneContact(pureNormalSpin, table);
  nearVec(normalSpinResponse.state.omega, pureNormalSpin.omega, 1e-8, "normal-axis omega");

  const rolling = makeState({
    velocity: { x: 0, y: -2, z: 2 },
    omega: { x: 100, y: 0, z: 0 },
  });
  const rollingBefore = contact.contactPointVelocity(rolling, spin.vec(0, -0.02, 0), spin.vec());
  near(rollingBefore.z, 0, 1e-8, "rolling contact slip");
  const rollingResponse = contact.solvePlaneContact(rolling, table);
  near(rollingResponse.tangentImpulse.x, 0, 1e-8, "rolling x friction impulse");
  near(rollingResponse.tangentImpulse.z, 0, 1e-8, "rolling z friction impulse");

  const angle = 0.71;
  const rotated = contact.solvePlaneContact(rotateState(initial, angle), rotateContact({
    ...table,
    contactOffset: spin.vec(0, -0.02, 0),
  }, angle));
  const unrotated = contact.solvePlaneContact({ ...initial, position: initial.position }, {
    ...table,
    contactOffset: spin.vec(0, -0.02, 0),
  });
  nearVec(rotated.state.velocity, rotateZ(unrotated.state.velocity, angle), 1e-8, "rotated velocity");
  nearVec(rotated.state.omega, rotateZ(unrotated.state.omega, angle), 1e-8, "rotated omega");

  const compliant = contact.solveCompliantPlaneContact(initial, {
    ...table,
    penetration: 0.001,
  }, { spring: 1200, damping: 2, dt: 1 / 240, steps: 8 });
  assert.strictEqual(compliant.mode, "compliant");
  assert.ok(compliant.normalImpulse > 0, "compliant contact must apply a spring-damper impulse");
  assert.ok(Number.isFinite(compliant.state.velocity.x));

  const advanced = flight.advanceFlight(
    makeState({ velocity: { x: 0, y: 0, z: 6 }, omega: { x: 0, y: 150, z: 0 } }),
    1 / 120,
    { magnusCoefficient: 0.01 }
  );
  assert.ok(advanced.state.velocity.x > 0, "flight kernel must use world-space omega");
  assert.ok(advanced.state.velocity.y < 0, "real-scale gravity must be applied");

  console.log(JSON.stringify({
    status: "pass",
    scope: "isolated Phase 1/2 prototype",
    checks: [
      "schema-2 omega and one-time axial conversion",
      "Magnus cross-product direction",
      "arbitrary-plane impulse contact",
      "2D Coulomb friction and rolling condition",
      "fixed-plane energy non-increase",
      "rotation/frame invariance",
      "shared compliant contact path",
      "real-scale flight step",
    ],
    interpretation: "mathematical/prototype evidence only; no physical calibration claim",
  }, null, 2));
}

run();
