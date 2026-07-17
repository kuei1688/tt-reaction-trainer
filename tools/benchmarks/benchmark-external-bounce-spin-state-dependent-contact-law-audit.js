#!/usr/bin/env node
"use strict";

// Isolated state-dependent contact-law audit.
//
// The supplied report gives one empirical relation, COR = -0.019u + 0.87,
// for a ball hitting a stationary racket. This tool does not promote that
// relation to the table model. It applies it only as a labelled normal-speed
// output overlay so that two interpretations of u can be compared against the
// 2017 ball-table figure ranges:
//   - total incoming relative speed, as the report states;
//   - normal approach speed, as a contact-law adaptation.
//
// The existing mainline-v2 tangent response, omega state, and contact regime
// are held fixed underneath the overlay. Therefore this is a representability
// diagnostic, not a calibrated contact law or a material parameter proposal.
// No mainline-v2, shared core, legacy page, or formal preset is modified.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");
const V2_DIR = path.join(ROOT_DIR, "mainline-v2");
const SOURCE_CSV = path.join(ROOT_DIR, "AI_CONTEXT", "external_bounce_spin_2017_figure_digitization.csv");
const OUTPUT_JSON = path.join(ROOT_DIR, "AI_CONTEXT", "external_bounce_spin_2017_state_dependent_contact_law_audit.json");
const OUTPUT_MD = path.join(ROOT_DIR, "AI_CONTEXT", "external_bounce_spin_2017_state_dependent_contact_law_audit.md");
const SOURCE_ID = "JSME-2017-G0500606";
const REPORT_SOURCE = "C:\\Users\\Kevin\\Downloads\\桌球彈跳動力學模擬.pdf";
const SCHEMA = 2;
const RPS_TO_RAD_S = 2 * Math.PI;
const TABLE_NORMAL = {x: 0, y: 1, z: 0};
const AXES = ["x", "y", "z"];
const METRICS = ["angleDeg", "rotationRps", "speedMps"];
const GRID_POINTS_PER_AXIS = 9;
const REPORT_COR = Object.freeze({
  slopePerMps: -0.019,
  intercept: 0.87,
  clampMin: 0,
  clampMax: 1,
  context: "stationary racket impact in supplied report; not a ball-table measurement",
});
const ITTF_COF_REPRESENTATIVES = Object.freeze({I: 0.18, II: 0.24, III: 0.31});

function loadCommonJs(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadSharedCore() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "shared-physics-core.js"), "utf8");
  const names = ["physics3dSolvePlaneContact", "physics3dSolveCompliantPlaneContact"];
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

function add(a, b) {
  return {x: a.x + b.x, y: a.y + b.y, z: a.z + b.z};
}

function subtract(a, b) {
  return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
}

