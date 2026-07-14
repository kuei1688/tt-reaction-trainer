#!/usr/bin/env node

// Read-only integration layer for VAL-005 batch validation
// (return-studio.html research page — NOT game4.html acceptance).
//
// This loader never executes return-studio.html's inline <script> as a whole.
// It reuses load-game4-physics.js by calling its exported loadGame4Physics()
// with return-studio.html as --source-file, which gives us for free:
// 1. The same inline-script extraction (extractInlineScript).
// 2. The same per-symbol extraction + dependency-closure machinery
//    (getLocalSymbolInfo / instantiateGame4Symbols), instead of a copy.
// 3. The same shared-physics-core.js constants/functions as sandbox externals
//    (loadSharedCore() / evaluateSharedCoreValues() run inside loadGame4Physics).
//
// Scope guard (docs/VAL005_RETURN_STUDIO_BATCH_VALIDATION_TASKPACK.md):
// results extracted here describe return-studio.html's own research formulas.
// They must not be cross-checked against game4.html for "consistency" — the
// two return-formula families are intentionally divergent.

const path = require("path");
const vm = require("vm");
const { loadGame4Physics, extractConstantDefinition } = require("./load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_SOURCE_FILE = path.join(ROOT_DIR, "return-studio.html");

// Symbol list from the taskpack (階段一), re-verified against the current
// return-studio.html source before implementation.
const RETURN_STUDIO_TARGETS = {
  functions: [
    "simulateServe",
    "simulatePath",
    "findHitIndex",
    "findPushHitIndex",
    "simulateReturnForPreset",
    "judgeResult",
    "makeReturnVelocity",
    "makeRacketReturnVelocity",
    "bounceOffPlane",
    "bounceOffPlaneSubstepped",
    "computeBlendedNormal",
    "computeAdaptivePushLift",
    "computeAdaptivePushDrive",
    "computeAdaptivePushTiltX",
    "computeAdaptivePushTiltY",
    "mirrorVec",
    "mirrorSpin",
  ],
  constants: ["TECHNIQUES", "PADDLE_BLEND"],
};

// TECHNIQUES is declared as `let TECHNIQUES = deepClone(DEFAULT_TECHNIQUES);`
// where deepClone is a pure JSON round-trip, so the extracted value equals the
// page's initial TECHNIQUES state (no runtime mutations included).
const TECHNIQUES_EXTRACTION_NOTE =
  "等同於 TECHNIQUES 的初始值（deepClone(DEFAULT_TECHNIQUES)），不含執行期間的動態修改";

// Expected technique models per current return-studio.html source
// (loop was removed from DEFAULT_TECHNIQUES; only these three keys remain).
const EXPECTED_TECHNIQUE_MODELS = {
  forehand_attack: "attack",
  backhand_attack: "attack",
  push: "push",
};

// return-studio.html defines its own 7-argument
// bounceOffPlane(vel, spin, planeNormal, planeVel, restitution, friction, blend)
// which is intentionally different from the 5-argument game4 racket proxy that
// loadGame4Physics() exposes as a runtime external. Externals win over local
// extraction in instantiateGame4Symbols(), so we must knock the proxy out:
// passing `undefined` makes its externals merge filter drop the entry, which
// forces local extraction of return-studio.html's own version.
const FORCE_LOCAL_OVERRIDES = { bounceOffPlane: undefined };

// return-studio.html declares the adaptive-push tuning constants as
// multi-declarator statements (`const PUSH_LIFT_BASE = 0.35, PUSH_LIFT_K = 0, ...;`).
// load-game4-physics.js's extractConstantDefinition only understands the first
// declarator of such a statement (the rest of the statement becomes its "value"),
// so these groups cannot be extracted per symbol. We may not modify that file,
// so this loader parses the declarator groups itself (read-only, literal values
// only) and supplies every name in each group as a sandbox external instead.
const MULTI_DECLARATOR_GROUP_LEADS = ["PUSH_LIFT_BASE", "PUSH_DRIVE_BASE"];

// Identifiers that would indicate a DOM / THREE.js / browser dependency leaked
// into the extracted symbol closure. Any of these would also show up as an
// uncovered dependency (they are not sandbox externals), but we surface them
// explicitly for the VAL-005 "no DOM traces" verification.
const DOM_TRACE_NAMES = new Set([
  "THREE",
  "document",
  "window",
  "localStorage",
  "navigator",
  "fetch",
  "performance",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getElementById",
]);

function main() {
  const options = parseArgs(process.argv.slice(2));
  const loader = loadReturnStudioPhysics(options);
  const summary = summarizeReturnStudioLoad(loader);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (!summary.readiness.ok) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--source-file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      options.sourceFile = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node tools/load-return-studio-physics.js [--source-file <path>]");
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function loadReturnStudioPhysics(options = {}) {
  const sourceFile = options.sourceFile
    ? path.resolve(ROOT_DIR, options.sourceFile)
    : DEFAULT_SOURCE_FILE;

  const base = loadGame4Physics({ sourceFile });

  const multiDeclaratorConstants = {};
  for (const leadName of MULTI_DECLARATOR_GROUP_LEADS) {
    Object.assign(
      multiDeclaratorConstants,
      extractDeclaratorGroup(base.scriptText, leadName)
    );
  }

  const effectiveExternalNames = new Set([
    ...Object.keys(base.runtimeExternals).filter(
      (name) => !(name in FORCE_LOCAL_OVERRIDES)
    ),
    ...Object.keys(multiDeclaratorConstants),
  ]);

  function instantiateReturnStudioSymbols(symbolNames, extraExternals = {}) {
    return base.instantiateGame4Symbols(symbolNames, {
      ...FORCE_LOCAL_OVERRIDES,
      ...multiDeclaratorConstants,
      ...extraExternals,
    });
  }

  function classifyDirectDependencies(dependencyNames) {
    const local = [];
    const external = [];
    const uncovered = [];

    for (const dependencyName of dependencyNames) {
      if (effectiveExternalNames.has(dependencyName)) {
        external.push(dependencyName);
        continue;
      }
      if (base.getLocalSymbolInfo(dependencyName) != null) {
        local.push(dependencyName);
        continue;
      }
      uncovered.push(dependencyName);
    }

    return { local, external, uncovered };
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      scope: "VAL-005 only（return-studio.html 研究頁，非 game4.html 正式驗收）",
      sourceFile,
      rootDir: ROOT_DIR,
      wholeScriptExecution: false,
    },
    sourceFile,
    base,
    sharedCore: base.sharedCore,
    effectiveExternalNames,
    multiDeclaratorConstants,
    getLocalSymbolInfo: base.getLocalSymbolInfo,
    classifyDirectDependencies,
    instantiateReturnStudioSymbols,
  };
}

// Parse `const LEAD = v0, NAME1 = v1, ...;` into {LEAD: v0, NAME1: v1, ...}.
// Relies on the exported extractConstantDefinition, whose valueSource for the
// lead name is the remainder of the whole statement; each declarator value is
// evaluated as an isolated literal expression (Math only, no page code).
function extractDeclaratorGroup(scriptText, leadName) {
  const definition = extractConstantDefinition(scriptText, leadName);
  if (definition == null) {
    throw new Error(`Multi-declarator group lead "${leadName}" not found.`);
  }

  const values = {};
  const parts = splitTopLevelCommas(definition.valueSource);
  values[leadName] = evaluateLiteralExpression(parts[0], leadName);

  for (const part of parts.slice(1)) {
    const equalsIndex = part.indexOf("=");
    if (equalsIndex === -1) {
      throw new Error(
        `Unable to parse declarator "${part}" in group led by "${leadName}".`
      );
    }
    const name = part.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(
        `Unexpected declarator name "${name}" in group led by "${leadName}".`
      );
    }
    values[name] = evaluateLiteralExpression(part.slice(equalsIndex + 1), name);
  }

  return values;
}

