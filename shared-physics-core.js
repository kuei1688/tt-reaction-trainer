// Shared table-bounce physics core.
// Keep this file limited to symbols approved in the Phase 1 extraction package.
const EPSILON_VERTICAL = 0.876;   // ITTF table bounce test: 30cm drop rebounds to 23cm.
const EPSILON_OBLIQUE = 0.57;     // Measured oblique impact coefficient around 83 degrees.
const EPSILON_MIN = 0.45;         // Conservative lower bound for severe spin/oblique impacts.
const SPIN_EPSILON_REFERENCE = 6.0;
const CONTACT_FRICTION_MU = 0.13;

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
