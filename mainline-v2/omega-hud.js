(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2OmegaHud = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AXES = Object.freeze(["x", "y", "z"]);
  const AXIS_LABELS = Object.freeze({
    x: "上／下旋分量",
    y: "側旋分量",
    z: "軸向分量",
  });
  const EPSILON = 1e-9;

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function canonicalOmega(value) {
    if (!value || typeof value !== "object") throw new Error("canonical omega is required");
    return Object.freeze({
      x: finite(value.x, "omega.x"),
      y: finite(value.y, "omega.y"),
      z: finite(value.z, "omega.z"),
    });
  }

  function format(value) {
    return `${value.toFixed(2)} rad/s`;
  }

  function semanticLabel(omega) {
    const active = AXES
      .filter((axis) => Math.abs(omega[axis]) > EPSILON)
      .map((axis) => AXIS_LABELS[axis]);
    return active.length ? active.join("＋") : "無旋轉";
  }

  function createModel(value) {
    const omega = canonicalOmega(value);
    const magnitude = Math.hypot(omega.x, omega.y, omega.z);
    return Object.freeze({
      raw: omega,
      magnitude,
      semanticLabel: semanticLabel(omega),
      formatted: Object.freeze({
        x: format(omega.x),
        y: format(omega.y),
        z: format(omega.z),
        magnitude: format(magnitude),
      }),
    });
  }

  return Object.freeze({
    AXES,
    AXIS_LABELS,
    createModel,
  });
}));
