#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const CORE_FILE = path.join(ROOT_DIR, "shared-physics-core.js");

function loadCore() {
  const source = fs.readFileSync(CORE_FILE, "utf8");
  const names = [
    "MAGNUS_LIFT_SLOPE",
    "MAGNUS_COEFFICIENT",
    "physics3dFromLegacySpin",
    "physics3dPhysicalSpinFromInput",
    "physics3dSpinFromVariation",
    "physics3dResolveOmega",
    "physics3dMagnusAcceleration",
    "physics3dAdvanceVelocity",
    "bounceWithSpinPhysical",
    "bounceWithSpinPhysical3D",
  ];
  return vm.runInNewContext(
    `(function(){${source}\nreturn {${names.join(",")}};})()`,
    { Math, Number, console }
  );
}

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function main() {
  const core = loadCore();

  const left = { schema: 2, omega: { x: 0, y: 125.66, z: 0 } };
  const right = { schema: 2, omega: { x: 0, y: -125.66, z: 0 } };
  const forward = { x: 0, y: 0, z: 6 };
  const leftAcceleration = core.physics3dMagnusAcceleration(forward, left);
  const rightAcceleration = core.physics3dMagnusAcceleration(forward, right);

  assert.ok(leftAcceleration.x > 0, "left sidespin must curve right (+X)");
  assert.ok(rightAcceleration.x < 0, "right sidespin must curve left (-X)");
  near(leftAcceleration.y, 0);
  near(leftAcceleration.z, 0);

  const axialOnly = { schema: 1, omega: { x: 0, y: 0, z: 0 }, axialSpin: 125.66 };
  const axialAcceleration = core.physics3dMagnusAcceleration(forward, axialOnly);
  near(axialAcceleration.x, 0);
  near(axialAcceleration.y, 0);
  near(axialAcceleration.z, 0);

  const advanced = core.physics3dAdvanceVelocity(forward, left, -4.2, 1 / 120);
  assert.ok(advanced.x > forward.x, "Magnus acceleration must affect flight x velocity");
  assert.ok(advanced.y < forward.y, "gravity must still affect flight y velocity");

  const legacy = { topspin: -80, sidespin: -40 };
  const legacyVelocity = { x: 0.4, y: -2.1, z: 3.2 };
  const oldBounce = core.bounceWithSpinPhysical(legacyVelocity, legacy, 0.13);
  const migratedBounce = core.bounceWithSpinPhysical3D(
    legacyVelocity,
    core.physics3dFromLegacySpin(legacy),
    0.13
  );
  near(migratedBounce.vel.y, oldBounce.vel.y);
  assert.ok(Number.isFinite(migratedBounce.vel.x));
  assert.ok(Number.isFinite(migratedBounce.vel.z));
  assert.strictEqual(migratedBounce.spin3d.schema, 2);
  near(migratedBounce.spin3d.omega.y, 0);

  const trueSideBounce = core.bounceWithSpinPhysical3D(
    legacyVelocity,
    { schema: 2, omega: { x: -80, y: 125.66, z: 0 } },
    0.13
  );
  near(trueSideBounce.spin3d.omega.y, 125.66);

  const axialInput = { schema: 1, omega: { x: 0, y: 0, z: 0 }, axialSpin: 90 };
  const axialPhysical = core.physics3dPhysicalSpinFromInput(axialInput, legacyVelocity);
  assert.strictEqual(axialPhysical.schema, 2);
  assert.ok(!Object.prototype.hasOwnProperty.call(axialPhysical, "axialSpin"));
  assert.ok(Math.hypot(axialPhysical.omega.x, axialPhysical.omega.y, axialPhysical.omega.z) > 0);
  const axialBounce = core.bounceWithSpinPhysical3D(
    legacyVelocity,
    axialInput,
    0.13
  );
  assert.strictEqual(axialBounce.spin3d.schema, 2);
  assert.ok(!Object.prototype.hasOwnProperty.call(axialBounce.spin3d, "axialSpin"));

  console.log("3D spin core tests OK");
}

main();
