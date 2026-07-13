"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const annotatorDir = __dirname;
const prototypeDir = path.resolve(annotatorDir, "../..");
const context = vm.createContext({ console });
for (const file of [
  path.resolve(prototypeDir, "../../shared-physics-core.js"),
  path.resolve(prototypeDir, "prototype-physics-bridge.js"),
  path.resolve(prototypeDir, "projection-helper.js"),
  path.resolve(annotatorDir, "preview-runtime.js")
]) vm.runInContext(fs.readFileSync(file, "utf8"), context);

const runtime = context.DirectionCAnnotatorPreviewRuntime;
const bridge = context.PrototypePhysicsBridge;
const projection = context.VideoPhysicsProjection;
const config = JSON.parse(fs.readFileSync(path.resolve(prototypeDir, "timeline-config.json"), "utf8"));
const profile = config.serves.find((serve) => serve.id === "prototype_short").physics;
const deps = { projection, bridge, width: 450, height: 800 };
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

function insideDrawnTable(point) {
  const geometry = projection.tableGeometry(deps.width, deps.height, runtime.MOBILE_TABLE_LAYOUT);
  if (point.y < geometry.farY - 1e-6 || point.y > geometry.nearY + 1e-6) return false;
  const depth = (point.y - geometry.farY) / (geometry.nearY - geometry.farY);
  const halfWidth = geometry.farHalf + (geometry.nearHalf - geometry.farHalf) * depth;
  return Math.abs(point.x - deps.width / 2) <= halfWidth + 1e-6;
}

test("入口世界座標使用 profile 的起始高度 y", () => {
  const world = runtime.entryWorldPosition({ x: 0.313, y: 0.11 }, profile, deps);
  assert.equal(world.y, profile.initial_ball_state.position_m.y);
});

test("入口 UV 與投影可往返（桌面範圍內）", () => {
  const entry = { x: 0.5, y: 0.7 };
  const world = runtime.entryWorldPosition(entry, profile, deps);
  const screen = projection.worldToScreen(world, bridge.constants.table, deps.width, deps.height, runtime.MOBILE_TABLE_LAYOUT);
  assert.ok(Math.abs(screen.x - entry.x * deps.width) < 1e-6);
  assert.ok(Math.abs(screen.y - entry.y * deps.height) < 1e-6);
});

test("訓練球以 profile 真實物理從入口出發", () => {
  const entry = { x: 0.313, y: 0.11 };
  const world = runtime.createEntryWorld(entry, profile, deps);
  const expected = runtime.entryWorldPosition(entry, profile, deps);
  for (const axis of ["x", "y", "z"]) assert.equal(world.position[axis], expected[axis]);
  for (const axis of ["x", "y", "z"]) assert.equal(world.velocity[axis], profile.initial_ball_state.velocity_mps[axis]);
});

test("不同入口產生不同軌跡（入口確實決定物理起點）", () => {
  const left = runtime.traceEntryTrajectory({ x: 0.25, y: 0.6 }, profile, deps);
  const right = runtime.traceEntryTrajectory({ x: 0.75, y: 0.6 }, profile, deps);
  assert.ok(Math.abs(left.points[0].x - right.points[0].x) > 10);
  const lastLeft = left.points[left.points.length - 1];
  const lastRight = right.points[right.points.length - 1];
  assert.ok(Math.abs(lastLeft.x - lastRight.x) > 10);
});

test("桌面反彈點落在畫出來的桌面梯形內（繪製與投影幾何一致）", () => {
  const entries = [{ x: 0.313, y: 0.11 }, { x: 0.5, y: 0.2 }, { x: 0.65, y: 0.55 }];
  let checkedBounces = 0;
  for (const entry of entries) {
    const trace = runtime.traceEntryTrajectory(entry, profile, deps, { maxSteps: 200 });
    for (const bounce of trace.bounces) {
      assert.ok(insideDrawnTable(bounce), `bounce at (${bounce.x.toFixed(1)}, ${bounce.y.toFixed(1)}) for entry (${entry.x}, ${entry.y})`);
      checkedBounces += 1;
    }
  }
  assert.ok(checkedBounces > 0, "at least one table bounce must occur across the sampled entries");
});

test("createBallRun 逐步推進並回報事件與停止狀態", () => {
  const run = runtime.createBallRun({ x: 0.5, y: 0.4 }, profile, deps);
  let sawBounce = false;
  let lastScreen = null;
  for (let i = 0; i < 300 && !run.isStopped(); i += 1) {
    const step = run.step(1 / 60);
    lastScreen = step.screen;
    if (step.events.some((event) => event.type === "TABLE_BOUNCE")) sawBounce = true;
  }
  assert.ok(lastScreen && Number.isFinite(lastScreen.x) && Number.isFinite(lastScreen.y));
  assert.ok(sawBounce, "the stepped preview ball must bounce on the table");
});

console.log(`# ${passed} tests passed`);
