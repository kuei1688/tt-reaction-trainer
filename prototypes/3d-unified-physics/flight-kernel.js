"use strict";

const { finite, vec, add, scale } = require("./canonical-spin.js");
const { cross } = require("./contact-solver.js");

const REAL_SCALE_GRAVITY = vec(0, -9.81, 0);

function createState(input = {}) {
  return {
    position: vec(input.position && input.position.x, input.position && input.position.y, input.position && input.position.z),
    velocity: vec(input.velocity && input.velocity.x, input.velocity && input.velocity.y, input.velocity && input.velocity.z),
    omega: vec(input.omega && input.omega.x, input.omega && input.omega.y, input.omega && input.omega.z),
    mass: finite(input.mass, 0.0027),
    inertia: finite(input.inertia, 7.2e-7),
  };
}

function magnusAcceleration(state, coefficient) {
  return scale(
    cross(state.omega, state.velocity),
    finite(coefficient, 0)
  );
}

function flightAcceleration(state, options = {}) {
  const gravity = options.gravity || REAL_SCALE_GRAVITY;
  const drag = Math.max(0, finite(options.linearDrag, 0));
  const magnus = magnusAcceleration(state, options.magnusCoefficient);
  return add(
    add(vec(gravity.x, gravity.y, gravity.z), scale(state.velocity, -drag)),
    magnus
  );
}

function advanceFlight(inputState, dt, options = {}) {
  const state = createState(inputState);
  const step = Math.max(0, finite(dt));
  const acceleration = flightAcceleration(state, options);
  state.position = add(
    state.position,
    add(scale(state.velocity, step), scale(acceleration, 0.5 * step * step))
  );
  state.velocity = add(state.velocity, scale(acceleration, step));
  const decay = Math.max(0, finite(options.spinDecayRate, 0));
  if (decay > 0) state.omega = scale(state.omega, Math.exp(-decay * step));
  return { state, acceleration };
}

module.exports = {
  REAL_SCALE_GRAVITY,
  createState,
  magnusAcceleration,
  flightAcceleration,
  advanceFlight,
};
