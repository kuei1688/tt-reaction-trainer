#!/usr/bin/env node
"use strict";

// Isolated material/contact-law experiment.
//
// This tool explores effective contact proxies only. It does not claim to
// identify Young's modulus, shell thickness, table laminate properties, or
// any other physical material constant. It does not fit or mutate formal
// parameters, mainline-v2, shared core, legacy pages, or formal presets.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const V2_DIR = path.join(ROOT_DIR, "mainline-v2");
const SOURCE_CSV = path.join(ROOT_DIR, "AI_CONTEXT", "external_bounce_spin_2017_figure_digitization.csv");
const SOURCE_ID = "JSME-2017-G0500606";
const SCHEMA = 2;
const RPS_TO_RAD_S = 2 * Math.PI;
const CONTACT_DT = 0.00025;
const GRID_POINTS_PER_AXIS = 9;
const AXES = ["x", "y", "z"];
const METRICS = ["angleDeg", "rotationRps", "speedMps"];
const NORMAL_TEST_SPEEDS = [4, 6, 8, 10];

const MATERIAL_GRID = Object.freeze({
  spring: [3000, 6000, 12000],
  damping: [2, 4, 8],
  friction: [0.08, 0.13, 0.25],
  contactDuration: [0.002, 0.003, 0.0045],
});

