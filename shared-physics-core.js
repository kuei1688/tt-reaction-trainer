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
