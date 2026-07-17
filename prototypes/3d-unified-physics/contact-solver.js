"use strict";

const {
  finite,
  vec,
  add,
  scale,
  norm,
  normalize,
} = require("./canonical-spin.js");

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

function sub(a, b) {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function cloneState(state) {
  return {
    position: vec(state.position.x, state.position.y, state.position.z),
    velocity: vec(state.velocity.x, state.velocity.y, state.velocity.z),
    omega: vec(state.omega.x, state.omega.y, state.omega.z),
    mass: finite(state.mass, 0.0027),
    inertia: finite(state.inertia, 7.2e-7),
  };
}

function contactPointVelocity(state, offset, surfaceVelocity) {
  return sub(
    add(state.velocity, cross(state.omega, offset)),
    surfaceVelocity || vec()
  );
}

function tangentBasis(normal) {
  const n = normalize(normal);
  const helper = Math.abs(n.x) < 0.7 ? vec(1, 0, 0) : vec(0, 0, 1);
  const t1 = normalize(cross(helper, n));
  const t2 = normalize(cross(n, t1));
  return { n, t1, t2 };
}

function effectiveMass(state, offset, direction) {
  const rotationalLever = cross(offset, direction);
  return 1 / state.mass + dot(rotationalLever, rotationalLever) / state.inertia;
}

function applyImpulse(state, offset, impulse) {
  state.velocity = add(state.velocity, scale(impulse, 1 / state.mass));
  state.omega = add(state.omega, scale(cross(offset, impulse), 1 / state.inertia));
}

function frictionImpulse(state, offset, basis, surfaceVelocity, normalImpulse, friction) {
  if (normalImpulse <= 0 || friction <= 0) return vec();
  const contactVelocity = contactPointVelocity(state, offset, surfaceVelocity);
  const tangentVelocity = sub(contactVelocity, scale(basis.n, dot(contactVelocity, basis.n)));
  const desired1 = -dot(tangentVelocity, basis.t1) /
    effectiveMass(state, offset, basis.t1);
  const desired2 = -dot(tangentVelocity, basis.t2) /
    effectiveMass(state, offset, basis.t2);
  const desired = vec(
    basis.t1.x * desired1 + basis.t2.x * desired2,
    basis.t1.y * desired1 + basis.t2.y * desired2,
    basis.t1.z * desired1 + basis.t2.z * desired2
  );
  const limit = Math.max(0, friction) * normalImpulse;
  const desiredMagnitude = norm(desired);
  return desiredMagnitude > limit && desiredMagnitude > 1e-12
    ? scale(desired, limit / desiredMagnitude)
    : desired;
}

function applyNormalAndFriction(state, contact, basis, offset, normalImpulse) {
  const surfaceVelocity = contact.surfaceVelocity || vec();
  applyImpulse(state, offset, scale(basis.n, normalImpulse));
  const tangentImpulse = frictionImpulse(
    state,
    offset,
    basis,
    surfaceVelocity,
    normalImpulse,
    finite(contact.friction, 0)
  );
  applyImpulse(state, offset, tangentImpulse);
  return tangentImpulse;
}

/**
 * Instantaneous rigid-plane contact. The plane is described by its outward
 * normal, surface velocity, and ball-centre-to-contact offset. The same
 * kernel can represent a fixed table or a moving racket plane.
 */
function solvePlaneContact(inputState, contact = {}) {
  const state = cloneState(inputState);
  const basis = tangentBasis(contact.normal || vec(0, 1, 0));
  const offset = contact.contactOffset || scale(basis.n, -finite(contact.radius, 0.02));
  const surfaceVelocity = contact.surfaceVelocity || vec();
  const before = contactPointVelocity(state, offset, surfaceVelocity);
  const normalVelocity = dot(before, basis.n);
  const approaching = normalVelocity < 0;
  const restitution = Math.max(0, Math.min(1, finite(contact.restitution, 0)));
  const normalImpulse = approaching
    ? Math.max(0, -(1 + restitution) * normalVelocity /
      effectiveMass(state, offset, basis.n))
    : 0;
  const tangentImpulse = applyNormalAndFriction(
    state,
    contact,
    basis,
    offset,
    normalImpulse
  );
  const after = contactPointVelocity(state, offset, surfaceVelocity);
  return {
    state,
    contactPointVelocityBefore: before,
    contactPointVelocityAfter: after,
    normalVelocityBefore: normalVelocity,
    normalImpulse,
    tangentImpulse,
    frictionLimited: norm(tangentImpulse) >= finite(contact.friction, 0) * normalImpulse - 1e-12,
    basis,
    offset,
    mode: "impulse",
  };
}

/**
 * Experimental compliant mode. It shares the exact contact-point and
 * friction calculations with the impulse solver, while deriving a normal
 * impulse from a spring-damper force over fixed substeps. The caller supplies
 * penetration in metres (or a function returning it for each substep).
 */
function solveCompliantPlaneContact(inputState, contact = {}, options = {}) {
  const state = cloneState(inputState);
  const basis = tangentBasis(contact.normal || vec(0, 1, 0));
  const offset = contact.contactOffset || scale(basis.n, -finite(contact.radius, 0.02));
  const surfaceVelocity = contact.surfaceVelocity || vec();
  const dt = Math.max(1e-6, finite(options.dt, 1 / 240));
  const steps = Math.max(1, Math.floor(finite(options.steps, 1)));
  const spring = Math.max(0, finite(options.spring, 0));
  const damping = Math.max(0, finite(options.damping, 0));
  let totalNormalImpulse = 0;
  let totalTangentImpulse = vec();

  for (let index = 0; index < steps; index += 1) {
    const penetration = typeof contact.penetration === "function"
      ? Math.max(0, finite(contact.penetration(state, index * dt)))
      : Math.max(0, finite(contact.penetration, 0));
    const contactVelocity = contactPointVelocity(state, offset, surfaceVelocity);
    const normalVelocity = dot(contactVelocity, basis.n);
    const normalForce = Math.max(0, spring * penetration - damping * normalVelocity);
    const normalImpulse = normalForce * dt;
    const tangentImpulse = applyNormalAndFriction(
      state,
      contact,
      basis,
      offset,
      normalImpulse
    );
    totalNormalImpulse += normalImpulse;
    totalTangentImpulse = add(totalTangentImpulse, tangentImpulse);
  }

  return {
    state,
    normalImpulse: totalNormalImpulse,
    tangentImpulse: totalTangentImpulse,
    basis,
    offset,
    steps,
    dt,
    mode: "compliant",
  };
}

module.exports = {
  dot,
  cross,
  sub,
  cloneState,
  contactPointVelocity,
  tangentBasis,
  effectiveMass,
  solvePlaneContact,
  solveCompliantPlaneContact,
};
