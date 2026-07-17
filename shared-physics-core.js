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
