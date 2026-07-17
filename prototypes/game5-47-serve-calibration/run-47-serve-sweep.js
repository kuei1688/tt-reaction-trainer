#!/usr/bin/env node

// Isolated Game 5 calibration experiment.
//
// This script reads the current Game 5 source and the current 47 serve presets,
// then evaluates parameter overrides through temporary source copies. It never
// writes game5.html, shared-physics-core.js, videos.json, or physics-presets.json.
// The output is calibration evidence, not a claim of physical truth.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {loadGame4Physics} = require("../../tools/load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SOURCE_FILE = path.join(ROOT_DIR, "game5.html");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const DEFAULT_OUTPUT_DIR = path.join(
  ROOT_DIR,
  "AI_CONTEXT",
  `game5_47_serve_calibration_${new Date().toISOString().slice(0, 10)}`
);

const DT = 1 / 120;
const DEPLOYED_DELAY_MS = 100;
const REPRESENTATIVE_COUNT = 6;

const EXTRACTED_NAMES = [
  "TECHNIQUES",
  "simulateServe",
  "simulatePath",
  "findHitIndex",
  "solveBaseVelocity",
  "solveServeBounceVelocity",
  "makeServeAimCandidate",
  "solveVelocity",
  "getServeLengthProfile",
  "findServeBounceTime",
  "getServeBounces",
  "serveBounceScore",
  "makeRacketReturnVelocity",
];

