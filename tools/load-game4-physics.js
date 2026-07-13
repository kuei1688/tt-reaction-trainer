#!/usr/bin/env node

// Read-only integration layer for VAL-004 batch validation.
// This loader never executes game4.html as a whole; it only:
// 1. Reads approved Node proxies directly.
// 2. Extracts specific symbols from game4.html.
// 3. Optionally instantiates dependency-closed symbol bundles.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_SOURCE_FILE = path.join(ROOT_DIR, "game4.html");
const SHARED_CORE_PATH = path.join(ROOT_DIR, "shared-physics-core.js");
const TABLE_PHYSICS_PATH = path.join(__dirname, "physics-v2-contact-mechanics.js");
const RACKET_PHYSICS_PATH = path.join(__dirname, "racket-contact-mechanics.js");

const SHARED_CORE_CONSTANTS = [
  "TABLE",
  "BALL_RADIUS",
  "BALL_MASS",
  "BALL_INERTIA_ALPHA",
  "BALL_INERTIA",
  "MAX_TABLE_BOUNCES",
  "NET_COLLISION",
  "OBLIQUE_ANGLE_DEG",
  "EPSILON_VERTICAL",
  "EPSILON_OBLIQUE",
  "EPSILON_MIN",
  "SPIN_EPSILON_REFERENCE",
  "CONTACT_FRICTION_MU",
];

const SHARED_CORE_FUNCTIONS = [
  "clamp",
  "horizontalImpactSpeed",
  "spinSurfaceSpeed",
  "bounceWithSpinPhysical",
  "dynamicEpsilon",
  "bounceTangentialAxis",
];

const SHARED_CORE_EXPECTED_VALUES = {
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
};

const SHARED_CORE_EXPECTED_FINGERPRINTS = {
  dynamicEpsilon: "2ea0c04710",
  bounceTangentialAxis: "c2d211d423",
  // Phase 2 functions: fingerprints not pinned
};

const SOURCE3_TARGETS = {
  constants: [
    "PADDLE_RESTITUTION_LOW",
    "PADDLE_RESTITUTION_HIGH",
    "PADDLE_SPEED_LOW",
    "PADDLE_SPEED_HIGH",
    "PADDLE_FRICTION",
    "PADDLE_RESTITUTION",
    "RETURN_TARGET_X",
    "RETURN_SKILL",
    "RETURN_SKILL_LEVEL",
    "RANGE_SOLUTION_MODE",
    "TECHNIQUES",
    "PUSH_LIFT_BASE",
    "PUSH_LIFT_K",
    "PUSH_LIFT_FLOOR",
    "PUSH_LIFT_NEUTRAL",
    "PUSH_LIFT_MAX",
    "PUSH_DRIVE_BASE",
    "PUSH_DRIVE_K",
    "PUSH_DRIVE_FLOOR",
    "PUSH_DRIVE_NEUTRAL",
    "PUSH_DRIVE_MAX",
    "PUSH_TILT_Y",
  ],
  functions: [
    "crossVec3",
    "subVec3",
    "scaleVec3",
    "dotVec3",
    "rotateAroundAxis",
    "add",
    "addVec",
    "scaleVec",
    "normalize",
    "computeRacketNormal",
    "makeDirectReturnVelocity",
    "estimateFlightTimeToTable",
    "solveRacketVelXForTargetLandingX",
    "dynamicPaddleEpsilon",
    "speedScaledTechniqueVel",
    "applyExecutionVariance",
    "computeAdaptivePushLift",
    "computeAdaptivePushDrive",
    "computeAdaptivePushTiltX",
    "computeAdaptivePushTiltY",
    "sampleReturnCorrectionFraction",
    "makeRacketReturnVelocity",
  ],
};

const KNOWN_IDENTIFIERS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Error",
  "Infinity",
  "JSON",
  "Map",
  "Math",
  "NaN",
  "Number",
  "Object",
  "RegExp",
  "Set",
  "String",
  "console",
  "false",
  "null",
  "true",
  "undefined",
]);

