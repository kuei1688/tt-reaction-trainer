#!/usr/bin/env node

// Read-only Game 5 MVP readiness gate.
//
// This validator reads product data and extracts selected Game 5 symbols for
// deterministic checks. It never writes videos.json, physics-presets.json, or
// any product HTML. Reports are the only generated files.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {loadGame4Physics} = require("../load-game4-physics.js");
const {evaluateServeSuccess} = require("../serve-success-gate.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const GAME5_PATH = path.join(ROOT_DIR, "game5.html");
const VIDEOS_PATH = path.join(ROOT_DIR, "videos.json");
const PRESETS_PATH = path.join(ROOT_DIR, "physics-presets.json");

const EXPECTED_VIDEO_COUNT = 47;
const EXPECTED_PURE_SIDESPIN_COUNT = 22;
const SIDE_RULES = {
  contact_sidebackspin_left: {sideName: "left", curveDirection: "right", sign: -1},
  contact_sidebackspin_right: {sideName: "right", curveDirection: "left", sign: 1},
  contact_sidespin_left: {sideName: "left", curveDirection: "right", sign: -1},
  contact_sidespin_right: {sideName: "right", curveDirection: "left", sign: 1},
};
const NON_SIDE_CATEGORIES = new Set(["contact_backspin", "contact_nospin"]);
const REPRESENTATIVE_CATEGORIES = [
  "contact_sidebackspin_left",
  "contact_sidebackspin_right",
  "contact_sidespin_left",
  "contact_sidespin_right",
  "contact_backspin",
  "contact_nospin",
];

const SERVE_SYMBOLS = [
  "simulateServe",
  "solveBaseVelocity",
  "solveServeBounceVelocity",
  "makeServeAimCandidate",
  "serveBounceScore",
  "getServeLengthProfile",
  "getServeBounces",
  "solveVelocity",
  "simulatePath",
  "findHitIndex",
  "findPushHitIndex",
];
const CONTACT_SYMBOLS = [
  "makeRacketReturnVelocity",
  "TECHNIQUES",
  "computeAdaptivePushLift",
  "computeAdaptivePushDrive",
  "computeAdaptivePushTiltX",
  "computeAdaptivePushTiltY",
  "computeRacketNormal",
  "applyExecutionVariance",
  "speedScaledTechniqueVel",
  "dynamicPaddleEpsilon",
  "solveRacketVelXForTargetLandingX",
  "applyPushContact",
  "bounceOffPlaneSubstepped",
  "computeBlendedNormal",
  "speedDependentSpongeDampingRatio",
];

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report-dir") {
      options.reportDir = argv[++i];
    } else if (arg === "--date") {
      options.date = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node tools/game5-mvp-validation.test.js [--report-dir <dir>] [--date YYYY-MM-DD]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function finiteTree(value, pathName = "value", issues = []) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) issues.push(pathName);
    return issues;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => finiteTree(item, `${pathName}[${index}]`, issues));
    return issues;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => finiteTree(item, `${pathName}.${key}`, issues));
  }
  return issues;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compactPoint(point) {
  if (!point) return null;
  return {
    x: Number(point.x?.toFixed?.(6) ?? point.x),
    y: Number(point.y?.toFixed?.(6) ?? point.y),
    z: Number(point.z?.toFixed?.(6) ?? point.z),
    t: point.t == null ? undefined : Number(point.t.toFixed(6)),
  };
}

function sourceHas(source, fragment) {
  return source.includes(fragment);
}

function makeCheck(id, classification, fn) {
  try {
    const result = fn();
    return {
      id,
      classification,
      status: result.status || "pass",
      blocking: result.blocking ?? result.status === "fail",
      message: result.message || "ok",
      evidence: result.evidence || {},
    };
  } catch (error) {
    return {
      id,
      classification,
      status: "fail",
      blocking: true,
      message: error.message,
      evidence: {error: String(error.stack || error)},
    };
  }
}

