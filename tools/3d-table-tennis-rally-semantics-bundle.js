/* Isolated semantics-aware rally bundle. Generated from read-only shared/mainline modules. */
/* This bundle is for the tools/ preview only; it is not formal mainline code. */

/* BEGIN shared-physics-core.js */
// Shared table-bounce physics core.
// Phase 1: 5 constants + 2 functions (approved 2026-07-09).
// Phase 2: 8 constants + 4 functions (approved 2026-07-10).

// ── Constants ──────────────────────────────────────────────────
const TABLE = {length:2.74, width:1.525, height:0.76, top:0.781, net:0.1525};
const BALL_RADIUS = 0.02;
const BALL_MASS = 0.0027;      // kg, ITTF 2.7g
const BALL_INERTIA_ALPHA = 2 / 3; // thin-shell ball inertia coefficient: I = ALPHA * M * R^2
const BALL_INERTIA = BALL_INERTIA_ALPHA * BALL_MASS * BALL_RADIUS * BALL_RADIUS;
const MAX_TABLE_BOUNCES = 8;
const NET_COLLISION = {depth:0.012, zRestitution:0.16, xDamping:0.55, yDamping:0.35};
const OBLIQUE_ANGLE_DEG = 83;

const EPSILON_VERTICAL = 0.876;   // ITTF table bounce test: 30cm drop rebounds to 23cm.
const EPSILON_OBLIQUE = 0.57;     // Measured oblique impact coefficient around 83 degrees.
const EPSILON_MIN = 0.45;         // Conservative lower bound for severe spin/oblique impacts.
const SPIN_EPSILON_REFERENCE = 6.0;
const CONTACT_FRICTION_MU = 0.13;

// ── Canonical 3D spin / flight constants ────────────────────────────────────
// The old `spin.sidespin` field is a compatibility proxy for the x-kick model.
// New data uses `spin3d.omega.y` for real sidespin.  The forward model
// consumes schema-2 world-space omega and never re-injects an axial scalar
// during force/contact evaluation.  These are engineering values, not a claim
// that the current preset library has been physically calibrated.
const SPIN3D_SCHEMA_VERSION = 2;
const REAL_GRAVITY_Y = -9.81;
const AIR_DENSITY = 1.225; // kg/m^3, standard sea-level reference.
// Initial engineering candidate from the low-spin linearized sphere model:
// a_M = C * (omega x v).  Keep this explicit and separately calibratable;
// it is not a claim that the current video preset library is physically true.
const MAGNUS_LIFT_SLOPE = 0.49;
const MAGNUS_COEFFICIENT = 0.5 * AIR_DENSITY * Math.PI * Math.pow(BALL_RADIUS, 3) * MAGNUS_LIFT_SLOPE / BALL_MASS;

// ── Utility functions ─────────────────────────────────────────
function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function horizontalImpactSpeed(vel){
  return Math.hypot(vel.x || 0, vel.z || 0);
}

function spinSurfaceSpeed(spin){
  return BALL_RADIUS * Math.hypot((spin && spin.topspin) || 0, (spin && spin.sidespin) || 0);
}

function physics3dFinite(value){
  return Number.isFinite(value) ? value : 0;
}

function physics3dVec(x, y, z){
  return {x:physics3dFinite(x), y:physics3dFinite(y), z:physics3dFinite(z)};
}

function physics3dCopySpin(spin){
  const omega = spin && spin.omega ? spin.omega : {};
  return {
    schema: SPIN3D_SCHEMA_VERSION,
    omega: physics3dVec(omega.x, omega.y, omega.z)
  };
}

function physics3dHasCanonicalSpin(spin){
  return Boolean(
    spin &&
    spin.schema === SPIN3D_SCHEMA_VERSION &&
    spin.omega &&
    typeof spin.omega === 'object'
  );
}

// Convert the old x-kick compatibility representation into a world-space
// vector without treating its sign as a left/right data label.  In the legacy
// engine, sidespin is represented by the opposite sign on omega.z.
function physics3dFromLegacySpin(spin){
  const legacy = spin || {};
  return physics3dCopySpin({
    omega: {
      x: legacy.topspin,
      y: 0,
      z: -physics3dFinite(legacy.sidespin)
    },
    axialSpin: 0
  });
}

// Boundary adapter for old schema-1 spin3d and legacy spin payloads.  Any
// axial component is resolved once against the input velocity; after this
// function returns, the physical state contains only world-space omega.
function physics3dPhysicalSpinFromInput(spin, velocity){
  if(physics3dHasCanonicalSpin(spin)) return physics3dCopySpin(spin);
  if(spin && spin.omega && typeof spin.omega === 'object'){
    const base = physics3dVec(spin.omega.x, spin.omega.y, spin.omega.z);
    const speed = Math.hypot(
      (velocity && velocity.x) || 0,
      (velocity && velocity.y) || 0,
      (velocity && velocity.z) || 0
    );
    const axial = physics3dFinite(spin.axialSpin);
    if(speed > 1e-9 && Math.abs(axial) > 1e-9){
      return physics3dCopySpin({
        omega: physics3dVec(
          base.x + axial * velocity.x / speed,
          base.y + axial * velocity.y / speed,
          base.z + axial * velocity.z / speed
        )
      });
    }
    return physics3dCopySpin({omega:base});
  }
  return physics3dFromLegacySpin(spin);
}

function physics3dSpinFromVariation(variation, velocity){
  if(variation && variation.spin3d){
    return physics3dPhysicalSpinFromInput(variation.spin3d, velocity);
  }
  return physics3dPhysicalSpinFromInput(variation && variation.spin, velocity);
}

// Compatibility name during migration. Schema-2 input is a pure read;
// schema-1/legacy input is converted at this explicit boundary.
function physics3dResolveOmega(spin, velocity){
  return physics3dPhysicalSpinFromInput(spin, velocity).omega;
}

function physics3dScaleSpin(spin, factor){
  const canonical = physics3dHasCanonicalSpin(spin)
    ? physics3dCopySpin(spin)
    : physics3dPhysicalSpinFromInput(spin);
  return {
    schema: SPIN3D_SCHEMA_VERSION,
    omega: physics3dVec(canonical.omega.x * factor, canonical.omega.y * factor, canonical.omega.z * factor)
  };
}

function physics3dExposeSpin(spin, legacySpin){
  const canonical = physics3dCopySpin(spin);
  return {
    schema: SPIN3D_SCHEMA_VERSION,
    omega: canonical.omega,
    // Keep these fields for existing UI/return code.  They are compatibility
    // values only; new code must read omega.y for true sidespin.
    topspin: canonical.omega.x,
    sidespin: legacySpin && Number.isFinite(legacySpin.sidespin)
      ? legacySpin.sidespin
      : -canonical.omega.z
  };
}