const JS_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = loadGame4Physics(options);
  const summary = summarizeLoadResult(result);

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
      options.sourceFile = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log("Usage: node tools/load-game4-physics.js [--source-file <path>]");
}

function requireValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function evaluateSharedCoreValues() {
  const text = fs.readFileSync(SHARED_CORE_PATH, "utf8");
  const names = [
    "TABLE", "BALL_RADIUS", "BALL_MASS", "BALL_INERTIA_ALPHA",
    "BALL_INERTIA", "MAX_TABLE_BOUNCES", "NET_COLLISION", "OBLIQUE_ANGLE_DEG",
    "clamp", "horizontalImpactSpeed", "spinSurfaceSpeed",
    "CONTACT_FRICTION_MU", "EPSILON_VERTICAL", "EPSILON_OBLIQUE", "EPSILON_MIN", "SPIN_EPSILON_REFERENCE",
  ];
  // Wrap in a function to capture const values (vm context does not expose const declarations)
  const nl = String.fromCharCode(10);
  const wrapper = "(function() {" + nl + text + nl + "return { " + names.join(", ") + " };" + nl + "})()";
  const sandbox = { Math, JSON, console };
  const vm = require("vm");
  const context = vm.createContext(sandbox);
  const result = vm.runInContext(wrapper, context);
  return result;
}

