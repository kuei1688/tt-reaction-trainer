"use strict";

const assert = require("node:assert/strict");
const projection = require("./projection-helper.js");

const TABLE = { length: 2.74, width: 1.525, height: 0.76, top: 0.781, net: 0.1525 };
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

test("既有 prototype_short 初始狀態投影維持不變", () => {
  const point = projection.worldToScreen({ x: 0.2, y: 1.05, z: 0.15 }, TABLE, 960, 540);
  assert.ok(Math.abs(point.x - 574.8030) < 0.001);
  assert.ok(Math.abs(point.y - 314.6062) < 0.001);
});

test("舞台幾何維持既有 16:9 prototype 比例", () => {
  const geometry = projection.tableGeometry(960, 540);
  assert.ok(Math.abs(geometry.farY - 183.6) < 1e-9);
  assert.ok(Math.abs(geometry.nearY - 507.6) < 1e-9);
  assert.ok(Math.abs(geometry.farHalf - 249.6) < 1e-9);
  assert.ok(Math.abs(geometry.nearHalf - 451.2) < 1e-9);
});

test("screenToWorld 以明確高度反解 worldToScreen 的標註位置", () => {
  const world = { x: -0.18, y: 1.05, z: 0.42 };
  const screen = projection.worldToScreen(world, TABLE, 960, 540);
  const restored = projection.screenToWorld(screen, TABLE, 960, 540, { heightM: world.y });
  for (const axis of ["x", "y", "z"]) assert.ok(Math.abs(restored[axis] - world[axis]) < 1e-9, axis);
});

test("手機 C3 版面可使用獨立桌面幾何且維持投影反解", () => {
  const mobile = { farYRatio: .50, nearYRatio: .91, farHalfRatio: .26, nearHalfRatio: .46 };
  const world = { x: .12, y: .96, z: -.2 };
  const screen = projection.worldToScreen(world, TABLE, 450, 800, mobile);
  const restored = projection.screenToWorld(screen, TABLE, 450, 800, { ...mobile, heightM: world.y });
  assert.equal(projection.tableGeometry(450, 800, mobile).farY, 400);
  for (const axis of ["x", "y", "z"]) assert.ok(Math.abs(restored[axis] - world[axis]) < 1e-9, axis);
});

console.log(`# ${passed} tests passed`);
