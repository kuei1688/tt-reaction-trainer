#!/usr/bin/env node
"use strict";

// Isolated behavior matrix for the simple schema-2 3D model.
//
// This is intentionally a qualitative product-behavior screen. It records
// what the current vector model visibly does for explicit omega vectors; it
// does not fit parameters, identify materials, or promote any result into a
// formal preset or mainline change.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const AI_CONTEXT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", "isolation-validation");
const REPORT_JSON = path.join(AI_CONTEXT_DIR, "3d_behavior_matrix.json");
const REPORT_MD = path.join(AI_CONTEXT_DIR, "3d_behavior_matrix.md");
const SCHEMA = 2;

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
    "BALL_RADIUS",
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

function magnitude(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a) {
  return scale(a, 1 / magnitude(a));
}

function canonicalBall(velocity, omega) {
  return stateApi.createBallState({
    position: vec(0, 0, 0),
    velocity,
    spin3d: {schema: SCHEMA, omega},
  });
}

function energy(state) {
  return 0.5 * state.mass * dot(state.velocity, state.velocity) +
    0.5 * state.inertia * dot(state.omega, state.omega);
}

function finiteVector(value, label) {
  assert.ok(value && ["x", "y", "z"].every((axis) => Number.isFinite(value[axis])),
    `${label} is not finite`);
}

function simulateFlight(state, duration = 0.28, dt = 1 / 240) {
  let position = {...state.position};
  let velocity = {...state.velocity};
  const spin = {schema: SCHEMA, omega: state.omega};
  let elapsed = 0;
  while (elapsed < duration - 1e-12) {
    const step = Math.min(dt, duration - elapsed);
    const nextVelocity = core.physics3dAdvanceVelocity(velocity, spin, -9.81, step);
    position = add(position, scale(add(velocity, nextVelocity), 0.5 * step));
    velocity = nextVelocity;
    elapsed += step;
  }
  return {position, velocity};
}

function simulateBounce(state, normal) {
  return core.physics3dSolvePlaneContact(state, {
    normal,
    surfaceVelocity: vec(0, 0, 0),
    restitution: 0.76,
    friction: 0.13,
    radius: core.BALL_RADIUS,
  });
}

function runScenario(scenario) {
  const state = canonicalBall(vec(0, 3.8, 2.2), scenario.omega);
  const flight = simulateFlight(state);
  const bounceState = canonicalBall(vec(0.2, -2.0, 2.2), scenario.omega);
  const bounce = simulateBounce(bounceState, scenario.normal);
  const beforeNormal = dot(bounce.contactPointVelocityBefore, normalize(scenario.normal));
  const afterNormal = dot(bounce.contactPointVelocityAfter, normalize(scenario.normal));
  const beforeEnergy = energy(bounceState);
  const afterEnergy = energy(bounce.state);
  return {
    id: scenario.id,
    label: scenario.label,
    omega: scenario.omega,
    tableNormal: normalize(scenario.normal),
    flight: {
      endPosition: flight.position,
      endVelocity: flight.velocity,
      lateralDisplacementX: flight.position.x,
    },
    bounce: {
      beforeNormal,
      afterNormal,
      speedBefore: magnitude(bounceState.velocity),
      speedAfter: magnitude(bounce.state.velocity),
      velocityAfter: bounce.state.velocity,
      omegaAfter: bounce.state.omega,
      deltaOmega: sub(bounce.state.omega, bounceState.omega),
      tangentImpulse: bounce.tangentImpulse,
      frictionLimited: Boolean(bounce.frictionLimited),
      energyBefore: beforeEnergy,
      energyAfter: afterEnergy,
      energyDelta: afterEnergy - beforeEnergy,
    },
  };
}

function checkBehavior(results, id, description, fn, checks) {
  try {
    const details = fn() || {};
    checks.push({id, status: "pass", description, details});
  } catch (error) {
    checks.push({id, status: "fail", description, error: error.message});
  }
}

