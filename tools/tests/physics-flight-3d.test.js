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
    "REAL_GRAVITY_Y",
    "physics3dAdvanceSimulationVelocity",
    "physics3dAdvanceVelocity",
    "physics3dMagnusAcceleration",
    "physics3dPhysicalSpinFromInput",
    "physics3dScaleSpin",
  ];
  return vm.runInNewContext(
    `(function(){${source}\nreturn {${names.join(",")}};})()`,
    { Math, Number, console }
  );
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
  const velocity = { x: 0, y: 0, z: 6 };
  const leftSpin = { schema: 2, omega: { x: 0, y: 150, z: 0 } };
  const rightSpin = { schema: 2, omega: { x: 0, y: -150, z: 0 } };
  const leftAcceleration = core.physics3dMagnusAcceleration(velocity, leftSpin, 0.01);
  const rightAcceleration = core.physics3dMagnusAcceleration(velocity, rightSpin, 0.01);
  assert.ok(leftAcceleration.x > 0, "+omega.y must curve toward +X");
  assert.ok(rightAcceleration.x < 0, "-omega.y must curve toward -X");
  near(leftAcceleration.y, 0, 1e-12, "left Magnus y");
  near(leftAcceleration.z, 0, 1e-12, "left Magnus z");

  const gravityStep = core.physics3dAdvanceVelocity(velocity, leftSpin, undefined, 1 / 120, 0.01);
  near(gravityStep.y, core.REAL_GRAVITY_Y / 120, 1e-12, "real gravity step");
  assert.ok(gravityStep.x > 0, "Magnus must affect x velocity");

  const legacyInput = { schema: 1, omega: { x: 10, y: 20, z: 30 }, axialSpin: 40 };
  const converted = core.physics3dPhysicalSpinFromInput(legacyInput, velocity);
  assert.strictEqual(converted.schema, 2);
  nearVec(converted.omega, { x: 10, y: 20, z: 70 }, 1e-9, "one-time axial conversion");
  assert.ok(!Object.prototype.hasOwnProperty.call(converted, "axialSpin"));
  const legacyBridge = core.physics3dAdvanceSimulationVelocity(
    velocity,
    legacyInput,
    -4.2,
    1 / 120,
    10,
    0.01
  );
  assert.ok(Number.isFinite(legacyBridge.x + legacyBridge.y + legacyBridge.z),
    "scaled flight bridge must resolve legacy axial input before conversion");

  const D = 10;
  const pageVelocity = { x: 0.3, y: -0.4, z: 2.5 };
  const pageSpin = { schema: 2, omega: { x: 12, y: 35, z: -8 } };
  const pageGravity = -4.2;
  const dt = 1 / 120;
  const bridged = core.physics3dAdvanceSimulationVelocity(pageVelocity, pageSpin, pageGravity, dt, D, 0.01);
  const realVelocity = { x: pageVelocity.x * D, y: pageVelocity.y * D, z: pageVelocity.z * D };
  const realSpin = core.physics3dScaleSpin(pageSpin, D);
  const realStep = core.physics3dAdvanceVelocity(realVelocity, realSpin, pageGravity * D * D, dt / D, 0.01);
  nearVec(bridged, {
    x: realStep.x / D,
    y: realStep.y / D,
    z: realStep.z / D,
  }, 1e-12, "simulation-to-real bridge");

  console.log("3D flight core tests OK");
}

main();