function scale(value, factor) {
  return {x: value.x * factor, y: value.y * factor, z: value.z * factor};
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value, label) {
  const length = magnitude(value);
  if (!(length > 1e-12)) fail(`${label} must be non-zero`);
  return scale(value, 1 / length);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function copyState(state, velocity) {
  return {
    position: {...state.position},
    velocity: {...velocity},
    omega: {...state.omega},
    mass: state.mass,
    inertia: state.inertia,
  };
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

function vectorFromSpeedAndAngle(speed, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return {x: 0, y: -speed * Math.sin(angle), z: speed * Math.cos(angle)};
}

function horizontalSpeed(value) {
  return Math.hypot(value.x, value.z);
}

function trajectoryAngleDeg(value) {
  return Math.atan2(Math.abs(value.y), horizontalSpeed(value)) * 180 / Math.PI;
}

function rangeDistance(value, range) {
  if (value < range.min) return {hit: false, distance: range.min - value};
  if (value > range.max) return {hit: false, distance: value - range.max};
  return {hit: true, distance: 0};
}

function rangeIntersects(envelope, range) {
  return envelope.max >= range.min && envelope.min <= range.max;
}

function kineticEnergy(contactApi, state) {
  return contactApi.kineticEnergy(state);
}

function applyNormalOverlay(baseResponse, incoming, surface, normalLaw) {
  if (normalLaw.kind === "fixed-mainline") {
    return {
      state: baseResponse.state,
      normalLaw: {kind: normalLaw.kind, effectiveRestitution: null, speedArgumentMps: null},
    };
  }

  const normal = normalize(surface.normal, "table.normal");
  const surfaceVelocity = surface.surfaceVelocity || {x: 0, y: 0, z: 0};
  const incomingRelative = subtract(incoming.velocity, surfaceVelocity);
  const approachSpeed = Math.max(0, -dot(incomingRelative, normal));
  const totalRelativeSpeed = magnitude(incomingRelative);
  const speedArgumentMps = normalLaw.speedArgument === "normal-approach"
    ? approachSpeed
    : totalRelativeSpeed;
  const rawRestitution = REPORT_COR.intercept + REPORT_COR.slopePerMps * speedArgumentMps;
  const effectiveRestitution = clamp(rawRestitution, REPORT_COR.clampMin, REPORT_COR.clampMax);
  const outgoingRelative = subtract(baseResponse.state.velocity, surfaceVelocity);
  const outgoingNormal = dot(outgoingRelative, normal);
  const outgoingTangent = subtract(outgoingRelative, scale(normal, outgoingNormal));
  const adjustedRelative = add(
    outgoingTangent,
    scale(normal, effectiveRestitution * approachSpeed)
  );
  return {
    // Preserve the base solver's post-contact omega and other state fields;
    // only the normal linear-velocity component is isolated here.
    state: copyState(baseResponse.state, add(surfaceVelocity, adjustedRelative)),
    normalLaw: {
      kind: normalLaw.kind,
      speedArgument: normalLaw.speedArgument,
      speedArgumentMps,
      rawRestitution,
      effectiveRestitution,
      baseOutgoingNormalSpeedMps: outgoingNormal,
      adjustedOutgoingNormalSpeedMps: effectiveRestitution * approachSpeed,
    },
  };
}

function makeProbe(level, sign, angleDeg, rotationRps, speedMps, variant, stateApi, contactApi, core) {
  const incoming = stateApi.createBallState({
    position: {x: 0, y: 0.02, z: 0},
    velocity: vectorFromSpeedAndAngle(speedMps, angleDeg),
    spin3d: {schema: SCHEMA, omega: {x: sign * rotationRps * RPS_TO_RAD_S, y: 0, z: 0}},
  });
  const policy = contactApi.createContactPolicy({tableFriction: variant.friction});
  const baseResponse = contactApi.solveContact({
    state: incoming,
    surface: policy.table,
    mode: policy.table.mode,
  }, core);
  const adjusted = applyNormalOverlay(baseResponse, incoming, policy.table, variant.normalLaw);
  const outgoing = adjusted.state;
  finiteVector(incoming.velocity, `${level.lowerDiskLevel}/${sign} input velocity`);
  finiteVector(incoming.omega, `${level.lowerDiskLevel}/${sign} input omega`);
  finiteVector(outgoing.velocity, `${level.lowerDiskLevel}/${sign} output velocity`);
  finiteVector(outgoing.omega, `${level.lowerDiskLevel}/${sign} output omega`);
  const inputEnergy = kineticEnergy(contactApi, incoming);
  const outputEnergy = kineticEnergy(contactApi, outgoing);
  return {
    input: {angleDeg, rotationRps, speedMps},
    output: {
      angleDeg: trajectoryAngleDeg(outgoing.velocity),
      rotationRps: magnitude(outgoing.omega) / RPS_TO_RAD_S,
      speedMps: magnitude(outgoing.velocity),
      velocity: outgoing.velocity,
      omega: outgoing.omega,
    },
    contact: {
      baseFrictionRegime: baseResponse.diagnostics.frictionRegime,
      baseEnergyDelta: baseResponse.diagnostics.energyDelta,
      energyDelta: outputEnergy - inputEnergy,
      energyRatio: outputEnergy / Math.max(inputEnergy, 1e-12),
      normalImpulse: baseResponse.diagnostics.normalImpulse,
      tangentImpulse: baseResponse.diagnostics.tangentImpulse,
      normalLaw: adjusted.normalLaw,
    },
  };
}

function emptyMetricAccumulator() {
  return Object.fromEntries(METRICS.map((metric) => [metric, []]));
}

function summarizeVariantLevel(level, sign, variant, stateApi, contactApi, core) {
  const angles = gridValues(level.inputRanges.angleDeg, GRID_POINTS_PER_AXIS);
  const rotations = gridValues(level.inputRanges.rotationRps, GRID_POINTS_PER_AXIS);
  const speeds = gridValues(level.inputRanges.speedMps, GRID_POINTS_PER_AXIS);
  const values = emptyMetricAccumulator();
  const hits = Object.fromEntries(METRICS.map((metric) => [metric, 0]));
  const nearest = Object.fromEntries(METRICS.map((metric) => [metric, null]));
  const regimes = {};
  let jointAllThree = 0;
  let energyIncrease = 0;
  let minEnergyRatio = Infinity;
  let maxEnergyRatio = -Infinity;
  const restitutionValues = [];

  for (const angleDeg of angles) {
    for (const rotationRps of rotations) {
      for (const speedMps of speeds) {
        const sample = makeProbe(
          level, sign, angleDeg, rotationRps, speedMps,
          variant, stateApi, contactApi, core
        );
        const sampleValues = {
          angleDeg: sample.output.angleDeg,
          rotationRps: sample.output.rotationRps,
          speedMps: sample.output.speedMps,
        };
        let joint = true;
        for (const metric of METRICS) {
          values[metric].push(sampleValues[metric]);
          const distance = rangeDistance(sampleValues[metric], level.externalAfter[metric]);
          if (distance.hit) hits[metric] += 1;
          else joint = false;
          if (!nearest[metric] || distance.distance < nearest[metric].distance) {
            nearest[metric] = {distance: distance.distance, input: sample.input, output: sample.output};
          }
        }
        if (joint) jointAllThree += 1;
        if (sample.contact.energyDelta > 1e-9) energyIncrease += 1;
        minEnergyRatio = Math.min(minEnergyRatio, sample.contact.energyRatio);
        maxEnergyRatio = Math.max(maxEnergyRatio, sample.contact.energyRatio);
        const regime = sample.contact.baseFrictionRegime;
        regimes[regime] = (regimes[regime] || 0) + 1;
        if (Number.isFinite(sample.contact.normalLaw.effectiveRestitution)) {
          restitutionValues.push(sample.contact.normalLaw.effectiveRestitution);
        }
      }
    }
  }

  const outputEnvelope = Object.fromEntries(METRICS.map((metric) => [
    metric,
    {min: Math.min(...values[metric]), max: Math.max(...values[metric])},
  ]));
  return {
    lowerDiskLevel: level.lowerDiskLevel,
    regime: level.regime,
    omegaSign: sign,
    sampleCount: values.angleDeg.length,
    inputRanges: Object.fromEntries(METRICS.map((metric) => {
      const range = level.inputRanges[metric];
      return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
    })),
    externalAfter: Object.fromEntries(METRICS.map((metric) => {
      const range = level.externalAfter[metric];
      return [metric, {min: range.min, max: range.max, midpoint: range.midpoint}];
    })),
    outputEnvelope,
    envelopeIntersects: Object.fromEntries(METRICS.map((metric) => [
      metric,
      rangeIntersects(outputEnvelope[metric], level.externalAfter[metric]),
    ])),
    sampleHits: {...hits, jointAllThree},
    baseFrictionRegimes: regimes,
    energyIncreaseCount: energyIncrease,
    energyRatioEnvelope: {min: minEnergyRatio, max: maxEnergyRatio},
    effectiveRestitutionEnvelope: restitutionValues.length === 0
      ? null
      : {min: Math.min(...restitutionValues), max: Math.max(...restitutionValues)},
    nearest,
  };
}

function makeVariants() {
  const variants = [];
  const fixedFriction = [
    {id: "current-policy-fixed", friction: 0.13, label: "current mainline policy"},
    {id: "official-group-I-fixed", friction: ITTF_COF_REPRESENTATIVES.I, label: "official CoF group I representative"},
    {id: "official-group-II-fixed", friction: ITTF_COF_REPRESENTATIVES.II, label: "official CoF group II representative"},
    {id: "official-group-III-fixed", friction: ITTF_COF_REPRESENTATIVES.III, label: "official CoF group III representative"},
  ];
  for (const entry of fixedFriction) {
    variants.push({
      id: entry.id,
      label: entry.label,
      friction: entry.friction,
      normalLaw: {kind: "fixed-mainline"},
    });
  }
  for (const speedArgument of ["total-relative", "normal-approach"]) {
    for (const entry of fixedFriction) {
      variants.push({
        id: `${entry.id.replace(/-fixed$/, "")}-report-cor-${speedArgument}`,
        label: `${entry.label} + report COR overlay (${speedArgument})`,
        friction: entry.friction,
        normalLaw: {kind: "report-linear-cor-overlay", speedArgument},
      });
    }
  }
  return variants;
}

function runVariant(levels, variant, stateApi, contactApi, core) {
  const levelsOut = [];
  for (const level of levels) {
    for (const sign of [-1, 1]) {
      levelsOut.push(summarizeVariantLevel(level, sign, variant, stateApi, contactApi, core));
    }
  }
  return {...variant, levels: levelsOut};
}

function aggregate(variant, workingSignOnly) {
  const selected = variant.levels.filter((level) => !workingSignOnly || level.omegaSign === 1);
  const byLevel = {};
  for (const level of selected) byLevel[level.lowerDiskLevel] = level;
  return {
    workingSignJointLevels: selected.filter((level) => level.sampleHits.jointAllThree > 0).map((level) => level.lowerDiskLevel),
    workingSignEnvelopeIntersections: Object.fromEntries(METRICS.map((metric) => [
      metric,
      selected.filter((level) => level.envelopeIntersects[metric]).length,
    ])),
    workingSignJointHitCount: selected.reduce((sum, level) => sum + level.sampleHits.jointAllThree, 0),
    allSignsJointHitCount: variant.levels.reduce((sum, level) => sum + level.sampleHits.jointAllThree, 0),
    allSignsEnergyIncreaseCount: variant.levels.reduce((sum, level) => sum + level.energyIncreaseCount, 0),
    allSignsSampleCount: variant.levels.reduce((sum, level) => sum + level.sampleCount, 0),
    byLevel,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# 2017 外部彈跳／旋轉：state-dependent contact-law audit",
    "",
    `Date: ${report.date}`,
    "Status: `PASS / ISOLATED REPRESENTABILITY AUDIT / NOT CALIBRATED`",
    "",
    "## 結論",
    "",
    "本審計只把報告中的球拍 COR 關係當作隔離的法向速度 overlay；沒有修改 mainline-v2 或宣稱它是球桌參數。它用來檢查：若加入速度依賴的法向回彈，2017 的 angle／rotation／speed 是否可能被代表。",
    "",
    `- 報告公式：COR = ${REPORT_COR.slopePerMps}u + ${REPORT_COR.intercept}。來源情境是靜止球拍，不是球桌。`,
    "- `total-relative` 將 `u` 解讀成入射相對速度大小，貼近報告文字。",
    "- `normal-approach` 將 `u` 解讀成桌面法向接近速度，是接觸模型的敏感度情境，不是報告的直接校準。",
    "- 切向衝量、omega 與 solver 回報的 sliding／rolling regime 都固定沿用現有接觸結果；因此此結果不能被解讀為完整 state-dependent friction model。",
    "",
    "## 代表性結果",
    "",
    "| variant | working-sign scalar envelope intersections | working-sign joint hits | energy increases |",
    "|---|---:|---:|---:|",
  ];
  for (const variant of report.variants) {
    const summary = variant.aggregate;
    lines.push(`| ${variant.id} | angle ${summary.workingSignEnvelopeIntersections.angleDeg}/4; rotation ${summary.workingSignEnvelopeIntersections.rotationRps}/4; speed ${summary.workingSignEnvelopeIntersections.speedMps}/4 | ${summary.workingSignJointHitCount} | ${summary.allSignsEnergyIncreaseCount} |`);
  }
  lines.push(
    "",
    "## 逐 level 的 joint 結果",
    "",
    "| variant | level 0 | level 2 | level 4 | level 6 |",
    "|---|---:|---:|---:|---:|",
  );
  for (const variant of report.variants) {
    const cells = [0, 2, 4, 6].map((level) => {
      const result = variant.aggregate.byLevel[level];
      return `${result.sampleHits.jointAllThree}/${result.sampleCount}`;
    });
    lines.push(`| ${variant.id} | ${cells.join(" | ")} |`);
  }
  lines.push(
    "",
    "## 判定",
    "",
    "這是一個機制敏感度與語義審計，不是參數調整授權。若 overlay 仍無 joint match，不能據此說明材質一定錯；它只表示「單獨加入報告式速度依賴 COR」不足以解釋全部外部結果。若某情境出現 joint match，也只能表示該輸入／輸出語義與接觸律組合值得後續量測驗證，不能直接升格為正式模型。",
    "",
    "## 限制",
    "",
    "1. 2017 資料來自圖表 digitization，且 before 的角度、旋轉、速度被做成獨立範圍；沒有恢復同一顆球的配對資料。",
    "2. 報告中的 COR 公式是球拍接觸關係；球桌接觸的法向／切向材料資料仍缺少直接量測。",
    "3. overlay 只重設法向輸出速度，沒有讓更新後的 normal impulse 重新限制切向摩擦；這是刻意的隔離設計。",
    "4. output 是 raw table contact，不包含接觸後飛行中的阻力與 Magnus 力。",
    "",
    "## Reproduction",
    "",
    "```text",
    "node tools/benchmark-external-bounce-spin-state-dependent-contact-law-audit.js",
    "```",
    "",
    "Machine-readable output: `AI_CONTEXT/research-evidence/external_bounce_spin_2017_state_dependent_contact_law_audit.json`",
  );
  return lines.join("\n") + "\n";
}

function buildReport() {
  const rows = parseCsv(fs.readFileSync(SOURCE_CSV, "utf8"));
  const levels = summarizeRows(rows);
  const stateApi = loadCommonJs(path.join(V2_DIR, "trainer-state.js"));
  const contactApi = loadCommonJs(path.join(V2_DIR, "contact-policy.js"));
  const core = loadSharedCore();
  const variants = makeVariants().map((variant) => {
    const result = runVariant(levels, variant, stateApi, contactApi, core);
    return {...result, aggregate: aggregate(result, true)};
  });
  return {
    status: "pass",
    date: new Date().toISOString().slice(0, 10),
    benchmark: "2017 external bounce/spin state-dependent contact-law audit",
    calibrationStatus: "not-calibrated",
    scope: "isolated normal-COR sensitivity overlay over current mainline-v2 table tangent response",
    source: {
      sourceId: SOURCE_ID,
      csv: "AI_CONTEXT/research-evidence/external_bounce_spin_2017_figure_digitization.csv",
      report: REPORT_SOURCE,
      rowsRead: rows.length,
      dataQuality: "figure_digitized_approx",
    },
    coordinateContract: {
      schema: SCHEMA,
      tableNormal: TABLE_NORMAL,
      velocity: "{x:0, y:-speed*sin(angle), z:speed*cos(angle)} before contact",
      angle: "atan2(abs(velocity.y), hypot(velocity.x, velocity.z)) after contact",
      omega: "{x:sign*rps*2*pi, y:0, z:0} in rad/s",
      rpsToRadPerSecond: RPS_TO_RAD_S,
      outputBoundary: "raw table contact response before post-table flight",
    },
    baselinePolicy: {
      source: "mainline-v2 contact policy, read-only",
      tableFriction: 0.13,
      normalModel: "compliant",
      tangentModel: "coulomb",
      dwellTimeS: 0.003,
      dtS: 0.00025,
      steps: 12,
      springNPerM: 6000,
      dampingNsPerM: 4,
    },
    reportRelation: REPORT_COR,
    method: {
      grid: "full-factorial, inclusive endpoints inside each independent 2017 before range",
      pointsPerAxis: GRID_POINTS_PER_AXIS,
      omegaSigns: [-1, 1],
      fixedTangentResponse: true,
      stateDependentFrictionTested: false,
      normalOverlayOnly: true,
      parameterFitting: false,
      formalFilesModified: false,
      directMaterialCalibration: false,
    },
    frictionScenarios: ITTF_COF_REPRESENTATIVES,
    variants,
    decision: {
      parameterTuningAuthorized: false,
      formalPromotionAuthorized: false,
      reportCORDirectlyAppliedToTable: false,
      interpretation: "A report-style speed-dependent normal COR overlay is a sensitivity scenario only; it does not identify a ball-table material profile.",
      nextGate: "If a future measurement is available, record normal approach speed, outgoing normal speed, tangential contact-point speed, omega vector, and contact regime together before proposing a full state-dependent table law.",
    },
  };
}

try {
  const report = buildReport();
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");
  console.log(JSON.stringify({
    status: report.status,
    variants: report.variants.length,
    totalSamples: report.variants.reduce((sum, variant) => sum + variant.aggregate.allSignsSampleCount, 0),
    json: path.relative(ROOT_DIR, OUTPUT_JSON),
    markdown: path.relative(ROOT_DIR, OUTPUT_MD),
  }, null, 2));
} catch (error) {
  console.error(`State-dependent contact-law audit failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}
