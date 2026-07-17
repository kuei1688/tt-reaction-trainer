(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2MotionHud = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function vector(value, label) {
    const source = value || {};
    return {
      x: finite(source.x, `${label}.x`),
      y: finite(source.y, `${label}.y`),
      z: finite(source.z, `${label}.z`),
    };
  }

  function formatVector(value, unit) {
    return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}) ${unit}`;
  }

  function phaseLabel(productPhase, subphase, physics) {
    const product = productPhase || "—";
    const sub = subphase || "—";
    const physicsPhase = physics && physics.phase || "—";
    const leg = physics && physics.flightLeg || "—";
    return `${product} / ${sub} · ${physicsPhase} / ${leg}`;
  }

  function createModel(input) {
    const source = input || {};
    const physics = source.physics || null;
    const ball = physics && physics.ball;
    if (!ball) {
      return Object.freeze({
        hasBall: false,
        stateLabel: phaseLabel(source.productPhase, source.subphase, physics),
        physicsLabel: "—",
        contactLabel: "—",
        contactCount: 0,
        formatted: Object.freeze({position: "—", velocity: "—", speed: "—"}),
      });
    }

    const position = vector(ball.position, "ball.position");
    const velocity = vector(ball.velocity, "ball.velocity");
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const contact = physics.lastContact || "—";
    const contactCount = Number.isFinite(physics.contactCount) ? physics.contactCount : 0;
    return Object.freeze({
      hasBall: true,
      raw: Object.freeze({position, velocity}),
      speed,
      stateLabel: phaseLabel(source.productPhase, source.subphase, physics),
      physicsLabel: `${physics.phase || "—"} / ${physics.flightLeg || "—"}`,
      contactLabel: String(contact),
      contactCount,
      formatted: Object.freeze({
        position: formatVector(position, "m"),
        velocity: formatVector(velocity, "m/s"),
        speed: `${speed.toFixed(2)} m/s`,
      }),
    });
  }

  return Object.freeze({createModel, formatVector});
}));
