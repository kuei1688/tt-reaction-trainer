#!/usr/bin/env node
"use strict";

// V9 fixed-parameter uncertainty envelope.
//
// The input ranges come from the user-provided 2017 figure digitization. The
// current mainline-v2 table policy is held fixed. This tool measures whether
// input uncertainty alone can reach the external after-contact ranges; it does
// not fit or mutate any physics parameter or formal file.

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
const METRICS = ["angleDeg", "rotationRps", "speedMps"];
const GRID_POINTS_PER_AXIS = 9;

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

function summarizeRows(rows) {
  const levels = new Map();
  for (const row of rows) {
    if (row.source_id !== SOURCE_ID) fail(`unexpected source_id: ${row.source_id}`);
    const level = Number(row.lower_disk_level);
    if (!Number.isFinite(level)) fail(`invalid lower_disk_level: ${row.lower_disk_level}`);
    if (!levels.has(level)) levels.set(level, {lowerDiskLevel: level, before: {}, after: {}});
    const target = row.phase === "before" ? levels.get(level).before : levels.get(level).after;
    if (target[row.quantity]) fail(`duplicate ${level}/${row.phase}/${row.quantity}`);
    target[row.quantity] = parseApproxRange(
      row.approx_value_range,
      `${level}/${row.phase}/${row.quantity}`
    );
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
      inputRanges: {
        angleDeg: before.trajectory_angle,
        rotationRps: before.rotation_rate,
        speedMps: before.translation_speed,
      },
      externalAfter: {
        angleDeg: after.trajectory_angle,
        rotationRps: after.rotation_rate,
        speedMps: after.translation_speed,
      },
    };
  });
}

function gridValues(range, count) {
  if (count < 2 || range.max === range.min) return [range.min];
  return Array.from({length: count}, (_, index) =>
    range.min + (range.max - range.min) * index / (count - 1)
  );
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

function vectorFromSpeedAndAngle(speed, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: 0,
    y: -speed * Math.sin(angle),
    z: speed * Math.cos(angle),
  };
}

function rangeDistance(value, range) {
  if (value < range.min) return {hit: false, distance: range.min - value};
  if (value > range.max) return {hit: false, distance: value - range.max};
  return {hit: true, distance: 0};
}

function rangeIntersects(envelope, range) {
  return envelope.max >= range.min && envelope.min <= range.max;
}

function makeProbe(level, sign, angleDeg, rotationRps, speedMps, stateApi, contactApi, policy, core) {
  const velocity = vectorFromSpeedAndAngle(speedMps, angleDeg);
  const omega = {x: sign * rotationRps * RPS_TO_RAD_S, y: 0, z: 0};
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
  finiteVector(incoming.velocity, `${level.lowerDiskLevel}/${sign} input velocity`);
  finiteVector(incoming.omega, `${level.lowerDiskLevel}/${sign} input omega`);
  finiteVector(outgoing.velocity, `${level.lowerDiskLevel}/${sign} output velocity`);
  finiteVector(outgoing.omega, `${level.lowerDiskLevel}/${sign} output omega`);
  return {
    input: {
      angleDeg,
      rotationRps,
      omegaRadPerSec: magnitude(incoming.omega),
      velocity: incoming.velocity,
      omega: incoming.omega,
    },
    output: {
      angleDeg: trajectoryAngleDeg(outgoing.velocity),
      signedAngleDeg: signedTrajectoryAngleDeg(outgoing.velocity),
      rotationRps: magnitude(outgoing.omega) / RPS_TO_RAD_S,
      omegaRadPerSec: magnitude(outgoing.omega),
      velocity: outgoing.velocity,
      omega: outgoing.omega,
      speedMps: magnitude(outgoing.velocity),
    },
    contact: {
      frictionRegime: response.diagnostics.frictionRegime,
      energyDelta: response.diagnostics.energyDelta,
      energyRatio: contactApi.kineticEnergy(outgoing) /
        Math.max(contactApi.kineticEnergy(incoming), 1e-12),
      normalImpulse: response.diagnostics.normalImpulse,
      tangentImpulse: response.diagnostics.tangentImpulse,
    },
  };
}