function physics3dCross(a, b){
  return physics3dVec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

function physics3dMagnusAcceleration(velocity, spin, coefficient){
  const omega = physics3dHasCanonicalSpin(spin)
    ? spin.omega
    : physics3dPhysicalSpinFromInput(spin, velocity).omega;
  const scale = Number.isFinite(coefficient) ? coefficient : MAGNUS_COEFFICIENT;
  const lift = physics3dCross(omega, velocity);
  return physics3dVec(lift.x * scale, lift.y * scale, lift.z * scale);
}

function physics3dAdvanceVelocity(velocity, spin, gravity, dt, coefficient){
  const magnus = physics3dMagnusAcceleration(velocity, spin, coefficient);
  return physics3dVec(
    velocity.x + magnus.x * dt,
    velocity.y + ((Number.isFinite(gravity) ? gravity : REAL_GRAVITY_Y) + magnus.y) * dt,
    velocity.z + magnus.z * dt
  );
}

// Page animation still stores simulation-scale velocity for visual timing.
// Convert at this one bridge, advance the kernel in real units, then convert
// only the returned velocity back for the page integrator.
function physics3dAdvanceSimulationVelocity(velocity, spin, simulationGravity, dt, timeDilation, coefficient){
  const D = Number.isFinite(timeDilation) && timeDilation > 0 ? timeDilation : 1;
  const physicalSpin = physics3dPhysicalSpinFromInput(spin, velocity);
  if(Math.abs(D - 1) < 1e-12){
    return physics3dAdvanceVelocity(velocity, physicalSpin, simulationGravity, dt, coefficient);
  }
  const realVelocity = physics3dVec(velocity.x * D, velocity.y * D, velocity.z * D);
  const realSpin = physics3dScaleSpin(physicalSpin, D);
  const realGravity = (Number.isFinite(simulationGravity) ? simulationGravity : REAL_GRAVITY_Y) * D * D;
  const realVelocityAfter = physics3dAdvanceVelocity(realVelocity, realSpin, realGravity, dt / D, coefficient);
  return physics3dVec(realVelocityAfter.x / D, realVelocityAfter.y / D, realVelocityAfter.z / D);
}

// ── General 3D plane contact kernel ───────────────────────────────────────
function physics3dAdd(a, b){
  return physics3dVec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function physics3dSub(a, b){
  return physics3dVec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function physics3dScale(a, factor){
  return physics3dVec(a.x * factor, a.y * factor, a.z * factor);
}

function physics3dDot(a, b){
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function physics3dNorm(a){
  return Math.hypot(a.x, a.y, a.z);
}

function physics3dNormalize(a){
  const length = physics3dNorm(a);
  return length > 1e-12 ? physics3dScale(a, 1 / length) : physics3dVec(0, 1, 0);
}

function physics3dContactPointVelocity(state, offset, surfaceVelocity){
  return physics3dSub(
    physics3dAdd(state.velocity, physics3dCross(state.omega, offset)),
    surfaceVelocity || physics3dVec(0, 0, 0)
  );
}

function physics3dEffectiveMass(state, offset, direction){
  const lever = physics3dCross(offset, direction);
  const mass = Number.isFinite(state.mass) && state.mass > 0 ? state.mass : BALL_MASS;
  const inertia = Number.isFinite(state.inertia) && state.inertia > 0 ? state.inertia : BALL_INERTIA;
  return 1 / mass + physics3dDot(lever, lever) / inertia;
}

function physics3dApplyImpulse(state, offset, impulse){
  const mass = Number.isFinite(state.mass) && state.mass > 0 ? state.mass : BALL_MASS;
  const inertia = Number.isFinite(state.inertia) && state.inertia > 0 ? state.inertia : BALL_INERTIA;
  state.velocity = physics3dAdd(state.velocity, physics3dScale(impulse, 1 / mass));
  state.omega = physics3dAdd(state.omega, physics3dScale(physics3dCross(offset, impulse), 1 / inertia));
}

function physics3dFrictionImpulse(state, offset, basis, surfaceVelocity, normalImpulse, friction){
  if(normalImpulse <= 0 || !Number.isFinite(friction) || friction <= 0){
    return physics3dVec(0, 0, 0);
  }
  const contactVelocity = physics3dContactPointVelocity(state, offset, surfaceVelocity);
  const tangentVelocity = physics3dSub(
    contactVelocity,
    physics3dScale(basis.n, physics3dDot(contactVelocity, basis.n))
  );
  const j1 = -physics3dDot(tangentVelocity, basis.t1) /
    physics3dEffectiveMass(state, offset, basis.t1);
  const j2 = -physics3dDot(tangentVelocity, basis.t2) /
    physics3dEffectiveMass(state, offset, basis.t2);
  const requested = physics3dAdd(
    physics3dScale(basis.t1, j1),
    physics3dScale(basis.t2, j2)
  );
  const limit = Math.max(0, friction) * normalImpulse;
  const requestedMagnitude = physics3dNorm(requested);
  return requestedMagnitude > limit && requestedMagnitude > 1e-12
    ? physics3dScale(requested, limit / requestedMagnitude)
    : requested;
}

function physics3dApplyCompliantContactImpulse(state, contact, normalImpulse, options){
  const cfg = contact || {};
  const opts = options || {};
  const basis = opts.basis || physics3dTangentBasis(cfg.normal || physics3dVec(0, 1, 0));
  const surfaceVelocity = cfg.surfaceVelocity || physics3dVec(0, 0, 0);
  const offset = opts.offset || cfg.contactOffset || physics3dScale(basis.n, -(
    Number.isFinite(cfg.radius) ? cfg.radius : BALL_RADIUS
  ));
  const safeNormalImpulse = Math.max(0, Number.isFinite(normalImpulse) ? normalImpulse : 0);
  if(opts.applyNormal !== false && safeNormalImpulse > 0){
    physics3dApplyImpulse(state, offset, physics3dScale(basis.n, safeNormalImpulse));
  }

  let tangentImpulse;
  if(opts.tangentModel === 'viscous'){
    const dt = Math.max(1e-9, Number.isFinite(opts.dt) ? opts.dt : 1 / 240);
    const contactVelocity = physics3dContactPointVelocity(state, offset, surfaceVelocity);
    const tangentVelocity = physics3dSub(
      contactVelocity,
      physics3dScale(basis.n, physics3dDot(contactVelocity, basis.n))
    );
    const damping = Math.max(0, Number.isFinite(opts.tangentDamping) ? opts.tangentDamping : 0);
    const requestedForce = physics3dScale(tangentVelocity, -damping);
    const normalForce = safeNormalImpulse / dt;
    const limit = Math.max(0, Number.isFinite(cfg.friction) ? cfg.friction : 0) * normalForce;
    const requestedMagnitude = physics3dNorm(requestedForce);
    const boundedForce = requestedMagnitude > limit && requestedMagnitude > 1e-12
      ? physics3dScale(requestedForce, limit / requestedMagnitude)
      : requestedForce;
    tangentImpulse = physics3dScale(boundedForce, dt);
  } else {
    tangentImpulse = physics3dFrictionImpulse(
      state, offset, basis, surfaceVelocity, safeNormalImpulse, cfg.friction
    );
  }
  physics3dApplyImpulse(state, offset, tangentImpulse);
  return {
    basis,
    offset,
    normalImpulse: safeNormalImpulse,
    tangentImpulse,
    contactPointVelocityAfter: physics3dContactPointVelocity(state, offset, surfaceVelocity)
  };
}

function physics3dTangentBasis(normal){
  const n = physics3dNormalize(normal);
  const helper = Math.abs(n.x) < 0.7 ? physics3dVec(1, 0, 0) : physics3dVec(0, 0, 1);
  const t1 = physics3dNormalize(physics3dCross(helper, n));
  const t2 = physics3dNormalize(physics3dCross(n, t1));
  return {n, t1, t2};
}

function physics3dSolvePlaneContact(inputState, contact){
  const source = inputState || {};
  const state = {
    position: physics3dVec(source.position && source.position.x, source.position && source.position.y, source.position && source.position.z),
    velocity: physics3dVec(source.velocity && source.velocity.x, source.velocity && source.velocity.y, source.velocity && source.velocity.z),
    omega: physics3dVec(source.omega && source.omega.x, source.omega && source.omega.y, source.omega && source.omega.z),
    mass: Number.isFinite(source.mass) && source.mass > 0 ? source.mass : BALL_MASS,
    inertia: Number.isFinite(source.inertia) && source.inertia > 0 ? source.inertia : BALL_INERTIA
  };
  const cfg = contact || {};
  const basis = physics3dTangentBasis(cfg.normal || physics3dVec(0, 1, 0));
  const surfaceVelocity = cfg.surfaceVelocity || physics3dVec(0, 0, 0);
  const offset = cfg.contactOffset || physics3dScale(basis.n, -(
    Number.isFinite(cfg.radius) ? cfg.radius : BALL_RADIUS
  ));
  const before = physics3dContactPointVelocity(state, offset, surfaceVelocity);
  const normalVelocity = physics3dDot(before, basis.n);
  const restitution = clamp(Number.isFinite(cfg.restitution) ? cfg.restitution : 0, 0, 1);
  const normalImpulse = normalVelocity < 0
    ? Math.max(0, -(1 + restitution) * normalVelocity / physics3dEffectiveMass(state, offset, basis.n))
    : 0;
  const contactResponse = physics3dApplyCompliantContactImpulse(
    state,
    {...cfg, normal: basis.n, surfaceVelocity, contactOffset: offset},
    normalImpulse,
    {applyNormal: true}
  );
  const tangentImpulse = contactResponse.tangentImpulse;
  return {
    state,
    contactPointVelocityBefore: before,
    contactPointVelocityAfter: physics3dContactPointVelocity(state, offset, surfaceVelocity),
    normalVelocityBefore: normalVelocity,
    normalImpulse,
    tangentImpulse,
    frictionLimited: physics3dNorm(tangentImpulse) >= (Number.isFinite(cfg.friction) ? cfg.friction : 0) * normalImpulse - 1e-12,
    basis: contactResponse.basis,
    offset: contactResponse.offset
  };
}

// Shared compliant contact mode.  This is a generic spring-damper kernel for
// measured or synthetic penetration inputs; page-specific two-stage racket
// dwell-time models remain adapters until their parameters are independently
// validated against contact measurements.
function physics3dSolveCompliantPlaneContact(inputState, contact, options){
  const source = inputState || {};
  const state = {
    position: physics3dVec(source.position && source.position.x, source.position && source.position.y, source.position && source.position.z),
    velocity: physics3dVec(source.velocity && source.velocity.x, source.velocity && source.velocity.y, source.velocity && source.velocity.z),
    omega: physics3dVec(source.omega && source.omega.x, source.omega && source.omega.y, source.omega && source.omega.z),
    mass: Number.isFinite(source.mass) && source.mass > 0 ? source.mass : BALL_MASS,
    inertia: Number.isFinite(source.inertia) && source.inertia > 0 ? source.inertia : BALL_INERTIA
  };
  const cfg = contact || {};
  const opts = options || {};
  const basis = physics3dTangentBasis(cfg.normal || physics3dVec(0, 1, 0));
  const surfaceVelocity = cfg.surfaceVelocity || physics3dVec(0, 0, 0);
  const offset = cfg.contactOffset || physics3dScale(basis.n, -(
    Number.isFinite(cfg.radius) ? cfg.radius : BALL_RADIUS
  ));
  const dt = Math.max(1e-6, Number.isFinite(opts.dt) ? opts.dt : 1 / 240);
  const steps = Math.max(1, Math.floor(Number.isFinite(opts.steps) ? opts.steps : 1));
  const spring = Math.max(0, Number.isFinite(opts.spring) ? opts.spring : 0);
  const damping = Math.max(0, Number.isFinite(opts.damping) ? opts.damping : 0);
  let totalNormalImpulse = 0;
  let totalTangentImpulse = physics3dVec(0, 0, 0);

  for(let index = 0; index < steps; index += 1){
    const penetrationValue = typeof cfg.penetration === 'function'
      ? cfg.penetration(state, index * dt)
      : cfg.penetration;
    const penetration = Math.max(0, Number.isFinite(penetrationValue) ? penetrationValue : 0);
    const contactVelocity = physics3dContactPointVelocity(state, offset, surfaceVelocity);
    const normalVelocity = physics3dDot(contactVelocity, basis.n);
    const normalForce = Math.max(0, spring * penetration - damping * normalVelocity);
    const normalImpulse = normalForce * dt;
    const contactResponse = physics3dApplyCompliantContactImpulse(
      state,
      {...cfg, normal: basis.n, surfaceVelocity, contactOffset: offset},
      normalImpulse,
      {applyNormal: true}
    );
    const tangentImpulse = contactResponse.tangentImpulse;
    totalNormalImpulse += normalImpulse;
    totalTangentImpulse = physics3dAdd(totalTangentImpulse, tangentImpulse);
  }

  return {
    state,
    normalImpulse: totalNormalImpulse,
    tangentImpulse: totalTangentImpulse,
    basis,
    offset,
    steps,
    dt,
    mode: 'compliant'
  };
}

// ── Table bounce physics ───────────────────────────────────────
function dynamicEpsilon(vel, spin){
  const normalSpeed = Math.abs(vel.y);
  if(normalSpeed < 1e-9) return EPSILON_MIN;
  const obliqueHorizontalSpeed = normalSpeed * Math.tan(OBLIQUE_ANGLE_DEG * Math.PI / 180);
  const baselineT = clamp(horizontalImpactSpeed(vel) / obliqueHorizontalSpeed, 0, 1);
  const baselineEpsilon = EPSILON_VERTICAL + (EPSILON_OBLIQUE - EPSILON_VERTICAL) * baselineT;
  const spinT = clamp(spinSurfaceSpeed(spin || {topspin:0,sidespin:0}) / SPIN_EPSILON_REFERENCE, 0, 1);
  const spinPenalty = (EPSILON_OBLIQUE - EPSILON_MIN) * spinT;
  return clamp(baselineEpsilon - spinPenalty, EPSILON_MIN, EPSILON_VERTICAL);
}

function bounceTangentialAxis(v, omega, normalImpulse, mu){
  const slip = v - omega * BALL_RADIUS;
  if(Math.abs(slip) < 1e-9) return {v2:v, omega2:omega, regime:'rolling'};
  const omega2Roll = (BALL_MASS * v * BALL_RADIUS + BALL_INERTIA * omega) / (BALL_MASS * BALL_RADIUS * BALL_RADIUS + BALL_INERTIA);
  const v2Roll = omega2Roll * BALL_RADIUS;
  const jNeededForRoll = BALL_MASS * (v2Roll - v);
  const jAvailable = mu * normalImpulse;
  if(Math.abs(jNeededForRoll) <= jAvailable) return {v2:v2Roll, omega2:omega2Roll, regime:'rolling'};
  const jFriction = -Math.sign(slip) * jAvailable;
  const v2 = v + jFriction / BALL_MASS;
  const omega2 = omega - jFriction / (BALL_INERTIA / BALL_RADIUS);
  return {v2, omega2, regime:'sliding'};
}

function bounceWithSpinPhysical(vel, spin, mu){
  const epsilon = dynamicEpsilon(vel, spin);
  const normalImpulse = BALL_MASS * (1 + epsilon) * Math.abs(vel.y);
  const vyAfter = -epsilon * vel.y;
  const zResult = bounceTangentialAxis(vel.z, spin.topspin || 0, normalImpulse, mu);
  const xResult = bounceTangentialAxis(vel.x, -(spin.sidespin || 0), normalImpulse, mu);
  return {
    vel:{x:xResult.v2, y:vyAfter, z:zResult.v2},
    spin:{topspin:zResult.omega2, sidespin:-xResult.omega2},
    epsilon,
    regime:{topspin:zResult.regime, sidespin:xResult.regime}
  };
}

function dynamicEpsilon3D(vel, spin3d){
  const omega = physics3dPhysicalSpinFromInput(spin3d, vel).omega;
  // For a +Y table, only omega.x/omega.z contribute to table-plane contact
  // slip.  omega.y is axial to the table normal and remains untouched.
  return dynamicEpsilon(vel, {
    topspin: omega.x,
    sidespin: -omega.z
  });
}

// General table contact: the +Y plane is only a parameter choice.  True
// sidespin around omega.y is carried through without being routed through the
// legacy x-kick equations, while the same kernel can later serve a racket
// plane with arbitrary normal and surface velocity.
function bounceWithSpinPhysical3D(vel, spin, mu){
  const canonical = physics3dPhysicalSpinFromInput(spin, vel);
  const state = {
    position: physics3dVec(0, 0, 0),
    velocity: physics3dVec(vel.x, vel.y, vel.z),
    omega: canonical.omega,
    mass: BALL_MASS,
    inertia: BALL_INERTIA
  };
  const response = physics3dSolvePlaneContact(state, {
    normal: physics3dVec(0, 1, 0),
    surfaceVelocity: physics3dVec(0, 0, 0),
    restitution: dynamicEpsilon3D(vel, canonical),
    friction: mu,
    radius: BALL_RADIUS
  });
  const spin3d = physics3dCopySpin({omega:response.state.omega});
  const regime = response.frictionLimited ? 'sliding' : 'rolling';
  return {
    vel:response.state.velocity,
    spin3d,
    spin:physics3dExposeSpin(spin3d, spin && spin.sidespin !== undefined ? spin : null),
    epsilon:dynamicEpsilon3D(vel, canonical),
    regime:{topspin:regime, sidespin:regime}
  };
}

/* END shared-physics-core.js */


/* BEGIN mainline-v2/trainer-state.js */
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

/* END mainline-v2/trainer-state.js */


/* BEGIN mainline-v2/physics-adapter.js */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2Physics = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CORE_FUNCTIONS = [
    "physics3dAdvanceVelocity",
    "physics3dSolvePlaneContact",
  ];

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function vec(value, label) {
    const source = value || {x: 0, y: 0, z: 0};
    return {
      x: finite(source.x, `${label}.x`),
      y: finite(source.y, `${label}.y`),
      z: finite(source.z, `${label}.z`),
    };
  }

  function resolveSharedCore(source) {
    const candidate = source && source.MainlineV2Core || source ||
      (typeof globalThis !== "undefined" ? globalThis : null);
    const missing = CORE_FUNCTIONS.filter((name) => !candidate || typeof candidate[name] !== "function");
    if (missing.length) {
      throw new Error(`shared-physics-core missing: ${missing.join(", ")}`);
    }
    return {
      ...candidate,
      BALL_RADIUS: Number.isFinite(candidate.BALL_RADIUS) ? candidate.BALL_RADIUS : 0.02,
      BALL_MASS: Number.isFinite(candidate.BALL_MASS) ? candidate.BALL_MASS : 0.0027,
      BALL_INERTIA: Number.isFinite(candidate.BALL_INERTIA)
        ? candidate.BALL_INERTIA
        : (2 / 3) * 0.0027 * 0.02 * 0.02,
      REAL_GRAVITY_Y: Number.isFinite(candidate.REAL_GRAVITY_Y) ? candidate.REAL_GRAVITY_Y : -9.81,
    };
  }

  function copyBallState(state) {
    return {
      position: vec(state.position, "ball.position"),
      velocity: vec(state.velocity, "ball.velocity"),
      omega: vec(state.omega, "ball.omega"),
      mass: finite(state.mass, "ball.mass"),
      inertia: finite(state.inertia, "ball.inertia"),
    };
  }

  function add(a, b) {
    return {x: a.x + b.x, y: a.y + b.y, z: a.z + b.z};
  }

  function scale(value, factor) {
    return {x: value.x * factor, y: value.y * factor, z: value.z * factor};
  }

  function subtract(a, b) {
    return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
  }

  function magnitude(value) {
    return Math.hypot(value.x, value.y, value.z);
  }

  function solveLinear3(matrix, right) {
    const rows = matrix.map((row, index) => [row[0], row[1], row[2], right[index]]);
    for (let column = 0; column < 3; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < 3; row += 1) {
        if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
      }
      if (Math.abs(rows[pivot][column]) < 1e-10) return null;
      [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
      const divisor = rows[column][column];
      for (let entry = column; entry < 4; entry += 1) rows[column][entry] /= divisor;
      for (let row = 0; row < 3; row += 1) {
        if (row === column) continue;
        const factor = rows[row][column];
        for (let entry = column; entry < 4; entry += 1) {
          rows[row][entry] -= factor * rows[column][entry];
        }
      }
    }
    return {x: rows[0][3], y: rows[1][3], z: rows[2][3]};
  }

  function createScaleAdapter(options) {
    const config = options || {};
    const core = resolveSharedCore(config.core);
    const timeDilation = Number.isFinite(config.timeDilation) && config.timeDilation > 0
      ? config.timeDilation
      : 1;
    const simulationGravity = Number.isFinite(config.simulationGravity)
      ? config.simulationGravity
      : -9.81 / (timeDilation * timeDilation);
    const realGravity = Number.isFinite(config.realGravity)
      ? config.realGravity
      : simulationGravity * timeDilation * timeDilation;

    function realToSimulationState(state) {
      const source = copyBallState(state);
      return {
        ...source,
        velocity: scale(source.velocity, 1 / timeDilation),
        omega: scale(source.omega, 1 / timeDilation),
      };
    }

    function simulationToRealState(state) {
      const source = copyBallState(state);
      return {
        ...source,
        velocity: scale(source.velocity, timeDilation),
        omega: scale(source.omega, timeDilation),
      };
    }

    // The runtime stores real-scale BallState. Only this adapter knows that
    // one animation step represents dt / D seconds of physical time.
    function advanceSimulationState(state, dtSimulation, magnusCoefficient) {
      const source = copyBallState(state);
      const dt = finite(dtSimulation, "dtSimulation");
      if (dt < 0) throw new Error("dtSimulation must not be negative");
      const dtReal = dt / timeDilation;
      const nextVelocity = core.physics3dAdvanceVelocity(
        source.velocity,
        {schema: 2, omega: source.omega},
        realGravity,
        dtReal,
        magnusCoefficient
      );
      const averageVelocity = scale(add(source.velocity, nextVelocity), 0.5);
      return {
        ...source,
        position: add(source.position, scale(averageVelocity, dtReal)),
        velocity: vec(nextVelocity, "advanced ball.velocity"),
      };
    }

    function integrateLaunch(start, velocity, omega, durationSimulation, magnusCoefficient, stepSimulation) {
      const position = vec(start, "launch.start");
      let currentVelocity = vec(velocity, "launch.velocity");
      const spin = vec(omega, "launch.omega");
      const duration = finite(durationSimulation, "launch.durationSimulation");
      const step = Number.isFinite(stepSimulation) && stepSimulation > 0
        ? stepSimulation
        : 1 / 240;
      let elapsed = 0;
      while (elapsed < duration - 1e-12) {
        const dtSimulation = Math.min(step, duration - elapsed);
        const dtReal = dtSimulation / timeDilation;
        const nextVelocity = core.physics3dAdvanceVelocity(
          currentVelocity,
          {schema: 2, omega: spin},
          realGravity,
          dtReal,
          magnusCoefficient
        );
        const averageVelocity = scale(add(currentVelocity, nextVelocity), 0.5);
        const delta = scale(averageVelocity, dtReal);
        position.x += delta.x;
        position.y += delta.y;
        position.z += delta.z;
        currentVelocity = nextVelocity;
        elapsed += dtSimulation;
      }
      return {position, velocity: currentVelocity};
    }

    function solveLaunchVelocityDetailed(options) {
      const source = options || {};
      const start = vec(source.start, "launch.start");
      const target = vec(source.target, "launch.target");
      const omega = vec(source.omega, "launch.omega");
      const durationSimulation = finite(source.durationSimulation, "launch.durationSimulation");
      if (!(durationSimulation > 0)) throw new Error("launch.durationSimulation must be positive");
      const durationReal = durationSimulation / timeDilation;
      let velocity = source.initialVelocity
        ? vec(source.initialVelocity, "launch.initialVelocity")
        : {
          x: (target.x - start.x) / durationReal,
          y: (target.y - start.y - 0.5 * realGravity * durationReal * durationReal) / durationReal,
          z: (target.z - start.z) / durationReal,
        };
      const tolerance = Number.isFinite(source.tolerance) && source.tolerance > 0
        ? source.tolerance
        : 1e-5;
      const maxIterations = Number.isFinite(source.maxIterations) && source.maxIterations > 0
        ? Math.floor(source.maxIterations)
        : 16;
      const stepSimulation = Number.isFinite(source.stepSimulation) && source.stepSimulation > 0
        ? source.stepSimulation
        : 1 / 240;
      let result = integrateLaunch(
        start, velocity, omega, durationSimulation, source.magnusCoefficient, stepSimulation
      );
      let error = subtract(target, result.position);
      let residual = magnitude(error);
      let iterations = 0;
      for (; iterations < maxIterations && residual > tolerance; iterations += 1) {
        const jacobian = [];
        for (const axis of ["x", "y", "z"]) {
          const perturbation = Math.max(0.01, Math.abs(velocity[axis]) * 0.002);
          const perturbedVelocity = {...velocity, [axis]: velocity[axis] + perturbation};
          const perturbed = integrateLaunch(
            start, perturbedVelocity, omega, durationSimulation,
            source.magnusCoefficient, stepSimulation
          );
          jacobian.push([
            (perturbed.position.x - result.position.x) / perturbation,
            (perturbed.position.y - result.position.y) / perturbation,
            (perturbed.position.z - result.position.z) / perturbation,
          ]);
        }
        const transposedJacobian = [
          [jacobian[0][0], jacobian[1][0], jacobian[2][0]],
          [jacobian[0][1], jacobian[1][1], jacobian[2][1]],
          [jacobian[0][2], jacobian[1][2], jacobian[2][2]],
        ];
        const correction = solveLinear3(transposedJacobian, [error.x, error.y, error.z]);
        if (!correction) break;
        const candidateVelocity = {
          x: velocity.x + correction.x,
          y: velocity.y + correction.y,
          z: velocity.z + correction.z,
        };
        const candidate = integrateLaunch(
          start, candidateVelocity, omega, durationSimulation,
          source.magnusCoefficient, stepSimulation
        );
        const candidateError = subtract(target, candidate.position);
        const candidateResidual = magnitude(candidateError);
        if (candidateResidual >= residual) {
          velocity = {
            x: velocity.x + correction.x * 0.5,
            y: velocity.y + correction.y * 0.5,
            z: velocity.z + correction.z * 0.5,
          };
        } else {
          velocity = candidateVelocity;
        }
        result = integrateLaunch(
          start, velocity, omega, durationSimulation,
          source.magnusCoefficient, stepSimulation
        );
        error = subtract(target, result.position);
        residual = magnitude(error);
      }
      if (residual > tolerance) {
        throw new Error(`3D launch solve did not converge: residual ${residual}`);
      }
      return Object.freeze({
        velocity: vec(velocity, "solved launch.velocity"),
        predictedTarget: result.position,
        residual,
        iterations,
        durationSimulation,
      });
    }

    function solveLaunchVelocity(options) {
      return solveLaunchVelocityDetailed(options).velocity;
    }

    return Object.freeze({
      timeDilation,
      simulationGravity,
      realGravity,
      realToSimulationState,
      simulationToRealState,
      advanceSimulationState,
      solveLaunchVelocity,
      solveLaunchVelocityDetailed,
    });
  }

  return Object.freeze({
    resolveSharedCore,
    createScaleAdapter,
  });
}));

/* END mainline-v2/physics-adapter.js */


/* BEGIN mainline-v2/contact-policy.js */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2Contact = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = 2;
  const EPSILON = 1e-12;
  const DEFAULT_RACKET_CANDIDATE = Object.freeze({
    normalModel: "compliant",
    tangentModel: "viscous",
    dwellTime: 0.004,
    racketMass: 0.18,
    wristBrake: 20,
    dt: 0.0005,
    steps: 8,
    spring: 5000,
    damping: 4,
    tangentDamping: 0.5,
  });
  const R1_TABLE_CONTACT_PROFILE = Object.freeze({
    normalModel: "compliant",
    tangentModel: "coulomb",
    dwellTime: 0.003,
    dt: 0.00025,
    steps: 12,
    spring: 6000,
    damping: 4,
    tangentDamping: 0,
    penetrationProfile: "harmonic",
    contactModel: "mainline-v2-r1-compliant-3d-table",
  });

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function nonNegative(value, fallback, label) {
    const resolved = Number.isFinite(value) ? value : fallback;
    if (resolved < 0) throw new Error(`${label} must not be negative`);
    return resolved;
  }

  function vector(value, fallback, label) {
    const source = value || fallback || {x: 0, y: 0, z: 0};
    return {
      x: finite(source.x, `${label || "vector"}.x`),
      y: finite(source.y, `${label || "vector"}.y`),
      z: finite(source.z, `${label || "vector"}.z`),
    };
  }

  function add(a, b) {
    return {x: a.x + b.x, y: a.y + b.y, z: a.z + b.z};
  }

  function subtract(a, b) {
    return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
  }

  function scale(value, factor) {
    return {x: value.x * factor, y: value.y * factor, z: value.z * factor};
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function magnitude(value) {
    return Math.hypot(value.x, value.y, value.z);
  }

  function normalize(value, label) {
    const source = vector(value, null, label || "normal");
    const length = magnitude(source);
    if (!(length > EPSILON)) throw new Error(`${label || "normal"} must be non-zero`);
    return scale(source, 1 / length);
  }

  function copyBallWithResponse(ball, velocity, omega) {
    return {
      position: {...ball.position},
      velocity: vector(velocity, null, "response.velocity"),
      omega: vector(omega, null, "response.omega"),
      mass: ball.mass,
      inertia: ball.inertia,
    };
  }

  function kineticEnergy(ball) {
    return 0.5 * ball.mass * dot(ball.velocity, ball.velocity) +
      0.5 * ball.inertia * dot(ball.omega, ball.omega);
  }

  function createMode(options) {
    const source = options || {};
    const normalModel = source.normalModel || "instantaneous";
    const tangentModel = source.tangentModel || "coulomb";
    if (!["instantaneous", "compliant"].includes(normalModel)) {
      throw new Error(`unsupported contact normalModel: ${normalModel}`);
    }
    if (!["coulomb", "viscous"].includes(tangentModel)) {
      throw new Error(`unsupported contact tangentModel: ${tangentModel}`);
    }
    const dwellTime = nonNegative(source.dwellTime, 0, "contact mode dwellTime");
    const racketMass = Number.isFinite(source.racketMass) && source.racketMass > 0
      ? source.racketMass
      : Infinity;
    const wristBrake = nonNegative(source.wristBrake, 0, "contact mode wristBrake");
    const dt = Number.isFinite(source.dt) && source.dt > 0 ? source.dt : 1 / 240;
    const steps = Math.max(1, Math.floor(Number.isFinite(source.steps) ? source.steps : 1));
    const spring = nonNegative(source.spring, 0, "contact mode spring");
    const damping = nonNegative(source.damping, 0, "contact mode damping");
    const tangentDamping = nonNegative(source.tangentDamping, 0, "contact mode tangentDamping");
    const penetration = source.penetration;
    const penetrationProfile = source.penetrationProfile || "constant";
    if (!["constant", "harmonic"].includes(penetrationProfile)) {
      throw new Error(`unsupported contact penetrationProfile: ${penetrationProfile}`);
    }
    if (penetration !== undefined && typeof penetration !== "function") {
      nonNegative(penetration, 0, "contact mode penetration");
    }
    if (normalModel === "compliant" && !(dwellTime > 0)) {
      throw new Error("compliant contact mode requires positive dwellTime");
    }
    if (tangentModel === "viscous" && normalModel !== "compliant") {
      throw new Error("viscous tangentModel requires compliant normalModel");
    }
    return Object.freeze({
      normalModel,
      tangentModel,
      dwellTime,
      racketMass,
      wristBrake,
      dt,
      steps,
      spring,
      damping,
      tangentDamping,
      penetration,
      penetrationProfile,
    });
  }

  function createContactPolicy(options) {
    const config = options || {};
    const radius = Number.isFinite(config.radius) ? config.radius : 0.02;
    const tableFriction = Number.isFinite(config.tableFriction) ? config.tableFriction : 0.13;
    const racketFriction = Number.isFinite(config.racketFriction) ? config.racketFriction : 0.4;
    const racketNormalModel = config.racketNormalModel === undefined
      ? DEFAULT_RACKET_CANDIDATE.normalModel
      : config.racketNormalModel;
    const racketTangentModel = config.racketTangentModel === undefined
      ? DEFAULT_RACKET_CANDIDATE.tangentModel
      : config.racketTangentModel;
    const tableNormalModel = config.tableNormalModel === undefined
      ? R1_TABLE_CONTACT_PROFILE.normalModel
      : config.tableNormalModel;
    const tableTangentModel = config.tableTangentModel === undefined
      ? R1_TABLE_CONTACT_PROFILE.tangentModel
      : config.tableTangentModel;
    const tableMode = createMode({
      normalModel: tableNormalModel,
      tangentModel: tableTangentModel,
      dwellTime: Number.isFinite(config.tableDwellTime)
        ? config.tableDwellTime
        : R1_TABLE_CONTACT_PROFILE.dwellTime,
      dt: Number.isFinite(config.tableContactDt)
        ? config.tableContactDt
        : R1_TABLE_CONTACT_PROFILE.dt,
      steps: Number.isFinite(config.tableContactSteps)
        ? config.tableContactSteps
        : R1_TABLE_CONTACT_PROFILE.steps,
      spring: Number.isFinite(config.tableSpring)
        ? config.tableSpring
        : R1_TABLE_CONTACT_PROFILE.spring,
      damping: Number.isFinite(config.tableDamping)
        ? config.tableDamping
        : R1_TABLE_CONTACT_PROFILE.damping,
      tangentDamping: Number.isFinite(config.tableTangentDamping)
        ? config.tableTangentDamping
        : R1_TABLE_CONTACT_PROFILE.tangentDamping,
      penetration: config.tablePenetration,
      penetrationProfile: config.tablePenetrationProfile ||
        R1_TABLE_CONTACT_PROFILE.penetrationProfile,
      racketMass: Infinity,
      wristBrake: 0,
    });
    const tableContactModel = config.tableContactModel ||
      (tableNormalModel === "compliant"
        ? R1_TABLE_CONTACT_PROFILE.contactModel
        : "shared-3d-table");
    const racketMode = createMode({
      normalModel: racketNormalModel,
      tangentModel: racketTangentModel,
      dwellTime: Number.isFinite(config.racketDwellTime)
        ? config.racketDwellTime
        : DEFAULT_RACKET_CANDIDATE.dwellTime,
      racketMass: Number.isFinite(config.racketMass)
        ? config.racketMass
        : DEFAULT_RACKET_CANDIDATE.racketMass,
      wristBrake: Number.isFinite(config.racketWristBrake)
        ? config.racketWristBrake
        : DEFAULT_RACKET_CANDIDATE.wristBrake,
      dt: Number.isFinite(config.racketContactDt)
        ? config.racketContactDt
        : DEFAULT_RACKET_CANDIDATE.dt,
      steps: Number.isFinite(config.racketContactSteps)
        ? config.racketContactSteps
        : DEFAULT_RACKET_CANDIDATE.steps,
      spring: Number.isFinite(config.racketSpring)
        ? config.racketSpring
        : DEFAULT_RACKET_CANDIDATE.spring,
      damping: Number.isFinite(config.racketDamping)
        ? config.racketDamping
        : DEFAULT_RACKET_CANDIDATE.damping,
      tangentDamping: Number.isFinite(config.racketTangentDamping)
        ? config.racketTangentDamping
        : DEFAULT_RACKET_CANDIDATE.tangentDamping,
      penetration: config.racketPenetration,
    });
    return Object.freeze({
      table: Object.freeze({
        name: "table",
        kind: "table",
        normal: vector(config.tableNormal, {x: 0, y: 1, z: 0}, "table.normal"),
        surfaceVelocity: vector(config.tableVelocity, null, "table.surfaceVelocity"),
        friction: tableFriction,
        restitution: Number.isFinite(config.tableRestitution) ? config.tableRestitution : 0.76,
        radius,
        contactModel: tableContactModel,
        mode: tableMode,
      }),
      racket: Object.freeze({
        name: "racket",
        kind: "racket",
        adapter: "game5-racket-adapter-v2-temporary",
        // The adapter remains explicitly temporary. V3 centralizes its mode
        // and diagnostics without claiming measured racket parameters.
        normal: vector(config.racketNormal, {x: 0, y: -1, z: 0}, "racket.normal"),
        surfaceVelocity: vector(config.racketVelocity, {x: 0, y: 0, z: 0.45}, "racket.surfaceVelocity"),
        friction: racketFriction,
        restitution: Number.isFinite(config.racketRestitution) ? config.racketRestitution : 0.76,
        radius,
        mode: racketMode,
      }),
    });
  }

  function averageBrakedVelocity(surfaceVelocity, mode) {
    if (!(mode.wristBrake > 0) || !(mode.dwellTime > 0)) return surfaceVelocity;
    const rateTime = mode.wristBrake * mode.dwellTime;
    const averageFactor = (1 - Math.exp(-rateTime)) / rateTime;
    return scale(surfaceVelocity, averageFactor);
  }

  function applyFiniteRacketMass(before, after, mode) {
    if (!Number.isFinite(mode.racketMass)) {
      return {ball: after, applied: false, ratio: 1};
    }
    const ratio = mode.racketMass / (mode.racketMass + before.mass);
    return {
      ball: copyBallWithResponse(
        before,
        add(before.velocity, scale(subtract(after.velocity, before.velocity), ratio)),
        add(before.omega, scale(subtract(after.omega, before.omega), ratio))
      ),
      applied: true,
      ratio,
    };
  }

  function scaledImpulse(value, factor) {
    return scale(vector(value, null, "contact tangentImpulse"), factor);
  }

  function solveRawContact(ball, surface, mode, core) {
    if (!core || typeof core.physics3dSolvePlaneContact !== "function") {
      throw new Error("shared-physics-core plane contact API is required");
    }
    const surfaceVelocity = averageBrakedVelocity(
      vector(surface.surfaceVelocity, null, `${surface.name || "surface"}.surfaceVelocity`),
      mode
    );
    const contact = {
      ...surface,
      normal: normalize(surface.normal, `${surface.name || "surface"}.normal`),
      surfaceVelocity,
    };
    if (mode.normalModel === "instantaneous") {
      return {
        response: core.physics3dSolvePlaneContact(ball, contact),
        surfaceVelocity,
      };
    }
    if (typeof core.physics3dSolveCompliantPlaneContact !== "function") {
      throw new Error("shared-physics-core compliant contact API is required for V3 compliant mode");
    }
    if (!(mode.spring > 0)) {
      throw new Error("V3 compliant mode requires a positive spring parameter");
    }
    const approachSpeed = Math.max(0, -dot(
      subtract(ball.velocity, surfaceVelocity),
      contact.normal
    ));
    let penetration = mode.penetration;
    if (penetration === undefined && surface.kind === "table" &&
        mode.penetrationProfile === "harmonic") {
      const duration = Math.max(mode.dt * mode.steps, mode.dwellTime);
      const peakCompression = approachSpeed * Math.sqrt(ball.mass / mode.spring);
      penetration = (state, elapsed) => {
        const phase = Math.max(0, Math.min(1, elapsed / duration));
        return peakCompression * Math.sin(Math.PI * phase);
      };
    }
    if (penetration === undefined) {
      penetration = approachSpeed * mode.dwellTime / Math.max(1, mode.steps);
    }
    const compliantContact = {
      ...contact,
      penetration,
    };
    const response = core.physics3dSolveCompliantPlaneContact(ball, compliantContact, {
      dt: mode.dt,
      steps: mode.steps,
      spring: mode.spring,
      damping: mode.damping,
      tangentModel: mode.tangentModel === "viscous" ? "viscous" : undefined,
      tangentDamping: mode.tangentDamping,
    });
    return {response, surfaceVelocity};
  }

  function solveContact(request, core) {
    const source = request || {};
    const ball = source.state;
    const surface = source.surface;
    if (!ball || !surface) throw new Error("solveContact requires state and surface");
    if (surface.kind !== "table" && surface.kind !== "racket") {
      throw new Error(`unsupported V3 contact surface: ${surface.name || "unknown"}`);
    }
    const mode = createMode(source.mode || surface.mode);
    const before = copyBallWithResponse(ball, ball.velocity, ball.omega);
    const raw = solveRawContact(before, surface, mode, core);
    const rawState = raw.response.state;
    const massResponse = surface.kind === "racket"
      ? applyFiniteRacketMass(before, rawState, mode)
      : {ball: copyBallWithResponse(before, rawState.velocity, rawState.omega), applied: false, ratio: 1};
    const responseBall = massResponse.ball;
    const rawNormalImpulse = Number.isFinite(raw.response.normalImpulse)
      ? raw.response.normalImpulse
      : 0;
    const rawTangentImpulse = vector(raw.response.tangentImpulse, null, "contact tangentImpulse");
    const normalImpulse = massResponse.applied
      ? rawNormalImpulse * massResponse.ratio
      : rawNormalImpulse;
    const tangentImpulse = massResponse.applied
      ? scaledImpulse(rawTangentImpulse, massResponse.ratio)
      : rawTangentImpulse;
    const tangentMagnitude = magnitude(tangentImpulse);
    const frictionLimit = Math.max(0, Number.isFinite(surface.friction) ? surface.friction : 0) * normalImpulse;
    const frictionRegime = normalImpulse <= EPSILON
      ? "none"
      : (tangentMagnitude > EPSILON && tangentMagnitude >= frictionLimit - EPSILON ? "sliding" : "rolling");
    const dwellTime = mode.normalModel === "compliant"
      ? mode.dwellTime
      : mode.dwellTime;
    const energyDelta = kineticEnergy(responseBall) - kineticEnergy(before);
    const normalVelocityBefore = Number.isFinite(raw.response.normalVelocityBefore)
      ? raw.response.normalVelocityBefore
      : dot(
        subtract(before.velocity, raw.surfaceVelocity),
        normalize(surface.normal, `${surface.name || "surface"}.normal`)
      );
    const diagnostics = {
      normalImpulse,
      tangentImpulse,
      dwellTime,
      normalForce: dwellTime > 0 ? normalImpulse / dwellTime : null,
      frictionRegime,
      energyDelta,
      normalModel: mode.normalModel,
      tangentModel: mode.tangentModel,
      racketMass: mode.racketMass,
      wristBrake: mode.wristBrake,
      contactDt: mode.dt,
      contactSteps: mode.steps,
      spring: mode.spring,
      damping: mode.damping,
      penetrationProfile: mode.penetrationProfile,
      finiteRacketMassApplied: massResponse.applied,
      finiteRacketMassRatio: massResponse.ratio,
      surfaceVelocityEffective: raw.surfaceVelocity,
      normalVelocityBefore,
      contactModel: surface.contactModel || surface.adapter || "shared-plane-contact-v3",
      // V2 consumers used `regime`; keep it as a diagnostic alias while V3
      // standardizes the scalar `frictionRegime` field.
      regime: frictionRegime,
    };
    return {state: responseBall, diagnostics};
  }

  function solveTableContact(request, core) {
    return solveContact({
      ...request,
      surface: {...request.surface, kind: "table"},
    }, core);
  }

  function solveGame5RacketContact(request, core) {
    return solveContact({
      ...request,
      surface: {...request.surface, kind: "racket"},
    }, core);
  }

  return Object.freeze({
    R1_TABLE_CONTACT_PROFILE,
    createContactPolicy,
    createMode,
    kineticEnergy,
    solveTableContact,
    solveGame5RacketContact,
    solveContact,
  });
}));