function checkDataContract(videos, presets) {
  const approvedVideos = videos.filter(video => video.kind === "video" && video.reviewStatus === "approved");
  const presetByVideoId = new Map();
  const duplicatePresetVideoIds = [];
  for (const preset of presets) {
    const videoId = preset.tags?.videoId;
    if (videoId && presetByVideoId.has(videoId)) duplicatePresetVideoIds.push(videoId);
    if (videoId) presetByVideoId.set(videoId, preset);
  }
  const missing = approvedVideos.filter(video => !presetByVideoId.has(video.id)).map(video => video.id);
  const orphan = presets
    .map(preset => preset.tags?.videoId)
    .filter(videoId => videoId && !approvedVideos.some(video => video.id === videoId));
  const duplicateVideos = approvedVideos
    .map(video => video.id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  const missingFiles = approvedVideos
    .filter(video => !fs.existsSync(path.join(ROOT_DIR, video.src)))
    .map(video => video.src);
  const tagMismatches = [];
  for (const video of approvedVideos) {
    const preset = presetByVideoId.get(video.id);
    if (!preset) continue;
    if (preset.tags.videoCategory !== video.spinType) tagMismatches.push(`${video.id}:videoCategory`);
    if (preset.tags.videoId !== video.id) tagMismatches.push(`${video.id}:videoId`);
  }
  const pass = approvedVideos.length === EXPECTED_VIDEO_COUNT &&
    presets.length === EXPECTED_VIDEO_COUNT &&
    missing.length === 0 && orphan.length === 0 &&
    duplicatePresetVideoIds.length === 0 && duplicateVideos.length === 0 &&
    missingFiles.length === 0 && tagMismatches.length === 0;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? `${approvedVideos.length} approved videos map 1:1 to ${presets.length} presets` : "approved video / preset mapping is incomplete",
    evidence: {
      approvedVideoCount: approvedVideos.length,
      presetCount: presets.length,
      missing,
      orphan,
      duplicatePresetVideoIds,
      duplicateVideos,
      missingFiles,
      tagMismatches,
      byCategory: Object.fromEntries([...new Set(approvedVideos.map(video => video.spinType))].map(category => [
        category,
        approvedVideos.filter(video => video.spinType === category).length,
      ])),
    },
  };
}

function checkContactMetadata(videos) {
  const approvedVideos = videos.filter(video => video.kind === "video" && video.reviewStatus === "approved");
  const invalid = approvedVideos.filter(video =>
    !Number.isFinite(video.contact_time_sec) ||
    video.contact_time_sec < 0 ||
    video.contact_time_sec > 10
  ).map(video => ({id: video.id, contact_time_sec: video.contact_time_sec}));
  const missingSchema = approvedVideos.filter(video =>
    typeof video.id !== "string" ||
    typeof video.src !== "string" ||
    typeof video.spinType !== "string"
  ).map(video => video.id || "<missing-id>");
  const pass = invalid.length === 0 && missingSchema.length === 0;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? `${approvedVideos.length} approved videos have finite contact metadata` : "contact metadata has invalid or missing fields",
    evidence: {approvedVideoCount: approvedVideos.length, invalid, missingSchema},
  };
}