function envelope(values) {
  return {min: Math.min(...values), max: Math.max(...values)};
}

function compactSample(sample, distance, metric) {
  return {
    metric,
    distance,
    input: sample.input,
    output: sample.output,
    contact: sample.contact,
  };
}

function summarizeRun(level, sign, stateApi, contactApi, policy, core) {
  const angleValues = gridValues(level.inputRanges.angleDeg, GRID_POINTS_PER_AXIS);
  const rotationValues = gridValues(level.inputRanges.rotationRps, GRID_POINTS_PER_AXIS);
  const speedValues = gridValues(level.inputRanges.speedMps, GRID_POINTS_PER_AXIS);
  const samples = [];
  const hitCounts = Object.fromEntries(METRICS.map((metric) => [metric, 0]));
  const best = Object.fromEntries(METRICS.map((metric) => [metric, null]));
  const outputValues = Object.fromEntries(METRICS.map((metric) => [metric, []]));
  const frictionRegimes = {};
  let jointRangeHitCount = 0;
  let energyIncreaseCount = 0;

  for (const angleDeg of angleValues) {
    for (const rotationRps of rotationValues) {
      for (const speedMps of speedValues) {
        const sample = makeProbe(
          level, sign, angleDeg, rotationRps, speedMps,
          stateApi, contactApi, policy, core
        );
        samples.push(sample);
        const values = {
          angleDeg: sample.output.angleDeg,
          rotationRps: sample.output.rotationRps,
          speedMps: sample.output.speedMps,
        };
        const checks = {};
        let jointHit = true;
        for (const metric of METRICS) {
          const check = rangeDistance(values[metric], level.externalAfter[metric]);
          checks[metric] = check;
          outputValues[metric].push(values[metric]);
          if (check.hit) hitCounts[metric] += 1;
          else jointHit = false;
          if (!best[metric] || check.distance < best[metric].distance) {
            best[metric] = compactSample(sample, check.distance, metric);
          }
        }
        if (jointHit) jointRangeHitCount += 1;
        if (sample.contact.energyDelta > 1e-9) energyIncreaseCount += 1;
        const regime = sample.contact.frictionRegime;
        frictionRegimes[regime] = (frictionRegimes[regime] || 0) + 1;
      }
    }
  }

  const outputEnvelope = Object.fromEntries(METRICS.map((metric) => [
    metric,
    envelope(outputValues[metric]),
  ]));
  const externalAfter = Object.fromEntries(METRICS.map((metric) => {
    const range = level.externalAfter[metric];
    return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
  }));

  return {
    lowerDiskLevel: level.lowerDiskLevel,
    regime: level.regime,
    omegaSign: sign,
    sampleCount: samples.length,
    inputGrid: {
      pointsPerAxis: GRID_POINTS_PER_AXIS,
      angleDeg: angleValues,
      rotationRps: rotationValues,
      speedMps: speedValues,
      combinations: samples.length,
    },
    inputRanges: Object.fromEntries(METRICS.map((metric) => {
      const range = level.inputRanges[metric];
      return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
    })),
    externalAfter,
    outputEnvelope,
    envelopeIntersects: Object.fromEntries(METRICS.map((metric) => [
      metric,
      rangeIntersects(outputEnvelope[metric], level.externalAfter[metric]),
    ])),
    sampleHits: {
      angleDeg: hitCounts.angleDeg,
      rotationRps: hitCounts.rotationRps,
      speedMps: hitCounts.speedMps,
      jointAllThree: jointRangeHitCount,
    },
    frictionRegimes,
    energyIncreaseCount,
    nearest: best,
  };
}

