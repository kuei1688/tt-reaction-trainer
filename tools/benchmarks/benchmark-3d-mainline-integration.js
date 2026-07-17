const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const TIME_DILATION = Math.sqrt(9.81 / 4.2);
const REAL_STEP = 1 / 120;

function createRuntimeContext() {
  const context = {
    console,
    Math,
    Number,
    Object,
    Array,
    JSON,
    Date,
    Set,
    Map,
    Error,
    TypeError,
    RangeError,
    Infinity,
    NaN,
    isFinite,
    parseFloat,
    parseInt,
  };
  context.globalThis = context;
  vm.createContext(context);
  [
    "shared-physics-core.js",
    "mainline-v2/trainer-state.js",
    "mainline-v2/physics-adapter.js",
    "mainline-v2/serve-data.js",
    "mainline-v2/contact-policy.js",
    "mainline-v2/trajectory-diagnostics.js",
    "mainline-v2/table-geometry.js",
    "mainline-v2/runtime.js",
    "mainline-v2/game5-product.js",
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {filename: file});
  });
  return context;
}

const scenarios = {
  zero: {label: "zero spin", omega: {x: 0, y: 0, z: 0}, velocity: {x: 0, y: 3.8, z: 2.2}},
  side: {label: "omega.y + side spin", omega: {x: 42, y: 70, z: -15}, velocity: {x: 0.25, y: 3.8, z: 2.2}},
  mixed: {label: "mixed omega", omega: {x: 70, y: 70, z: -35}, velocity: {x: 0.25, y: 3.8, z: 2.2}},
};

function vector(value) {
  return {x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0};
}

function makePreset(id, config) {
  return {
    schema: 2,
    id,
    type: "serve",
    start: {x: 0, y: 1, z: -1.1},
    firstBounce: {x: 0, y: 0.781, z: -0.1},
    secondBounce: {x: 0, y: 0.781, z: 0.8},
    variation: {
      velocity: vector(config.velocity),
      spin3d: {schema: 2, omega: vector(config.omega)},
    },
    solve: {gravity: -4.2, timeToFirst: 0.74},
    tags: {source: "isolated-mainline-integration-preview", scenario: id},
  };
}

function runScenario(key, config) {
  const root = createRuntimeContext();
  const preset = makePreset(`isolated-${key}`, config);
  const round = {preset, video: {id: "isolated-video", src: "isolated://mainline-v2", contactTimeSec: 0.32}};
  function runtimeFactory(currentPreset) {
    const core = root.MainlineV2Physics.resolveSharedCore(root);
    const scaleAdapter = root.MainlineV2Physics.createScaleAdapter({
      core,
      timeDilation: TIME_DILATION,
      simulationGravity: -4.2,
    });
    return root.MainlineV2Runtime.createRuntime({
      core,
      preset: currentPreset,
      scaleAdapter,
      contactPolicy: root.MainlineV2Contact.createContactPolicy(),
      contactApi: root.MainlineV2Contact,
      stateApi: root.MainlineV2State,
      serveData: root.MainlineV2ServeData,
      trajectoryDiagnostics: root.MainlineV2TrajectoryDiagnostics,
      tableGeometry: root.MainlineV2TableGeometry.PHYSICAL_TABLE_REFERENCE,
    });
  }

  let nowMs = 0;
  const events = [];
  const controller = root.MainlineV2Game5Product.createController({
    round,
    runtimeFactory,
    now: () => nowMs,
    swingDelayMs: 140,
    dtSimulation: 1 / 120,
    racketInterceptDurationSimulation: 0.3,
    returnDurationSimulation: 0.42,
    trajectoryDiagnostics: root.MainlineV2TrajectoryDiagnostics,
    tableGeometry: root.MainlineV2TableGeometry.PHYSICAL_TABLE_REFERENCE,
    onEvent: (event) => events.push(event.type),
  });

  controller.startRound();
  controller.handoff("benchmark");
  controller.chooseReturn({technique: "push", side: "backhand", direction: "right"});
  let steps = 0;
  let state = controller.snapshot();
  while (state.phase !== "result" && steps < 1000) {
    nowMs += REAL_STEP * 1000;
    state = controller.step(TIME_DILATION * REAL_STEP);
    steps += 1;
  }
  const physics = state.physics;
  const ball = physics && physics.ball;
  const requiredEvents = ["table-bounce", "racket-contact", "return-start", "result"];
  const finite = ball && [ball.position, ball.velocity, ball.omega].every((value) =>
    [value.x, value.y, value.z].every(Number.isFinite));
  const checks = {
    resultSuccess: state.phase === "result" && state.result && state.result.status === "success",
    requiredEvents: requiredEvents.every((event) => events.includes(event)),
    twoContacts: Boolean(physics && physics.contactCount === 2),
    finiteBallState: Boolean(finite),
    canonicalOmegaY: Boolean(ball && Math.abs(ball.omega.y - config.omega.y) < 1e-9),
  };
  return {
    id: key,
    label: config.label,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    steps,
    physicalTimeSec: Number((nowMs / 1000).toFixed(6)),
    finalPhase: state.phase,
    finalSubphase: state.subphase,
    physicsPhase: physics && physics.phase,
    flightLeg: physics && physics.flightLeg,
    contactCount: physics && physics.contactCount,
    finalBall: ball,
    events,
    checks,
  };
}

const results = Object.entries(scenarios).map(([key, config]) => runScenario(key, config));
const output = {
  status: results.every((result) => result.status === "pass") ? "pass" : "fail",
  date: new Date().toISOString(),
  scope: "isolated mainline-v2 3D integration: product phase, real-scale BallState/omega, table contact, racket contact, and return",
  acceptance: "engineering flow and qualitative representability only; no formal page mutation, material calibration, or external numeric fitting",
  timeDilation: TIME_DILATION,
  scenarios: results,
};
const outDir = path.join(ROOT, "AI_CONTEXT");
fs.writeFileSync(path.join(outDir, "3d_mainline_integration_preview.json"), `${JSON.stringify(output, null, 2)}\n`);
const lines = [
  "# Isolated 3D mainline integration preview",
  "",
  `Date: ${output.date}`,
  "",
  "## Scope",
  "",
  "This isolated check drives the existing mainline-v2 product controller through `serve → flight → table contact → racket contact → return → result` while preserving canonical schema-2 BallState and world-space omega. It reads existing shared/core and mainline-v2 files; it does not modify them.",
  "",
  "## Results",
  "",
  "| Scenario | Result | Physical time | Contacts | Required events | omega.y preserved |",
  "|---|---:|---:|---:|---:|---:|",
  ...results.map((result) => `| ${result.label} | ${result.status} | ${result.physicalTimeSec.toFixed(3)} s | ${result.contactCount ?? "—"} | ${result.checks.requiredEvents ? "yes" : "no"} | ${result.checks.canonicalOmegaY ? "yes" : "no"} |`),
  "",
  `Overall status: **${output.status}**`,
  "",
  "## Boundary",
  "",
  "The preview demonstrates engineering data flow and visible qualitative behavior. It is not a claim of material identification, measured trajectory agreement, product readiness, or formal mainline promotion.",
];
fs.writeFileSync(path.join(outDir, "3d_mainline_integration_preview.md"), `${lines.join("\n")}\n`);
console.log(JSON.stringify(output, null, 2));