function checkDirectionContract(videos, presets, source) {
  const approvedVideos = videos.filter(video => video.kind === "video" && video.reviewStatus === "approved");
  const presetByVideoId = new Map(presets.map(preset => [preset.tags?.videoId, preset]));
  const errors = [];
  const categoryCounts = {};
  for (const video of approvedVideos) {
    categoryCounts[video.spinType] = (categoryCounts[video.spinType] || 0) + 1;
    const preset = presetByVideoId.get(video.id);
    const rule = SIDE_RULES[video.spinType];
    if (!preset) continue;
    if (rule) {
      if (preset.tags.sideName !== rule.sideName) errors.push(`${video.id}:sideName`);
      if (preset.tags.curveDirection !== rule.curveDirection) errors.push(`${video.id}:curveDirection`);
      if (Math.sign(preset.variation?.spin?.sidespin || 0) !== rule.sign) errors.push(`${video.id}:legacy-sign`);
      if (preset.variation?.spin3d?.omega?.y !== (rule.sideName === "left" ? Math.abs(preset.variation.spin.sidespin) : -Math.abs(preset.variation.spin.sidespin))) {
        errors.push(`${video.id}:omega-y`);
      }
    } else if (NON_SIDE_CATEGORIES.has(video.spinType)) {
      if (preset.tags.sideName !== null || preset.tags.curveDirection !== "none") errors.push(`${video.id}:non-side-tags`);
      if (preset.variation?.spin3d?.omega?.y !== 0 || Object.prototype.hasOwnProperty.call(preset.variation?.spin3d || {}, "axialSpin")) {
        errors.push(`${video.id}:non-side-spin3d`);
      }
    }
  }
  const pureSideCount = (categoryCounts.contact_sidespin_left || 0) + (categoryCounts.contact_sidespin_right || 0);
  const sourceContract = [
    "const DIRECTION_LABEL = {left:'向左修正', right:'向右修正'}",
    "selectedDirectionInput === 'left' ? -1 : 1",
    "GESTURE_DIR_PX = 24",
    "pointermove",
  ].every(fragment => sourceHas(source, fragment));
  const pass = errors.length === 0 && pureSideCount === EXPECTED_PURE_SIDESPIN_COUNT && sourceContract;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? `${pureSideCount} pure sidespin videos preserve the direction contract` : "direction contract mismatch",
    evidence: {categoryCounts, pureSideCount, errors, sourceContract},
  };
}

function checkPhysicsReplay(presets, runtime) {
  const results = [];
  const byId = new Map();
  const representativeIds = [];
  for (const category of REPRESENTATIVE_CATEGORIES) {
    const preset = presets.find(item => item.tags?.videoCategory === category);
    if (preset) representativeIds.push(preset.tags.videoId);
  }
  const representativeSet = new Set(representativeIds);
  for (const preset of presets) {
    const result = runtime.simulateServe(preset);
    const finiteIssues = finiteTree(result, "serve");
    const legal = evaluateServeSuccess(result);
    const record = {
      id: preset.tags?.videoId || preset.id,
      finite: finiteIssues.length === 0,
      legalServe: legal.pass,
      legalReasons: legal.reasons,
      points: result.points.length,
      bounceCount: result.bounces.length,
      firstBounce: compactPoint(legal.firstBounce),
      secondBounce: compactPoint(legal.secondBounce),
      netClearance: result.netY == null ? null : Number((result.netY - 0.9125).toFixed(6)),
      finiteIssues: finiteIssues.slice(0, 8),
    };
    if (representativeSet.has(record.id)) {
      const replay = runtime.simulateServe(preset);
      record.deterministic = JSON.stringify(result) === JSON.stringify(replay);
    }
    results.push(record);
    byId.set(record.id, record);
  }
  const failures = results.filter(record => !record.finite || !record.legalServe || record.deterministic === false);
  const pass = failures.length === 0 && representativeIds.length === REPRESENTATIVE_CATEGORIES.length;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? `${results.length}/${results.length} serves are finite and legal; ${representativeIds.length} representative replays are deterministic` : "serve replay contains a finite, legal-serve, or determinism failure",
    evidence: {representativeIds, failures, serveResults: results},
    byId,
  };
}