function loadGame4Physics(options = {}) {
  const sourceFile = resolveSourceFile(options.sourceFile);
  const htmlText = fs.readFileSync(sourceFile, "utf8");
  const scriptText = extractInlineScript(htmlText);
  if (!scriptText.trim()) {
    throw new Error(`No inline script was found in ${sourceFile}.`);
  }

  const sharedCore = loadSharedCore();
  const tablePhysics = loadProxyModule(TABLE_PHYSICS_PATH);
  const racketPhysics = loadProxyModule(RACKET_PHYSICS_PATH);

  const sharedCoreValues = evaluateSharedCoreValues();

  const runtimeExternals = {
    bounceOffPlane: racketPhysics.exports.bounceOffPlane,
    bounceTangentialAxis: tablePhysics.exports.bounceTangentialAxis,
    bounceWithSpinPhysical: tablePhysics.exports.bounceWithSpinPhysical,
    dynamicEpsilon: tablePhysics.exports.dynamicEpsilon,
    TABLE: sharedCoreValues.TABLE,
    BALL_RADIUS: sharedCoreValues.BALL_RADIUS,
    BALL_MASS: sharedCoreValues.BALL_MASS,
    BALL_INERTIA_ALPHA: sharedCoreValues.BALL_INERTIA_ALPHA,
    BALL_INERTIA: sharedCoreValues.BALL_INERTIA,
    MAX_TABLE_BOUNCES: sharedCoreValues.MAX_TABLE_BOUNCES,
    NET_COLLISION: sharedCoreValues.NET_COLLISION,
    OBLIQUE_ANGLE_DEG: sharedCoreValues.OBLIQUE_ANGLE_DEG,
    clamp: sharedCoreValues.clamp,
    horizontalImpactSpeed: sharedCoreValues.horizontalImpactSpeed,
    spinSurfaceSpeed: sharedCoreValues.spinSurfaceSpeed,
    CONTACT_FRICTION_MU: sharedCoreValues.CONTACT_FRICTION_MU,
    EPSILON_VERTICAL: sharedCoreValues.EPSILON_VERTICAL,
    EPSILON_OBLIQUE: sharedCoreValues.EPSILON_OBLIQUE,
    EPSILON_MIN: sharedCoreValues.EPSILON_MIN,
    SPIN_EPSILON_REFERENCE: sharedCoreValues.SPIN_EPSILON_REFERENCE,
  };

  const localSymbolCache = new Map();
  const evaluatedConstantCache = new Map();

  function getLocalSymbolInfo(name) {
    if (localSymbolCache.has(name)) {
      return localSymbolCache.get(name);
    }

    const functionSource = extractFunctionSource(scriptText, name);
    if (functionSource != null) {
      const info = {
        name,
        kind: "function",
        declarationKind: "function",
        source: functionSource,
        fingerprint: fingerprintSource(functionSource),
        directDependencies: detectSymbolDependencies(functionSource, {
          kind: "function",
          symbolName: name,
        }),
      };
      localSymbolCache.set(name, info);
      return info;
    }

    const constantDefinition = extractConstantDefinition(scriptText, name);
    if (constantDefinition != null) {
      const info = {
        name,
        kind: "constant",
        declarationKind: constantDefinition.kind,
        source: constantDefinition.valueSource,
        directDependencies: detectSymbolDependencies(constantDefinition.valueSource, {
          kind: "constant",
          symbolName: name,
        }),
      };
      localSymbolCache.set(name, info);
      return info;
    }

    localSymbolCache.set(name, null);
    return null;
  }

  function classifyDependencies(dependencyNames, availableExternals) {
    const local = [];
    const external = [];
    const uncovered = [];

    for (const dependencyName of dependencyNames) {
      if (availableExternals.has(dependencyName)) {
        external.push(dependencyName);
        continue;
      }

      if (KNOWN_IDENTIFIERS.has(dependencyName) || JS_KEYWORDS.has(dependencyName)) {
        continue;
      }

      if (getLocalSymbolInfo(dependencyName) != null) {
        local.push(dependencyName);
        continue;
      }

      uncovered.push(dependencyName);
    }

    return {
      local,
      external,
      uncovered,
    };
  }

  function instantiateGame4Symbols(symbolNames, extraExternals = {}) {
    const availableExternals = new Map(
      Object.entries({
        ...runtimeExternals,
        ...extraExternals,
      }).filter((entry) => typeof entry[1] !== "undefined")
    );

    const orderedSymbols = [];
    const missingSymbols = [];
    const unresolved = new Map();
    const visiting = new Set();
    const visited = new Set();

    function visit(name) {
      if (visited.has(name)) {
        return;
      }
      if (visiting.has(name)) {
        throw new Error(`Cyclic dependency detected while extracting ${name}.`);
      }

      const info = getLocalSymbolInfo(name);
      if (info == null) {
        missingSymbols.push(name);
        return;
      }

      visiting.add(name);

      const classified = classifyDependencies(info.directDependencies, availableExternals);
      if (classified.uncovered.length > 0) {
        unresolved.set(name, classified.uncovered);
      }

      for (const dependencyName of classified.local) {
        visit(dependencyName);
      }

      visiting.delete(name);
      visited.add(name);
      orderedSymbols.push(info);
    }

    for (const name of symbolNames) {
      visit(name);
    }

    if (missingSymbols.length > 0 || unresolved.size > 0) {
      const details = [];
      if (missingSymbols.length > 0) {
        details.push(`missing symbols: ${missingSymbols.join(", ")}`);
      }
      if (unresolved.size > 0) {
        details.push(
          `uncovered dependencies: ${JSON.stringify(
            Object.fromEntries(unresolved.entries()),
            null,
            2
          )}`
        );
      }
      throw new Error(`Unable to instantiate extracted symbols: ${details.join("; ")}`);
    }

    const bundleSource = orderedSymbols
      .map((info) => {
        if (info.kind === "function") {
          return info.source;
        }
        return `${info.declarationKind} ${info.name} = ${info.source};`;
      })
      .join("\n\n");

    const exportSource = `globalThis.__exports = { ${symbolNames.join(", ")} };`;
    const sandbox = {
      Math,
      JSON,
      Number,
      Object,
      Array,
      String,
      Boolean,
      RegExp,
      Date,
      Set,
      Map,
    };

    for (const [name, value] of availableExternals.entries()) {
      sandbox[name] = value;
    }

    const context = vm.createContext(sandbox);
    const script = new vm.Script(`${bundleSource}\n\n${exportSource}`, {
      filename: path.basename(sourceFile),
    });
    script.runInContext(context, { timeout: 1000 });
    return context.__exports;
  }

  function evaluateExtractedConstant(name) {
    if (evaluatedConstantCache.has(name)) {
      return evaluatedConstantCache.get(name);
    }

    const exportsObject = instantiateGame4Symbols([name]);
    const value = exportsObject[name];
    evaluatedConstantCache.set(name, value);
    return value;
  }

  const proxyAlignment = buildProxyAlignment(scriptText);

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      scope: "VAL-004 only",
      sourceFile,
      rootDir: ROOT_DIR,
    },
    scriptText,
    sharedCore,
    proxyModules: {
      tablePhysics,
      racketPhysics,
    },
    runtimeExternals,
    getLocalSymbolInfo,
    classifyDependencies: (dependencyNames, extraExternals = {}) =>
      classifyDependencies(
        dependencyNames,
        new Set([
          ...Object.keys(runtimeExternals),
          ...Object.keys(extraExternals),
        ])
      ),
    instantiateGame4Symbols,
    evaluateExtractedConstant,
    proxyAlignment,
  };
}

