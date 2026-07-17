#!/usr/bin/env node
"use strict";

// Official-spec-constrained contact profile screen.
//
// ITTF publishes performance constraints for table/ball contact rather than
// a single Young's modulus to insert into a solver. This isolated tool turns
// the published vertical rebound and tabletop CoF bounds into effective
// acceptance gates, then screens only profiles that pass those gates against
// the 2017 external ranges.
//
// No formal parameter, mainline-v2 file, shared core, legacy page, or preset
// is modified. This is not a material calibration.

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

const ITTF = Object.freeze({
  dropHeightM: 0.300,
  reboundHeightM: {min: 0.230, max: 0.260},
  tabletopCof: {min: 0.150, max: 0.350},
  tabletopCofGroups: {
    I: {min: 0.150, max: 0.210, representative: 0.180},
    II: {min: 0.211, max: 0.270, representative: 0.240},
    III: {min: 0.271, max: 0.350, representative: 0.310},
  },
  ballDiameterM: 0.040,
  ballMassKg: 0.0027,
});

const MATERIAL_PROXY_GRID = Object.freeze({
  spring: [3000, 6000, 12000],
  damping: [2, 4, 8],
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
  return {x: 0, y: -speed * Math.sin(angle), z: speed * Math.cos(angle)};
}

function omegaFromRps(rotationRps, sign) {
  return {x: sign * rotationRps * RPS_TO_RAD_S, y: 0, z: 0};
}

function createVariants() {
  const variants = [];
  for (const group of Object.entries(ITTF.tabletopCofGroups)) {
    const [frictionGroup, spec] = group;
    for (const spring of MATERIAL_PROXY_GRID.spring) {
      for (const damping of MATERIAL_PROXY_GRID.damping) {
        for (const contactDuration of MATERIAL_PROXY_GRID.contactDuration) {
          variants.push({
            id: `group-${frictionGroup}_spring-${spring}_damping-${damping}_duration-${contactDuration}`,
            frictionGroup,
            friction: spec.representative,
            spring,
            damping,
            contactDuration,
            steps: Math.round(contactDuration / CONTACT_DT),
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

function emptyAccumulator() {
  return {
    sampleCount: 0,
    envelope: Object.fromEntries(METRICS.map((metric) => [metric, {min: Infinity, max: -Infinity}])),
    hits: Object.fromEntries(METRICS.map((metric) => [metric, 0])),
    joint: 0,
    energyIncrease: 0,
    regimes: {},
  };
}

function rangeDistance(value, range) {
  if (value < range.min) return {hit: false, distance: range.min - value};
  if (value > range.max) return {hit: false, distance: value - range.max};
  return {hit: true, distance: 0};
}

function observe(acc, sample, target) {
  acc.sampleCount += 1;
  let joint = true;
  for (const metric of METRICS) {
    const value = sample.output[metric];
    acc.envelope[metric].min = Math.min(acc.envelope[metric].min, value);
    acc.envelope[metric].max = Math.max(acc.envelope[metric].max, value);
    if (rangeDistance(value, target[metric]).hit) acc.hits[metric] += 1;
    else joint = false;
  }
  if (joint) acc.joint += 1;
  if (sample.contact.energyDelta > 1e-9) acc.energyIncrease += 1;
  const regime = sample.contact.frictionRegime;
  acc.regimes[regime] = (acc.regimes[regime] || 0) + 1;
}

function finalize(acc, target) {
  const envelope = Object.fromEntries(METRICS.map((metric) => [
    metric,
    {min: acc.envelope[metric].min, max: acc.envelope[metric].max},
  ]));
  return {
    sampleCount: acc.sampleCount,
    envelope,
    target: Object.fromEntries(METRICS.map((metric) => {
      const range = target[metric];
      return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
    })),
    envelopeIntersects: Object.fromEntries(METRICS.map((metric) => [
      metric,
      envelope[metric].max >= target[metric].min && envelope[metric].min <= target[metric].max,
    ])),
    hits: {angleDeg: acc.hits.angleDeg, rotationRps: acc.hits.rotationRps, speedMps: acc.hits.speedMps, jointAllThree: acc.joint},
    energyIncrease: acc.energyIncrease,
    regimes: acc.regimes,
  };
}

function normalProfileTest(variant, stateApi, contactApi, core) {
  const policy = createPolicy(contactApi, variant);
  const impactSpeed = Math.sqrt(2 * 9.80665 * ITTF.dropHeightM);
  const sample = makeProbe(90, 0, impactSpeed, 1, stateApi, contactApi, policy, core);
  const effectiveRestitution = sample.output.outgoingNormalVelocityMps / impactSpeed;
  const reboundHeightM = effectiveRestitution * effectiveRestitution * ITTF.dropHeightM;
  const heightPass = reboundHeightM >= ITTF.reboundHeightM.min && reboundHeightM <= ITTF.reboundHeightM.max;
  const energyPass = sample.contact.energyDelta <= 1e-9;
  return {
    variantId: variant.id,
    frictionGroup: variant.frictionGroup,
    friction: variant.friction,
    spring: variant.spring,
    damping: variant.damping,
    contactDuration: variant.contactDuration,
    impactSpeedMps: impactSpeed,
    effectiveRestitution,
    predictedReboundHeightM: reboundHeightM,
    heightPass,
    energyPass,
    pass: heightPass && energyPass,
    energyRatio: sample.contact.energyRatio,
    frictionRegime: sample.contact.frictionRegime,
  };
}

function obliqueProfileTest(levels, variant, stateApi, contactApi, core) {
  const policy = createPolicy(contactApi, variant);
  return levels.map((level) => {
    const acc = emptyAccumulator();
    const angleValues = gridValues(level.inputRanges.angleDeg, GRID_POINTS_PER_AXIS);
    const rotationValues = gridValues(level.inputRanges.rotationRps, GRID_POINTS_PER_AXIS);
    const speedValues = gridValues(level.inputRanges.speedMps, GRID_POINTS_PER_AXIS);
    for (const sign of [-1, 1]) {
      for (const angle of angleValues) {
        for (const rotation of rotationValues) {
          for (const speed of speedValues) {
            const sample = makeProbe(angle, rotation, speed, sign, stateApi, contactApi, policy, core);
            observe(acc, sample, level.externalAfter);
          }
        }
      }
    }
    return {
      lowerDiskLevel: level.lowerDiskLevel,
      regime: level.regime,
      ...finalize(acc, level.externalAfter),
    };
  });
}

function buildReport() {
  const rows = parseCsv(fs.readFileSync(SOURCE_CSV, "utf8"));
  const levels = summarizeRows(rows);
  const stateApi = loadCommonJs(path.join(V2_DIR, "trainer-state.js"));
  const contactApi = loadCommonJs(path.join(V2_DIR, "contact-policy.js"));
  const core = loadSharedCore();
  const variants = createVariants();
  const normalTests = variants.map((variant) => normalProfileTest(variant, stateApi, contactApi, core));
  const accepted = normalTests.filter((test) => test.pass);
  const currentPolicy = normalProfileTest({
    id: "current-policy",
    frictionGroup: "outside-official-range",
    friction: 0.13,
    spring: 6000,
    damping: 4,
    contactDuration: 0.003,
    steps: 12,
  }, stateApi, contactApi, core);
  const obliqueProfiles = accepted.map((test) => {
    const variant = variants.find((candidate) => candidate.id === test.variantId);
    return {
      ...test,
      levels: obliqueProfileTest(levels, variant, stateApi, contactApi, core),
    };
  });
  const levelSummary = levels.map((level) => {
    const results = obliqueProfiles.map((profile) => ({
      variantId: profile.variantId,
      frictionGroup: profile.frictionGroup,
      friction: profile.friction,
      spring: profile.spring,
      damping: profile.damping,
      contactDuration: profile.contactDuration,
      normalProfile: {
        effectiveRestitution: profile.effectiveRestitution,
        predictedReboundHeightM: profile.predictedReboundHeightM,
      },
      result: profile.levels.find((candidate) => candidate.lowerDiskLevel === level.lowerDiskLevel),
    }));
    return {
      lowerDiskLevel: level.lowerDiskLevel,
      acceptedProfileCount: results.length,
      profilesWithAllThreeEnvelopeIntersection: results.filter((profile) =>
        METRICS.every((metric) => profile.result.envelopeIntersects[metric])
      ).length,
      profilesWithJointMatch: results.filter((profile) => profile.result.hits.jointAllThree > 0).length,
      profilesWithEnergyIncrease: results.filter((profile) => profile.result.energyIncrease > 0).length,
      bestJointProfiles: results
        .filter((profile) => profile.result.hits.jointAllThree > 0)
        .sort((a, b) => b.result.hits.jointAllThree - a.result.hits.jointAllThree)
        .slice(0, 5),
      allProfileResults: results,
    };
  });
  return {
    status: "pass",
    benchmark: "Official-spec-constrained material/contact profile screen",
    calibrationStatus: "not-calibrated",
    scope: "use official rebound and tabletop-CoF performance bounds as acceptance gates for isolated effective profiles",
    officialSources: {
      councilDecisions2024: "https://db.ittf.com/sites/default/files/public/2024-03/2024_ITTF_Council_Decisions_Taken.pdf",
      handbook2020: "https://db.ittf.com/sites/default/files/public/2021-04/2020ITTFHandbook.pdf",
      evidence: {
        tableRebound: "300 mm drop height; 230-260 mm rebound height",
        tabletopCof: "0.150-0.350 reference CoF; groups I 0.150-0.210, II 0.211-0.270, III 0.271-0.350",
        ball: "40 mm diameter and 2.7 g mass",
        materialInterpretation: "ITTF emphasizes measured bounce/restitution and friction performance rather than one tabletop material constant",
      },
    },
    physicalStateContract: {
      schema: SCHEMA,
      tableNormal: {x: 0, y: 1, z: 0},
      inputScale: "real-scale",
      angle: "table-plane angle",
      velocity: "{x:0, y:-speed*sin(angle), z:speed*cos(angle)}",
      omega: "{x:sign*2π*rps, y:0, z:0}",
    },
    officialProfileGate: {
      dropHeightM: ITTF.dropHeightM,
      reboundHeightM: ITTF.reboundHeightM,
      equivalentRestitutionRange: [
        Math.sqrt(ITTF.reboundHeightM.min / ITTF.dropHeightM),
        Math.sqrt(ITTF.reboundHeightM.max / ITTF.dropHeightM),
      ],
      tabletopCofRange: ITTF.tabletopCof,
      ballDiameterM: ITTF.ballDiameterM,
      ballMassKg: ITTF.ballMassKg,
      note: "equivalent restitution assumes ballistic height conversion e=sqrt(h_rebound/h_drop); it is a performance gate, not a Young's modulus",
    },
    proxySearch: {
      springNPerM: MATERIAL_PROXY_GRID.spring,
      dampingNsPerM: MATERIAL_PROXY_GRID.damping,
      contactDurationS: MATERIAL_PROXY_GRID.contactDuration,
      frictionGroups: Object.fromEntries(Object.entries(ITTF.tabletopCofGroups).map(([key, value]) => [key, value.representative])),
      candidateCount: variants.length,
      acceptedNormalProfileCount: accepted.length,
      normalTests: normalTests,
      currentPolicyNormalTest: currentPolicy,
    },
    obliqueScreen: {
      inputGrid: "full-factorial 9-point grid inside each 2017 before range",
      omegaSigns: [-1, 1],
      samplesPerAcceptedProfile: levels.reduce((sum, level) => {
        const dimensions = [level.inputRanges.angleDeg, level.inputRanges.rotationRps, level.inputRanges.speedMps]
          .map((range) => range.min === range.max ? 1 : GRID_POINTS_PER_AXIS);
        return sum + 2 * dimensions[0] * dimensions[1] * dimensions[2];
      }, 0),
      acceptedProfileCount: accepted.length,
      totalSamples: obliqueProfiles.length * levels.reduce((sum, level) => {
        const dimensions = [level.inputRanges.angleDeg, level.inputRanges.rotationRps, level.inputRanges.speedMps]
          .map((range) => range.min === range.max ? 1 : GRID_POINTS_PER_AXIS);
        return sum + 2 * dimensions[0] * dimensions[1] * dimensions[2];
      }, 0),
      levelSummary,
    },
    decision: {
      parameterTuningAuthorized: false,
      formalPromotionAuthorized: false,
      materialSpecsDirectlyApplied: false,
      interpretation: "Official equipment performance bounds constrain the admissible effective profiles, but do not identify spring, damping, ball shell properties, or a unique contact law.",
      nextGate: "Use a measured ball-table contact trace or BBoT-like restitution/friction observation to choose among the accepted profiles before any R1 proposal.",
    },
  };
}

try {
  console.log(JSON.stringify(buildReport(), null, 2));
} catch (error) {
  console.error(`Official contact profile screen failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}