function checkTechniqueSplit(source, presets, serveResults, serveRuntime, loader) {
  const representativeIds = REPRESENTATIVE_CATEGORIES.map(category =>
    presets.find(preset => preset.tags?.videoCategory === category)?.tags?.videoId
  ).filter(Boolean);
  const contactEvidence = [];
  const contactFailures = [];
  const contactRuntimes = {
    none: loader.instantiateGame4Symbols(CONTACT_SYMBOLS, {selectedDirectionInput: null}),
    left: loader.instantiateGame4Symbols(CONTACT_SYMBOLS, {selectedDirectionInput: "left"}),
    right: loader.instantiateGame4Symbols(CONTACT_SYMBOLS, {selectedDirectionInput: "right"}),
  };
  for (const id of representativeIds) {
    const preset = presets.find(item => item.tags?.videoId === id);
    const serveById = new Map((serveResults.evidence?.serveResults || []).map(record => [record.id, record]));
    const serve = serveById.get(id);
    if (!preset || !serve) continue;
    const pathResult = serveRuntime.simulateServe(preset);
    for (const techniqueName of ["push", "attack"]) {
      const hitIndex = techniqueName === "push"
        ? serveRuntime.findPushHitIndex(pathResult)
        : serveRuntime.findHitIndex(pathResult);
      const point = pathResult.points[hitIndex];
      const velocity = pathResult.velocities[hitIndex];
      const spin = pathResult.spins[hitIndex];
      const direction = SIDE_RULES[preset.tags.videoCategory]?.sideName || null;
      const runtime = contactRuntimes[direction || "none"];
      const techKey = techniqueName === "push"
        ? "push"
        : (preset.tags.placement === "backhand" ? "backhand_attack" : "forehand_attack");
      const output = runtime.makeRacketReturnVelocity(
        velocity,
        spin,
        clone(runtime.TECHNIQUES[techKey]),
        point,
        preset.solve?.gravity ?? -4.2
      );
      const finiteIssues = finiteTree(output, "return");
      let returnPathIssues = [];
      if (finiteIssues.length === 0) {
        const returned = serveRuntime.simulatePath(point, output.vel, {
          gravity: preset.solve?.gravity ?? -4.2,
          spin: output.spin,
        });
        returnPathIssues = finiteTree(returned, "returnPath");
      }
      const record = {
        videoId: id,
        technique: techniqueName,
        direction,
        hitIndex,
        finite: finiteIssues.length === 0 && returnPathIssues.length === 0,
        finiteIssues: [...finiteIssues, ...returnPathIssues].slice(0, 8),
      };
      contactEvidence.push(record);
      if (!record.finite) contactFailures.push(record);
    }
  }
  const compensationMatch = source.match(/const SIDESPIN_COMPENSATION_C\s*=\s*([0-9.]+)/);
  const currentCompensationC = compensationMatch ? Number(compensationMatch[1]) : null;
  const splitContract = sourceHas(source, "const blend = tech.model === 'push' ? PADDLE_BLEND : 0") &&
    currentCompensationC === 2.9;
  const attackWarning = source.includes("controlled approximation") &&
    source.includes("側旋補償尚未專屬校準");
  const compensationIsPushOnly = /if\(tech\.model === 'push' && selectedDirectionInput/.test(source);
  const pass = contactFailures.length === 0 && splitContract && compensationIsPushOnly;
  return {
    status: pass ? (attackWarning ? "pass-with-warning" : "pass") : "fail",
    blocking: !pass,
    message: pass
      ? "push/chop uses the calibrated compensation path; attack remains explicitly marked as an approximation"
      : "push/chop and attack compensation scope is not safely separated",
    evidence: {
      splitContract,
      currentCompensationC,
      compensationIsPushOnly,
      attackWarning,
      contactFailures,
      contactEvidence,
      warning: attackWarning ? "attack side-spin compensation has no dedicated calibration sweep" : null,
    },
  };
}

function checkTiming(source) {
  const delayMatch = source.match(/const SWING_DELAY_MS\s*=\s*(\d+)/);
  const delayMs = delayMatch ? Number(delayMatch[1]) : null;
  const requiredFragments = [
    "const delayMs = AUTO_BEST_TIMING ? 0 : SWING_DELAY_MS / GAME_SPEED",
    "fireAt:performance.now() + delayMs",
    "DIFFICULTY_MODE === 'beginner'",
    "whiffedEarly = true",
    "出手太晚",
  ];
  const missing = requiredFragments.filter(fragment => !sourceHas(source, fragment));
  const synthetic = delayMs == null ? [] : [
    {case: "early", fireAt: delayMs, contactAt: 0, outcome: "wait-or-whiff depending on difficulty"},
    {case: "in-window", fireAt: delayMs, contactAt: delayMs, outcome: "single contact"},
    {case: "late", fireAt: delayMs, contactAt: delayMs + 1, outcome: "late/missed path"},
  ];
  const pass = delayMs === 100 && missing.length === 0;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? "100 ms swing delay is encoded with early/in-window/late branches" : "swing-delay contract is incomplete",
    evidence: {delayMs, missing, syntheticCases: synthetic},
  };
}