/* END mainline-v2/contact-policy.js */


/* BEGIN mainline-v2/table-geometry.js */
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

/* END mainline-v2/table-geometry.js */


/* BEGIN tools/3d-table-tennis-rally-semantics.js */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalThis);
  } else {
    root.TableTennisRallySemantics = factory(root);
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const TIME_DILATION = Math.sqrt(9.81 / 4.2);
  const TABLE = root.MainlineV2TableGeometry.PHYSICAL_TABLE_REFERENCE;
  const RACKET_DELAY_SIMULATION = 0.30;
  const DEFAULT_STEP_SIMULATION = TIME_DILATION / 120;

  const PHASES = Object.freeze({
    SERVE_FLIGHT: "serve-flight",
    OWN_TABLE_CONTACT: "own-table-contact",
    OPPONENT_FLIGHT: "opponent-flight",
    OPPONENT_TABLE_CONTACT: "opponent-table-contact",
    RECEIVER_APPROACH: "receiver-approach",
    RACKET_CONTACT: "racket-contact",
    RETURN_FLIGHT: "return-flight",
    OWN_RETURN_CONTACT: "own-return-contact",
    COMPLETE: "complete",
    FAILURE: "failure",
  });

  const SCENARIOS = Object.freeze({
    zero: Object.freeze({
      label: "zero spin",
      omega: Object.freeze({x: 0, y: 0, z: 0}),
      serveVelocity: Object.freeze({x: 0, y: 3.8, z: 0.95}),
    }),
    side: Object.freeze({
      label: "omega.y + side spin",
      omega: Object.freeze({x: 42, y: 70, z: -15}),
      serveVelocity: Object.freeze({x: 0.1, y: 3.8, z: 0.95}),
    }),
    mixed: Object.freeze({
      label: "mixed omega",
      omega: Object.freeze({x: 70, y: 70, z: -35}),
      serveVelocity: Object.freeze({x: 0.1, y: 3.8, z: 0.95}),
    }),
  });

  function vector(value) {
    const source = value || {};
    return {
      x: Number(source.x) || 0,
      y: Number(source.y) || 0,
      z: Number(source.z) || 0,
    };
  }

  function cloneBall(ball) {
    return root.MainlineV2State.cloneBallState(ball);
  }

  function clonePoint(point) {
    const source = point || {};
    return {x: Number(source.x) || 0, y: Number(source.y) || 0, z: Number(source.z) || 0};
  }

  function interpolateToTable(before, after) {
    const denominator = before.position.y - after.position.y;
    const fraction = Math.abs(denominator) > 1e-9
      ? (before.position.y - TABLE.surfaceY) / denominator
      : 1;
    const clamped = Math.max(0, Math.min(1, fraction));
    const position = {
      x: before.position.x + (after.position.x - before.position.x) * clamped,
      y: TABLE.surfaceY,
      z: before.position.z + (after.position.z - before.position.z) * clamped,
    };
    return root.MainlineV2State.createBallState({
      ...after,
      position,
    });
  }

  function crossesDownwardTable(before, after) {
    return before.position.y > TABLE.surfaceY &&
      after.position.y <= TABLE.surfaceY &&
      after.velocity.y < 0;
  }

  function inTable(point) {
    return Math.abs(point.x) <= TABLE.width / 2 + 1e-6 &&
      Math.abs(point.z) <= TABLE.length / 2 + 1e-6;
  }

  function sideForZ(z) {
    return z < 0 ? "server" : "receiver";
  }

  function createReturnRacketSurface(contactPolicy) {
    // The plane is intentionally explicit: it represents the receiver's
    // isolated return-facing plane, not a calibrated racket pose or preset.
    return Object.freeze({
      ...contactPolicy.racket,
      name: "isolated-receiver-return-plane",
      normal: {x: 0, y: 0, z: -1},
      surfaceVelocity: {x: 0, y: 0, z: -1},
      contactModel: "isolated-semantics-racket-return-plane",
    });
  }

  function createPreset(key, scenario) {
    return {
      schema: 2,
      id: `isolated-semantic-${key}`,
      type: "serve",
      start: {x: 0, y: 1, z: -1.1},
      firstBounce: {x: 0, y: TABLE.surfaceY, z: -0.29},
      secondBounce: {x: 0, y: TABLE.surfaceY, z: 0.4},
      variation: {
        velocity: vector(scenario.serveVelocity),
        spin3d: {schema: 2, omega: vector(scenario.omega)},
      },
      solve: {gravity: -4.2, timeToFirst: 0.74},
      tags: {
        source: "isolated-semantics-aware-rally-preview",
        scenario: key,
      },
    };
  }

  function createSimulator(key) {
    const scenario = SCENARIOS[key] || SCENARIOS.side;
    const core = root.MainlineV2Physics.resolveSharedCore(root);
    const scaleAdapter = root.MainlineV2Physics.createScaleAdapter({
      core,
      timeDilation: TIME_DILATION,
      simulationGravity: -4.2,
    });
    const contactPolicy = root.MainlineV2Contact.createContactPolicy();
    const returnRacket = createReturnRacketSurface(contactPolicy);
    const preset = createPreset(key, scenario);
    let ball = root.MainlineV2State.createBallState({
      position: preset.start,
      velocity: preset.variation.velocity,
      spin3d: preset.variation.spin3d,
    });
    let phase = PHASES.SERVE_FLIGHT;
    let physicalTimeSec = 0;
    let receiverElapsedSimulation = 0;
    let lastContact = null;
    const contacts = [];
    const events = [{
      type: "serve-start",
      side: "server",
      point: clonePoint(ball.position),
      time: 0,
    }];
    const trace = [{
      time: 0,
      phase,
      ball: cloneBall(ball),
    }];
    let failure = null;

    function addEvent(type, data) {
      const event = {
        type,
        time: physicalTimeSec,
        ...(data || {}),
      };
      events.push(event);
      return event;
    }

    function addTrace() {
      trace.push({
        time: physicalTimeSec,
        phase,
        ball: cloneBall(ball),
      });
    }

    function fail(reason, detail) {
      if (failure) return;
      failure = {reason, detail: detail || null};
      phase = PHASES.FAILURE;
      addEvent("semantic-failure", failure);
      addTrace();
    }

    function contactTable(expectedSide, label) {
      const actualSide = sideForZ(ball.position.z);
      const legalPosition = inTable(ball.position);
      const sideMatches = expectedSide === actualSide;
      if (!legalPosition || !sideMatches) {
        fail("illegal-table-side", {
          label,
          expectedSide,
          actualSide,
          position: clonePoint(ball.position),
          inTable: legalPosition,
        });
        return;
      }
      const response = root.MainlineV2Contact.solveContact({
        state: ball,
        surface: contactPolicy.table,
        mode: contactPolicy.table.mode,
      }, core);
      ball = response.state;
      lastContact = "table";
      contacts.push({
        kind: "table",
        label,
        side: actualSide,
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
        diagnostics: response.diagnostics,
      });
      addEvent("table-contact", {
        label,
        side: actualSide,
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
      });
    }

    function contactRacket() {
      if (sideForZ(ball.position.z) !== "receiver") {
        fail("receiver-contact-on-wrong-side", {position: clonePoint(ball.position)});
        return;
      }
      const response = root.MainlineV2Contact.solveContact({
        state: ball,
        surface: returnRacket,
        mode: returnRacket.mode,
      }, core);
      ball = response.state;
      lastContact = "racket";
      contacts.push({
        kind: "racket",
        label: "receiver-return",
        side: "receiver",
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
        diagnostics: response.diagnostics,
      });
      addEvent("racket-contact", {
        label: "receiver-return",
        side: "receiver",
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
      });
    }

    function transitionAfterTable() {
      const tableContactCount = contacts.filter((contact) => contact.kind === "table").length;
      if (tableContactCount === 1) {
        phase = PHASES.OPPONENT_FLIGHT;
      } else if (tableContactCount === 2) {
        phase = PHASES.RECEIVER_APPROACH;
        receiverElapsedSimulation = 0;
      } else if (tableContactCount === 3) {
        phase = PHASES.COMPLETE;
        addEvent("rally-complete", {
          status: "success",
          point: clonePoint(ball.position),
        });
      }
    }

    function step(dtSimulation) {
      if (phase === PHASES.COMPLETE || phase === PHASES.FAILURE) return snapshot();
      const dt = Number.isFinite(dtSimulation) && dtSimulation > 0
        ? dtSimulation
        : DEFAULT_STEP_SIMULATION;
      if (phase === PHASES.SERVE_FLIGHT || phase === PHASES.OPPONENT_FLIGHT || phase === PHASES.RETURN_FLIGHT) {
        const before = ball;
        const next = scaleAdapter.advanceSimulationState(ball, dt);
        physicalTimeSec += dt / TIME_DILATION;
        if ((phase === PHASES.OPPONENT_FLIGHT || phase === PHASES.RETURN_FLIGHT) &&
            ((before.position.z < 0 && next.position.z >= 0) ||
              (before.position.z > 0 && next.position.z <= 0))) {
          addEvent(phase === PHASES.OPPONENT_FLIGHT ? "serve-net-crossing" : "return-net-crossing", {
            point: clonePoint(next.position),
          });
        }
        if (crossesDownwardTable(before, next)) {
          ball = interpolateToTable(before, next);
          const expectedSide = phase === PHASES.SERVE_FLIGHT || phase === PHASES.RETURN_FLIGHT
            ? "server"
            : "receiver";
          const label = phase === PHASES.SERVE_FLIGHT
            ? "serve-first-bounce"
            : phase === PHASES.OPPONENT_FLIGHT
              ? "serve-second-bounce"
              : "return-to-server-table";
          contactTable(expectedSide, label);
          if (!failure) {
            addTrace();
            transitionAfterTable();
            if (phase === PHASES.RECEIVER_APPROACH) addEvent("receiver-can-return", {point: clonePoint(ball.position)});
          }
        } else {
          ball = next;
          addTrace();
        }
        return snapshot();
      }
      if (phase === PHASES.RECEIVER_APPROACH) {
        ball = scaleAdapter.advanceSimulationState(ball, dt);
        physicalTimeSec += dt / TIME_DILATION;
        receiverElapsedSimulation += dt;
        if (receiverElapsedSimulation >= RACKET_DELAY_SIMULATION) {
          contactRacket();
          if (!failure) {
            phase = PHASES.RETURN_FLIGHT;
            addEvent("return-start", {point: clonePoint(ball.position), omega: vector(ball.omega)});
          }
        }
        addTrace();
        return snapshot();
      }
      fail("unknown-phase", phase);
      return snapshot();
    }

    function snapshot() {
      const tableContacts = contacts.filter((contact) => contact.kind === "table");
      const racketContacts = contacts.filter((contact) => contact.kind === "racket");
      const checks = {
        firstBounceServerSide: Boolean(tableContacts[0] && tableContacts[0].side === "server"),
        secondBounceReceiverSide: Boolean(tableContacts[1] && tableContacts[1].side === "receiver"),
        racketAfterSecondBounce: Boolean(racketContacts[0] && tableContacts.length >= 2),
        returnLandsServerSide: Boolean(tableContacts[2] && tableContacts[2].side === "server"),
        allContactsInTable: contacts.filter((contact) => contact.kind === "table").every((contact) => inTable(contact.point)),
      };
      const semanticPass = Object.values(checks).every(Boolean) && !failure && phase === PHASES.COMPLETE;
      return {
        key,
        label: scenario.label,
        phase,
        status: semanticPass ? "pass" : failure ? "fail" : "running",
        physicalTimeSec,
        ball: cloneBall(ball),
        lastContact,
        contacts: contacts.map((contact) => ({
          kind: contact.kind,
          label: contact.label,
          side: contact.side,
          point: clonePoint(contact.point),
          omega: vector(contact.omega),
          diagnostics: contact.diagnostics,
        })),
        events: events.map((event) => ({...event, point: event.point ? clonePoint(event.point) : undefined})),
        trace: trace.map((sample) => ({time: sample.time, phase: sample.phase, ball: cloneBall(sample.ball)})),
        checks,
        failure,
        metadata: {
          coordinateContract: "world-space z<0 server half; z>0 receiver half",
          firstBounceMeaning: "actual table contact before net crossing",
          secondBounceMeaning: "actual receiver-side table contact before racket contact",
          returnMeaning: "actual server-side table contact after receiver racket contact",
          returnRacketAdapter: "isolated receiver-facing plane; not material calibration",
          timeDilation: TIME_DILATION,
        },
      };
    }

    return Object.freeze({
      PHASES,
      SCENARIOS,
      preset,
      step,
      snapshot,
    });
  }

  return Object.freeze({
    TIME_DILATION,
    TABLE,
    PHASES,
    SCENARIOS,
    createPreset,
    createSimulator,
  });
}));

/* END tools/3d-table-tennis-rally-semantics.js */
