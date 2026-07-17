(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MainlineV2TrajectoryDiagnostics = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_TABLE_GEOMETRY = Object.freeze({
    length: 2.74,
    width: 1.525,
    surfaceY: 0.781,
    netHeight: 0.1525,
    netZ: 0,
    ballRadius: 0.02,
  });

  function finite(value, fallback, label) {
    if (Number.isFinite(value)) return value;
    if (fallback !== undefined) return fallback;
    throw new Error(`${label || "value"} must be finite`);
  }

  function vector(value, label) {
    const source = value || {};
    return {
      x: finite(source.x, 0, `${label || "vector"}.x`),
      y: finite(source.y, 0, `${label || "vector"}.y`),
      z: finite(source.z, 0, `${label || "vector"}.z`),
    };
  }

  function mergeGeometry(value) {
    return {...DEFAULT_TABLE_GEOMETRY, ...(value || {})};
  }

  function interpolate(before, after, fraction) {
    const t = Math.max(0, Math.min(1, fraction));
    return {
      x: before.x + (after.x - before.x) * t,
      y: before.y + (after.y - before.y) * t,
      z: before.z + (after.z - before.z) * t,
    };
  }

  function segmentCrossing(beforeBall, afterBall, axis, value) {
    if (!beforeBall || !afterBall || !beforeBall.position || !afterBall.position) return null;
    const before = vector(beforeBall.position, "before.position");
    const after = vector(afterBall.position, "after.position");
    const delta = after[axis] - before[axis];
    if (Math.abs(delta) < 1e-12) return null;
    const fraction = (value - before[axis]) / delta;
    if (!(fraction >= 0 && fraction <= 1)) return null;
    return {fraction, point: interpolate(before, after, fraction)};
  }

  function tableBounds(pointValue, geometry) {
    const table = mergeGeometry(geometry);
    const point = vector(pointValue, "table point");
    const halfWidth = table.width / 2 - table.ballRadius;
    const halfLength = table.length / 2 - table.ballRadius;
    return {
      inBounds: Math.abs(point.x) <= halfWidth && Math.abs(point.z) <= halfLength,
      x: point.x,
      z: point.z,
      limits: {halfWidth, halfLength},
    };
  }

  function tableCrossing(beforeBall, afterBall, geometry, surfaceY) {
    const table = mergeGeometry(geometry);
    const height = Number.isFinite(surfaceY) ? surfaceY : table.surfaceY;
    if (!beforeBall || !afterBall || !beforeBall.velocity || !afterBall.velocity) return null;
    const crossing = segmentCrossing(beforeBall, afterBall, "y", height);
    if (!crossing || !(afterBall.velocity.y < 0)) return null;
    const bounds = tableBounds(crossing.point, table);
    return Object.freeze({
      point: crossing.point,
      fraction: crossing.fraction,
      inBounds: bounds.inBounds,
      bounds,
      surfaceY: height,
    });
  }

  function netCrossing(beforeBall, afterBall, geometry) {
    const table = mergeGeometry(geometry);
    const crossing = segmentCrossing(beforeBall, afterBall, "z", table.netZ);
    if (!crossing || !(afterBall.position.z > beforeBall.position.z)) return null;
    const clearance = crossing.point.y - (table.surfaceY + table.netHeight + table.ballRadius);
    return Object.freeze({
      point: crossing.point,
      fraction: crossing.fraction,
      clearance,
      passesNet: clearance >= 0,
      status: clearance >= 0 ? "clear" : "insufficient-clearance",
      netTopWithBallRadius: table.surfaceY + table.netHeight + table.ballRadius,
    });
  }

  return Object.freeze({
    DEFAULT_TABLE_GEOMETRY,
    interpolate,
    segmentCrossing,
    tableBounds,
    tableCrossing,
    netCrossing,
  });
}));
