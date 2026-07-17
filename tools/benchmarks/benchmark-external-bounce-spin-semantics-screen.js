#!/usr/bin/env node
"use strict";

// Semantics-aware representability screen.
//
// This is an isolated feasibility tool. It does not fit or mutate physics
// parameters, formal presets, mainline-v2, shared core, or legacy pages.
// It keeps the measured scalar ranges fixed while varying only the source
// state semantics that the 2017 paper does not fully specify.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const V2_DIR = path.join(ROOT_DIR, "mainline-v2");
const SOURCE_CSV = path.join(ROOT_DIR, "AI_CONTEXT", "external_bounce_spin_2017_figure_digitization.csv");
const SOURCE_ID = "JSME-2017-G0500606";
const SCHEMA = 2;
const RPS_TO_RAD_S = 2 * Math.PI;
const GRID_POINTS_PER_AXIS = 9;
const AXES = ["x", "y", "z"];
const METRICS = ["angleDeg", "rotationRps", "speedMps"];
const LATERAL_HEADINGS_DEG = [-15, -7.5, 0, 7.5, 15];

function loadCommonJs(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadSharedCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = [
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
        angleDeg: level.before.trajectory_angle,
        rotationRps: level.before.rotation_rate,
        speedMps: level.before.translation_speed,
      },
      externalAfter: {
        angleDeg: level.after.trajectory_angle,
        rotationRps: level.after.rotation_rate,
        speedMps: level.after.translation_speed,
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

function angleDeg(value, semantic) {
  const normal = Math.abs(value.y);
  const tangent = horizontalSpeed(value);
  if (semantic === "tableNormal") return Math.atan2(tangent, normal) * 180 / Math.PI;
  return Math.atan2(normal, tangent) * 180 / Math.PI;
}

function vectorFromSpeedAndAngle(speed, angleDegValue, headingDeg) {
  const angle = angleDegValue * Math.PI / 180;
  const heading = headingDeg * Math.PI / 180;
  const horizontal = speed * Math.cos(angle);
  return {
    x: horizontal * Math.sin(heading),
    y: -speed * Math.sin(angle),
    z: horizontal * Math.cos(heading),
  };
}

function omegaFromRotation(rotationRps, axis, sign) {
  const value = sign * rotationRps * RPS_TO_RAD_S;
  return {
    x: axis === "x" ? value : 0,
    y: axis === "y" ? value : 0,
    z: axis === "z" ? value : 0,
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

function compactBest(sample, metric, distance) {
  return {
    distance,
    metric,
    input: sample.input,
    output: sample.output,
  };
}

const SCENARIOS = [
  {
    id: "baseline_table_plane_planar_omega_x",
    label: "基準代理：桌面角度、平面速度、omega X 軸",
    angleSemantic: "tablePlane",
    lateralHeadingsDeg: [0],
    omegaAxes: ["x"],
    omegaSigns: [-1, 1],
    comparisonClass: "conditional-scalar-comparison",
    representability: {
      angle: "conditional-direct",
      lateralVelocity: "proxy-zero-only",
      rotationAxis: "proxy-x-only",
      contactRegime: "not-comparable",
    },
  },
  {
    id: "alternative_table_normal_planar_omega_x",
    label: "替代語義：桌面法線角度、平面速度、omega X 軸",
    angleSemantic: "tableNormal",
    lateralHeadingsDeg: [0],
    omegaAxes: ["x"],
    omegaSigns: [-1, 1],
    comparisonClass: "alternative-semantics-only",
    representability: {
      angle: "not-supported-by-source; numeric alternative only",
      lateralVelocity: "proxy-zero-only",
      rotationAxis: "proxy-x-only",
      contactRegime: "not-comparable",
    },
  },
  {
    id: "sensitivity_bounded_lateral_heading",
    label: "敏感度：允許桌面內 lateral heading ±15°",
    angleSemantic: "tablePlane",
    lateralHeadingsDeg: LATERAL_HEADINGS_DEG,
    omegaAxes: ["x"],
    omegaSigns: [-1, 1],
    comparisonClass: "sensitivity-only",
    representability: {
      angle: "conditional-direct",
      lateralVelocity: "not-observed; bounded sensitivity assumption",
      rotationAxis: "proxy-x-only",
      contactRegime: "not-comparable",
    },
  },
  {
    id: "sensitivity_unknown_principal_rotation_axis",
    label: "敏感度：旋轉軸未知，掃描 ±X／±Y／±Z",
    angleSemantic: "tablePlane",
    lateralHeadingsDeg: [0],
    omegaAxes: ["x", "y", "z"],
    omegaSigns: [-1, 1],
    comparisonClass: "sensitivity-only",
    representability: {
      angle: "conditional-direct",
      lateralVelocity: "proxy-zero-only",
      rotationAxis: "not-observed; principal-axis envelope only",
      contactRegime: "not-comparable",
    },
  },
  {
    id: "combined_unknown_axis_and_lateral",
    label: "組合敏感度：lateral ±15° + 未知主軸 ±X／±Y／±Z",
    angleSemantic: "tablePlane",
    lateralHeadingsDeg: LATERAL_HEADINGS_DEG,
    omegaAxes: ["x", "y", "z"],
    omegaSigns: [-1, 1],
    comparisonClass: "sensitivity-only",
    representability: {
      angle: "conditional-direct",
      lateralVelocity: "not-observed; bounded sensitivity assumption",
      rotationAxis: "not-observed; principal-axis envelope only",
      contactRegime: "not-comparable",
    },
  },
];

function makeProbe(level, scenario, headingDeg, omegaAxis, omegaSign, angle, rotation, speed, stateApi, contactApi, policy, core) {
  const velocity = vectorFromSpeedAndAngle(speed, angle, headingDeg);
  const omega = omegaFromRotation(rotation, omegaAxis, omegaSign);
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
  finiteVector(incoming.velocity, `${level.lowerDiskLevel} input velocity`);
  finiteVector(incoming.omega, `${level.lowerDiskLevel} input omega`);
  finiteVector(outgoing.velocity, `${level.lowerDiskLevel} output velocity`);
  finiteVector(outgoing.omega, `${level.lowerDiskLevel} output omega`);
  return {
    input: {
      angleDeg: angle,
      rotationRps: rotation,
      speedMps: speed,
      lateralHeadingDeg: headingDeg,
      omegaAxis,
      omegaSign,
    },
    output: {
      angleDeg: angleDeg(outgoing.velocity, scenario.angleSemantic),
      tablePlaneAngleDeg: angleDeg(outgoing.velocity, "tablePlane"),
      tableNormalAngleDeg: angleDeg(outgoing.velocity, "tableNormal"),
      rotationRps: magnitude(outgoing.omega) / RPS_TO_RAD_S,
      speedMps: magnitude(outgoing.velocity),
    },
    contact: {
      frictionRegime: response.diagnostics.frictionRegime,
      energyDelta: response.diagnostics.energyDelta,
    },
  };
}

function summarizeScenarioLevel(level, scenario, stateApi, contactApi, policy, core) {
  const angleValues = gridValues(level.inputRanges.angleDeg, GRID_POINTS_PER_AXIS);
  const rotationValues = gridValues(level.inputRanges.rotationRps, GRID_POINTS_PER_AXIS);
  const speedValues = gridValues(level.inputRanges.speedMps, GRID_POINTS_PER_AXIS);
  const outputValues = Object.fromEntries(METRICS.map((metric) => [metric, []]));
  const hitCounts = Object.fromEntries(METRICS.map((metric) => [metric, 0]));
  const best = Object.fromEntries(METRICS.map((metric) => [metric, null]));
  const frictionRegimes = {};
  let jointAllThree = 0;
  let sampleCount = 0;
  let energyIncreaseCount = 0;

  for (const headingDeg of scenario.lateralHeadingsDeg) {
    for (const omegaAxis of scenario.omegaAxes) {
      for (const omegaSign of scenario.omegaSigns) {
        for (const angle of angleValues) {
          for (const rotation of rotationValues) {
            for (const speed of speedValues) {
              const sample = makeProbe(
                level, scenario, headingDeg, omegaAxis, omegaSign,
                angle, rotation, speed, stateApi, contactApi, policy, core
              );
              sampleCount += 1;
              let jointHit = true;
              for (const metric of METRICS) {
                const value = sample.output[metric];
                const check = rangeDistance(value, level.externalAfter[metric]);
                outputValues[metric].push(value);
                if (check.hit) hitCounts[metric] += 1;
                else jointHit = false;
                if (!best[metric] || check.distance < best[metric].distance) {
                  best[metric] = compactBest(sample, metric, check.distance);
                }
              }
              if (jointHit) jointAllThree += 1;
              if (sample.contact.energyDelta > 1e-9) energyIncreaseCount += 1;
              const regime = sample.contact.frictionRegime;
              frictionRegimes[regime] = (frictionRegimes[regime] || 0) + 1;
            }
          }
        }
      }
    }
  }

  const outputEnvelope = Object.fromEntries(METRICS.map((metric) => [
    metric,
    {min: Math.min(...outputValues[metric]), max: Math.max(...outputValues[metric])},
  ]));
  const externalAfter = Object.fromEntries(METRICS.map((metric) => {
    const range = level.externalAfter[metric];
    return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
  }));

  return {
    lowerDiskLevel: level.lowerDiskLevel,
    regime: level.regime,
    sampleCount,
    scenarioGrid: {
      pointsPerScalarAxis: GRID_POINTS_PER_AXIS,
      lateralHeadingsDeg: scenario.lateralHeadingsDeg,
      omegaAxes: scenario.omegaAxes,
      omegaSigns: scenario.omegaSigns,
      scalarCombinationsPerVariant: angleValues.length * rotationValues.length * speedValues.length,
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
      jointAllThree,
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
  const scenarios = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    comparisonClass: scenario.comparisonClass,
    representability: scenario.representability,
    semantics: {
      angle: scenario.angleSemantic === "tablePlane"
        ? "model reports angle from table plane"
        : "model reports angle from table normal",
      lateralVelocity: scenario.lateralHeadingsDeg.length === 1 && scenario.lateralHeadingsDeg[0] === 0
        ? "vx=0 planar proxy"
        : "table-plane heading sampled at ±15 degrees; bound is not measured by the paper",
      rotationAxis: scenario.omegaAxes.length === 1
        ? `omega axis ${scenario.omegaAxes[0]} proxy`
        : "principal-axis union over x/y/z; not a full arbitrary-axis reconstruction",
      externalContactRegime: "not_reported",
    },
    levels: levels.map((level) => summarizeScenarioLevel(
      level, scenario, stateApi, contactApi, policy, core
    )),
  }));

  const totalSamples = scenarios.reduce((sum, scenario) =>
    sum + scenario.levels.reduce((levelSum, level) => levelSum + level.sampleCount, 0), 0
  );
  const modelRegimes = scenarios.reduce((counts, scenario) => {
    for (const level of scenario.levels) {
      for (const [regime, count] of Object.entries(level.frictionRegimes)) {
        counts[regime] = (counts[regime] || 0) + count;
      }
    }
    return counts;
  }, {});

  return {
    status: "pass",
    benchmark: "Semantics-aware representability screen",
    calibrationStatus: "not-calibrated",
    source: {
      sourceId: SOURCE_ID,
      csv: "AI_CONTEXT/research-evidence/external_bounce_spin_2017_figure_digitization.csv",
      pdf: "C:\\Users\\Kevin\\Downloads\\2017_G0500606.pdf",
      rowsRead: rows.length,
      dataQuality: "figure_digitized_approx",
      sourceSemanticReview: "AI_CONTEXT/research-evidence/external_bounce_spin_2017_semantics_regime_review.json",
      pairing: "level ranges only; no per-ball before/after pairing recovered",
    },
    fixedCoordinateContract: {
      schema: SCHEMA,
      tableNormal: {x: 0, y: 1, z: 0},
      scalarSpeed: "input speed is preserved as magnitude",
      tablePlaneAngleFormula: "atan2(abs(v_normal), hypot(v_tangent))",
      tableNormalAngleFormula: "atan2(hypot(v_tangent), abs(v_normal))",
      rpsToRadPerSecond: RPS_TO_RAD_S,
      inputScale: "real-scale; no simulation time-dilation conversion",
    },
    fixedTablePolicy: {
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
    method: {
      scalarGrid: "full-factorial inclusive endpoints inside each before range",
      pointsPerScalarAxis: GRID_POINTS_PER_AXIS,
      lateralHeadingBoundDeg: LATERAL_HEADINGS_DEG,
      rotationAxisScreen: "principal axes only; not full 3D axis identification",
      outputBoundary: "raw table contact response before post-table flight integration",
      parameterFitting: false,
      formalFilesModified: false,
      totalSamples,
    },
    comparisonContract: {
      directlyUsableNow: [
        "translation speed magnitude, as a scalar before/after range",
        "rotation-rate magnitude, as a scalar before/after range",
        "trajectory angle under the high-confidence table-plane interpretation, as a conditional scalar comparison",
      ],
      sensitivityOnly: [
        "bounded lateral velocity: paper does not report lateral component; ±15 degree heading is an explicit test bound",
        "unknown rotation axis: paper does not report axis; ±X/±Y/±Z is a principal-axis sensitivity envelope",
        "combined lateral-plus-axis envelope: feasibility bound, not a reconstructed trial",
      ],
      notComparableNow: [
        "full 3D velocity vector",
        "omega axis or signed omega vector",
        "per-ball coupled before/after output",
        "external sliding-versus-rolling regime",
      ],
      contactRegimeRule: "external regime remains not_reported; mainline frictionRegime is model diagnostic only",
    },
    summary: {
      scenarioCount: scenarios.length,
      levelCount: levels.length,
      modelRegimesAcrossScreen: modelRegimes,
      externalRegime: "not_reported",
      canClaimExternalRegimeMatch: false,
      interpretation: "A scalar envelope overlap means only that a semantic scenario can reach the numeric range; it does not validate the hidden vector state or contact regime.",
    },
    scenarios,
    decision: {
      parameterTuningAuthorized: false,
      formalPromotionAuthorized: false,
      nextGate: "If a semantic scenario remains quantitatively mismatched, isolate the missing physical mechanism with new evidence or an explicitly authorized R1 proposal.",
    },
  };
}

try {
  console.log(JSON.stringify(buildReport(), null, 2));
} catch (error) {
  console.error(`Semantics-aware screen failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}