function resolveSourceFile(sourceFile) {
  if (!sourceFile) {
    return DEFAULT_SOURCE_FILE;
  }
  if (path.isAbsolute(sourceFile)) {
    return sourceFile;
  }
  return path.resolve(ROOT_DIR, sourceFile);
}

function loadSharedCore() {
  let sharedCoreVmValues = null;
  try { sharedCoreVmValues = evaluateSharedCoreValues(); } catch(e) { /* vm eval failed, fall back to evaluateLiteral */ }
  const text = fs.readFileSync(SHARED_CORE_PATH, "utf8");
  const exportsObject = requireFreshOrEmpty(SHARED_CORE_PATH);
  const exportKeys = Object.keys(exportsObject);
  const warnings = [];

  if (exportKeys.length === 0) {
    warnings.push(
      "shared-physics-core.js currently exposes no CommonJS exports; loader fell back to per-symbol extraction."
    );
  }

  const constants = {};
  for (const name of SHARED_CORE_CONSTANTS) {
    const definition = extractConstantDefinition(text, name);
    if (definition == null) {
      constants[name] = {
        found: false,
        expected: SHARED_CORE_EXPECTED_VALUES[name],
      };
      continue;
    }

    const actualValue = sharedCoreVmValues != null && Object.prototype.hasOwnProperty.call(sharedCoreVmValues, name) ? sharedCoreVmValues[name] : evaluateLiteral(definition.valueSource);
    constants[name] = {
      found: true,
      source: "shared-physics-core.js",
      loadMode: exportKeys.length > 0 && Object.prototype.hasOwnProperty.call(exportsObject, name)
        ? "direct-require"
        : "per-symbol-extraction",
      rawSource: definition.valueSource,
      actualValue,
      expected: SHARED_CORE_EXPECTED_VALUES[name],
      matchesExpected: actualValue === SHARED_CORE_EXPECTED_VALUES[name],
    };
  }

  const functions = {};
  for (const name of SHARED_CORE_FUNCTIONS) {
    const source = extractFunctionSource(text, name);
    if (source == null) {
      functions[name] = {
        found: false,
        expectedFingerprint: SHARED_CORE_EXPECTED_FINGERPRINTS[name],
      };
      continue;
    }

    const fingerprint = fingerprintSource(source);
    functions[name] = {
      found: true,
      source: "shared-physics-core.js",
      loadMode: exportKeys.length > 0 && Object.prototype.hasOwnProperty.call(exportsObject, name)
        ? "direct-require"
        : "per-symbol-extraction",
      fingerprint,
      expectedFingerprint: SHARED_CORE_EXPECTED_FINGERPRINTS[name],
      matchesExpected: fingerprint === SHARED_CORE_EXPECTED_FINGERPRINTS[name],
    };
  }

  return {
    path: SHARED_CORE_PATH,
    loadMode: exportKeys.length > 0 ? "direct-require" : "require-returned-empty-object",
    exportKeys,
    warnings,
    constants,
    functions,
  };
}