function buildReport() {
  const rows = parseCsv(fs.readFileSync(SOURCE_CSV, "utf8"));
  const levels = summarizeRows(rows);
  const stateApi = loadCommonJs(path.join(V2_DIR, "trainer-state.js"));
  const contactApi = loadCommonJs(path.join(V2_DIR, "contact-policy.js"));
  const core = loadSharedCore();
  const policy = contactApi.createContactPolicy();
  const runs = [];
  for (const level of levels) {
    for (const sign of [-1, 1]) {
      runs.push(summarizeRun(level, sign, stateApi, contactApi, policy, core));
    }
  }
  const workingSignRuns = runs.filter((run) => run.omegaSign === 1);
  const metricIntersectionCounts = Object.fromEntries(METRICS.map((metric) => [
    metric,
    workingSignRuns.filter((run) => run.envelopeIntersects[metric]).length,
  ]));
  const metricSampleHitLevelCounts = Object.fromEntries(METRICS.map((metric) => [
    metric,
    workingSignRuns.filter((run) => run.sampleHits[metric] > 0).length,
  ]));
  const jointHitLevels = workingSignRuns.filter((run) => run.sampleHits.jointAllThree > 0);
  const allRunsEnergyIncrease = runs.reduce((sum, run) => sum + run.energyIncreaseCount, 0);
  const allRunsSampleCount = runs.reduce((sum, run) => sum + run.sampleCount, 0);
  const allRunsFrictionRegimes = runs.reduce((counts, run) => {
    for (const [regime, count] of Object.entries(run.frictionRegimes)) {
      counts[regime] = (counts[regime] || 0) + count;
    }
    return counts;
  }, {});

  return {
    status: "pass",
    benchmark: "V9 fixed-parameter uncertainty envelope",
    scope: "2017 JSME external bounce/spin input-range envelope against mainline-v2 raw table contact",
    calibrationStatus: "not-calibrated",
    source: {
      sourceId: SOURCE_ID,
      csv: "AI_CONTEXT/research-evidence/external_bounce_spin_2017_figure_digitization.csv",
      pdf: "C:\\Users\\Kevin\\Downloads\\2017_G0500606.pdf",
      rowsRead: rows.length,
      dataQuality: "figure_digitized_approx",
      caveat: "the grid tests all independent combinations inside each before range; it does not recover hidden per-ball pairing from the figure",
    },
    coordinateContract: {
      schema: SCHEMA,
      state: "mainline-v2 BallState",
      tableNormal: TABLE_NORMAL,
      velocity: "{x:0, y:-speed*sin(angle), z:speed*cos(angle)} before contact",
      angle: "positive magnitude from atan2(abs(velocity.y), hypot(velocity.x, velocity.z))",
      omega: "{x: sign*2π*rps, y:0, z:0} in rad/s",
      omegaAxis: OMEGA_AXIS,
      rpsToRadPerSecond: RPS_TO_RAD_S,
      inputScale: "real-scale; no simulation time-dilation conversion",
      signCandidates: [-1, 1],
      workingSign: 1,
    },
    method: {
      grid: "full-factorial, inclusive endpoints",
      pointsPerAxis: GRID_POINTS_PER_AXIS,
      maxSamplesPerLevelPerSign: GRID_POINTS_PER_AXIS ** 3,
      totalSamples: allRunsSampleCount,
      inputDimensions: ["incident angle", "rotation rate", "translation speed"],
      fixedContactPolicy: true,
      outputBoundary: "raw table contact response before post-table flight integration",
      envelopeIntersectionMeaning: "a scalar output envelope overlaps the external after range; it is not a paired observation match",
      jointMatchMeaning: "one sampled input simultaneously lands in all three external after ranges",
      parameterFitting: false,
      formalFilesModified: false,
    },
    tablePolicy: {
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
      rowsRead: rows.length,
      workingSign: 1,
      workingSignEnvelopeIntersectionLevels: metricIntersectionCounts,
      workingSignSampleHitLevels: metricSampleHitLevelCounts,
      workingSignJointMatchLevels: jointHitLevels.map((run) => run.lowerDiskLevel),
      workingSignJointMatchLevelCount: jointHitLevels.length,
      allRunsEnergyIncreaseSamples: allRunsEnergyIncrease,
      allRunsFrictionRegimes,
      interpretation: "input uncertainty feasibility screen only; no parameter was fitted or changed",
    },
    runs,
  };
}

try {
  console.log(JSON.stringify(buildReport(), null, 2));
} catch (error) {
  console.error(`V9 external envelope benchmark failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}
