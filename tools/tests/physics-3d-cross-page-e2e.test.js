#!/usr/bin/env node

// Canonical omega cross-page contract test.
//
// Scope:
//   serve -> flight -> table contact -> racket contact -> return flight
//
// This is an engineering data-flow test. It proves that the participating
// pages preserve schema-2 world-space omega and pass it explicitly between
// stages; it does not prove that Magnus, contact parameters, or presets are
// physically calibrated.

const fs = require("fs");
const path = require("path");
const {
  loadGame4Physics,
} = require("../load-game4-physics.js");
const {
  loadReturnStudioPhysics,
} = require("../load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const SCHEMA = 2;
const EPSILON = 1e-9;

const PAGE_CASES = [
  {
    id: "game4",
    sourceFile: "game4.html",
    loader: () => loadGame4Physics({sourceFile: "game4.html"}),
    instantiate: (loader, names) => loader.instantiateGame4Symbols(names),
    requiredSourcePatterns: [
      {label: "main return flight", pattern: /spin3d\s*:\s*returnHit\.spin3d/},
      {label: "push landing solver flight", pattern: /spin3d\s*:\s*bounced\.spin3d/},
    ],
  },
  {
    id: "game5",
    sourceFile: "game5.html",
    loader: () => loadGame4Physics({sourceFile: "game5.html"}),
    instantiate: (loader, names) => loader.instantiateGame4Symbols(names),
    requiredSourcePatterns: [
      {label: "main return flight", pattern: /spin3d\s*:\s*returnHit\.spin3d/},
      {label: "push landing solver flight", pattern: /spin3d\s*:\s*bounced\.spin3d/},
    ],
  },
  {
    id: "return-studio",
    sourceFile: "return-studio.html",
    loader: () => loadReturnStudioPhysics({sourceFile: "return-studio.html"}),
    instantiate: (loader, names) => loader.instantiateReturnStudioSymbols(names),
    requiredSourcePatterns: [
      {label: "research return flight", pattern: /spin3d\s*:\s*returnHit\.spin3d/},
      {label: "push landing solver flight", pattern: /spin3d\s*:\s*bounced\.spin3d/},
      {label: "rally mirrored return flight", pattern: /spin3d\s*:\s*returnSpin3d/},
    ],
  },
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertFiniteVector(vector, label) {
  assert(vector && Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z), `${label} is not finite`);
}

function assertCanonicalSpin(spin, label) {
  assert(spin && spin.schema === SCHEMA, `${label} is not schema-${SCHEMA}`);
  assertFiniteVector(spin.omega, `${label}.omega`);
}

function assertClose(actual, expected, label) {
  assert(Math.abs(actual - expected) <= EPSILON, `${label}: expected ${expected}, got ${actual}`);
}

function assertSameOmega(actual, expected, label) {
  assertCanonicalSpin(actual, label);
  assertCanonicalSpin(expected, `${label} expected`);
  assertClose(actual.omega.x, expected.omega.x, `${label}.omega.x`);
  assertClose(actual.omega.y, expected.omega.y, `${label}.omega.y`);
  assertClose(actual.omega.z, expected.omega.z, `${label}.omega.z`);
}

function findCanonicalPreset(presets) {
  return presets.find((preset) => {
    const omega = preset.variation?.spin3d?.omega;
    return (
      preset.variation?.spin3d?.schema === SCHEMA &&
      omega &&
      Math.abs(omega.x) > 1 &&
      Math.abs(omega.y) > 1 &&
      Number.isFinite(omega.z)
    );
  });
}

function assertSourceContract(page) {
  const source = fs.readFileSync(path.join(ROOT_DIR, page.sourceFile), "utf8");
  for (const requirement of page.requiredSourcePatterns) {
    assert(
      requirement.pattern.test(source),
      `${page.id}: missing explicit ${requirement.label} spin3d handoff`
    );
  }
}

function runPageCase(page, preset) {
  assertSourceContract(page);

  const loader = page.loader();
  const functions = page.instantiate(loader, [
    "simulateServe",
    "simulatePath",
    "solveBaseVelocity",
    "solveServeBounceVelocity",
    "solveVelocity",
    "makeServeAimCandidate",
    "getServeLengthProfile",
    "findServeBounceTime",
    "getServeBounces",
    "serveBounceScore",
    "clone",
    "DT",
    "MAX_STEPS",
    "SIM_TIME_DILATION",
    "bounceOffPlane",
    ...(page.id === "return-studio" ? ["mirrorSpin"] : []),
  ]);

  const servePath = functions.simulateServe(preset);
  assert(Array.isArray(servePath.spins) && servePath.spins.length > 0, `${page.id}: serve path has no spin samples`);
  assertCanonicalSpin(servePath.spins[0], `${page.id}: serve spin`);
  assert(Math.abs(servePath.spins[0].omega.y) > 1, `${page.id}: serve omega.y was lost`);
  assert(Array.isArray(servePath.bounces), `${page.id}: serve path has no bounce list`);

  const core = loader.runtimeExternals || loader.base.runtimeExternals;
  const tableResponse = core.bounceWithSpinPhysical3D(
    {x: 0.32, y: -1.25, z: -1.15},
    preset.variation.spin3d,
    core.CONTACT_FRICTION_MU
  );
  assertCanonicalSpin(tableResponse.spin3d, `${page.id}: table response spin`);
  assertClose(
    tableResponse.spin3d.omega.y,
    preset.variation.spin3d.omega.y,
    `${page.id}: table axial omega.y`
  );

  const racketResponse = functions.bounceOffPlane(
    {x: 0.18, y: -1.15, z: -1.35},
    preset.variation.spin3d,
    {x: 0, y: 1, z: 0},
    {x: 0.26, y: 0, z: -0.38},
    0.76,
    0.4
  );
  assertCanonicalSpin(racketResponse.spin3d, `${page.id}: racket response spin`);

  const returnPath = functions.simulatePath(
    {x: 0.12, y: 1.02, z: 0.58},
    racketResponse.vel,
    {
      gravity: -4.2,
      spin: racketResponse.spin,
      spin3d: racketResponse.spin3d,
    }
  );
  assertCanonicalSpin(returnPath.spins[0], `${page.id}: return flight spin`);
  assertSameOmega(returnPath.spins[0], racketResponse.spin3d, `${page.id}: racket -> return flight`);

  if (page.id === "return-studio") {
    const mirrored = functions.mirrorSpin(preset.variation.spin3d);
    assertCanonicalSpin(mirrored, "return-studio: mirrored spin");
    assertClose(mirrored.omega.x, -preset.variation.spin3d.omega.x, "return-studio: mirrored omega.x");
    assertClose(mirrored.omega.y, -preset.variation.spin3d.omega.y, "return-studio: mirrored omega.y");
    assertClose(mirrored.omega.z, preset.variation.spin3d.omega.z, "return-studio: mirrored omega.z");
  }

  return {
    page: page.id,
    serveOmegaY: servePath.spins[0].omega.y,
    tableOmegaY: tableResponse.spin3d.omega.y,
    racketOmega: racketResponse.spin3d.omega,
    returnOmega: returnPath.spins[0].omega,
  };
}

function main() {
  const presets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const preset = findCanonicalPreset(presets);
  assert(preset, "No mixed canonical schema-2 preset with non-zero omega.x/omega.y was found");

  const results = PAGE_CASES.map((page) => runPageCase(page, preset));
  console.log(JSON.stringify({
    status: "pass",
    scope: "serve -> flight -> table -> racket -> return canonical omega data flow",
    preset: preset.id,
    pages: results,
    interpretation: "data-flow evidence only; not a calibration or physical-truth claim",
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`3D cross-page omega contract failed: ${error.message}`);
  process.exitCode = 1;
}
