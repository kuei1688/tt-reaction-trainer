#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const V2_DIR = path.join(ROOT_DIR, "mainline-v2");

function load(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
    "BALL_RADIUS",
    "BALL_MASS",
    "BALL_INERTIA",
    "REAL_GRAVITY_Y",
    "physics3dAdvanceVelocity",
    "physics3dPhysicalSpinFromInput",
    "physics3dSolvePlaneContact",
    "physics3dSolveCompliantPlaneContact",
    "bounceWithSpinPhysical3D",
  ];
  return vm.runInNewContext(`(function(){${source}\nreturn {${names.join(",")}};})()`, {
    Math,
    Number,
    console,
  });
}

function vectorMagnitude(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function subtract(a, b) {
  return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function range(values) {
  return values.length
    ? {min: Math.min(...values), max: Math.max(...values)}
    : {min: null, max: null};
}

function assertFinite(value, label) {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
}

function assertFiniteVector(value, label) {
  for (const axis of ["x", "y", "z"]) assertFinite(value[axis], `${label}.${axis}`);
}

function main() {
  const data = load(path.join(V2_DIR, "serve-data.js"));
  const physics = load(path.join(V2_DIR, "physics-adapter.js"));
  const contact = load(path.join(V2_DIR, "contact-policy.js"));
  const stateApi = load(path.join(V2_DIR, "trainer-state.js"));
  const runtimeApi = load(path.join(V2_DIR, "runtime.js"));
  const diagnostics = load(path.join(V2_DIR, "trajectory-diagnostics.js"));
  const core = loadCore();
  const presets = data.loadPresetCollection(
    JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "physics-presets.json"), "utf8"))
  );
  const adapter = physics.createScaleAdapter({
    core,
    timeDilation: Math.sqrt(9.81 / 4.2),
    simulationGravity: -4.2,
  });
  const profileOverride = process.env.MAINLINE_V2_TABLE_PROFILE
    ? JSON.parse(process.env.MAINLINE_V2_TABLE_PROFILE)
    : {};
  const policy = contact.createContactPolicy(profileOverride);
  const geometry = diagnostics.DEFAULT_TABLE_GEOMETRY;
  const rows = [];

  for (const preset of presets) {
    const runtime = runtimeApi.createRuntime({
      core,
      preset,
      scaleAdapter: adapter,
      contactPolicy: policy,
      contactApi: contact,
      stateApi,
      serveData: data,
      trajectoryDiagnostics: diagnostics,
      tableGeometry: geometry,
    });
    runtime.startServe();
    const approach = runtime.advanceToTable();
    const incoming = approach.ball;
    const tableCrossing = approach.diagnostics.at(-1).tableCrossing;
    assert.ok(tableCrossing && tableCrossing.inBounds,
      `${preset.id} first table crossing is out of bounds`);

    const independent = contact.solveContact({
      state: incoming,
      surface: policy.table,
      mode: policy.table.mode,
    }, core);
    const tableState = runtime.contact("table");
    const outgoing = tableState.ball;
    const contactDiagnostic = tableState.diagnostics.at(-1);
    assert.strictEqual(contactDiagnostic.trajectoryBridge, undefined,
      `${preset.id} table transfer still has a trajectory bridge`);
    assertFiniteVector(incoming.velocity, `${preset.id} incoming velocity`);
    assertFiniteVector(outgoing.velocity, `${preset.id} outgoing velocity`);
    assertFiniteVector(incoming.omega, `${preset.id} incoming omega`);
    assertFiniteVector(outgoing.omega, `${preset.id} outgoing omega`);
    for (const field of ["velocity", "omega"]) {
      for (const axis of ["x", "y", "z"]) {
        assert.ok(Math.abs(outgoing[field][axis] - independent.state[field][axis]) <= 1e-12,
          `${preset.id} raw table ${field}.${axis} changed before integration`);
      }
    }

    let before = outgoing;
    let netCrossing = null;
    let secondTableCrossing = null;
    const stepSimulation = 1 / 240;
    for (let index = 0; index < 720; index += 1) {
      const after = adapter.advanceSimulationState(before, stepSimulation);
      if (!netCrossing) netCrossing = diagnostics.netCrossing(before, after, geometry);
      if (!secondTableCrossing) {
        secondTableCrossing = diagnostics.tableCrossing(
          before, after, geometry, preset.firstBounce.y
        );
      }
      if (secondTableCrossing) break;
      before = after;
    }

    const incomingSpeed = vectorMagnitude(incoming.velocity);
    const outgoingSpeed = vectorMagnitude(outgoing.velocity);
    const incomingOmega = vectorMagnitude(incoming.omega);
    const outgoingOmega = vectorMagnitude(outgoing.omega);
    const energyBefore = contact.kineticEnergy(incoming);
    const energyAfter = contact.kineticEnergy(outgoing);
    const secondReferenceError = secondTableCrossing
      ? subtract(secondTableCrossing.point, preset.secondBounce)
      : null;
    const row = {
      id: preset.id,
      tags: {
        spinType: preset.tags.spinType,
        sideName: preset.tags.sideName,
        curveDirection: preset.tags.curveDirection,
      },
      firstBounce: {
        crossing: tableCrossing.point,
        target: preset.firstBounce,
        error: subtract(tableCrossing.point, preset.firstBounce),
        inBounds: tableCrossing.inBounds,
      },
      incoming: {
        velocity: incoming.velocity,
        speed: incomingSpeed,
        omega: incoming.omega,
        omegaMagnitude: incomingOmega,
      },
      tableResponse: {
        velocity: outgoing.velocity,
        speed: outgoingSpeed,
        speedRatio: outgoingSpeed / Math.max(incomingSpeed, 1e-12),
        omega: outgoing.omega,
        omegaMagnitude: outgoingOmega,
        omegaDelta: subtract(outgoing.omega, incoming.omega),
        normalImpulse: contactDiagnostic.normalImpulse,
        tangentImpulse: contactDiagnostic.tangentImpulse,
        tangentImpulseMagnitude: vectorMagnitude(contactDiagnostic.tangentImpulse),
        normalVelocityBefore: contactDiagnostic.normalVelocityBefore,
        frictionRegime: contactDiagnostic.frictionRegime,
        energyBefore,
        energyAfter,
        energyDelta: contactDiagnostic.energyDelta,
        energyRatio: energyAfter / Math.max(energyBefore, 1e-12),
      },
      postTable: {
        netCrossing,
        secondTableCrossing,
        secondBounceReferenceError: secondReferenceError,
      },
    };
    rows.push(row);
  }

  const speedRatios = rows.map((row) => row.tableResponse.speedRatio);
  const energyDeltas = rows.map((row) => row.tableResponse.energyDelta);
  const secondZErrors = rows
    .map((row) => row.postTable.secondBounceReferenceError)
    .filter(Boolean)
    .map((error) => error.z);
  const netRows = rows.filter((row) => row.postTable.netCrossing);
  const clearNetRows = netRows.filter((row) => row.postTable.netCrossing.passesNet);
  const frictionRegimes = rows.reduce((counts, row) => {
    const key = row.tableResponse.frictionRegime;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const largestReferenceErrors = rows
    .slice()
    .sort((a, b) => Math.abs(b.postTable.secondBounceReferenceError.z) -
      Math.abs(a.postTable.secondBounceReferenceError.z))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      secondBounceReferenceError: row.postTable.secondBounceReferenceError,
      outgoingVelocity: row.tableResponse.velocity,
    }));

  const report = {
    status: "pass",
    scope: "mainline-v2 raw table-bounce transfer audit",
    presetCount: rows.length,
    modelBoundary: {
      incoming: "real-scale BallState immediately before table contact",
      response: "shared 3D table contact response",
      outgoing: "raw contact response before post-table integration",
      secondBounce: "validation reference only",
    },
    summary: {
      firstTableContactsInBounds: rows.filter((row) => row.firstBounce.inBounds).length,
      rawNetCrossings: netRows.length,
      rawNetClearances: clearNetRows.length,
      rawNetInsufficientClearances: netRows.length - clearNetRows.length,
      rawSecondTableCrossings: rows.filter((row) => row.postTable.secondTableCrossing).length,
      frictionRegimes,
      speedRatio: {
        range: range(speedRatios),
        median: median(speedRatios),
      },
      energyDelta: {
        range: range(energyDeltas),
        median: median(energyDeltas),
      },
      secondBounceReferenceErrorZ: {
        range: range(secondZErrors),
        median: median(secondZErrors),
      },
      largestSecondBounceReferenceErrors: largestReferenceErrors,
    },
    interpretation: "engineering diagnostics only; no table parameter was fitted or changed, and no secondBounce target was used to generate velocity",
    rows,
  };
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`mainline-v2 table-bounce audit failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}
