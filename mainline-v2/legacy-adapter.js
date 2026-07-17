(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2LegacyAdapter = factory();
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

  function canonicalSpin(spin3d, label) {
    if (!spin3d || spin3d.schema !== SCHEMA || !spin3d.omega) {
      throw new Error(`${label} must resolve to schema-${SCHEMA} spin3d`);
    }
    return {
      schema: SCHEMA,
      omega: {
        x: finite(spin3d.omega.x, `${label}.omega.x`),
        y: finite(spin3d.omega.y, `${label}.omega.y`),
        z: finite(spin3d.omega.z, `${label}.omega.z`),
      },
    };
  }

  function resolveCore(core) {
    const resolved = core || (typeof globalThis !== "undefined" ? globalThis : null);
    if (!resolved || typeof resolved.physics3dPhysicalSpinFromInput !== "function") {
      throw new Error("shared-physics-core is required for the legacy adapter");
    }
    return resolved;
  }

  // This is the only v2 entry point that may consume a legacy spin payload.
  // The runtime receives the returned schema-2 vector and never sees the input.
  function fromLegacySpin(legacySpin, velocity, core) {
    if (!legacySpin || typeof legacySpin !== "object") {
      throw new Error("legacy spin payload is required");
    }
    const resolved = resolveCore(core);
    return canonicalSpin(
      resolved.physics3dPhysicalSpinFromInput(legacySpin, velocity),
      "legacy adapter result"
    );
  }

  function fromLegacyVariation(variation, velocity, core) {
    if (!variation || !variation.spin || variation.spin3d) {
      throw new Error("legacy variation must contain spin and no canonical spin3d");
    }
    return fromLegacySpin(variation.spin, velocity, core);
  }

  return Object.freeze({
    SCHEMA,
    fromLegacySpin,
    fromLegacyVariation,
  });
}));

