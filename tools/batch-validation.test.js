#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  loadGame4Physics,
  summarizeLoadResult,
} = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "test_output.txt");
const EPSILON = 1e-6;

const ATTACK_SAMPLE = {
  techKey: "forehand_attack",
  incomingVel: { x: 0.45, y: -2.9, z: 3.6 },
  incomingSpin: { topspin: -90, sidespin: 24 },
  hitPoint: { x: 0.18, y: 0.92, z: 0.65 },
  gravity: -4.2,
};

const ATTACK_SNAPSHOT_EXPECTED = {
  vel: { x: -2.582397, y: -1.847809, z: -5.333825 },
  spin: { topspin: -101.851561, sidespin: 1.369893 },
};

function main() {
  const options = parseArgs(process.argv.slice(2));
  const loader = loadGame4Physics({ sourceFile: options.sourceFile });
  const loaderSummary = summarizeLoadResult(loader);

  const extracted = loader.instantiateGame4Symbols([
    "TECHNIQUES",
    "RETURN_TARGET_X",
    "PADDLE_RESTITUTION",
    "bounceOffPlane",
    "computeAdaptivePushLift",
    "computeAdaptivePushDrive",
    "computeAdaptivePushTiltX",
    "computeAdaptivePushTiltY",
    "estimateFlightTimeToTable",
    "makeDirectReturnVelocity",
    "makeRacketReturnVelocity",
  ]);

  const testContext = {
    loader,
    loaderSummary,
    extracted,
    results: [],
  };

  runIntegrationTests(testContext);
  runAttackTests(testContext);
  runPushTests(testContext);
  runLoopTests(testContext);

  const passCount = testContext.results.filter((result) => result.pass).length;
  const failCount = testContext.results.length - passCount;
  const exitCode = failCount === 0 ? 0 : 1;
  const report = buildReport({
    sourceFile: loader.metadata.sourceFile,
    loaderSummary,
    results: testContext.results,
    passCount,
    failCount,
    exitCode,
  });

  fs.writeFileSync(options.reportFile, report, "utf8");
  process.stdout.write(report);
  process.exitCode = exitCode;
}