function markdown(report) {
  const lines = [
    "# Simple 3D Behavior Matrix",
    "",
    `- Status: **${report.status}**`,
    `- Date: ${report.date}`,
    `- Scenarios: ${report.scenarioCount}`,
    `- Checks: ${report.passCount} passed, ${report.failCount} failed`,
    "- Interpretation: visible-effect and qualitative-semantic evidence only",
    "",
    "## What was tested",
    "",
    "Explicit world-space omega cases were sent through the same simple flight and plane-contact equations: zero spin, omega.x positive/negative (topspin-like/backspin-like in the current table frame), omega.y positive/negative (axial sidespin), mixed spin, and a tilted table normal.",
    "",
    "## Scenario observations",
    "",
    "| Scenario | omega | flight lateral X | bounce normal before -> after | bounce energy delta |",
    "|---|---:|---:|---:|---:|",
    ...report.scenarios.map((scenario) => {
      const spin = `(${scenario.omega.x}, ${scenario.omega.y}, ${scenario.omega.z})`;
      const normal = `${scenario.bounce.beforeNormal.toFixed(4)} -> ${scenario.bounce.afterNormal.toFixed(4)}`;
      return `| ${scenario.label} | ${spin} | ${scenario.flight.lateralDisplacementX.toFixed(5)} m | ${normal} m/s | ${scenario.bounce.energyDelta.toExponential(3)} J |`;
    }),
    "",
    "## Checks",
    "",
    "| ID | Status | Finding |",
    "|---|---|---|",
    ...report.checks.map((check) => {
      const value = check.status === "pass"
        ? JSON.stringify(check.details).replace(/\|/g, "\\|")
        : check.error.replace(/\|/g, "\\|");
      return `| ${check.id} | ${check.status} | ${value} |`;
    }),
    "",
    "## Interpretation",
    "",
    "The matrix confirms that the simple model produces distinct, sign-consistent spin effects while keeping table contact passive. It does not establish that the chosen magnitudes or coefficients match a particular ball, table, racket, or external report.",
    "",
    "## Boundary",
    "",
    "This is an isolated benchmark/validation artifact. It does not modify mainline-v2, shared-physics-core.js, legacy pages, or formal presets, and it is not a calibration gate.",
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  const scenarios = [
    {id: "zero", label: "zero spin", omega: vec(0, 0, 0), normal: vec(0, 1, 0)},
    {id: "omega-x-positive", label: "omega.x + (topspin-like)", omega: vec(70, 0, 0), normal: vec(0, 1, 0)},
    {id: "omega-x-negative", label: "omega.x - (backspin-like)", omega: vec(-70, 0, 0), normal: vec(0, 1, 0)},
    {id: "omega-y-positive", label: "omega.y + (axial sidespin)", omega: vec(0, 70, 0), normal: vec(0, 1, 0)},
    {id: "omega-y-negative", label: "omega.y - (axial sidespin)", omega: vec(0, -70, 0), normal: vec(0, 1, 0)},
    {id: "mixed", label: "mixed omega", omega: vec(70, 70, -35), normal: vec(0, 1, 0)},
    {id: "tilted-table", label: "mixed omega on tilted table", omega: vec(70, 70, -35), normal: vec(0.25, 0.95, -0.18)},
  ];
  const results = scenarios.map(runScenario);
  const byId = Object.fromEntries(results.map((result) => [result.id, result]));
  const checks = [];

  checkBehavior(results, "BEHAVIOR-001", "all scenarios remain finite and separate from the table", () => {
    for (const result of results) {
      finiteVector(result.flight.endPosition, `${result.id}.flight.endPosition`);
      finiteVector(result.flight.endVelocity, `${result.id}.flight.endVelocity`);
      finiteVector(result.bounce.velocityAfter, `${result.id}.bounce.velocityAfter`);
      finiteVector(result.bounce.omegaAfter, `${result.id}.bounce.omegaAfter`);
      assert.ok(result.bounce.beforeNormal < 0, `${result.id} did not approach the table`);
      assert.ok(result.bounce.afterNormal > 0, `${result.id} did not separate from the table`);
      assert.ok(result.bounce.energyDelta <= 1e-10, `${result.id} increased energy`);
    }
    return {scenarioCount: results.length};
  }, checks);

  checkBehavior(results, "BEHAVIOR-002", "zero spin has no Magnus lateral displacement", () => {
    assert.ok(Math.abs(byId.zero.flight.lateralDisplacementX) < 1e-10,
      `zero-spin lateral displacement was ${byId.zero.flight.lateralDisplacementX}`);
    return {lateralDisplacementX: byId.zero.flight.lateralDisplacementX};
  }, checks);

  checkBehavior(results, "BEHAVIOR-003", "axial sidespin bends flight with sign-consistent lateral direction", () => {
    const positive = byId["omega-y-positive"].flight.lateralDisplacementX;
    const negative = byId["omega-y-negative"].flight.lateralDisplacementX;
    assert.ok(positive > 1e-5, `positive axial spin did not bend +X: ${positive}`);
    assert.ok(negative < -1e-5, `negative axial spin did not bend -X: ${negative}`);
    assert.ok(Math.abs(positive + negative) < 1e-8,
      `opposite axial spins were not approximately mirrored: ${positive} vs ${negative}`);
    return {positive, negative, mirrorResidual: positive + negative};
  }, checks);

  checkBehavior(results, "BEHAVIOR-004", "omega.x sign reverses the table tangent response", () => {
    const positive = byId["omega-x-positive"].bounce;
    const negative = byId["omega-x-negative"].bounce;
    const positiveDelta = positive.velocityAfter.z - byId.zero.bounce.velocityAfter.z;
    const negativeDelta = negative.velocityAfter.z - byId.zero.bounce.velocityAfter.z;
    assert.ok(Math.abs(positiveDelta) > 1e-6, `positive omega.x had no tangent effect: ${positiveDelta}`);
    assert.ok(Math.abs(negativeDelta) > 1e-6, `negative omega.x had no tangent effect: ${negativeDelta}`);
    assert.ok(positiveDelta * negativeDelta < 0,
      `omega.x sign did not reverse tangent response: ${positiveDelta} vs ${negativeDelta}`);
    return {positiveDelta, negativeDelta};
  }, checks);

  checkBehavior(results, "BEHAVIOR-005", "axial omega.y survives table contact without being consumed as tangent slip", () => {
    const zero = byId.zero.bounce;
    const positive = byId["omega-y-positive"].bounce;
    const negative = byId["omega-y-negative"].bounce;
    assert.ok(Math.abs(positive.omegaAfter.y - 70) < 1e-9, `omega.y + changed at contact: ${positive.omegaAfter.y}`);
    assert.ok(Math.abs(negative.omegaAfter.y + 70) < 1e-9, `omega.y - changed at contact: ${negative.omegaAfter.y}`);
    for (const axis of ["x", "y", "z"]) {
      assert.ok(Math.abs(positive.tangentImpulse[axis] - zero.tangentImpulse[axis]) < 1e-12,
        `omega.y + changed tangent impulse ${axis}`);
      assert.ok(Math.abs(negative.tangentImpulse[axis] - zero.tangentImpulse[axis]) < 1e-12,
        `omega.y - changed tangent impulse ${axis}`);
      assert.ok(Math.abs(positive.velocityAfter[axis] - zero.velocityAfter[axis]) < 1e-9,
        `omega.y + changed output velocity ${axis}`);
      assert.ok(Math.abs(negative.velocityAfter[axis] - zero.velocityAfter[axis]) < 1e-9,
        `omega.y - changed output velocity ${axis}`);
    }
    return {
      positiveOmegaY: positive.omegaAfter.y,
      negativeOmegaY: negative.omegaAfter.y,
      tangentImpulseMatchesZeroSpin: true,
    };
  }, checks);

  checkBehavior(results, "BEHAVIOR-006", "tilted table preserves normal separation and mixed-spin finiteness", () => {
    const result = byId["tilted-table"];
    assert.ok(result.bounce.afterNormal > 0, `tilted table after-normal was ${result.bounce.afterNormal}`);
    assert.ok(result.bounce.energyDelta <= 1e-10, `tilted table increased energy by ${result.bounce.energyDelta}`);
    return {
      normal: result.tableNormal,
      beforeNormal: result.bounce.beforeNormal,
      afterNormal: result.bounce.afterNormal,
      omegaAfter: result.bounce.omegaAfter,
    };
  }, checks);

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.length - passCount;
  const report = {
    status: failCount === 0 ? "pass" : "review-required",
    date: new Date().toISOString(),
    scope: "simple 3D behavior matrix: explicit omega vectors through flight and table contact",
    acceptance: "qualitative desired-effect screen only; no calibration or parameter fitting",
    scenarioCount: results.length,
    passCount,
    failCount,
    scenarios: results,
    checks,
  };
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(REPORT_MD, markdown(report), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (failCount > 0) process.exitCode = 1;
}

main();
