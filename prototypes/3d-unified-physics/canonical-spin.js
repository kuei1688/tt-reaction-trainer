"use strict";

const SCHEMA_VERSION = 2;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function vec(x = 0, y = 0, z = 0) {
  return { x: finite(x), y: finite(y), z: finite(z) };
}

function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function scale(a, factor) {
  return vec(a.x * factor, a.y * factor, a.z * factor);
}

function norm(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a) {
  const length = norm(a);
  return length > 1e-12 ? scale(a, 1 / length) : vec();
}

function cloneOmega(omega) {
  return vec(omega && omega.x, omega && omega.y, omega && omega.z);
}

function isPhysicalSpin(value) {
  return Boolean(
    value &&
      value.schema === SCHEMA_VERSION &&
      value.omega &&
      Number.isFinite(value.omega.x) &&
      Number.isFinite(value.omega.y) &&
      Number.isFinite(value.omega.z)
  );
}

function physicalSpinFromOmega(omega) {
  return {
    schema: SCHEMA_VERSION,
    omega: cloneOmega(omega),
  };
}

function axialComponent(intent) {
  return finite(
    intent &&
      (intent.axialSpinRelativeToVelocity ??
        intent.axialSpin ??
        intent.axialSpinRadPerSec)
  );
}

function sideComponent(intent) {
  if (intent && intent.omega && Number.isFinite(intent.omega.y)) {
    return intent.omega.y;
  }
  const explicit = intent &&
    (intent.sideSpin ?? intent.sidespin ?? intent.sideMagnitude);
  const magnitude = Math.abs(finite(explicit));
  if (intent && intent.sideName === "left") return magnitude;
  if (intent && intent.sideName === "right") return -magnitude;
  return finite(explicit);
}

/**
 * Convert authoring metadata into the only spin representation consumed by
 * the prototype's forward model. The conversion is intentionally performed
 * once, at the boundary; no later force/contact evaluation re-resolves an
 * axial scalar from a changing velocity.
 */
function physicalSpinFromIntent(intent, velocity) {
  if (isPhysicalSpin(intent)) {
    return physicalSpinFromOmega(intent.omega);
  }

  const base = vec(
    intent && intent.omega && Number.isFinite(intent.omega.x)
      ? intent.omega.x
      : intent && (intent.verticalSpin ?? intent.topspin),
    sideComponent(intent),
    intent && intent.omega && Number.isFinite(intent.omega.z)
      ? intent.omega.z
      : 0
  );
  const velocityAxis = normalize(velocity || vec());
  return physicalSpinFromOmega(add(base, scale(velocityAxis, axialComponent(intent))));
}

/**
 * Legacy data is accepted only at an explicit boundary. Its sidespin sign is
 * preserved as a compatibility axis (negative world-Z in the old x-kick
 * convention); it is never used to infer a left/right metadata label.
 */
function physicalSpinFromLegacy(legacy, velocity) {
  return physicalSpinFromIntent(
    {
      omega: {
        x: legacy && legacy.topspin,
        y: 0,
        z: -(legacy && legacy.sidespin),
      },
      axialSpin: 0,
    },
    velocity
  );
}

function physicalSpinFromInput(input, velocity) {
  if (isPhysicalSpin(input)) return physicalSpinFromOmega(input.omega);
  if (input && input.omega) {
    return physicalSpinFromIntent(
      { omega: input.omega, axialSpin: input.axialSpin },
      velocity
    );
  }
  if (input && (input.omega || input.verticalSpin !== undefined || input.sideName)) {
    return physicalSpinFromIntent(input, velocity);
  }
  return physicalSpinFromLegacy(input || {}, velocity);
}

module.exports = {
  SCHEMA_VERSION,
  finite,
  vec,
  add,
  scale,
  norm,
  normalize,
  isPhysicalSpin,
  physicalSpinFromOmega,
  physicalSpinFromIntent,
  physicalSpinFromLegacy,
  physicalSpinFromInput,
};
