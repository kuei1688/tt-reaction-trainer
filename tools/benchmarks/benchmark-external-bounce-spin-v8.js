#!/usr/bin/env node
"use strict";

// V8 External Benchmark Alignment.
//
// This is a read-only benchmark. It consumes the user-provided figure
// digitization, maps the range midpoints into a real-scale mainline-v2
// BallState, and reports the raw table-contact response. It deliberately does
// not fit or write any physics parameters, presets, or mainline files.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const V2_DIR = path.join(ROOT_DIR, "mainline-v2");
const SOURCE_CSV = path.join(ROOT_DIR, "AI_CONTEXT", "external_bounce_spin_2017_figure_digitization.csv");
const SOURCE_ID = "JSME-2017-G0500606";
const SCHEMA = 2;
const RPS_TO_RAD_S = 2 * Math.PI;
const OMEGA_AXIS = "x";
const TABLE_NORMAL = {x: 0, y: 1, z: 0};
const AXES = ["x", "y", "z"];

function loadCommonJs(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadSharedCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
    "BALL_RADIUS",
    "BALL_MASS",
    "BALL_INERTIA",
    "REAL_GRAVITY_Y",
    "physics3dSolvePlaneContact",
    "physics3dSolveCompliantPlaneContact",
  ];
  return vm.runInNewContext(`(function(){${source}\nreturn {${names.join(",")}};})()`, {
    Math,
    Number,
    console,
  });
}

function fail(message) {
  throw new Error(message);
}