function splitTopLevelCommas(text) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(" || char === "{" || char === "[") depth += 1;
    if (char === ")" || char === "}" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function evaluateLiteralExpression(source, name) {
  try {
    return vm.runInNewContext(`(${source})`, { Math }, { timeout: 250 });
  } catch (error) {
    throw new Error(`Unable to evaluate value for "${name}": ${error.message}`);
  }
}

// Walk the local dependency closure of the target symbols so the summary covers
// every symbol that would end up in an instantiation bundle (e.g. helpers like
// applyPushContact that the taskpack list reaches only transitively).
function collectSymbolClosure(loader, targetNames) {
  const infos = new Map();
  const uncoveredBySymbol = {};
  const missingTargets = [];
  const queue = [];

  for (const name of targetNames) {
    if (loader.getLocalSymbolInfo(name) == null) {
      missingTargets.push(name);
    } else {
      queue.push(name);
    }
  }

  while (queue.length > 0) {
    const name = queue.shift();
    if (infos.has(name)) {
      continue;
    }
    const info = loader.getLocalSymbolInfo(name);
    infos.set(name, info);

    const classified = loader.classifyDirectDependencies(info.directDependencies);
    if (classified.uncovered.length > 0) {
      uncoveredBySymbol[name] = classified.uncovered;
    }
    for (const dependencyName of classified.local) {
      if (!infos.has(dependencyName)) {
        queue.push(dependencyName);
      }
    }
  }

  return { infos, uncoveredBySymbol, missingTargets };
}

function summarizeReturnStudioLoad(loader) {
  const targetNames = [
    ...RETURN_STUDIO_TARGETS.functions,
    ...RETURN_STUDIO_TARGETS.constants,
  ];
  const closure = collectSymbolClosure(loader, targetNames);

  const extractedFunctions = {};
  const extractedConstants = {};

  for (const name of RETURN_STUDIO_TARGETS.functions) {
    const info = closure.infos.get(name);
    if (!info) {
      continue;
    }
    const classified = loader.classifyDirectDependencies(info.directDependencies);
    extractedFunctions[name] = {
      kind: info.kind,
      sourceMode: "per-symbol-extraction",
      fingerprint: info.fingerprint,
      directDependencies: info.directDependencies,
      localDependencies: classified.local,
      externalDependencies: classified.external,
      uncoveredDependencies: classified.uncovered,
    };
  }

  let instantiationError = null;
  let evaluatedConstants = {};
  try {
    evaluatedConstants = loader.instantiateReturnStudioSymbols(targetNames);
  } catch (error) {
    instantiationError = error.message;
  }

  for (const name of RETURN_STUDIO_TARGETS.constants) {
    const info = closure.infos.get(name);
    if (!info) {
      continue;
    }
    const classified = loader.classifyDirectDependencies(info.directDependencies);
    let value = null;
    let valueError = null;
    if (instantiationError == null) {
      try {
        value = JSON.parse(JSON.stringify(evaluatedConstants[name]));
      } catch (error) {
        valueError = error.message;
      }
    }
    extractedConstants[name] = {
      kind: info.kind,
      declarationKind: info.declarationKind,
      sourceMode: "per-symbol-extraction",
      directDependencies: info.directDependencies,
      localDependencies: classified.local,
      externalDependencies: classified.external,
      uncoveredDependencies: classified.uncovered,
      value,
      valueError,
      note: name === "TECHNIQUES" ? TECHNIQUES_EXTRACTION_NOTE : undefined,
    };
  }

  const techniqueModelChecks = checkTechniqueModels(
    extractedConstants.TECHNIQUES ? extractedConstants.TECHNIQUES.value : null
  );

  const closureSymbolNames = Array.from(closure.infos.keys()).sort();
  const transitiveOnlySymbols = closureSymbolNames.filter(
    (name) => !targetNames.includes(name)
  );

  const domTraces = [];
  for (const [name, info] of closure.infos.entries()) {
    for (const dependencyName of info.directDependencies) {
      if (DOM_TRACE_NAMES.has(dependencyName)) {
        domTraces.push({ symbol: name, dependency: dependencyName });
      }
    }
  }

  const uncoveredEntries = Object.entries(closure.uncoveredBySymbol).map(
    ([name, uncovered]) => ({ name, uncoveredDependencies: uncovered })
  );

  const ok =
    closure.missingTargets.length === 0 &&
    uncoveredEntries.length === 0 &&
    domTraces.length === 0 &&
    instantiationError == null &&
    techniqueModelChecks.ok;

  return {
    metadata: loader.metadata,
    sharedCore: loader.sharedCore,
    externalProxySymbols: Array.from(loader.effectiveExternalNames).sort(),
    forcedLocalSymbols: Object.keys(FORCE_LOCAL_OVERRIDES),
    multiDeclaratorConstants: loader.multiDeclaratorConstants,
    extractedFunctions,
    extractedConstants,
    techniqueModelChecks,
    dependencyClosure: {
      symbolCount: closureSymbolNames.length,
      symbols: closureSymbolNames,
      transitiveOnlySymbols,
    },
    domTraces,
    readiness: {
      ok,
      missingSymbols: closure.missingTargets,
      unresolvedDependencies: uncoveredEntries,
      instantiationError,
    },
  };
}

function checkTechniqueModels(techniquesValue) {
  const checks = {};
  let ok = techniquesValue != null && typeof techniquesValue === "object";

  for (const [key, expectedModel] of Object.entries(EXPECTED_TECHNIQUE_MODELS)) {
    const actualModel =
      techniquesValue && techniquesValue[key] ? techniquesValue[key].model : null;
    const matches = actualModel === expectedModel;
    checks[key] = { expectedModel, actualModel, matches };
    ok = ok && matches;
  }

  const actualKeys = techniquesValue ? Object.keys(techniquesValue).sort() : [];
  const expectedKeys = Object.keys(EXPECTED_TECHNIQUE_MODELS).sort();
  const keySetMatches = JSON.stringify(actualKeys) === JSON.stringify(expectedKeys);

  return {
    ok: ok && keySetMatches,
    expectedKeys,
    actualKeys,
    keySetMatches,
    models: checks,
  };
}

module.exports = {
  DEFAULT_SOURCE_FILE,
  RETURN_STUDIO_TARGETS,
  TECHNIQUES_EXTRACTION_NOTE,
  loadReturnStudioPhysics,
  summarizeReturnStudioLoad,
};

try {
  if (require.main === module) {
    main();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
