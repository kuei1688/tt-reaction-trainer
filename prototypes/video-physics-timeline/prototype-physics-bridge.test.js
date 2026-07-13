"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const prototypeDir = __dirname;
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.resolve(prototypeDir, "../../shared-physics-core.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.resolve(prototypeDir, "prototype-physics-bridge.js"), "utf8"), context);
const bridge = context.PrototypePhysicsBridge;
const config = JSON.parse(fs.readFileSync(path.resolve(prototypeDir, "timeline-config.json"), "utf8"));
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function worldFor(serve) {
  return bridge.createWorld(serve.physics.initial_ball_state, serve.physics);
}

test("bridge 讀到 shared core 球桌與球網常數", () => {
  assert.equal(bridge.constants.table.length, 2.74);
  assert.equal(bridge.constants.table.width, 1.525);
  assert.equal(bridge.constants.table.net, 0.1525);
});

test("position、velocity 與三軸 spin_rps 都被轉成 world state", () => {
  const serve = config.serves[0];
  const world = worldFor(serve);
  for (const axis of ["x", "y", "z"]) {
    assert.equal(world.position[axis], serve.physics.initial_ball_state.position_m[axis]);
    assert.equal(world.velocity[axis], serve.physics.initial_ball_state.velocity_mps[axis]);
  }
  assert.ok(Math.abs(world.spin.topspin - serve.physics.initial_ball_state.spin_rps.z * Math.PI * 2) < 1e-9);
  assert.ok(Math.abs(world.spin.sidespin - serve.physics.initial_ball_state.spin_rps.y * Math.PI * 2) < 1e-9);
  assert.ok(Math.abs(world.spin.axial - serve.physics.initial_ball_state.spin_rps.x * Math.PI * 2) < 1e-9);
});

test("固定步進實際使用 velocity 與 gravity", () => {
  const world = worldFor(config.serves[0]);
  const initial = { ...world.position };
  bridge.stepWorld(world, 0.1);
  assert.ok(world.position.x > initial.x);
  assert.ok(world.position.z > initial.z);
  assert.ok(world.velocity.y < config.serves[0].physics.initial_ball_state.velocity_mps.y);
});

test("不同發球參數產生不同物理位置", () => {
  const shortWorld = worldFor(config.serves[0]);
  const longWorld = worldFor(config.serves[1]);
  bridge.stepWorld(shortWorld, 0.2);
  bridge.stepWorld(longWorld, 0.2);
  assert.notDeepEqual(shortWorld.position, longWorld.position);
});

test("低球過網會使用 shared net collision 常數反彈", () => {
  const world = bridge.createWorld({
    position_m: { x: 0, y: 0.84, z: -0.03 },
    velocity_mps: { x: 0.4, y: 0, z: 4 },
    spin_rps: { x: 0, y: 0, z: 0 }
  }, { gravity_mps2: -4.2, hit_window_z_m: 1.3 });
  const snapshot = bridge.stepWorld(world, 0.03);
  assert.ok(snapshot.events.some((event) => event.type === "NET_HIT"));
  assert.ok(world.velocity.z < 0);
  assert.ok(world.velocity.x < 0.4);
});

test("碰桌會呼叫 shared bounceWithSpinPhysical 並改變速度與旋轉", () => {
  const world = bridge.createWorld({
    position_m: { x: 0, y: 0.82, z: 0.4 },
    velocity_mps: { x: 0.3, y: -1.2, z: 2 },
    spin_rps: { x: 0, y: 2, z: -12 }
  }, { gravity_mps2: -4.2, hit_window_z_m: 1.3 });
  const beforeSpin = world.spin.topspin;
  const snapshot = bridge.stepWorld(world, 0.04);
  assert.ok(snapshot.events.some((event) => event.type === "TABLE_BOUNCE"));
  assert.equal(world.bounces, 1);
  assert.ok(world.velocity.y > 0);
  assert.notEqual(world.spin.topspin, beforeSpin);
});

test("hit window 事件只出現一次", () => {
  const world = bridge.createWorld({
    position_m: { x: 0, y: 1, z: 1.28 },
    velocity_mps: { x: 0, y: 0, z: 1 },
    spin_rps: { x: 0, y: 0, z: 0 }
  }, { gravity_mps2: -4.2, hit_window_z_m: 1.3 });
  const first = bridge.stepWorld(world, 0.05);
  const second = bridge.stepWorld(world, 0.05);
  assert.equal(first.events.filter((event) => event.type === "HIT_WINDOW_ENTERED").length, 1);
  assert.equal(second.events.filter((event) => event.type === "HIT_WINDOW_ENTERED").length, 0);
});

test("兩組發球參數都能由物理步進抵達玩家 hit window", () => {
  for (const serve of config.serves) {
    const world = worldFor(serve);
    let entered = false;
    for (let frame = 0; frame < 120 && !world.stopped; frame += 1) {
      const snapshot = bridge.stepWorld(world, 1 / 60);
      if (snapshot.events.some((event) => event.type === "HIT_WINDOW_ENTERED")) {
        entered = true;
        break;
      }
    }
    assert.equal(entered, true, `${serve.id} 未抵達 hit window`);
    assert.equal(world.stopped, false, `${serve.id} 在 hit window 前停止`);
    assert.equal(world.bounces, 1, `${serve.id} 應在 handoff 後落桌一次`);
  }
});

console.log(`# ${passed} tests passed`);