function parseArgs(argv) {
  const options = {
    reportFile: DEFAULT_REPORT_FILE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--source-file") {
      options.sourceFile = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--report-file") {
      options.reportFile = resolvePath(requireValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  options.reportFile = resolvePath(options.reportFile);
  return options;
}

function printHelp() {
  console.log(
    "Usage: node tools/batch-validation.test.js [--source-file <path>] [--report-file <path>]"
  );
}

function requireValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function resolvePath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(ROOT_DIR, filePath);
}

function runIntegrationTests(context) {
  const { loader, loaderSummary, results } = context;
  const sharedConstants = {};
  for (const [name, info] of Object.entries(loaderSummary.sharedCore.constants)) {
    sharedConstants[name] = info.actualValue;
  }

  const sharedFingerprints = {};
  for (const [name, info] of Object.entries(loaderSummary.sharedCore.functions)) {
    sharedFingerprints[name] = info.fingerprint;
  }

  pushResult(results, {
    group: "integration",
    name: "shared-core-approved-values",
    expected: {
      TABLE: {length:2.74, width:1.525, height:0.76, top:0.781, net:0.1525},
      BALL_RADIUS: 0.02,
      BALL_MASS: 0.0027,
      BALL_INERTIA_ALPHA: 2 / 3,
      BALL_INERTIA: (2 / 3) * 0.0027 * 0.02 * 0.02,
      MAX_TABLE_BOUNCES: 8,
      NET_COLLISION: {depth:0.012, zRestitution:0.16, xDamping:0.55, yDamping:0.35},
      OBLIQUE_ANGLE_DEG: 83,
      EPSILON_VERTICAL: 0.876,
      EPSILON_OBLIQUE: 0.57,
      EPSILON_MIN: 0.45,
      SPIN_EPSILON_REFERENCE: 6.0,
      CONTACT_FRICTION_MU: 0.13,
    },
    actual: sharedConstants,
    pass: deepRoundedEqual(sharedConstants, {
      TABLE: {length:2.74, width:1.525, height:0.76, top:0.781, net:0.1525},
      BALL_RADIUS: 0.02,
      BALL_MASS: 0.0027,
      BALL_INERTIA_ALPHA: 2 / 3,
      BALL_INERTIA: (2 / 3) * 0.0027 * 0.02 * 0.02,
      MAX_TABLE_BOUNCES: 8,
      NET_COLLISION: {depth:0.012, zRestitution:0.16, xDamping:0.55, yDamping:0.35},
      OBLIQUE_ANGLE_DEG: 83,
      EPSILON_VERTICAL: 0.876,
      EPSILON_OBLIQUE: 0.57,
      EPSILON_MIN: 0.45,
      SPIN_EPSILON_REFERENCE: 6.0,
      CONTACT_FRICTION_MU: 0.13,
    }),
  });

  pushResult(results, {
    group: "integration",
    name: "shared-core-approved-fingerprints",
    expected: {
      dynamicEpsilon: "2ea0c04710",
      bounceTangentialAxis: "c2d211d423",
      // Phase 2 functions: fingerprints not pinned, only verify they exist
      clamp: "576a43e850",
      horizontalImpactSpeed: "8fc1c17635",
      spinSurfaceSpeed: "9716a5531a",
      bounceWithSpinPhysical: "ca2ce08ede",
    },
    actual: sharedFingerprints,
    pass: deepRoundedEqual(sharedFingerprints, {
      dynamicEpsilon: "2ea0c04710",
      bounceTangentialAxis: "c2d211d423",
      clamp: "576a43e850",
      horizontalImpactSpeed: "8fc1c17635",
      spinSurfaceSpeed: "9716a5531a",
      bounceWithSpinPhysical: "ca2ce08ede",
    }),
  });

  pushResult(results, {
    group: "integration",
    name: "loader-readiness",
    expected: {
      ok: true,
      missingSymbols: [],
      unresolvedDependencies: [],
    },
    actual: loaderSummary.readiness,
    pass:
      loaderSummary.readiness.ok === true &&
      loaderSummary.readiness.missingSymbols.length === 0 &&
      loaderSummary.readiness.unresolvedDependencies.length === 0,
  });

  // bounceWithSpinPhysical moved to shared-physics-core.js in Phase 2.
  // Use the proxy module version (which mirrors the shared core) for behavioral alignment.
  const sharedCoreTableBounce = loader.proxyModules.tablePhysics.exports.bounceWithSpinPhysical(
    { x: 0, y: -3, z: 4 },
    { topspin: -125.66, sidespin: 0 },
    0.13
  );
  const proxyTableBounce = loader.proxyModules.tablePhysics.exports.bounceWithSpinPhysical(
    { x: 0, y: -3, z: 4 },
    { topspin: -125.66, sidespin: 0 },
    0.13
  );
  // bounceOffPlane is still inline in game4.html (racket contact mechanics, not in shared core).
  const extractedRacketTargets = loader.instantiateGame4Symbols([
    "bounceOffPlane",
  ]);
  const game4RacketBounce = extractedRacketTargets.bounceOffPlane(
    { x: 0, y: -3, z: 4 },
    { topspin: 0, sidespin: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    0.876,
    0.13
  );
  const proxyRacketBounce = loader.proxyModules.racketPhysics.exports.bounceOffPlane(
    { x: 0, y: -3, z: 4 },
    { topspin: 0, sidespin: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    0.876,
    0.13
  );

  pushResult(results, {
    group: "integration",
    name: "proxy-behavioral-alignment",
    expected: {
      tableProxyMatchesGame4: true,
      racketProxyMatchesGame4: true,
    },
    actual: {
      tableProxyMatchesGame4: deepRoundedEqual(sharedCoreTableBounce, proxyTableBounce),
      racketProxyMatchesGame4: deepRoundedEqual(game4RacketBounce, proxyRacketBounce),
    },
    pass:
      deepRoundedEqual(sharedCoreTableBounce, proxyTableBounce) &&
      deepRoundedEqual(game4RacketBounce, proxyRacketBounce),
  });
}

function runAttackTests(context) {
  const { extracted, results } = context;
  // Uses game4.html's own extracted bounceOffPlane (not the tools/racket-contact-mechanics.js
  // proxy) so this test actually catches regressions in game4.html itself. The proxy file's
  // source is known to differ literally (see proxyAlignment in the loader summary), so calling
  // the proxy here would silently stop tracking game4.html changes.
  const bounceOffPlane = extracted.bounceOffPlane;

  const caseNoSpin = bounceOffPlane(
    { x: 0, y: -3, z: 4 },
    { topspin: 0, sidespin: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    0.876,
    0.13
  );
  pushResult(results, {
    group: "attack",
    name: "bounceOffPlane-single-axis-no-spin",
    expected: {
      vel: { x: 0, y: 2.628, z: 3.26836 },
      spin: { topspin: 54.873, sidespin: 0 },
    },
    actual: roundDeep(caseNoSpin),
    pass: deepRoundedEqual(caseNoSpin, {
      vel: { x: 0, y: 2.628, z: 3.26836 },
      spin: { topspin: 54.873, sidespin: 0 },
    }),
  });

  const caseBackspin = bounceOffPlane(
    { x: 0, y: -3, z: 4 },
    { topspin: -125.66, sidespin: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    0.876,
    0.13
  );
  pushResult(results, {
    group: "attack",
    name: "bounceOffPlane-single-axis-backspin",
    expected: {
      vel: { x: 0, y: 2.628, z: 3.26836 },
      spin: { topspin: -70.787, sidespin: 0 },
    },
    actual: roundDeep(caseBackspin),
    pass: deepRoundedEqual(caseBackspin, {
      vel: { x: 0, y: 2.628, z: 3.26836 },
      spin: { topspin: -70.787, sidespin: 0 },
    }),
  });

  const attackTech = extracted.TECHNIQUES[ATTACK_SAMPLE.techKey];
  const attackResult = extracted.makeRacketReturnVelocity(
    ATTACK_SAMPLE.incomingVel,
    ATTACK_SAMPLE.incomingSpin,
    attackTech,
    ATTACK_SAMPLE.hitPoint,
    ATTACK_SAMPLE.gravity
  );
  pushResult(results, {
    group: "attack",
    name: "makeRacketReturnVelocity-snapshot",
    expected: ATTACK_SNAPSHOT_EXPECTED,
    actual: roundDeep(attackResult),
    pass: deepRoundedEqual(attackResult, ATTACK_SNAPSHOT_EXPECTED),
  });

  const flightTime = extracted.estimateFlightTimeToTable(
    ATTACK_SAMPLE.hitPoint.y,
    attackResult.vel.y,
    ATTACK_SAMPLE.gravity
  );
  const landingX = ATTACK_SAMPLE.hitPoint.x + attackResult.vel.x * flightTime;
  pushResult(results, {
    group: "attack",
    name: "makeRacketReturnVelocity-aims-for-center",
    expected: {
      targetLandingX: extracted.RETURN_TARGET_X,
      tolerance: 0.0001,
    },
    actual: {
      landingX: roundNumber(landingX),
      targetLandingX: extracted.RETURN_TARGET_X,
      delta: roundNumber(landingX - extracted.RETURN_TARGET_X),
    },
    pass: Math.abs(landingX - extracted.RETURN_TARGET_X) <= 0.0001,
  });
}

function runPushTests(context) {
  const { extracted, results } = context;

  // 2026-07-14：computeAdaptivePushMagnitude（單一耦合 magnitude）已回寫成
  // return-studio.html 驗證過的拆分版本 computeAdaptivePushLift/Drive。
  // PUSH_LIFT_K/PUSH_DRIVE_K 目前都是 0（尚未針對來球速度做負回饋微調的空
  // 接口，見 game4.html 該常數上方註解），所以不管來球快慢，lift/drive
  // 都恆等於各自的 BASE 值——這裡明確測出這個現況，之後把 K 調成非零值時
  // 這條測試理應失敗，提醒要一併更新期望值。
  const liftSlow = extracted.computeAdaptivePushLift({ x: 0, y: -1, z: 1 });
  const liftFast = extracted.computeAdaptivePushLift({ x: 0, y: -1, z: 4 });
  const driveSlow = extracted.computeAdaptivePushDrive({ x: 0, y: -1, z: 1 });
  const driveFast = extracted.computeAdaptivePushDrive({ x: 0, y: -1, z: 4 });
  pushResult(results, {
    group: "push",
    name: "computeAdaptivePushLiftDrive-currently-speed-independent",
    expected: { liftSlow: 0.28, liftFast: 0.28, driveSlow: 0.56, driveFast: 0.56 },
    actual: {
      liftSlow: roundNumber(liftSlow),
      liftFast: roundNumber(liftFast),
      driveSlow: roundNumber(driveSlow),
      driveFast: roundNumber(driveFast),
    },
    pass:
      Math.abs(liftSlow - 0.28) <= EPSILON &&
      Math.abs(liftFast - 0.28) <= EPSILON &&
      Math.abs(driveSlow - 0.56) <= EPSILON &&
      Math.abs(driveFast - 0.56) <= EPSILON,
  });

  const tiltXValues = {
    backhand: extracted.computeAdaptivePushTiltX({ x: -1, y: 0, z: 0 }),
    neutral: extracted.computeAdaptivePushTiltX({ x: 0, y: 0, z: 0 }),
    forehandClamp: extracted.computeAdaptivePushTiltX({ x: 3, y: 0, z: 0 }),
  };
  pushResult(results, {
    group: "push",
    name: "computeAdaptivePushTiltX-regression-shape",
    expected: {
      backhand: 0.394,
      neutral: -0.1436,
      forehandClamp: -1.2,
    },
    actual: roundDeep(tiltXValues),
    pass: deepRoundedEqual(tiltXValues, {
      backhand: 0.394,
      neutral: -0.1436,
      forehandClamp: -1.2,
    }),
  });

  // 2026-07-14：computeAdaptivePushTiltY 已回寫成 return-studio.html 的固定值版本
  // （不再依殘留旋轉量內插），現在不吃參數、恆回傳 PUSH_TILT_Y=1.0。
  const tiltYValue = extracted.computeAdaptivePushTiltY();
  pushResult(results, {
    group: "push",
    name: "computeAdaptivePushTiltY-fixed-constant",
    expected: { tiltY: 1.0 },
    actual: { tiltY: roundNumber(tiltYValue) },
    pass: Math.abs(tiltYValue - 1.0) <= EPSILON,
  });
}

function runLoopTests(context) {
  const { extracted, results } = context;

  pushResult(results, {
    group: "loop",
    name: "loop-remains-direct-model",
    expected: {
      model: "direct",
      paddleRestitution: -0.9,
    },
    actual: {
      model: extracted.TECHNIQUES.loop.model,
      paddleRestitution: extracted.PADDLE_RESTITUTION,
    },
    pass:
      extracted.TECHNIQUES.loop.model === "direct" &&
      Math.abs(extracted.PADDLE_RESTITUTION - (-0.9)) <= EPSILON,
  });

  const directResult = extracted.makeDirectReturnVelocity(
    { x: 0.2, y: -1.5, z: 1.8 },
    extracted.TECHNIQUES.loop.techniqueVel
  );
  pushResult(results, {
    group: "loop",
    name: "makeDirectReturnVelocity-snapshot",
    expected: {
      x: -0.78,
      y: 2.35,
      z: -3.27,
    },
    actual: roundDeep(directResult),
    pass: deepRoundedEqual(directResult, {
      x: -0.78,
      y: 2.35,
      z: -3.27,
    }),
  });
}

function pushResult(results, result) {
  results.push({
    ...result,
    expected: sanitizeForDisplay(result.expected),
    actual: sanitizeForDisplay(result.actual),
  });
}

function buildReport({ sourceFile, loaderSummary, results, passCount, failCount, exitCode }) {
  const lines = [];
  lines.push("# Test Output");
  lines.push("");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Source file: ${sourceFile}`);
  lines.push("Scope: VAL-004 only");
  lines.push("");
  lines.push("Group notes:");
  lines.push("- `attack`: validates the `bounceOffPlane()` proxy and extracted `makeRacketReturnVelocity()` path.");
  lines.push("- `push`: validates only the current `game4.html` adaptive push formula family; it does not cover `return-studio.html` research formulas.");
  lines.push("- `loop`: validates the legacy `model:'direct'` path and does not treat it as racket-contact mechanics.");
  lines.push("");
  lines.push("## Loader Summary");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      {
        metadata: loaderSummary.metadata,
        sharedCore: loaderSummary.sharedCore,
        proxyAlignment: loaderSummary.proxyAlignment,
        readiness: loaderSummary.readiness,
      },
      null,
      2
    )
  );
  lines.push("```");
  lines.push("");
  lines.push("## Results");
  lines.push("");

  for (const result of results) {
    lines.push(
      `${result.pass ? "Pass" : "Fail"} | ${result.group} | ${result.name} | expected=${toInlineJson(
        result.expected
      )} | actual=${toInlineJson(result.actual)}`
    );
  }

  lines.push("");
  lines.push("## Boundary Review");
  lines.push("");
  lines.push("- `docs/BATCH_VALIDATION_SPEC.md` non-goals kept: this report checks regression baselines only, does not claim final physical correctness, does not merge `return-studio.html` research into `game4.html`, and does not treat any single success metric as complete validation.");
  lines.push("- `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` acceptance 5 kept: this report does not describe `return-studio.html` as 已證明、最終解、正式部署.");
  lines.push("- No mechanism was added to execute the full inline `game4.html` script. The loader uses direct Node proxies plus per-symbol extraction only.");
  lines.push("");
  lines.push(`Summary: ${passCount} passed / ${failCount} failed`);
  lines.push(`Exit code: ${exitCode}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function roundDeep(value) {
  if (typeof value === "number") {
    return roundNumber(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => roundDeep(entry));
  }
  if (value && typeof value === "object") {
    const rounded = {};
    for (const key of Object.keys(value)) {
      rounded[key] = roundDeep(value[key]);
    }
    return rounded;
  }
  return value;
}

function roundNumber(value) {
  return Number(value.toFixed(6));
}

function deepRoundedEqual(actual, expected) {
  return JSON.stringify(roundDeep(actual), Object.keys(roundDeep(actual)).sort()) === JSON.stringify(roundDeep(expected), Object.keys(roundDeep(expected)).sort());
}

function sanitizeForDisplay(value) {
  return roundDeep(value);
}

function toInlineJson(value) {
  return JSON.stringify(value);
}

try {
  if (require.main === module) {
    main();
  }
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