function finite(value, label) {
  if (!Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function finiteVector(value, label) {
  for (const axis of AXES) finite(value[axis], `${label}.${axis}`);
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) fail("unterminated CSV quote");
  cells.push(cell);
  return cells;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) fail("digitization CSV is empty");
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      fail(`CSV row ${rowIndex + 2} has ${values.length} cells; expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function parseApproxRange(value, label) {
  const text = String(value).trim();
  const range = text.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return {min, max, midpoint: (min + max) / 2, raw: text, label};
  }
  const scalar = Number(text);
  if (!Number.isFinite(scalar)) fail(`cannot parse ${label}: ${value}`);
  return {min: scalar, max: scalar, midpoint: scalar, raw: text, label};
}

function magnitude(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function horizontalSpeed(value) {
  return Math.hypot(value.x, value.z);
}

function signedTrajectoryAngleDeg(value) {
  return Math.atan2(value.y, horizontalSpeed(value)) * 180 / Math.PI;
}

function trajectoryAngleDeg(value) {
  return Math.abs(signedTrajectoryAngleDeg(value));
}

function direction(before, after) {
  const tolerance = Math.max(1e-9, Math.abs(before) * 1e-9);
  if (after > before + tolerance) return "increase";
  if (after < before - tolerance) return "decrease";
  return "flat";
}

function rangeDirection(before, after) {
  if (after.max < before.min) return "decrease";
  if (after.min > before.max) return "increase";
  return "overlap";
}

function inRange(value, range) {
  const tolerance = 1e-9;
  return value >= range.min - tolerance && value <= range.max + tolerance;
}

function vectorFromSpeedAndAngle(speed, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: 0,
    y: -speed * Math.sin(angle),
    z: speed * Math.cos(angle),
  };
}

function summarizeRows(rows) {
  const levels = new Map();
  for (const row of rows) {
    if (row.source_id !== SOURCE_ID) fail(`unexpected source_id: ${row.source_id}`);
    const level = Number(row.lower_disk_level);
    if (!Number.isFinite(level)) fail(`invalid lower_disk_level: ${row.lower_disk_level}`);
    if (!levels.has(level)) levels.set(level, {lowerDiskLevel: level, before: {}, after: {}});
    const target = row.phase === "before" ? levels.get(level).before : levels.get(level).after;
    if (target[row.quantity]) fail(`duplicate ${level}/${row.phase}/${row.quantity}`);
    target[row.quantity] = {
      ...parseApproxRange(row.approx_value_range, `${level}/${row.phase}/${row.quantity}`),
      unit: row.unit,
      uncertainty: row.plot_reading_uncertainty,
      dataQuality: row.data_quality,
      sourceFile: row.source_file,
      notes: row.notes,
    };
  }

  const required = ["trajectory_angle", "rotation_rate", "translation_speed"];
  return [...levels.values()].sort((a, b) => a.lowerDiskLevel - b.lowerDiskLevel).map((level) => {
    for (const phase of ["before", "after"]) {
      for (const quantity of required) {
        if (!level[phase][quantity]) fail(`missing ${level.lowerDiskLevel}/${phase}/${quantity}`);
      }
    }
    const before = level.before;
    const after = level.after;
    return {
      lowerDiskLevel: level.lowerDiskLevel,
      regime: level.lowerDiskLevel === 0
        ? "high-spin / low-speed"
        : level.lowerDiskLevel === 6
          ? "low-spin / high-speed"
          : level.lowerDiskLevel === 2
            ? "transitional"
            : "transitional bridge",
      external: {
        before: {
          angleDeg: before.trajectory_angle,
          rotationRps: before.rotation_rate,
          speedMps: before.translation_speed,
        },
        after: {
          angleDeg: after.trajectory_angle,
          rotationRps: after.rotation_rate,
          speedMps: after.translation_speed,
        },
        rangeDirection: {
          angleDeg: rangeDirection(before.trajectory_angle, after.trajectory_angle),
          rotationRps: rangeDirection(before.rotation_rate, after.rotation_rate),
          speedMps: rangeDirection(before.translation_speed, after.translation_speed),
        },
      },
      inputProxy: {
        selection: "midpoint of the before-phase digitized range",
        angleDeg: before.trajectory_angle.midpoint,
        rotationRps: before.rotation_rate.midpoint,
        speedMps: before.translation_speed.midpoint,
      },
    };
  });
}

function makeProbe(level, sign, stateApi, contactApi, policy, core) {
  const input = level.inputProxy;
  const omegaMagnitude = input.rotationRps * RPS_TO_RAD_S;
  const velocity = vectorFromSpeedAndAngle(input.speedMps, input.angleDeg);
  const omega = {x: sign * omegaMagnitude, y: 0, z: 0};
  const incoming = stateApi.createBallState({
    position: {x: 0, y: 0.02, z: 0},
    velocity,
    spin3d: {schema: SCHEMA, omega},
  });
  const response = contactApi.solveContact({
    state: incoming,
    surface: policy.table,
    mode: policy.table.mode,
  }, core);
  const outgoing = response.state;
  finiteVector(incoming.velocity, `${level.lowerDiskLevel}/${sign} incoming velocity`);
  finiteVector(incoming.omega, `${level.lowerDiskLevel}/${sign} incoming omega`);
  finiteVector(outgoing.velocity, `${level.lowerDiskLevel}/${sign} outgoing velocity`);
  finiteVector(outgoing.omega, `${level.lowerDiskLevel}/${sign} outgoing omega`);

  const incomingRps = magnitude(incoming.omega) / RPS_TO_RAD_S;
  const outgoingRps = magnitude(outgoing.omega) / RPS_TO_RAD_S;
  const incomingSpeed = magnitude(incoming.velocity);
  const outgoingSpeed = magnitude(outgoing.velocity);
  const incomingAngle = trajectoryAngleDeg(incoming.velocity);
  const outgoingAngle = trajectoryAngleDeg(outgoing.velocity);
  const expected = level.external.after;
  const observedTrend = level.external.rangeDirection;
  const modelTrend = {
    angleDeg: direction(incomingAngle, outgoingAngle),
    rotationRps: direction(incomingRps, outgoingRps),
    speedMps: direction(incomingSpeed, outgoingSpeed),
  };

  return {
    omegaSign: sign,
    input: {
      angleDeg: incomingAngle,
      signedAngleDeg: signedTrajectoryAngleDeg(incoming.velocity),
      speedMps: incomingSpeed,
      velocity: incoming.velocity,
      omega: incoming.omega,
      omegaAxis: OMEGA_AXIS,
      omegaMagnitudeRadPerSec: magnitude(incoming.omega),
      rotationRps: incomingRps,
      rpsRoundTripError: incomingRps - input.rotationRps,
    },
    output: {
      angleDeg: outgoingAngle,
      signedAngleDeg: signedTrajectoryAngleDeg(outgoing.velocity),
      speedMps: outgoingSpeed,
      velocity: outgoing.velocity,
      omega: outgoing.omega,
      omegaAxis: OMEGA_AXIS,
      omegaMagnitudeRadPerSec: magnitude(outgoing.omega),
      rotationRps: outgoingRps,
    },
    comparison: {
      afterRangeHit: {
        angleDeg: inRange(outgoingAngle, expected.angleDeg),
        rotationRps: inRange(outgoingRps, expected.rotationRps),
        speedMps: inRange(outgoingSpeed, expected.speedMps),
      },
      externalRangeDirection: observedTrend,
      modelDirection: modelTrend,
      directionMatch: {
        angleDeg: observedTrend.angleDeg === "overlap"
          ? null
          : observedTrend.angleDeg === modelTrend.angleDeg,
        rotationRps: observedTrend.rotationRps === "overlap"
          ? null
          : observedTrend.rotationRps === modelTrend.rotationRps,
        speedMps: observedTrend.speedMps === "overlap"
          ? null
          : observedTrend.speedMps === modelTrend.speedMps,
      },
    },
    contact: {
      normal: TABLE_NORMAL,
      frictionRegime: response.diagnostics.frictionRegime,
      normalModel: response.diagnostics.normalModel,
      tangentModel: response.diagnostics.tangentModel,
      normalImpulse: response.diagnostics.normalImpulse,
      tangentImpulse: response.diagnostics.tangentImpulse,
      energyDelta: response.diagnostics.energyDelta,
      energyRatio: contactApi.kineticEnergy(outgoing) /
        Math.max(contactApi.kineticEnergy(incoming), 1e-12),
      dwellTime: response.diagnostics.dwellTime,
      contactModel: response.diagnostics.contactModel,
    },
  };
}

function buildReport() {
  const rows = parseCsv(fs.readFileSync(SOURCE_CSV, "utf8"));
  const levels = summarizeRows(rows);
  const stateApi = loadCommonJs(path.join(V2_DIR, "trainer-state.js"));
  const contactApi = loadCommonJs(path.join(V2_DIR, "contact-policy.js"));
  const core = loadSharedCore();
  const policy = contactApi.createContactPolicy();
  const probes = [];
  for (const level of levels) {
    for (const sign of [-1, 1]) {
      probes.push({
        lowerDiskLevel: level.lowerDiskLevel,
        regime: level.regime,
        external: level.external,
        inputProxy: level.inputProxy,
        ...makeProbe(level, sign, stateApi, contactApi, policy, core),
      });
    }
  }
  const selected = probes.filter((probe) => probe.omegaSign === 1);
  const directionMatches = selected.reduce((counts, probe) => {
    for (const key of ["angleDeg", "rotationRps", "speedMps"]) {
      const value = probe.comparison.directionMatch[key];
      if (value === true) counts[key].matched += 1;
      if (value === false) counts[key].mismatched += 1;
      if (value === null) counts[key].unconstrained += 1;
    }
    return counts;
  }, {
    angleDeg: {matched: 0, mismatched: 0, unconstrained: 0},
    rotationRps: {matched: 0, mismatched: 0, unconstrained: 0},
    speedMps: {matched: 0, mismatched: 0, unconstrained: 0},
  });
  const rangeHits = selected.reduce((counts, probe) => {
    for (const key of ["angleDeg", "rotationRps", "speedMps"]) {
      if (probe.comparison.afterRangeHit[key]) counts[key] += 1;
    }
    return counts;
  }, {angleDeg: 0, rotationRps: 0, speedMps: 0});
  const regimeCounts = selected.reduce((counts, probe) => {
    const key = probe.contact.frictionRegime;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  return {
    status: "pass",
    benchmark: "V8 External Benchmark Alignment",
    scope: "2017 JSME external bounce/spin figure digitization against mainline-v2 raw table contact",
    calibrationStatus: "not-calibrated",
    source: {
      sourceId: SOURCE_ID,
      csv: path.relative(ROOT_DIR, SOURCE_CSV).replaceAll(path.sep, "/"),
      pdf: "C:\\Users\\Kevin\\Downloads\\2017_G0500606.pdf",
      rowsRead: rows.length,
      dataQuality: "figure_digitized_approx",
      caveat: "ranges read from figures; not original per-ball observations or standard deviations",
    },
    coordinateContract: {
      schema: SCHEMA,
      state: "mainline-v2 BallState",
      position: "world-space metres; probe position is (0, 0.02, 0) and is not used to synthesize contact",
      velocity: "world-space m/s; incoming travel is +Z and downward Y, so velocity.y < 0 before contact",
      tableNormal: TABLE_NORMAL,
      incidentAngle: "positive magnitude atan2(abs(velocity.y), hypot(velocity.x, velocity.z)) in degrees",
      reflectedAngle: "positive magnitude atan2(abs(velocity.y), hypot(velocity.x, velocity.z)) in degrees after contact",
      omega: "canonical world-space vector in rad/s",
      sourceSpinMapping: "rotation-rate magnitude mapped to omega.x; omega.y and omega.z are explicitly zero",
      rpsToRadPerSecond: RPS_TO_RAD_S,
      inputScale: "real-scale; no simulation time-dilation conversion",
      sourceSignStatus: "paper sign is not present in the digitized CSV; both signs are probed",
      workingSign: "+1 on omega.x because it matches the external qualitative speed/spin directions; this is not a source-coordinate claim",
    },
    method: {
      inputSelection: "midpoint of each lower_disk_level before-phase angle, rotation-rate, and speed ranges",
      contactPolicy: "mainline-v2 createContactPolicy() table policy, read-only",
      output: "raw contact response before post-table flight integration",
      comparison: "after-phase range hit plus range-derived direction; numerical mismatch is retained",
      parameterMutation: false,
      formalFilesModified: false,
    },
    tablePolicy: {
      surface: "table",
      friction: policy.table.friction,
      restitution: policy.table.restitution,
      normalModel: policy.table.mode.normalModel,
      tangentModel: policy.table.mode.tangentModel,
      dwellTime: policy.table.mode.dwellTime,
      contactDt: policy.table.mode.dt,
      contactSteps: policy.table.mode.steps,
      spring: policy.table.mode.spring,
      damping: policy.table.mode.damping,
      contactModel: policy.table.contactModel,
    },
    summary: {
      levelCount: levels.length,
      probeCount: probes.length,
      selectedWorkingSign: 1,
      selectedFrictionRegimes: regimeCounts,
      selectedAfterRangeHits: rangeHits,
      selectedDirectionMatches: directionMatches,
      interpretation: "trend/regime screening only; do not fit friction, restitution, dwell, or spin-transfer parameters from this run",
    },
    levels,
    probes,
  };
}

try {
  console.log(JSON.stringify(buildReport(), null, 2));
} catch (error) {
  console.error(`V8 external benchmark failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}