function loadProxyModule(modulePath) {
  const resolvedPath = require.resolve(modulePath);
  delete require.cache[resolvedPath];

  const originalLog = console.log;
  const originalError = console.error;
  const capturedStdout = [];
  const capturedStderr = [];
  const previousExitCode = process.exitCode;

  console.log = (...args) => {
    capturedStdout.push(args.map(formatConsoleValue).join(" "));
  };
  console.error = (...args) => {
    capturedStderr.push(args.map(formatConsoleValue).join(" "));
  };

  let exportsObject;
  try {
    exportsObject = require(resolvedPath);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = previousExitCode;
  }

  return {
    path: modulePath,
    exportKeys: Object.keys(exportsObject || {}),
    capturedStdout,
    capturedStderr,
    exports: exportsObject || {},
  };
}

function buildProxyAlignment(game4ScriptText) {
  const tableText = fs.readFileSync(TABLE_PHYSICS_PATH, "utf8");
  const racketText = fs.readFileSync(RACKET_PHYSICS_PATH, "utf8");

  const game4BounceWithSpinPhysical = extractFunctionSource(game4ScriptText, "bounceWithSpinPhysical");
  const proxyBounceWithSpinPhysical = extractFunctionSource(tableText, "bounceWithSpinPhysical");
  const game4BounceOffPlane = extractFunctionSource(game4ScriptText, "bounceOffPlane");
  const proxyBounceOffPlane = extractFunctionSource(racketText, "bounceOffPlane");

  return {
    bounceWithSpinPhysical: {
      proxyKind: "literal-proxy",
      game4Fingerprint: game4BounceWithSpinPhysical ? fingerprintSource(game4BounceWithSpinPhysical) : null,
      proxyFingerprint: proxyBounceWithSpinPhysical ? fingerprintSource(proxyBounceWithSpinPhysical) : null,
      normalizedMatch:
        game4BounceWithSpinPhysical != null &&
        proxyBounceWithSpinPhysical != null &&
        normalizeSource(game4BounceWithSpinPhysical) === normalizeSource(proxyBounceWithSpinPhysical),
    },
    bounceOffPlane: {
      proxyKind: "behavioral-proxy",
      game4Fingerprint: game4BounceOffPlane ? fingerprintSource(game4BounceOffPlane) : null,
      proxyFingerprint: proxyBounceOffPlane ? fingerprintSource(proxyBounceOffPlane) : null,
      normalizedMatch:
        game4BounceOffPlane != null &&
        proxyBounceOffPlane != null &&
        normalizeSource(game4BounceOffPlane) === normalizeSource(proxyBounceOffPlane),
    },
  };
}

