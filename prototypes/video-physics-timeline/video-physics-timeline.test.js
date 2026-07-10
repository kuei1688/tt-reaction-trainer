"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { TimelineEngine, STATES, SUBSTATES, validateConfig } = require("./timeline-engine.js");

const configPath = path.join(__dirname, "timeline-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
let passed = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function startAtHitWindow(serveId, direction) {
  const engine = new TimelineEngine(config);
  assert.equal(engine.start(serveId, direction, 0), true);
  const serve = config.serves.find((item) => item.id === serveId);
  engine.tick(serve.video.physics_trigger_time_sec, 100);
  assert.equal(engine.state, STATES.PHYSICS_SERVE);
  assert.equal(engine.dispatch("BALL_ENTERED_HIT_WINDOW", { sessionId: engine.sessionId, nowMs: 200 }), true);
  assert.equal(engine.state, STATES.AWAIT_PLAYER_HIT);
  return engine;
}

test("設定檔通過 schema 驗證", () => {
  assert.equal(validateConfig(config), config);
});

test("兩支 serve 使用各自的 trigger time", () => {
  const shortEngine = new TimelineEngine(config);
  shortEngine.start("prototype_short", "center", 0);
  shortEngine.tick(1.24, 100);
  assert.equal(shortEngine.state, STATES.SERVE_VIDEO);
  shortEngine.tick(1.25, 110);
  assert.equal(shortEngine.state, STATES.PHYSICS_SERVE);

  const longEngine = new TimelineEngine(config);
  longEngine.start("prototype_long", "center", 0);
  longEngine.tick(2.09, 100);
  assert.equal(longEngine.state, STATES.SERVE_VIDEO);
  longEngine.tick(2.1, 110);
  assert.equal(longEngine.state, STATES.PHYSICS_SERVE);
});

test("currentTime 直接跨過 trigger 仍只交接一次", () => {
  const engine = new TimelineEngine(config);
  engine.start("prototype_short", "left", 0);
  engine.tick(0.4, 20);
  engine.tick(1.9, 40);
  engine.tick(1.95, 60);
  const triggers = engine.eventLog.filter((event) => event.type === "VIDEO_TRIGGER_REACHED");
  assert.equal(triggers.length, 1);
});

test("沒有 PLAYER_HIT 時永久停在 Phase 3", () => {
  const engine = startAtHitWindow("prototype_short", "left");
  engine.tick(2, 999999);
  assert.equal(engine.state, STATES.AWAIT_PLAYER_HIT);
  assert.equal(engine.eventLog.some((event) => event.type === "COUNTER_CONTACT"), false);
});

test("left、center、right 各自選取不同節奏", () => {
  for (const direction of ["left", "center", "right"]) {
    const engine = startAtHitWindow("prototype_short", direction);
    engine.dispatch("PLAYER_HIT", { sessionId: engine.sessionId, nowMs: 500 });
    assert.equal(engine.response, config.serves[0].opponent_responses[direction]);
  }
  const invalid = startAtHitWindow("prototype_short", "left");
  invalid.reset(300);
  assert.equal(invalid.start("prototype_short", "diagonal", 400), false);
});

test("prep 後才開始 delay，contact 時間為兩者總和", () => {
  const engine = startAtHitWindow("prototype_short", "left");
  engine.dispatch("PLAYER_HIT", { sessionId: engine.sessionId, nowMs: 1000 });
  engine.tick(0, 1799);
  assert.equal(engine.substate, SUBSTATES.PREP);
  engine.tick(0, 1800);
  assert.equal(engine.substate, SUBSTATES.COUNTER_DELAY);
  engine.tick(0, 1899);
  assert.equal(engine.substate, SUBSTATES.COUNTER_DELAY);
  engine.tick(0, 1900);
  assert.equal(engine.substate, SUBSTATES.COUNTER_RETURN);
  const order = engine.eventLog.map((event) => event.type);
  assert.ok(order.indexOf("PREP_FINISHED") < order.indexOf("COUNTER_DELAY_FINISHED"));
  assert.ok(order.indexOf("COUNTER_DELAY_FINISHED") < order.indexOf("COUNTER_CONTACT"));
});

test("重複 Hit 與後續 tick 不會產生第二次 contact", () => {
  const engine = startAtHitWindow("prototype_short", "center");
  const sessionId = engine.sessionId;
  assert.equal(engine.dispatch("PLAYER_HIT", { sessionId, nowMs: 1000 }), true);
  assert.equal(engine.dispatch("PLAYER_HIT", { sessionId, nowMs: 1001 }), false);
  engine.tick(0, 1770);
  engine.tick(0, 3000);
  engine.tick(0, 4000);
  assert.equal(engine.eventLog.filter((event) => event.type === "COUNTER_CONTACT").length, 1);
});

test("RALLY_COMPLETE 只在 COUNTER_RETURN 接受一次", () => {
  const engine = startAtHitWindow("prototype_short", "center");
  const sessionId = engine.sessionId;
  engine.dispatch("PLAYER_HIT", { sessionId, nowMs: 1000 });
  assert.equal(engine.dispatch("RALLY_COMPLETE", { sessionId, nowMs: 1001 }), false);
  engine.tick(0, 1770);
  assert.equal(engine.dispatch("RALLY_COMPLETE", { sessionId, nowMs: 1800 }), true);
  assert.equal(engine.state, STATES.COMPLETE);
  assert.equal(engine.dispatch("RALLY_COMPLETE", { sessionId, nowMs: 1801 }), false);
});

test("Reset 後舊 session callback 全部失效", () => {
  const engine = new TimelineEngine(config);
  engine.start("prototype_short", "right", 0);
  engine.tick(2, 100);
  const staleSessionId = engine.sessionId;
  engine.reset(200);
  assert.equal(engine.dispatch("BALL_ENTERED_HIT_WINDOW", { sessionId: staleSessionId, nowMs: 300 }), false);
  assert.equal(engine.state, STATES.IDLE);
  assert.equal(engine.eventLog.filter((event) => event.type === "BALL_ENTERED_HIT_WINDOW").length, 0);
});

test("事件 ID 在同一 session 內唯一", () => {
  const engine = startAtHitWindow("prototype_short", "left");
  engine.dispatch("PLAYER_HIT", { sessionId: engine.sessionId, nowMs: 500 });
  engine.tick(0, 1400);
  const ids = engine.eventLog.map((event) => event.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("缺少必要欄位會失敗", () => {
  const invalid = clone(config);
  delete invalid.serves[0].physics.initial_ball_state.velocity_mps.z;
  assert.throws(() => validateConfig(invalid), /velocity_mps\.z/);
});

test("負數時間會失敗", () => {
  const invalid = clone(config);
  invalid.serves[0].opponent_responses.left.prep_duration_sec = -0.1;
  assert.throws(() => validateConfig(invalid), /不小於零/);
});

test("重複 serve ID 會失敗", () => {
  const invalid = clone(config);
  invalid.serves[1].id = invalid.serves[0].id;
  assert.throws(() => validateConfig(invalid), /重複/);
});

test("缺少方向設定會失敗", () => {
  const invalid = clone(config);
  delete invalid.serves[0].opponent_responses.right;
  assert.throws(() => validateConfig(invalid), /right/);
});

test("正式素材路徑會失敗", () => {
  for (const forbidden of ["../../videos.json", "../../images/contact_backspin/001.mp4", "../../game4.html"]) {
    const invalid = clone(config);
    invalid.serves[0].video.src = forbidden;
    assert.throws(() => validateConfig(invalid), /原型素材|正式素材/);
  }
});

test("WebM 待產製時必須提供程序化替代資料", () => {
  const invalid = clone(config);
  delete invalid.serves[0].video.procedural_fallback;
  assert.throws(() => validateConfig(invalid), /procedural_fallback/);
});

test("程序化替代的起點必須是有效 UV", () => {
  const invalid = clone(config);
  invalid.serves[0].video.procedural_fallback.start_uv.x = 1.2;
  assert.throws(() => validateConfig(invalid), /start_uv\.x/);
});

console.log(`# ${passed} tests passed`);