function main() {
  const options = parseArgs(process.argv.slice(2));
  const presetsDocument = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8"));
  const presets = Array.isArray(presetsDocument.serves) ? presetsDocument.serves : [];
  if (presets.length !== 47) {
    throw new Error(`Expected 47 serve presets, found ${presets.length}.`);
  }

  const beforeHashes = hashInputs();
  const baseEngine = createEngine({key: "baseline", params: {}}, null);
  const table = baseEngine.loader.runtimeExternals.TABLE;
  const serveCache = buildServeCache(baseEngine, presets);
  const representativeIds = selectRepresentativeIds(presets);
  const representativeSet = new Set(representativeIds);
  const holdoutPresets = presets.filter((preset) => !representativeSet.has(preset.id));

  const raw = {
    metadata: {
      generatedAt: new Date().toISOString(),
      scope: "isolated Game 5 47-serve parameter calibration",
      sourceFile: SOURCE_FILE,
      presetsFile: PRESETS_FILE,
      sourceSha256: beforeHashes[SOURCE_FILE],
      presetsSha256: beforeHashes[PRESETS_FILE],
      redLineFilesModified: false,
      physicalTruthClaim: false,
      dt: DT,
      deployedDelayMs: DEPLOYED_DELAY_MS,
      representativeIds,
      holdoutCount: holdoutPresets.length,
    },
    serveBaseline: summarizeServeBaseline(serveCache, table),
    rows: [],
  };

  const baselineVariant = {key: "baseline", label: "deployed baseline", params: {}, techniques: ["push", "attack"]};
  const parameterVariants = buildParameterVariants();
  const holdoutVariantKeys = new Set([
    "push-side-c-2.9",
    "push-blend-0.66",
    "attack-speed-y-0",
    "attack-speed-y-0.3",
  ]);
  const holdoutVariants = [
    baselineVariant,
    ...parameterVariants.filter((variant) => holdoutVariantKeys.has(variant.key)),
  ];
  raw.metadata.holdoutVariantKeys = holdoutVariants.map((variant) => variant.key);
  let attackNarrowCandidates = [];

  if (options.mode === "baseline" || options.mode === "all") {
    raw.rows.push(...runMatrix({
      presets,
      serveCache,
      variants: [baselineVariant],
      table,
      runName: "baseline-47",
      allDirectionsForNonSide: false,
      delays: [DEPLOYED_DELAY_MS],
    }));
  }

  if (options.mode === "coarse" || options.mode === "all") {
    raw.rows.push(...runMatrix({
      presets: presets.filter((preset) => representativeSet.has(preset.id)),
      serveCache,
      variants: [baselineVariant, ...parameterVariants],
      table,
      runName: "coarse-representative-6",
      allDirectionsForNonSide: true,
      delays: [DEPLOYED_DELAY_MS],
    }));
  }

  if (options.mode === "timing" || options.mode === "all") {
    raw.rows.push(...runMatrix({
      presets: presets.filter((preset) => representativeSet.has(preset.id)),
      serveCache,
      variants: [baselineVariant],
      table,
      runName: "timing-representative-6",
      allDirectionsForNonSide: true,
      delays: [60, 80, 100, 120, 140],
    }));
  }

  if (options.mode === "holdout" || options.mode === "all") {
    raw.rows.push(...runMatrix({
      presets: holdoutPresets,
      serveCache,
      variants: holdoutVariants,
      table,
      runName: "holdout-41",
      allDirectionsForNonSide: false,
      delays: [DEPLOYED_DELAY_MS],
    }));
  }

  if (options.mode === "attack-narrow") {
    const attackVariants = buildAttackNarrowVariants();
    const representativeRows = runMatrix({
      presets: presets.filter((preset) => representativeSet.has(preset.id)),
      serveCache,
      variants: attackVariants,
      table,
      runName: "attack-narrow-representative-6",
      allDirectionsForNonSide: true,
      delays: [40, 50, 60, 70, 80, 100],
    });
    raw.rows.push(...representativeRows);
    attackNarrowCandidates = rankAttackNarrowCandidates(representativeRows, attackVariants);
    raw.metadata.attackNarrowCandidates = attackNarrowCandidates.map((candidate) => ({
      variant: candidate.variant.key,
      sourceVariant: candidate.sourceVariant,
      delayMs: candidate.delayMs,
      score: candidate.score,
      representative: candidate.summary,
    }));

    for (const candidate of attackNarrowCandidates) {
      raw.rows.push(...runMatrix({
        presets: holdoutPresets,
        serveCache,
        variants: [candidate.variant],
        table,
        runName: "attack-narrow-holdout-41",
        allDirectionsForNonSide: false,
        delays: [candidate.delayMs],
      }));
    }
  }

  const afterHashes = hashInputs();
  raw.metadata.afterSourceSha256 = afterHashes[SOURCE_FILE];
  raw.metadata.afterPresetsSha256 = afterHashes[PRESETS_FILE];
  raw.metadata.concurrentInputMutation =
    raw.metadata.sourceSha256 !== raw.metadata.afterSourceSha256 ||
    raw.metadata.presetsSha256 !== raw.metadata.afterPresetsSha256;

  const summary = options.mode === "attack-narrow"
    ? buildAttackNarrowSummary(raw, attackNarrowCandidates)
    : buildSummary(raw);
  fs.mkdirSync(options.outputDir, {recursive: true});
  fs.writeFileSync(path.join(options.outputDir, "game5_47_serve_calibration_raw.json"), JSON.stringify(raw, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(options.outputDir, "game5_47_serve_calibration_summary.md"), summary, "utf8");

  console.log(summary);
  if (raw.metadata.concurrentInputMutation) {
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const options = {mode: "all", outputDir: DEFAULT_OUTPUT_DIR};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      options.mode = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output-dir") {
      const value = requireValue(argv, index, arg);
      options.outputDir = path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node prototypes/game5-47-serve-calibration/run-47-serve-sweep.js [--mode all|baseline|coarse|timing|holdout|attack-narrow] [--output-dir <path>]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["all", "baseline", "coarse", "timing", "holdout", "attack-narrow"].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function hashInputs() {
  return {
    [SOURCE_FILE]: sha256(SOURCE_FILE),
    [PRESETS_FILE]: sha256(PRESETS_FILE),
  };
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function buildParameterVariants() {
  const variants = [];
  for (const value of [0.55, 0.66]) {
    variants.push({key: `push-blend-${value}`, label: `push PADDLE_BLEND=${value}`, params: {PADDLE_BLEND: value}, techniques: ["push"]});
  }
  for (const value of [0.24, 0.32]) {
    variants.push({key: `push-lift-${value}`, label: `push PUSH_LIFT_BASE=${value}`, params: {PUSH_LIFT_BASE: value}, techniques: ["push"]});
  }
  for (const value of [0.48, 0.64]) {
    variants.push({key: `push-drive-${value}`, label: `push PUSH_DRIVE_BASE=${value}`, params: {PUSH_DRIVE_BASE: value}, techniques: ["push"]});
  }
  for (const value of [2.9, 3.8]) {
    variants.push({key: `push-side-c-${value}`, label: `push SIDESPIN_COMPENSATION_C=${value}`, params: {SIDESPIN_COMPENSATION_C: value}, techniques: ["push"]});
  }
  for (const value of [0.0, 0.2]) {
    variants.push({key: `attack-tilt-y-${value}`, label: `attack racketNormalTiltY=${value}`, params: {ATTACK_TILT_Y: value}, techniques: ["attack"]});
  }
  for (const value of [-0.8, -1.2]) {
    variants.push({key: `attack-speed-z-${value}`, label: `attack techniqueVel.z=${value}`, params: {ATTACK_SPEED_Z: value}, techniques: ["attack"]});
  }
  for (const value of [0.0, 0.3, 0.6]) {
    variants.push({key: `attack-speed-y-${value}`, label: `attack techniqueVel.y=${value}`, params: {ATTACK_SPEED_Y: value}, techniques: ["attack"]});
  }
  for (const value of [2.4, 4.4]) {
    variants.push({key: `attack-side-c-${value}`, label: `attack SIDESPIN_COMPENSATION_C=${value}`, params: {SIDESPIN_COMPENSATION_C: value}, techniques: ["attack"]});
  }
  return variants;
}

function buildAttackNarrowVariants() {
  return [-0.234, -0.1, 0.0, 0.15, 0.3, 0.45].map((value) => ({
    key: `attack-narrow-y-${value}`,
    label: `attack techniqueVel.y=${value}`,
    params: {ATTACK_SPEED_Y: value},
    techniques: ["attack"],
  }));
}

function rankAttackNarrowCandidates(rows, variants) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.variant}|${row.delayMs}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const ranked = [...groups.values()].map((group) => {
    const metrics = group.map((row) => row.metrics).filter(Boolean);
    const finite = metrics.filter((metric) => metric.finite).length;
    const success = metrics.filter((metric) => metric.success).length;
    const net = metrics.filter((metric) => metric.outcome === "net").length;
    const out = metrics.filter((metric) => metric.outcome === "out_or_no_landing").length;
    const rowsCount = Math.max(1, metrics.length);
    const successRate = success / rowsCount;
    const netRate = net / rowsCount;
    const outRate = out / rowsCount;
    const representative = group[0];
    const sourceVariant = variants.find((variant) => variant.key === representative.variant);
    return {
      sourceVariant: representative.variant,
      delayMs: representative.delayMs,
      score: successRate - netRate * 0.15 - outRate * 0.05,
      summary: {
        rows: group.length,
        finite,
        success,
        net,
        out,
        successRate,
        netRate,
        outRate,
        meanNetClearance: mean(metrics.map((metric) => metric.netClearance).filter(Number.isFinite)),
        meanAbsLandingX: mean(metrics.map((metric) => Math.abs(metric.landingX)).filter(Number.isFinite)),
      },
      variant: {
        key: `${representative.variant}-holdout-${representative.delayMs}ms`,
        label: `${sourceVariant?.label || representative.variant} @ ${representative.delayMs}ms`,
        params: sourceVariant?.params || {},
        techniques: ["attack"],
      },
    };
  }).sort((a, b) =>
    (b.score - a.score) ||
    (b.summary.success - a.summary.success) ||
    (a.summary.net - b.summary.net) ||
    ((b.summary.meanNetClearance ?? -Infinity) - (a.summary.meanNetClearance ?? -Infinity)) ||
    (a.delayMs - b.delayMs)
  );

  const selected = [];
  const seenSourceVariants = new Set();
  for (const candidate of ranked) {
    if (seenSourceVariants.has(candidate.sourceVariant)) continue;
    selected.push(candidate);
    seenSourceVariants.add(candidate.sourceVariant);
    if (selected.length === 3) break;
  }
  return selected.length ? selected : ranked.slice(0, 3);
}

function createEngine(variant) {
  const baseSource = fs.readFileSync(SOURCE_FILE, "utf8");
  const directionState = {value: null};
  const source = applyOverrides(baseSource, variant.params || {}, true);
  const tempFile = path.join(os.tmpdir(), `game5-calibration-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.html`);
  fs.writeFileSync(tempFile, source, "utf8");
  try {
    const loader = loadGame4Physics({sourceFile: tempFile});
    const extracted = loader.instantiateGame4Symbols(EXTRACTED_NAMES, {
      calibrationDirectionState: directionState,
    });
    return {loader, extracted, table: loader.runtimeExternals.TABLE, directionState};
  } finally {
    try { fs.unlinkSync(tempFile); } catch (_) { /* best-effort temp cleanup */ }
  }
}

function applyOverrides(source, params, bindDirectionState = false) {
  let output = source;
  if (bindDirectionState) {
    output = replaceOnce(output, /let selectedDirectionInput = null;/, "", "selectedDirectionInput binding");
    output = output.replace(/\bselectedDirectionInput\b/g, "calibrationDirectionState.value");
  }
  if (params.PADDLE_BLEND != null) output = replaceOnce(output, /const PADDLE_BLEND = [^;]+;/, `const PADDLE_BLEND = ${params.PADDLE_BLEND};`, "PADDLE_BLEND");
  if (params.PUSH_LIFT_BASE != null) output = replaceOnce(output, /const PUSH_LIFT_BASE = [^;]+;/, `const PUSH_LIFT_BASE = ${params.PUSH_LIFT_BASE};`, "PUSH_LIFT_BASE");
  if (params.PUSH_DRIVE_BASE != null) output = replaceOnce(output, /const PUSH_DRIVE_BASE = [^;]+;/, `const PUSH_DRIVE_BASE = ${params.PUSH_DRIVE_BASE};`, "PUSH_DRIVE_BASE");
  if (params.SIDESPIN_COMPENSATION_C != null) output = replaceOnce(output, /const SIDESPIN_COMPENSATION_C = [^;]+;/, `const SIDESPIN_COMPENSATION_C = ${params.SIDESPIN_COMPENSATION_C};`, "SIDESPIN_COMPENSATION_C");
  if (params.ATTACK_TILT_Y != null) output = replaceAll(output, /racketNormalTiltY:0\.1/g, `racketNormalTiltY:${params.ATTACK_TILT_Y}`, "attack racketNormalTiltY");
  if (params.ATTACK_SPEED_Y != null || params.ATTACK_SPEED_Z != null) {
    const attackY = params.ATTACK_SPEED_Y ?? -0.234;
    const attackZ = params.ATTACK_SPEED_Z ?? -1;
    output = replaceAll(output, /techniqueVel:\{x:0, y:-0\.234, z:-1\}/g, `techniqueVel:{x:0, y:${attackY}, z:${attackZ}}`, "attack techniqueVel");
  }
  return output;
}

function replaceOnce(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not override ${label}.`);
  return source.replace(pattern, replacement);
}

function replaceAll(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length < 2) throw new Error(`Expected two ${label} entries, found ${matches ? matches.length : 0}.`);
  return source.replace(pattern, replacement);
}

function buildServeCache(engine, presets) {
  const cache = new Map();
  for (const preset of presets) {
    const pathValue = engine.extracted.simulateServe(preset);
    const hitIndex = engine.extracted.findHitIndex(pathValue);
    cache.set(preset.id, {preset, path: pathValue, hitIndex});
  }
  return cache;
}

function selectRepresentativeIds(presets) {
  const categories = [
    "contact_sidebackspin_left",
    "contact_sidebackspin_right",
    "contact_sidespin_left",
    "contact_sidespin_right",
    "contact_backspin",
    "contact_nospin",
  ];
  const selected = [];
  for (const category of categories) {
    const match = presets.find((preset) => preset.tags?.videoCategory === category);
    if (match) selected.push(match.id);
  }
  if (selected.length !== REPRESENTATIVE_COUNT) {
    throw new Error(`Could not find six representative categories; found ${selected.length}.`);
  }
  return selected;
}

function runMatrix({presets, serveCache, variants, table, runName, allDirectionsForNonSide, delays}) {
  const rows = [];
  const engineCache = new Map();
  for (const variant of variants) {
    for (const technique of variant.techniques) {
      for (const delayMs of delays) {
        for (const preset of presets) {
          const directions = directionsFor(preset, allDirectionsForNonSide);
          for (const direction of directions) {
            const directionKey = direction || "none";
            const engineKey = `${variant.key}|${technique}`;
            let engine = engineCache.get(engineKey);
            if (!engine) {
              engine = createEngine(variant);
              engineCache.set(engineKey, engine);
            }
            engine.directionState.value = direction;
            rows.push(runOne({engine, variant, technique, delayMs, direction, preset, serveCache, table, runName}));
          }
        }
      }
    }
  }
  return rows;
}

function directionsFor(preset, allDirectionsForNonSide) {
  const isSide = String(preset.tags?.spinType || "").includes("side");
  if (isSide || allDirectionsForNonSide) return [null, "left", "right"];
  return [null];
}

function runOne({engine, variant, technique, delayMs, direction, preset, serveCache, table, runName}) {
  const serve = serveCache.get(preset.id);
  const contactIndex = contactIndexForDelay(serve.hitIndex, delayMs, serve.path.points.length);
  const point = serve.path.points[contactIndex];
  const incomingVel = serve.path.velocities[contactIndex];
  const incomingSpin = serve.path.spins[contactIndex];
  const techniqueKey = technique === "attack"
    ? (point && point.x < 0 ? "backhand_attack" : "forehand_attack")
    : "push";
  const tech = clone(engine.extracted.TECHNIQUES[techniqueKey]);
  const gravity = preset.solve?.gravity ?? -4.2;
  const finiteContact = isFiniteObject(point) && isFiniteObject(incomingVel) && isFiniteObject(incomingSpin);

  let result = null;
  let returnHit = null;
  let error = null;
  if (finiteContact) {
    try {
      returnHit = engine.extracted.makeRacketReturnVelocity(incomingVel, incomingSpin, tech, point, gravity);
      result = engine.extracted.simulatePath(point, returnHit.vel, {
        gravity,
        spin: returnHit.spin,
        spin3d: returnHit.spin3d,
        bounceBoost: tech.bounceBoost ?? 0,
      });
    } catch (caught) {
      error = caught.message;
    }
  }

  const metrics = result ? summarizeReturn(result, table) : null;
  return {
    run: runName,
    variant: variant.key,
    variantLabel: variant.label,
    params: variant.params,
    technique,
    techniqueKey,
    delayMs,
    direction: direction || "none",
    presetId: preset.id,
    tags: preset.tags,
    contact: {
      index: contactIndex,
      timeSec: contactIndex * DT,
      point,
      incomingVel,
      incomingSpin,
      finite: finiteContact,
    },
    returnHit: returnHit ? {
      vel: returnHit.vel,
      spin: returnHit.spin,
      spin3d: returnHit.spin3d || null,
      finite: isFiniteObject(returnHit.vel) && isFiniteObject(returnHit.spin),
    } : null,
    metrics,
    error,
  };
}

function contactIndexForDelay(baseHitIndex, delayMs, pointCount) {
  const baselineOffset = Math.round((DEPLOYED_DELAY_MS / 1000) / DT);
  const candidateOffset = Math.round((delayMs / 1000) / DT);
  return clamp(baseHitIndex - baselineOffset + candidateOffset, 0, Math.max(0, pointCount - 1));
}

function summarizeReturn(result, table) {
  const firstLanding = result.firstLanding || null;
  const netClearance = result.netY == null ? null : result.netY - (table.height + table.net);
  const onOpponentTable = !!firstLanding && firstLanding.z < 0 &&
    Math.abs(firstLanding.x) <= table.width / 2 && Math.abs(firstLanding.z) <= table.length / 2;
  const onOwnTable = !!firstLanding && firstLanding.z > 0 &&
    Math.abs(firstLanding.x) <= table.width / 2 && Math.abs(firstLanding.z) <= table.length / 2;
  let outcome = "out_or_no_landing";
  if (netClearance != null && netClearance < 0) outcome = "net";
  else if (onOpponentTable) outcome = "success";
  else if (onOwnTable) outcome = "own_table";

  const allFinite = isFiniteObject(result.points) && isFiniteObject(result.velocities) && isFiniteObject(result.spins);
  const maxHeight = result.points.reduce((max, point) => Math.max(max, point.y), -Infinity);
  const lastPoint = result.points[result.points.length - 1] || null;
  return {
    finite: allFinite,
    outcome,
    success: outcome === "success",
    netClearance,
    firstLanding,
    groundLanding: result.groundLanding || null,
    landingX: firstLanding?.x ?? result.groundLanding?.x ?? null,
    landingZ: firstLanding?.z ?? result.groundLanding?.z ?? null,
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : null,
    flightTimeSec: result.points.length > 0 ? (result.points.length - 1) * DT : null,
    pointCount: result.points.length,
    bounceCount: result.bounces.length,
    lastPoint,
  };
}

function summarizeServeBaseline(serveCache, table) {
  const rows = [];
  for (const {preset, path: pathValue, hitIndex} of serveCache.values()) {
    const bounces = pathValue.bounces || [];
    const legal = !pathValue.netHit && bounces.length >= 2 &&
      bounces[0].z < 0 && bounces[1].z > 0 &&
      Math.abs(bounces[0].x) <= table.width / 2 && Math.abs(bounces[1].x) <= table.width / 2 &&
      Math.abs(bounces[0].z) <= table.length / 2 && Math.abs(bounces[1].z) <= table.length / 2;
    rows.push({
      presetId: preset.id,
      videoId: preset.tags?.videoId || null,
      spinType: preset.tags?.spinType || null,
      legal,
      hitIndex,
      firstBounce: bounces[0] || null,
      secondBounce: bounces[1] || null,
      netY: pathValue.netY,
      netHit: !!pathValue.netHit,
    });
  }
  return {
    count: rows.length,
    legalCount: rows.filter((row) => row.legal).length,
    rows,
  };
}

function buildSummary(raw) {
  const lines = [];
  lines.push("# Game 5 47-Serve Parameter Calibration Summary");
  lines.push("");
  lines.push(`Generated: ${raw.metadata.generatedAt}`);
  lines.push(`Source SHA-256: \`${raw.metadata.sourceSha256}\``);
  lines.push(`Preset SHA-256: \`${raw.metadata.presetsSha256}\``);
  lines.push(`Red-line files modified: **${raw.metadata.redLineFilesModified ? "yes" : "no"}**`);
  lines.push(`Concurrent input mutation detected: **${raw.metadata.concurrentInputMutation ? "yes" : "no"}**`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("This is isolated calibration evidence. It measures the current Game 5 return model against the existing 47 generated serve presets; it is not a claim that the presets or the contact model are fully physically calibrated.");
  lines.push("");
  lines.push(`- Serve baseline: ${raw.serveBaseline.legalCount}/${raw.serveBaseline.count} legal by the local geometric gate.`);
  lines.push(`- Representative set: ${raw.metadata.representativeIds.join(", ")}.`);
  lines.push(`- Holdout set: ${raw.metadata.holdoutCount} presets.`);
  lines.push(`- Rows collected: ${raw.rows.length}.`);
  lines.push("");
  lines.push("## Matrix summary");
  lines.push("");
  lines.push("| Run | Variant | Technique | Rows | Finite | Success | Net | Own table | Out/no landing | Mean net clearance |");
  lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const summary of groupRows(raw.rows)) {
    lines.push(`| ${summary.run} | ${summary.variant} | ${summary.technique} | ${summary.rows} | ${summary.finite} | ${summary.success} | ${summary.net} | ${summary.ownTable} | ${summary.out} | ${formatNumber(summary.meanNetClearance)} |`);
  }
  lines.push("");
  lines.push("## Candidate reading");
  lines.push("");
  lines.push("The leaderboard below is descriptive only. It does not automatically select a production parameter, because direction semantics, visual trajectory, player feel, and attack/push technique validity still require separate review.");
  lines.push("");
  for (const technique of ["push", "attack"]) {
    lines.push(`### ${technique}`);
    lines.push("");
    lines.push("| Variant | Rows | Finite | Success | Success rate | Mean |landing x| |");
    lines.push("|---|---:|---:|---:|---:|---:|");
    for (const entry of leaderboard(raw.rows.filter((row) => row.run === "coarse-representative-6" && row.technique === technique), 5)) {
      lines.push(`| ${entry.variantLabel} | ${entry.rows} | ${entry.finite} | ${entry.success} | ${formatNumber(entry.success / Math.max(1, entry.rows))} | ${formatNumber(entry.meanAbsLandingX)} |`);
    }
    lines.push("");
  }
  lines.push("## Interpretation rules");
  lines.push("");
  lines.push("- Do not promote a candidate from the six representative balls alone; use the holdout rows and manual trajectory review.");
  lines.push("- `SIDESPIN_COMPENSATION_C` was already calibrated only for push/chop. Attack rows are sensitivity evidence, not an approved attack calibration.");
  lines.push("- A stale snapshot or an expected-model change is not a calibration success.");
  lines.push("- If a candidate needs a shared-core or preset-data edit, stop this prototype and hand off the proposed red-line change separately.");
  lines.push("");
  return lines.join("\n");
}

function buildAttackNarrowSummary(raw, candidates) {
  const lines = [];
  lines.push("# Game 5 Attack Narrow Calibration Summary");
  lines.push("");
  lines.push(`Generated: ${raw.metadata.generatedAt}`);
  lines.push(`Source SHA-256: \`${raw.metadata.sourceSha256}\``);
  lines.push(`Preset SHA-256: \`${raw.metadata.presetsSha256}\``);
  lines.push(`Red-line files modified: **${raw.metadata.redLineFilesModified ? "yes" : "no"}**`);
  lines.push(`Concurrent input mutation detected: **${raw.metadata.concurrentInputMutation ? "yes" : "no"}**`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("This is an isolated attack sensitivity experiment over the existing 47 serve presets. It compares vertical attack technique velocity and contact timing; it is not a production parameter recommendation or a physical-truth claim.");
  lines.push("");
  lines.push(`- Serve baseline: ${raw.serveBaseline.legalCount}/${raw.serveBaseline.count} legal by the local geometric gate.`);
  lines.push(`- Representative set: ${raw.metadata.representativeIds.join(", ")}.`);
  lines.push(`- Holdout set: ${raw.metadata.holdoutCount} presets.`);
  lines.push(`- Rows collected: ${raw.rows.length}.`);
  lines.push("");
  lines.push("## Representative sweep");
  lines.push("");
  lines.push("| Variant | Delay | Rows | Finite | Success | Net | Own table | Out/no landing | Mean net clearance |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const summary of groupAttackRows(raw.rows.filter((row) => row.run === "attack-narrow-representative-6"))) {
    lines.push(`| ${summary.variant} | ${summary.delayMs} | ${summary.rows} | ${summary.finite} | ${summary.success} | ${summary.net} | ${summary.ownTable} | ${summary.out} | ${formatNumber(summary.meanNetClearance)} |`);
  }
  lines.push("");
  lines.push("## Holdout candidates");
  lines.push("");
  lines.push("The top three representative candidates were replayed against the 41-ball holdout. The ranking is only a screening heuristic: success rate is favored, with small penalties for net and out/no-landing outcomes.");
  lines.push("");
  lines.push("| Candidate | Representative score | Holdout rows | Finite | Success | Net | Own table | Out/no landing | Mean |landing x| |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const candidate of candidates) {
    const holdoutRows = raw.rows.filter((row) => row.run === "attack-narrow-holdout-41" && row.variant === candidate.variant.key);
    const metrics = holdoutRows.map((row) => row.metrics).filter(Boolean);
    lines.push(`| ${candidate.variant.label} | ${formatNumber(candidate.score)} | ${holdoutRows.length} | ${metrics.filter((metric) => metric.finite).length} | ${metrics.filter((metric) => metric.success).length} | ${metrics.filter((metric) => metric.outcome === "net").length} | ${metrics.filter((metric) => metric.outcome === "own_table").length} | ${metrics.filter((metric) => metric.outcome === "out_or_no_landing").length} | ${formatNumber(mean(metrics.map((metric) => Math.abs(metric.landingX)).filter(Number.isFinite)))} |`);
  }
  lines.push("");
  lines.push("## Decision");
  lines.push("");
  lines.push("Do not automatically promote an attack candidate into `game5.html`. Use the holdout result to choose a small set for visual trajectory and player-feel review; direction coupling and racket-normal tuning remain separate calibration questions.");
  lines.push("");
  return lines.join("\n");
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.run}|${row.variant}|${row.technique}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [run, variant, technique] = key.split("|");
    const metrics = group.map((row) => row.metrics).filter(Boolean);
    return {
      run,
      variant,
      technique,
      rows: group.length,
      finite: metrics.filter((metric) => metric.finite).length,
      success: metrics.filter((metric) => metric.success).length,
      net: metrics.filter((metric) => metric.outcome === "net").length,
      ownTable: metrics.filter((metric) => metric.outcome === "own_table").length,
      out: metrics.filter((metric) => metric.outcome === "out_or_no_landing").length,
      meanNetClearance: mean(metrics.map((metric) => metric.netClearance).filter(Number.isFinite)),
    };
  }).sort((a, b) => `${a.run}|${a.variant}|${a.technique}`.localeCompare(`${b.run}|${b.variant}|${b.technique}`));
}

function groupAttackRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.variant}|${row.delayMs}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [variant, delayMs] = key.split("|");
    const metrics = group.map((row) => row.metrics).filter(Boolean);
    return {
      variant,
      delayMs,
      rows: group.length,
      finite: metrics.filter((metric) => metric.finite).length,
      success: metrics.filter((metric) => metric.success).length,
      net: metrics.filter((metric) => metric.outcome === "net").length,
      ownTable: metrics.filter((metric) => metric.outcome === "own_table").length,
      out: metrics.filter((metric) => metric.outcome === "out_or_no_landing").length,
      meanNetClearance: mean(metrics.map((metric) => metric.netClearance).filter(Number.isFinite)),
    };
  }).sort((a, b) => (a.delayMs - b.delayMs) || a.variant.localeCompare(b.variant));
}

function leaderboard(rows, limit) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.variant)) groups.set(row.variant, []);
    groups.get(row.variant).push(row);
  }
  return [...groups.entries()].map(([variant, group]) => {
    const metrics = group.map((row) => row.metrics).filter(Boolean);
    return {
      variantLabel: group[0].variantLabel,
      rows: group.length,
      finite: metrics.filter((metric) => metric.finite).length,
      success: metrics.filter((metric) => metric.success).length,
      meanAbsLandingX: mean(metrics.map((metric) => Math.abs(metric.landingX)).filter(Number.isFinite)),
    };
  }).sort((a, b) => (b.success - a.success) || (b.finite - a.finite) || (a.meanAbsLandingX - b.meanAbsLandingX)).slice(0, limit);
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "n/a";
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isFiniteObject(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.every(isFiniteObject);
  return Object.values(value).every(isFiniteObject);
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