function summarizeLoadResult(result) {
  const availableExternals = new Set(Object.keys(result.runtimeExternals));
  const extractedConstants = {};
  const extractedFunctions = {};
  const missingSymbols = [];
  const unresolvedDependencies = [];

  for (const name of SOURCE3_TARGETS.constants) {
    const info = result.getLocalSymbolInfo(name);
    if (info == null) {
      missingSymbols.push(name);
      continue;
    }

    const classified = result.classifyDependencies(info.directDependencies);
    if (classified.uncovered.length > 0) {
      unresolvedDependencies.push({
        name,
        uncoveredDependencies: classified.uncovered,
      });
    }

    let evaluatedValue;
    try {
      evaluatedValue = sanitizeForJson(result.evaluateExtractedConstant(name));
    } catch (error) {
      evaluatedValue = {
        evaluationError: error.message,
      };
    }

    extractedConstants[name] = {
      kind: info.kind,
      declarationKind: info.declarationKind,
      sourceMode: "per-symbol-extraction",
      directDependencies: info.directDependencies,
      localDependencies: classified.local,
      externalDependencies: classified.external,
      uncoveredDependencies: classified.uncovered,
      value: evaluatedValue,
    };
  }

  for (const name of SOURCE3_TARGETS.functions) {
    const info = result.getLocalSymbolInfo(name);
    if (info == null) {
      missingSymbols.push(name);
      continue;
    }

    const classified = result.classifyDependencies(info.directDependencies);
    if (classified.uncovered.length > 0) {
      unresolvedDependencies.push({
        name,
        uncoveredDependencies: classified.uncovered,
      });
    }

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

  return {
    metadata: {
      generatedAt: result.metadata.generatedAt,
      scope: result.metadata.scope,
      sourceFile: result.metadata.sourceFile,
      wholeScriptExecution: false,
    },
    sharedCore: result.sharedCore,
    proxyModules: {
      tablePhysics: {
        path: result.proxyModules.tablePhysics.path,
        exportKeys: result.proxyModules.tablePhysics.exportKeys,
        capturedStdoutLineCount: result.proxyModules.tablePhysics.capturedStdout.length,
        capturedStderrLineCount: result.proxyModules.tablePhysics.capturedStderr.length,
      },
      racketPhysics: {
        path: result.proxyModules.racketPhysics.path,
        exportKeys: result.proxyModules.racketPhysics.exportKeys,
        capturedStdoutLineCount: result.proxyModules.racketPhysics.capturedStdout.length,
        capturedStderrLineCount: result.proxyModules.racketPhysics.capturedStderr.length,
      },
    },
    proxyAlignment: result.proxyAlignment,
    source3: {
      extractedConstants,
      extractedFunctions,
      externalProxySymbols: Array.from(availableExternals).sort(),
    },
    readiness: {
      ok: missingSymbols.length === 0 && unresolvedDependencies.length === 0,
      missingSymbols,
      unresolvedDependencies,
    },
  };
}

function requireFreshOrEmpty(modulePath) {
  try {
    const resolvedPath = require.resolve(modulePath);
    delete require.cache[resolvedPath];
    return require(resolvedPath);
  } catch (error) {
    return {};
  }
}

function extractInlineScript(html) {
  const regex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }

  return scripts.join("\n");
}

function extractConstantDefinition(scriptText, constantName) {
  const regex = new RegExp(`\\b(const|let|var)\\s+${escapeRegExp(constantName)}\\s*=`, "g");
  let match;
  while ((match = regex.exec(scriptText)) !== null) {
    if (!isTopLevelIndex(scriptText, match.index)) {
      continue;
    }

    const valueStart = regex.lastIndex;
    const valueEnd = findStatementEnd(scriptText, valueStart);
    if (valueEnd === -1) {
      throw new Error(`Unable to parse constant "${constantName}".`);
    }

    return {
      kind: match[1],
      valueSource: scriptText.slice(valueStart, valueEnd).trim(),
    };
  }
  return null;
}

function extractFunctionSource(scriptText, functionName) {
  const regex = new RegExp(`\\bfunction\\s+${escapeRegExp(functionName)}\\s*\\(`, "g");
  let match;
  while ((match = regex.exec(scriptText)) !== null) {
    if (!isTopLevelIndex(scriptText, match.index)) {
      continue;
    }

    const functionStart = match.index;
    const openParen = scriptText.indexOf("(", functionStart);
    const closeParen = findMatchingBracket(scriptText, openParen, "(", ")");
    const openBrace = findNextSignificantIndex(scriptText, closeParen + 1);

    if (openBrace === -1 || scriptText[openBrace] !== "{") {
      throw new Error(`Unable to locate body for function "${functionName}".`);
    }

    const closeBrace = findMatchingBracket(scriptText, openBrace, "{", "}");
    return scriptText.slice(functionStart, closeBrace + 1).trim();
  }
  return null;
}

