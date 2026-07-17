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