function checkHandoff(source) {
  const requiredFragments = [
    "Number.isFinite(videoEntry && videoEntry.contact_time_sec)",
    "duration * VIDEO_CONTACT_FRACTION_GUESS",
    "videoExperiment.start('C3'",
    "frame.classList.add('exiting')",
    "onHandoff();",
    "videoFrame",
  ];
  const missing = requiredFragments.filter(fragment => !sourceHas(source, fragment));
  const metadataIndex = source.indexOf("Number.isFinite(videoEntry && videoEntry.contact_time_sec)");
  const fallbackIndex = source.indexOf("duration * VIDEO_CONTACT_FRACTION_GUESS");
  const handoffIndex = source.indexOf("onHandoff();", metadataIndex);
  const fadeIndex = source.lastIndexOf("frame.classList.add('exiting')", handoffIndex);
  const pass = missing.length === 0 && metadataIndex >= 0 && fallbackIndex > metadataIndex && handoffIndex > metadataIndex && fadeIndex > metadataIndex && fadeIndex < handoffIndex;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? "C3 handoff consumes contact_time_sec with explicit fallback and fades the video before removal" : "video-to-physics handoff contract is incomplete",
    evidence: {missing, metadataIndex, fallbackIndex, fadeIndex, handoffIndex},
  };
}

function checkSafety(source, physicsResult) {
  const requiredFragments = [
    "if(!presets.length) return;",
    "if(round){",
    "play().catch(fallback)",
    "Number.isFinite",
    "setPhase('result')",
  ];
  const missing = requiredFragments.filter(fragment => !sourceHas(source, fragment));
  const runtimeFailures = physicsResult.evidence.failures.filter(failure => !failure.finite).map(failure => failure.id);
  const pass = missing.length === 0 && runtimeFailures.length === 0;
  return {
    status: pass ? "pass" : "fail",
    message: pass ? "missing-load and finite-value safeguards are present; all replay outputs are finite" : "runtime safety safeguards are incomplete",
    evidence: {missing, runtimeFailures},
  };
}

function buildSummary(report) {
  const pass = report.checks.filter(check => check.status === "pass").length;
  const warning = report.checks.filter(check => check.status === "pass-with-warning" || check.status === "warning").length;
  const fail = report.checks.filter(check => check.status === "fail").length;
  const lines = [
    "# Game 5 MVP validation summary",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: \`game5.html\` (build ${report.buildVersion})`,
    "",
    `Automated checks: ${pass} pass, ${warning} pass-with-warning, ${fail} fail`,
    "",
    "| ID | Classification | Status | Blocking | Message |",
    "|---|---|---|---|---|",
    ...report.checks.map(check => `| ${check.id} | ${check.classification} | ${check.status} | ${check.blocking ? "yes" : "no"} | ${String(check.message).replaceAll("|", "\\|")} |`),
    "",
    "## Known baseline classifications",
    "",
    "- `expected-model-change`: existing VAL-004 Stage4a snapshot mismatch caused by the current `PADDLE_BLEND`/fallback model, not changed in this gate.",
    "- `serve-target-diagnostic`: individual target-precision rows may fail while the shared legal-serve gate and cross-check remain 47/47.",
    "- This report is product-readiness evidence, not a claim of calibrated physical truth or completion of TODO-009.",
    "",
    "## Manual evidence",
    "",
    "See `manual-check-matrix.md`; pending rows are not treated as a pass until the browser check is completed.",
    "",
  ];
  return lines.join("\n");
}