function detectSymbolDependencies(sourceText, options) {
  const wrappedSource =
    options.kind === "constant"
      ? `${options.symbolName} = (${sourceText});`
      : sourceText;
  const sanitized = stripNonCode(wrappedSource);

  const paramNames = options.kind === "function"
    ? extractParameterNames(sourceText)
    : [];
  const localNames = extractLocalNames(sanitized);
  const skipNames = new Set([
    options.symbolName,
    ...paramNames,
    ...localNames,
    ...KNOWN_IDENTIFIERS,
    ...JS_KEYWORDS,
  ]);

  const dependencies = new Set();
  const identifierRegex = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g;
  let match;

  while ((match = identifierRegex.exec(sanitized)) !== null) {
    const name = match[0];
    const start = match.index;
    const end = start + name.length;
    const previousChar = sanitized[start - 1];

    if (previousChar === ".") {
      continue;
    }

    const nextIndex = findNextNonWhitespaceIndex(sanitized, end);
    const previousIndex = findPreviousNonWhitespaceIndex(sanitized, start - 1);
    if (
      nextIndex !== -1 &&
      sanitized[nextIndex] === ":" &&
      previousIndex !== -1 &&
      (sanitized[previousIndex] === "{" || sanitized[previousIndex] === ",")
    ) {
      continue;
    }

    if (skipNames.has(name)) {
      continue;
    }

    dependencies.add(name);
  }

  return Array.from(dependencies).sort();
}

function extractParameterNames(functionSource) {
  const openParen = functionSource.indexOf("(");
  const closeParen = findMatchingBracket(functionSource, openParen, "(", ")");
  const parameterSlice = functionSource.slice(openParen + 1, closeParen);
  const matches = parameterSlice.match(/[A-Za-z_$][A-Za-z0-9_$]*/g);
  return matches ? matches.filter((name) => !JS_KEYWORDS.has(name)) : [];
}

function extractLocalNames(sanitizedSource) {
  const localNames = new Set();
  const functionRegex = /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)/g;
  let match;

  while ((match = functionRegex.exec(sanitizedSource)) !== null) {
    localNames.add(match[1]);
    for (const name of extractPatternIdentifiers(match[2])) {
      localNames.add(name);
    }
  }

  const declarationRegex = /\b(?:const|let|var)\b/g;
  while ((match = declarationRegex.exec(sanitizedSource)) !== null) {
    const statementStart = declarationRegex.lastIndex;
    const statementEnd = findStatementEnd(sanitizedSource, statementStart);
    if (statementEnd === -1) {
      continue;
    }

    const declarators = splitTopLevel(sanitizedSource.slice(statementStart, statementEnd), ",");
    for (const declarator of declarators) {
      const leftSide = splitAtTopLevelEquals(declarator);
      for (const name of extractPatternIdentifiers(leftSide)) {
        localNames.add(name);
      }
    }

    declarationRegex.lastIndex = statementEnd + 1;
  }

  const arrowParamRegex = /(?:\b([A-Za-z_$][A-Za-z0-9_$]*)\b|\(([^)]*)\))\s*=>/g;
  while ((match = arrowParamRegex.exec(sanitizedSource)) !== null) {
    const singleParam = match[1];
    const paramList = match[2];
    if (singleParam) {
      localNames.add(singleParam);
      continue;
    }
    for (const name of extractPatternIdentifiers(paramList)) {
      localNames.add(name);
    }
  }

  return Array.from(localNames);
}

function isTopLevelIndex(text, targetIndex) {
  let braceDepth = 0;

  for (let index = 0; index < targetIndex; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    if (text[index] === "{") {
      braceDepth += 1;
      continue;
    }

    if (text[index] === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    }
  }

  return braceDepth === 0;
}

function splitTopLevel(text, separatorChar) {
  const parts = [];
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depthParen += 1;
    if (char === ")") depthParen -= 1;
    if (char === "{") depthBrace += 1;
    if (char === "}") depthBrace -= 1;
    if (char === "[") depthBracket += 1;
    if (char === "]") depthBracket -= 1;

    if (
      char === separatorChar &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function splitAtTopLevelEquals(text) {
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depthParen += 1;
    if (char === ")") depthParen -= 1;
    if (char === "{") depthBrace += 1;
    if (char === "}") depthBrace -= 1;
    if (char === "[") depthBracket += 1;
    if (char === "]") depthBracket -= 1;

    if (
      char === "=" &&
      text[index - 1] !== "=" &&
      text[index + 1] !== "=" &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      return text.slice(0, index).trim();
    }
  }

  return text.trim();
}

function extractPatternIdentifiers(text) {
  const matches = text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g);
  if (!matches) {
    return [];
  }
  return matches.filter((name) => !JS_KEYWORDS.has(name));
}

