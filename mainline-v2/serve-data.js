(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2ServeData = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = 2;

  function finite(value, label) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be finite`);
    }
    return value;
  }

  function vector(value, label, fallback) {
    const source = value || fallback || {x: 0, y: 0, z: 0};
    return {
      x: finite(source.x, `${label}.x`),
      y: finite(source.y, `${label}.y`),
      z: finite(source.z, `${label}.z`),
    };
  }

  function assertCanonicalSpin3d(value, label) {
    const name = label || "spin3d";
    if (!value || value.schema !== SCHEMA || !value.omega || typeof value.omega !== "object") {
      throw new Error(`${name} must be canonical schema-${SCHEMA} with omega`);
    }
    return {
      schema: SCHEMA,
      omega: vector(value.omega, `${name}.omega`),
    };
  }

  function copyObject(value) {
    return value && typeof value === "object" ? {...value} : {};
  }

  function canonicalizePreset(raw, index) {
    const label = raw && (raw.id || raw.label) || `preset[${index}]`;
    if (!raw || typeof raw !== "object") {
      throw new Error(`${label} must be an object`);
    }
    if (!raw.variation || typeof raw.variation !== "object") {
      throw new Error(`${label} is missing variation`);
    }
    // Deliberately require spin3d here. There is no legacy fallback in v2.
    const spin3d = assertCanonicalSpin3d(raw.variation.spin3d, `${label}.variation.spin3d`);
    const variation = {spin3d};
    if (raw.variation.velocity) {
      variation.velocity = vector(raw.variation.velocity, `${label}.variation.velocity`);
    }
    if (Number.isFinite(raw.variation.bounce)) {
      variation.bounce = raw.variation.bounce;
    }
    return {
      id: String(raw.id || label),
      label: String(raw.label || raw.id || label),
      type: raw.type == null ? "serve" : String(raw.type),
      mode: raw.mode == null ? "" : String(raw.mode),
      tags: copyObject(raw.tags),
      tagLabels: copyObject(raw.tagLabels),
      start: vector(raw.start, `${label}.start`),
      firstBounce: vector(raw.firstBounce, `${label}.firstBounce`),
      secondBounce: vector(raw.secondBounce, `${label}.secondBounce`),
      target: vector(raw.target, `${label}.target`),
      solve: copyObject(raw.solve),
      variation,
    };
  }

  function loadPresetCollection(document) {
    const rawServes = Array.isArray(document) ? document : document && document.serves;
    if (!Array.isArray(rawServes) || rawServes.length === 0) {
      throw new Error("preset document must contain a non-empty serves array");
    }
    return rawServes.map(canonicalizePreset);
  }

  function loadPresetById(presets, id) {
    const found = (presets || []).find((preset) => preset.id === id);
    if (!found) throw new Error(`canonical preset not found: ${id}`);
    return found;
  }

  function findMixedPreset(presets) {
    return (presets || []).find((preset) => {
      const omega = preset.variation.spin3d.omega;
      return Math.abs(omega.x) > 0 && Math.abs(omega.y) > 0;
    }) || null;
  }

  // Existing generated presets keep serve velocity in the legacy page's
  // solver metadata. V2 derives a real-scale launch velocity at this explicit
  // input boundary without changing the formal preset file.
  function deriveServeVelocity(preset, options) {
    const config = options || {};
    const provided = preset && preset.variation && preset.variation.velocity;
    if (provided && Math.hypot(provided.x, provided.y, provided.z) > 1e-9) {
      return vector(provided, "preset.variation.velocity");
    }
    const start = vector(preset && preset.start, "preset.start");
    const target = vector(
      preset && (preset.firstBounce || preset.target),
      "preset.firstBounce"
    );
    const timeDilation = Number.isFinite(config.timeDilation) && config.timeDilation > 0
      ? config.timeDilation
      : 1;
    const simulationTime = Number.isFinite(preset && preset.solve && preset.solve.timeToFirst)
      ? preset.solve.timeToFirst
      : Number.isFinite(preset && preset.solve && preset.solve.flightTime)
        ? preset.solve.flightTime
        : 0.74;
    const realTime = simulationTime / timeDilation;
    if (!(realTime > 0)) throw new Error(`${preset.id} has no positive serve flight time`);
    const realGravity = Number.isFinite(config.realGravity)
      ? config.realGravity
      : (Number.isFinite(preset && preset.solve && preset.solve.gravity)
        ? preset.solve.gravity * timeDilation * timeDilation
        : -9.81);
    if (typeof config.solveLaunchVelocity === "function") {
      const solved = config.solveLaunchVelocity({
        start,
        target,
        omega: preset.variation.spin3d.omega,
        durationSimulation: simulationTime,
        magnusCoefficient: config.magnusCoefficient,
      });
      const solvedVelocity = solved && solved.velocity ? solved.velocity : solved;
      if (solvedVelocity) return vector(solvedVelocity, "3d solved serve velocity");
    }
    return {
      x: (target.x - start.x) / realTime,
      y: (target.y - start.y - 0.5 * realGravity * realTime * realTime) / realTime,
      z: (target.z - start.z) / realTime,
    };
  }

  async function loadPresetFile(url, fetchImplementation) {
    const fetcher = fetchImplementation || (typeof fetch === "function" ? fetch : null);
    if (!fetcher) throw new Error("fetch is required to load browser preset data");
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`preset request failed: ${response.status}`);
    return loadPresetCollection(await response.json());
  }

  return Object.freeze({
    SCHEMA,
    assertCanonicalSpin3d,
    canonicalizePreset,
    loadPresetCollection,
    loadPresetById,
    findMixedPreset,
    deriveServeVelocity,
    loadPresetFile,
  });
}));