function buildManualMatrix(approvedVideos) {
  const rows = REPRESENTATIVE_CATEGORIES.map(category => {
    const video = approvedVideos.find(item => item.spinType === category);
    return `| ${video?.id || "<missing>"} | ${category} | pending | push + attack | pending | pending | pending | pending |`;
  });
  return [
    "# Game 5 mobile manual-check matrix",
    "",
    "Viewport target: approximately 360 CSS px wide. Each row needs a real browser observation; `pending` is not a gate pass.",
    "",
    "| Video | Expected media direction | Observed media direction | Input | Handoff | Physics/result | Status | Notes |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "For each clip, record whether the camera view, curve direction, and player left/right gesture agree. Attack remains a controlled approximation until a dedicated calibration sweep exists.",
    "",
  ].join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const date = options.date || generatedAt.slice(0, 10);
  const reportDir = path.resolve(ROOT_DIR, options.reportDir || `AI_CONTEXT/game5_mvp_validation_${date}`);
  fs.mkdirSync(reportDir, {recursive: true});

  const source = fs.readFileSync(GAME5_PATH, "utf8");
  const videos = JSON.parse(fs.readFileSync(VIDEOS_PATH, "utf8"));
  const presets = JSON.parse(fs.readFileSync(PRESETS_PATH, "utf8")).serves;
  const buildVersion = source.match(/const BUILD_VERSION\s*=\s*['"]([^'"]+)/)?.[1] || "unknown";
  const approvedVideos = videos.filter(video => video.kind === "video" && video.reviewStatus === "approved");

  const loader = loadGame4Physics({sourceFile: GAME5_PATH});
  const serveRuntime = loader.instantiateGame4Symbols(SERVE_SYMBOLS);
  const checks = [];
  checks.push(makeCheck("DATA-01", "metadata-error", () => checkDataContract(videos, presets)));
  checks.push(makeCheck("DATA-02", "metadata-error", () => checkContactMetadata(videos)));
  checks.push(makeCheck("DIR-01", "direction-sign", () => checkDirectionContract(videos, presets, source)));
  const physicsCheck = makeCheck("PHYS-01", "canonical-physics", () => checkPhysicsReplay(presets, serveRuntime));
  checks.push(physicsCheck);
  const physicsResult = physicsCheck.status === "fail" ? {evidence: {failures: []}} : physicsCheck;
  checks.push(makeCheck("PHYS-02", "canonical-physics", () => checkTechniqueSplit(source, presets, physicsResult, serveRuntime, loader)));
  checks.push(makeCheck("TIME-01", "timing", () => checkTiming(source)));
  checks.push(makeCheck("HANDOFF-01", "handoff", () => checkHandoff(source)));
  checks.push(makeCheck("SAFETY-01", "finite-safety", () => checkSafety(source, physicsResult)));

  const report = {
    generatedAt,
    date,
    source: "game5.html",
    buildVersion,
    scope: "Game 5 MVP readiness automated gate; read-only product inspection",
    checks,
    gate: {
      automatedPass: checks.every(check => !check.blocking),
      manualReviewRequired: true,
      decision: "pending-manual-browser-check",
    },
    baseline: {
      serveGeneratorContract: "pass 47/47 (recorded before this validator)",
      serveLegalGate: "pass 47/47 in game4.html and physics-studio.html (individual target diagnostics separate)",
      physics3dSpin: "pass",
      batchValidation: "known expected-model-change at Stage4a snapshot; 13/14",
    },
  };

  fs.writeFileSync(path.join(reportDir, "raw-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportDir, "summary.md"), buildSummary(report));
  fs.writeFileSync(path.join(reportDir, "manual-check-matrix.md"), buildManualMatrix(approvedVideos));
  console.log(JSON.stringify({
    reportDir,
    automatedPass: report.gate.automatedPass,
    checks: checks.map(check => ({id: check.id, status: check.status, blocking: check.blocking})),
  }, null, 2));

  if (!report.gate.automatedPass) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
}