function stripNonCode(text) {
  const chars = Array.from(text);
  let index = 0;

  while (index < chars.length) {
    const char = chars[index];
    const nextChar = chars[index + 1];

    if (char === "'" || char === '"' || char === "`") {
      const end = skipStringLiteral(text, index, char);
      for (let cursor = index; cursor < end; cursor += 1) {
        if (chars[cursor] !== "\n") {
          chars[cursor] = " ";
        }
      }
      index = end;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      let cursor = index;
      while (cursor < chars.length && chars[cursor] !== "\n") {
        chars[cursor] = " ";
        cursor += 1;
      }
      index = cursor;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      const end = text.indexOf("*/", index + 2);
      if (end === -1) {
        throw new Error("Unterminated block comment while scanning dependencies.");
      }
      for (let cursor = index; cursor < end + 2; cursor += 1) {
        if (chars[cursor] !== "\n") {
          chars[cursor] = " ";
        }
      }
      index = end + 2;
      continue;
    }

    index += 1;
  }

  return chars.join("");
}

function evaluateLiteral(source) {
  return vm.runInNewContext(`(${source})`, {}, { timeout: 250 });
}

function normalizeSource(source) {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
}

function fingerprintSource(source) {
  return crypto.createHash("sha1").update(normalizeSource(source)).digest("hex").slice(0, 10);
}

function sanitizeForJson(value) {
  if (value == null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function formatConsoleValue(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function findStatementEnd(text, startIndex) {
  const stack = [];

  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    const char = text[index];

    if (char === "(" || char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === ")" || char === "}" || char === "]") {
      stack.pop();
      continue;
    }

    if (char === ";" && stack.length === 0) {
      return index;
    }
  }

  return -1;
}

function findMatchingBracket(text, startIndex, openChar, closeChar) {
  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    const char = text[index];
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`Unbalanced "${openChar}${closeChar}" while parsing source.`);
}

function findNextSignificantIndex(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    if (!/\s/.test(text[index])) {
      return index;
    }
  }

  return -1;
}

function findNextNonWhitespaceIndex(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) {
      return index;
    }
  }
  return -1;
}

function findPreviousNonWhitespaceIndex(text, startIndex) {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (!/\s/.test(text[index])) {
      return index;
    }
  }
  return -1;
}

function consumeNonCode(text, index) {
  const char = text[index];
  const nextChar = text[index + 1];

  if (char === "'" || char === '"' || char === "`") {
    return skipStringLiteral(text, index, char);
  }

  if (char === "/" && nextChar === "/") {
    let cursor = index + 2;
    while (cursor < text.length && text[cursor] !== "\n") {
      cursor += 1;
    }
    return cursor;
  }

  if (char === "/" && nextChar === "*") {
    const closeIndex = text.indexOf("*/", index + 2);
    if (closeIndex === -1) {
      throw new Error("Unterminated block comment while parsing source.");
    }
    return closeIndex + 2;
  }

  return index;
}

function skipStringLiteral(text, startIndex, quote) {
  let index = startIndex + 1;

  while (index < text.length) {
    const char = text[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (quote === "`" && char === "$" && text[index + 1] === "{") {
      index = skipTemplateExpression(text, index + 2);
      continue;
    }

    if (char === quote) {
      return index + 1;
    }

    index += 1;
  }

  throw new Error("Unterminated string literal while parsing source.");
}

function skipTemplateExpression(text, startIndex) {
  let depth = 1;

  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    if (text[index] === "{") {
      depth += 1;
      continue;
    }

    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error("Unterminated template expression while parsing source.");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  DEFAULT_SOURCE_FILE,
  SOURCE3_TARGETS,
  extractInlineScript,
  extractConstantDefinition,
  extractFunctionSource,
  fingerprintSource,
  loadGame4Physics,
  normalizeSource,
  summarizeLoadResult,
};

try {
  if (require.main === module) {
    main();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
