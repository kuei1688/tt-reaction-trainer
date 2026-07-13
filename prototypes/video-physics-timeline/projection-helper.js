(function (root) {
  "use strict";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function tableGeometry(width, height, options) {
    const settings = options || {};
    return {
      farY: height * (Number.isFinite(settings.farYRatio) ? settings.farYRatio : 0.34),
      nearY: height * (Number.isFinite(settings.nearYRatio) ? settings.nearYRatio : 0.94),
      farHalf: width * (Number.isFinite(settings.farHalfRatio) ? settings.farHalfRatio : 0.26),
      nearHalf: width * (Number.isFinite(settings.nearHalfRatio) ? settings.nearHalfRatio : 0.47)
    };
  }

  function worldToScreen(position, table, width, height, options) {
    if (!position || !table) throw new Error("position and table are required");
    const geometry = tableGeometry(width, height, options);
    const depth = clamp((position.z + table.length / 2) / table.length, -0.15, 1.15);
    const tableY = mix(geometry.farY, geometry.nearY, depth);
    const halfWidth = mix(geometry.farHalf, geometry.nearHalf, depth);
    const verticalScale = height * mix(0.28, 0.38, clamp(depth, 0, 1));
    return {
      x: width / 2 + (position.x / (table.width / 2)) * halfWidth,
      y: tableY - (position.y - table.top) * verticalScale
    };
  }

  // This is the inverse of worldToScreen for a selected ball height.  A screen
  // point alone cannot describe a unique 3D point, so callers deliberately
  // provide the height they are annotating rather than pretending that video
  // pixels are a calibrated camera measurement.
  function screenToWorld(point, table, width, height, options) {
    if (!point || !table) throw new Error("point and table are required");
    const settings = options || {};
    const ballHeight = Number.isFinite(settings.heightM) ? settings.heightM : table.top;
    const geometry = tableGeometry(width, height, settings);
    const heightAboveTable = ballHeight - table.top;
    const tableYDelta = geometry.nearY - geometry.farY;
    const verticalAtFar = height * 0.28;
    const verticalDelta = height * 0.10;
    const denominator = tableYDelta - heightAboveTable * verticalDelta;
    if (Math.abs(denominator) < 1e-9) throw new Error("selected height cannot be projected");
    const depth = (point.y - geometry.farY + heightAboveTable * verticalAtFar) / denominator;
    const unclampedDepth = settings.clampDepth === false ? depth : clamp(depth, 0, 1);
    const halfWidth = mix(geometry.farHalf, geometry.nearHalf, unclampedDepth);
    return {
      x: ((point.x - width / 2) / halfWidth) * (table.width / 2),
      y: ballHeight,
      z: unclampedDepth * table.length - table.length / 2
    };
  }

  const api = Object.freeze({ tableGeometry, worldToScreen, screenToWorld });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VideoPhysicsProjection = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
