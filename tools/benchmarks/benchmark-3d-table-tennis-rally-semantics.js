const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const TIME_DILATION = Math.sqrt(9.81 / 4.2);
const STEP_SIMULATION = TIME_DILATION / 120;

function createContext() {
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
    "mainline-v2/contact-policy.js",
    "mainline-v2/table-geometry.js",
    "tools/3d-table-tennis-rally-semantics.js",
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {filename: file});
  });
  return context;
}

function runScenario(root, key) {
  const simulator = root.TableTennisRallySemantics.createSimulator(key);
  let snapshot = simulator.snapshot();
  let steps = 0;
  while (snapshot.status === "running" && steps < 1000) {
    snapshot = simulator.step(STEP_SIMULATION);
    steps += 1;
  }
  const tableContacts = snapshot.contacts.filter((contact) => contact.kind === "table");
  const racketContacts = snapshot.contacts.filter((contact) => contact.kind === "racket");
  const requiredLabels = [
    "serve-first-bounce",
    "serve-second-bounce",
    "receiver-return",
    "return-to-server-table",
  ];
  const eventLabels = snapshot.contacts.map((contact) => contact.label);
  const finiteBallState = [snapshot.ball.position, snapshot.ball.velocity, snapshot.ball.omega]
    .every((value) => [value.x, value.y, value.z].every(Number.isFinite));
  const checks = {
    semanticPass: snapshot.status === "pass",
    fourPhysicalContacts: snapshot.contacts.length === 4,
    tableRallyOrder: tableContacts.length === 3 &&
      tableContacts[0].side === "server" &&
      tableContacts[1].side === "receiver" &&
      tableContacts[2].side === "server",
    racketAfterSecondBounce: snapshot.checks.racketAfterSecondBounce,
    requiredLabels: requiredLabels.every((label) => eventLabels.includes(label)),
    finiteBallState,
    canonicalOmegaY: Number.isFinite(snapshot.ball.omega.y),
  };
  return {
    id: key,
    label: snapshot.label,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    steps,
    physicalTimeSec: Number(snapshot.physicalTimeSec.toFixed(6)),
    phase: snapshot.phase,
    contacts: snapshot.contacts.map((contact) => ({
      kind: contact.kind,
      label: contact.label,
      side: contact.side,
      point: contact.point,
      omega: contact.omega,
    })),
    finalBall: snapshot.ball,
    checks,
    failure: snapshot.failure,
  };
}

const root = createContext();
const scenarios = Object.keys(root.TableTennisRallySemantics.SCENARIOS);
const results = scenarios.map((key) => runScenario(root, key));
const output = {
  status: results.every((result) => result.status === "pass") ? "pass" : "fail",
  date: new Date().toISOString(),
  scope: "isolated semantics-aware 3D table-tennis rally: server table bounce, receiver table bounce, receiver racket contact, server table return",
  acceptance: "basic rally semantics and canonical BallState/omega flow only; no material calibration, formal page mutation, or external numeric fitting",
  coordinateContract: "world-space z<0 is server half; z>0 is receiver half",
  previewDelivery: "self-contained HTML with an inline isolated physics bundle for file:/// loading",
  playbackClock: "fixed 60 Hz UI timer with two 1/120 simulation steps per tick",
  timeDilation: root.TableTennisRallySemantics.TIME_DILATION,
  scenarios: results,
};

fs.writeFileSync(
  path.join(ROOT, "AI_CONTEXT/isolation-validation/3d_table_tennis_rally_semantics.json"),
  JSON.stringify(output, null, 2) + "\n"
);

const markdown = [
  "# Isolated semantics-aware 3D table-tennis rally",
  "",
  `Date: ${output.date}`,
  "",
  "## Contract",
  "",
  "The isolated flow enforces the basic rally sequence:",
  "",
  "`serve → server-side table bounce → receiver-side table bounce → receiver racket contact → server-side table bounce`",
  "",
  "The world-space coordinate contract is `z < 0 = server half` and `z > 0 = receiver half`.",
  "",
  "## Results",
  "",
  "| Scenario | Result | Physical time | Contacts | Table order | Racket after second bounce |",
  "|---|---:|---:|---:|---:|---:|",
  ...results.map((result) => {
    const tableOrder = result.checks.tableRallyOrder ? "yes" : "no";
    const racketOrder = result.checks.racketAfterSecondBounce ? "yes" : "no";
    return `| ${result.label} | ${result.status} | ${result.physicalTimeSec.toFixed(3)} s | ${result.contacts.length} | ${tableOrder} | ${racketOrder} |`;
  }),
  "",
  `Overall status: **${output.status}**`,
  "",
  "## Boundary",
  "",
  "This is a semantics and state-flow screen. The receiver-facing return plane is an explicit isolated adapter so the return can be checked for server-side landing; it is not a calibrated racket-pose or material model and is not formal mainline behavior.",
  "",
  "The preview HTML embeds the isolated bundle so its start interaction does not depend on loading sibling files from a `file:///` page.",
  "",
  "Playback uses a fixed 60 Hz UI timer and two 1/120 simulation steps per tick, so it does not depend on requestAnimationFrame timing in a local file page.",
  "",
  "## Why this exists",
  "",
  "The earlier mainline-v2 integration preview drove the product shell from the first table contact directly to racket contact and treated `secondBounce` as a validation reference. That is useful plumbing evidence, but it is not a rules-correct table-tennis rally. This screen keeps that limitation isolated and makes the actual three-table-contact sequence observable.",
  "",
].join("\n");

fs.writeFileSync(path.join(ROOT, "AI_CONTEXT/isolation-validation/3d_table_tennis_rally_semantics.md"), markdown);

console.log(JSON.stringify(output, null, 2));
