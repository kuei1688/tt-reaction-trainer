"use strict";

const assert = require("node:assert/strict");
const { create, pointerToUnitPosition } = require("./entry-drag-controller.js");
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

function event(clientX, clientY, button = 0) {
  return { clientX, clientY, button, prevented: false, preventDefault() { this.prevented = true; } };
}

const rect = { left: 100, top: 50, width: 400, height: 800 };

test("converts mouse coordinates to the stage's unit coordinates", () => {
  assert.deepEqual(pointerToUnitPosition(event(300, 450), rect), { x: 0.5, y: 0.5 });
});

test("left-button down then document move updates the entry position", () => {
  const positions = [];
  const controller = create({ getRect: () => rect, onPosition: (position) => positions.push(position) });
  const down = event(180, 130);
  const move = event(420, 650);
  assert.equal(controller.down(down), true);
  assert.equal(down.prevented, true);
  assert.equal(controller.isDragging(), true);
  assert.equal(controller.move(move), true);
  assert.equal(move.prevented, true);
  assert.deepEqual(positions, [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.75 }]);
});

test("releasing ends the drag and later mouse moves do not alter the entry", () => {
  const positions = [];
  const controller = create({ getRect: () => rect, onPosition: (position) => positions.push(position) });
  controller.down(event(180, 130));
  assert.equal(controller.up(), true);
  assert.equal(controller.isDragging(), false);
  assert.equal(controller.move(event(420, 650)), false);
  assert.equal(positions.length, 1);
});

test("right-click does not start a drag", () => {
  const controller = create({ getRect: () => rect, onPosition: () => assert.fail("should not update") });
  assert.equal(controller.down(event(180, 130, 2)), false);
  assert.equal(controller.isDragging(), false);
});

console.log(`# ${passed} tests passed`);
