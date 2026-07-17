(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MainlineV2TableGeometry = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Display references copied from the existing table model. These values are
  // intentionally local to this visual mapper and are not physics inputs.
  const PHYSICAL_TABLE_REFERENCE = Object.freeze({
    length: 2.74,
    width: 1.525,
    surfaceY: 0.781,
    netHeight: 0.1525,
    ballRadius: 0.02,
  });

  // These are presentation parameters: they describe the camera trapezoid,
  // not a new physical calibration or a replacement for shared-physics-core.
  const VISUAL_PROJECTION = Object.freeze({
    farY: 0.24,
    nearY: 0.84,
    farHalfWidth: 0.30,
    nearHalfWidth: 0.46,
    heightScale: 0.30,
    maxHeight: 2.15,
    outsideDepth: 0.24,
  });

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function point(value, fallbackY) {
    const source = value || {};
    return {
      x: finite(source.x, 0),
      y: finite(source.y, fallbackY),
      z: finite(source.z, 0),
    };
  }

  function createProjector(size) {
    const dimensions = size || {};
    const width = Math.max(1, finite(dimensions.width, 1));
    const height = Math.max(1, finite(dimensions.height, 1));
    const table = PHYSICAL_TABLE_REFERENCE;
    const projection = VISUAL_PROJECTION;

    function depthForZ(z) {
      return (z + table.length / 2) / table.length;
    }

    function projectWorld(value) {
      const source = point(value, table.surfaceY);
      const depth = clamp(depthForZ(source.z), -projection.outsideDepth, 1 + projection.outsideDepth);
      const halfWidth = lerp(projection.farHalfWidth, projection.nearHalfWidth, depth) * width;
      const x = width / 2 + (source.x / (table.width / 2)) * halfWidth;
      const tableY = lerp(projection.farY, projection.nearY, depth) * height;
      const aboveSurface = clamp(Math.max(0, source.y - table.surfaceY), 0, projection.maxHeight);
      const y = tableY - aboveSurface * projection.heightScale * height;
      return {x, y, depth, aboveSurface};
    }

    function projectTablePoint(value) {
      const source = point(value, table.surfaceY);
      return projectWorld({
        x: clamp(source.x, -table.width / 2, table.width / 2),
        y: table.surfaceY,
        z: clamp(source.z, -table.length / 2, table.length / 2),
      });
    }

    function segment(a, b) {
      return {a: projectWorld(a), b: projectWorld(b)};
    }

    return Object.freeze({
      width,
      height,
      physical: table,
      projection,
      projectWorld,
      projectTablePoint,
      tablePolygon() {
        return [
          projectTablePoint({x: -table.width / 2, z: -table.length / 2}),
          projectTablePoint({x: table.width / 2, z: -table.length / 2}),
          projectTablePoint({x: table.width / 2, z: table.length / 2}),
          projectTablePoint({x: -table.width / 2, z: table.length / 2}),
        ];
      },
      centerSegment() {
        return segment(
          {x: 0, y: table.surfaceY, z: -table.length / 2},
          {x: 0, y: table.surfaceY, z: table.length / 2}
        );
      },
      netSegment() {
        return segment(
          {x: -table.width / 2, y: table.surfaceY + table.netHeight, z: 0},
          {x: table.width / 2, y: table.surfaceY + table.netHeight, z: 0}
        );
      },
    });
  }

  return Object.freeze({
    PHYSICAL_TABLE_REFERENCE,
    VISUAL_PROJECTION,
    createProjector,
  });
}));
