(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2State = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = 2;
  const BALL_RADIUS = 0.02;
  const BALL_MASS = 0.0027;
  const BALL_INERTIA = (2 / 3) * BALL_MASS * BALL_RADIUS * BALL_RADIUS;
  const PHASES = Object.freeze(["idle", "serve", "flight", "contact", "return", "result"]);

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function vector(value, label) {
    const source = value || {x: 0, y: 0, z: 0};
    return {
      x: finite(source.x, `${label}.x`),
      y: finite(source.y, `${label}.y`),
      z: finite(source.z, `${label}.z`),
    };
  }

  function canonicalSpin(spin3d, label) {
    const name = label || "spin3d";
    if (!spin3d || spin3d.schema !== SCHEMA || !spin3d.omega) {
      throw new Error(`${name} must be schema-${SCHEMA}`);
    }
    return {schema: SCHEMA, omega: vector(spin3d.omega, `${name}.omega`)};
  }

  function createBallState(input) {
    const source = input || {};
    const spin3d = source.spin3d || {
      schema: SCHEMA,
      omega: source.omega,
    };
    const canonical = canonicalSpin(spin3d, "BallState.spin3d");
    return {
      position: vector(source.position, "BallState.position"),
      velocity: vector(source.velocity, "BallState.velocity"),
      omega: canonical.omega,
      mass: Number.isFinite(source.mass) && source.mass > 0 ? source.mass : BALL_MASS,
      inertia: Number.isFinite(source.inertia) && source.inertia > 0 ? source.inertia : BALL_INERTIA,
    };
  }

  function cloneBallState(ball) {
    return createBallState(ball);
  }

  function createTrainerState(presetId) {
    return {
      phase: "idle",
      presetId: presetId || null,
      ball: null,
      samples: [],
      diagnostics: [],
      result: null,
      flightLeg: "serve",
      lastContact: null,
      contactCount: 0,
    };
  }

  function startServe(state, preset, serveVelocity) {
    if (!preset || !preset.variation || !preset.variation.spin3d) {
      throw new Error("canonical preset is required to start serve");
    }
    return {
      ...state,
      phase: "serve",
      presetId: preset.id,
      ball: createBallState({
        position: preset.start,
        velocity: serveVelocity || preset.variation.velocity,
        spin3d: preset.variation.spin3d,
      }),
      samples: [],
      diagnostics: [],
      result: null,
      flightLeg: "serve",
      lastContact: null,
      contactCount: 0,
    };
  }

  function withBall(state, phase, ball, diagnostics, sampleMeta) {
    const next = {
      ...state,
      phase,
      ball: cloneBallState(ball),
    };
    if (diagnostics) next.diagnostics = state.diagnostics.concat([diagnostics]);
    next.samples = state.samples.concat([{
      phase,
      ball: cloneBallState(ball),
      ...(sampleMeta || {}),
    }]);
    return next;
  }

  function setResult(state, result) {
    return {...state, phase: "result", result: result == null ? null : {...result}};
  }

  return Object.freeze({
    SCHEMA,
    PHASES,
    createBallState,
    cloneBallState,
    createTrainerState,
    startServe,
    withBall,
    setResult,
  });
}));