function loadCommonJs(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadSharedCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  return vm.runInNewContext(`(function(){${source}\nreturn {
    physics3dSolvePlaneContact,
    physics3dSolveCompliantPlaneContact
  };})()`, {Math, Number, console});
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

function angleDeg(value) {
  return Math.atan2(Math.abs(value.y), Math.hypot(value.x, value.z)) * 180 / Math.PI;
}

function vectorFromSpeedAndAngle(speed, incidentAngleDeg) {
  const angle = incidentAngleDeg * Math.PI / 180;
  return {
    x: 0,
    y: -speed * Math.sin(angle),
    z: speed * Math.cos(angle),
  };
}

function omegaFromRps(rotationRps, sign) {
  return {x: sign * rotationRps * RPS_TO_RAD_S, y: 0, z: 0};
}

function createMaterialVariants() {
  const variants = [];
  for (const spring of MATERIAL_GRID.spring) {
    for (const damping of MATERIAL_GRID.damping) {
      for (const friction of MATERIAL_GRID.friction) {
        for (const contactDuration of MATERIAL_GRID.contactDuration) {
          const steps = Math.round(contactDuration / CONTACT_DT);
          variants.push({
            id: `spring-${spring}_damping-${damping}_mu-${friction}_duration-${contactDuration}`,
            spring,
            damping,
            friction,
            contactDuration,
            steps,
            relativeToCurrent: {
              spring: spring / 6000,
              damping: damping / 4,
              friction: friction / 0.13,
              contactDuration: contactDuration / 0.003,
            },
          });
        }
      }
    }
  }
  return variants;
}

function createPolicy(contactApi, variant) {
  return contactApi.createContactPolicy({
    tableFriction: variant.friction,
    tableDwellTime: variant.contactDuration,
    tableContactDt: CONTACT_DT,
    tableContactSteps: variant.steps,
    tableSpring: variant.spring,
    tableDamping: variant.damping,
    tableTangentDamping: 0,
  });
}

function makeProbe(angle, rotation, speed, sign, stateApi, contactApi, policy, core) {
  const incoming = stateApi.createBallState({
    position: {x: 0, y: 0.02, z: 0},
    velocity: vectorFromSpeedAndAngle(speed, angle),
    spin3d: {schema: SCHEMA, omega: omegaFromRps(rotation, sign)},
  });
  const response = contactApi.solveContact({
    state: incoming,
    surface: policy.table,
    mode: policy.table.mode,
  }, core);
  const outgoing = response.state;
  finiteVector(incoming.velocity, "input velocity");
  finiteVector(incoming.omega, "input omega");
  finiteVector(outgoing.velocity, "output velocity");
  finiteVector(outgoing.omega, "output omega");
  return {
    output: {
      angleDeg: angleDeg(outgoing.velocity),
      rotationRps: magnitude(outgoing.omega) / RPS_TO_RAD_S,
      speedMps: magnitude(outgoing.velocity),
      outgoingNormalVelocityMps: outgoing.velocity.y,
    },
    contact: {
      frictionRegime: response.diagnostics.frictionRegime,
      energyDelta: response.diagnostics.energyDelta,
      energyRatio: contactApi.kineticEnergy(outgoing) /
        Math.max(contactApi.kineticEnergy(incoming), 1e-12),
      normalImpulse: response.diagnostics.normalImpulse,
      tangentImpulseMagnitude: magnitude(response.diagnostics.tangentImpulse),
      dwellTime: response.diagnostics.dwellTime,
      steps: response.diagnostics.contactSteps,
    },
  };
}

function emptyMetricEnvelope() {
  return Object.fromEntries(METRICS.map((metric) => [metric, {min: Infinity, max: -Infinity}]));
}

function emptyAccumulator() {
  return {
    sampleCount: 0,
    outputEnvelope: emptyMetricEnvelope(),
    sampleHits: Object.fromEntries(METRICS.map((metric) => [metric, 0])),
    jointAllThree: 0,
    energyIncreaseCount: 0,
    frictionRegimes: {},
    nearest: null,
  };
}

function rangeDistance(value, range) {
  if (value < range.min) return {hit: false, distance: range.min - value};
  if (value > range.max) return {hit: false, distance: value - range.max};
  return {hit: true, distance: 0};
}

function normalizedDistance(value, range) {
  const check = rangeDistance(value, range);
  if (check.hit) return 0;
  const scale = Math.max(range.max - range.min, Math.abs(range.midpoint), 1);
  return check.distance / scale;
}

function observe(accumulator, sample, externalAfter, inputMeta) {
  accumulator.sampleCount += 1;
  let jointHit = true;
  let normalizedMiss = 0;
  for (const metric of METRICS) {
    const value = sample.output[metric];
    const envelope = accumulator.outputEnvelope[metric];
    envelope.min = Math.min(envelope.min, value);
    envelope.max = Math.max(envelope.max, value);
    const check = rangeDistance(value, externalAfter[metric]);
    if (check.hit) accumulator.sampleHits[metric] += 1;
    else jointHit = false;
    normalizedMiss += normalizedDistance(value, externalAfter[metric]);
  }
  if (jointHit) accumulator.jointAllThree += 1;
  if (sample.contact.energyDelta > 1e-9) accumulator.energyIncreaseCount += 1;
  const regime = sample.contact.frictionRegime;
  accumulator.frictionRegimes[regime] = (accumulator.frictionRegimes[regime] || 0) + 1;
  if (!accumulator.nearest || normalizedMiss < accumulator.nearest.normalizedMiss) {
    accumulator.nearest = {
      normalizedMiss,
      input: inputMeta,
      output: sample.output,
      contact: sample.contact,
    };
  }
}

function finalizeAccumulator(accumulator, externalAfter) {
  return {
    sampleCount: accumulator.sampleCount,
    outputEnvelope: Object.fromEntries(METRICS.map((metric) => {
      const envelope = accumulator.outputEnvelope[metric];
      return [metric, {min: envelope.min, max: envelope.max}];
    })),
    externalAfter: Object.fromEntries(METRICS.map((metric) => {
      const range = externalAfter[metric];
      return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
    })),
    envelopeIntersects: Object.fromEntries(METRICS.map((metric) => {
      const output = accumulator.outputEnvelope[metric];
      const target = externalAfter[metric];
      return [metric, output.max >= target.min && output.min <= target.max];
    })),
    sampleHits: {
      angleDeg: accumulator.sampleHits.angleDeg,
      rotationRps: accumulator.sampleHits.rotationRps,
      speedMps: accumulator.sampleHits.speedMps,
      jointAllThree: accumulator.jointAllThree,
    },
    energyIncreaseCount: accumulator.energyIncreaseCount,
    frictionRegimes: accumulator.frictionRegimes,
    nearest: accumulator.nearest,
  };
}

function normalCharacterization(variants, stateApi, contactApi, core) {
  const bySpeed = new Map(NORMAL_TEST_SPEEDS.map((speed) => [speed, []]));
  let energyIncreaseCount = 0;
  const frictionRegimes = {};
  for (const variant of variants) {
    const policy = createPolicy(contactApi, variant);
    for (const speed of NORMAL_TEST_SPEEDS) {
      const sample = makeProbe(90, 0, speed, 1, stateApi, contactApi, policy, core);
      const effectiveRestitution = sample.output.outgoingNormalVelocityMps / speed;
      const result = {
        variantId: variant.id,
        spring: variant.spring,
        damping: variant.damping,
        friction: variant.friction,
        contactDuration: variant.contactDuration,
        speedMps: speed,
        outgoingNormalVelocityMps: sample.output.outgoingNormalVelocityMps,
        effectiveRestitution,
        energyRatio: sample.contact.energyRatio,
        normalImpulse: sample.contact.normalImpulse,
        contactDurationActual: sample.contact.dwellTime,
        contactSteps: sample.contact.steps,
        frictionRegime: sample.contact.frictionRegime,
      };
      bySpeed.get(speed).push(result);
      if (sample.contact.energyDelta > 1e-9) energyIncreaseCount += 1;
      const regime = sample.contact.frictionRegime;
      frictionRegimes[regime] = (frictionRegimes[regime] || 0) + 1;
    }
  }
  const speeds = NORMAL_TEST_SPEEDS.map((speed) => {
    const values = bySpeed.get(speed);
    const effective = values.map((result) => result.effectiveRestitution);
    const outgoing = values.map((result) => result.outgoingNormalVelocityMps);
    const energy = values.map((result) => result.energyRatio);
    return {
      speedMps: speed,
      variantCount: values.length,
      effectiveRestitutionEnvelope: {min: Math.min(...effective), max: Math.max(...effective)},
      outgoingNormalVelocityEnvelope: {min: Math.min(...outgoing), max: Math.max(...outgoing)},
      energyRatioEnvelope: {min: Math.min(...energy), max: Math.max(...energy)},
      currentPolicy: values.find((result) => result.variantId === "spring-6000_damping-4_mu-0.13_duration-0.003"),
    };
  });
  return {
    input: {
      type: "pure normal impact",
      tablePlaneIncidentAngleDeg: 90,
      speedSweepMps: NORMAL_TEST_SPEEDS,
      rotationRps: 0,
      note: "diagnostic speed sweep; not a direct measurement from the 2017 paper",
    },
    materialVariantCount: variants.length,
    speeds,
    energyIncreaseCount,
    frictionRegimes,
  };
}

function obliqueMaterialScreen(levels, variants, stateApi, contactApi, core) {
  const globalByLevel = new Map(levels.map((level) => [level.lowerDiskLevel, emptyAccumulator()]));
  const policyLevelSummaries = [];
  let totalSamples = 0;
  for (const variant of variants) {
    const policy = createPolicy(contactApi, variant);
    for (const level of levels) {
      const accumulator = emptyAccumulator();
      const angleValues = gridValues(level.inputRanges.angleDeg, GRID_POINTS_PER_AXIS);
      const rotationValues = gridValues(level.inputRanges.rotationRps, GRID_POINTS_PER_AXIS);
      const speedValues = gridValues(level.inputRanges.speedMps, GRID_POINTS_PER_AXIS);
      for (const sign of [-1, 1]) {
        for (const angle of angleValues) {
          for (const rotation of rotationValues) {
            for (const speed of speedValues) {
              const sample = makeProbe(angle, rotation, speed, sign, stateApi, contactApi, policy, core);
              const inputMeta = {angleDeg: angle, rotationRps: rotation, speedMps: speed, omegaSign: sign};
              observe(accumulator, sample, level.externalAfter, inputMeta);
              observe(globalByLevel.get(level.lowerDiskLevel), sample, level.externalAfter, inputMeta);
            }
          }
        }
      }
      totalSamples += accumulator.sampleCount;
      const result = finalizeAccumulator(accumulator, level.externalAfter);
      policyLevelSummaries.push({
        variantId: variant.id,
        spring: variant.spring,
        damping: variant.damping,
        friction: variant.friction,
        contactDuration: variant.contactDuration,
        lowerDiskLevel: level.lowerDiskLevel,
        sampleCount: result.sampleCount,
        envelopeIntersects: result.envelopeIntersects,
        sampleHits: result.sampleHits,
        energyIncreaseCount: result.energyIncreaseCount,
        frictionRegimes: result.frictionRegimes,
        nearestNormalizedMiss: result.nearest ? result.nearest.normalizedMiss : null,
      });
    }
  }

  const levelsReport = levels.map((level) => {
    const global = finalizeAccumulator(globalByLevel.get(level.lowerDiskLevel), level.externalAfter);
    const candidates = policyLevelSummaries
      .filter((result) => result.lowerDiskLevel === level.lowerDiskLevel)
      .sort((a, b) => (a.nearestNormalizedMiss ?? Infinity) - (b.nearestNormalizedMiss ?? Infinity));
    const allThreeEnvelopePolicies = candidates.filter((candidate) =>
      METRICS.every((metric) => candidate.envelopeIntersects[metric])
    ).length;
    const jointPolicies = candidates.filter((candidate) => candidate.sampleHits.jointAllThree > 0).length;
    const maxScalarCoverage = Math.max(...candidates.map((candidate) =>
      METRICS.filter((metric) => candidate.envelopeIntersects[metric]).length
    ));
    return {
      lowerDiskLevel: level.lowerDiskLevel,
      regime: level.regime,
      globalAcrossMaterialEnvelope: global.outputEnvelope,
      externalAfter: global.externalAfter,
      globalEnvelopeIntersects: global.envelopeIntersects,
      globalSampleHits: global.sampleHits,
      globalEnergyIncreaseCount: global.energyIncreaseCount,
      globalFrictionRegimes: global.frictionRegimes,
      materialVariantsWithAllThreeEnvelopeIntersection: allThreeEnvelopePolicies,
      materialVariantsWithJointSampleMatch: jointPolicies,
      maxScalarMetricsIntersectingForOneVariant: maxScalarCoverage,
      closestMaterialVariants: candidates.slice(0, 3),
      currentPolicy: candidates.find((candidate) =>
        candidate.variantId === "spring-6000_damping-4_mu-0.13_duration-0.003"
      ),
    };
  });
  return {totalSamples, levels: levelsReport};
}

function buildReport() {
  const rows = parseCsv(fs.readFileSync(SOURCE_CSV, "utf8"));
  const levels = summarizeRows(rows);
  const stateApi = loadCommonJs(path.join(V2_DIR, "trainer-state.js"));
  const contactApi = loadCommonJs(path.join(V2_DIR, "contact-policy.js"));
  const core = loadSharedCore();
  const variants = createMaterialVariants();
  const normal = normalCharacterization(variants, stateApi, contactApi, core);
  const oblique = obliqueMaterialScreen(levels, variants, stateApi, contactApi, core);
  return {
    status: "pass",
    benchmark: "Isolated material/contact-law experiment",
    calibrationStatus: "not-calibrated",
    scope: "effective ball/table contact proxies only; no formal model mutation",
    source: {
      sourceId: SOURCE_ID,
      csv: "AI_CONTEXT/research-evidence/external_bounce_spin_2017_figure_digitization.csv",
      pdf: "C:\\Users\\Kevin\\Downloads\\2017_G0500606.pdf",
      rowsRead: rows.length,
      dataQuality: "figure_digitized_approx",
      semanticContract: "table-plane angle, scalar speed, rotation magnitude, omega.x sign candidates",
      pairingCaveat: "2017 data are level ranges without per-ball before/after pairing",
    },
    physicalStateContract: {
      schema: SCHEMA,
      tableNormal: {x: 0, y: 1, z: 0},
      ballRadiusM: 0.02,
      ballMassKg: 0.0027,
      ballInertiaModel: "thin-shell I=(2/3)mr^2",
      inputVelocity: "{x:0, y:-speed*sin(angle), z:speed*cos(angle)}",
      inputOmega: "{x:sign*2π*rps, y:0, z:0}",
      outputBoundary: "raw table contact response before post-table flight integration",
    },
    materialProxyGrid: {
      interpretation: "diagnostic brackets around the current effective policy; not extracted material constants or standards",
      springNPerM: MATERIAL_GRID.spring,
      dampingNsPerM: MATERIAL_GRID.damping,
      frictionCoefficient: MATERIAL_GRID.friction,
      contactDurationS: MATERIAL_GRID.contactDuration,
      contactDtS: CONTACT_DT,
      contactSteps: MATERIAL_GRID.contactDuration.map((duration) => Math.round(duration / CONTACT_DT)),
      variantCount: variants.length,
      currentPolicy: {
        springNPerM: 6000,
        dampingNsPerM: 4,
        frictionCoefficient: 0.13,
        contactDurationS: 0.003,
      },
    },
    normalImpactExperiment: normal,
    obliqueSpinExperiment: {
      method: {
        inputRanges: "full-factorial 9-point grid inside each 2017 before range",
        omegaSigns: [-1, 1],
        materialVariants: variants.length,
        totalSamples: oblique.totalSamples,
        parameterFitting: false,
      },
      levels: oblique.levels,
    },
    decision: {
      parameterTuningAuthorized: false,
      formalPromotionAuthorized: false,
      materialSpecsDirectlyApplied: false,
      interpretation: "This experiment measures how much a deliberately bracketed effective contact law can move the output. It does not identify real ball/table material properties.",
      nextGate: "Use measured drop/oblique-contact data to constrain the effective law before any R1 proposal.",
    },
  };
}

try {
  console.log(JSON.stringify(buildReport(), null, 2));
} catch (error) {
  console.error(`Material/contact isolation failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}

