(function (root) {
  "use strict";

  if (typeof TABLE === "undefined" || typeof BALL_RADIUS === "undefined" ||
      typeof NET_COLLISION === "undefined" || typeof CONTACT_FRICTION_MU === "undefined" ||
      typeof bounceWithSpinPhysical !== "function") {
    throw new Error("prototype-physics-bridge 需要先載入 shared-physics-core.js");
  }

  const FIXED_DT_SEC = 1 / 120;
  const TWO_PI = Math.PI * 2;
  const CORE_CONSTANTS = Object.freeze({
    table: Object.freeze({ ...TABLE }),
    ballRadius: BALL_RADIUS,
    maxTableBounces: MAX_TABLE_BOUNCES,
    netCollision: Object.freeze({ ...NET_COLLISION }),
    contactFrictionMu: CONTACT_FRICTION_MU
  });

  function finite(value, name) {
    if (!Number.isFinite(value)) throw new Error(`${name} 必須是有限數字`);
    return value;
  }

  function vector3(value, name) {
    if (!value || typeof value !== "object") throw new Error(`${name} 必須是物件`);
    return {
      x: finite(value.x, `${name}.x`),
      y: finite(value.y, `${name}.y`),
      z: finite(value.z, `${name}.z`)
    };
  }

  function mapSpinRps(spinRps) {
    const source = vector3(spinRps, "spin_rps");
    return {
      topspin: source.z * TWO_PI,
      sidespin: source.y * TWO_PI,
      axial: source.x * TWO_PI
    };
  }

  function createWorld(initialBallState, options) {
    const settings = options || {};
    const world = {
      position: vector3(initialBallState.position_m, "position_m"),
      velocity: vector3(initialBallState.velocity_mps, "velocity_mps"),
      spin: mapSpinRps(initialBallState.spin_rps),
      gravity: finite(settings.gravity_mps2, "gravity_mps2"),
      hitWindowZ: finite(settings.hit_window_z_m, "hit_window_z_m"),
      elapsedSec: 0,
      accumulatorSec: 0,
      bounces: 0,
      crossedNet: false,
      hitWindowEntered: false,
      stopped: false,
      stopReason: null,
      pendingEvents: []
    };
    return world;
  }

  function emit(world, type, detail) {
    world.pendingEvents.push(Object.freeze({ type, elapsedSec: world.elapsedSec, detail: detail || null }));
  }

  function stepOnce(world) {
    if (world.stopped) return;
    const prev = { ...world.position };
    world.velocity.y += world.gravity * FIXED_DT_SEC;
    world.position.x += world.velocity.x * FIXED_DT_SEC;
    world.position.y += world.velocity.y * FIXED_DT_SEC;
    world.position.z += world.velocity.z * FIXED_DT_SEC;
    world.elapsedSec += FIXED_DT_SEC;

    if (!world.crossedNet && ((prev.z < 0 && world.position.z >= 0) || (prev.z > 0 && world.position.z <= 0))) {
      const ratio = (0 - prev.z) / (world.position.z - prev.z || 1);
      const netY = prev.y + (world.position.y - prev.y) * ratio;
      const netX = prev.x + (world.position.x - prev.x) * ratio;
      const withinNetWidth = Math.abs(netX) <= TABLE.width / 2 + BALL_RADIUS;
      if (withinNetWidth && netY - BALL_RADIUS < TABLE.height + TABLE.net) {
        const incomingZ = Math.sign(world.velocity.z) || Math.sign(world.position.z - prev.z) || 1;
        world.position.x = netX;
        world.position.y = netY;
        world.position.z = -incomingZ * NET_COLLISION.depth;
        world.velocity.x *= NET_COLLISION.xDamping;
        world.velocity.y *= NET_COLLISION.yDamping;
        world.velocity.z = -world.velocity.z * NET_COLLISION.zRestitution;
        emit(world, "NET_HIT", { x: netX, y: netY, z: 0 });
      } else {
        emit(world, "NET_CROSSED", { x: netX, y: netY, z: 0 });
      }
      world.crossedNet = true;
    }

    const crossedTableTop = prev.y >= TABLE.top + BALL_RADIUS && world.position.y <= TABLE.top + BALL_RADIUS;
    if (crossedTableTop && world.velocity.y < 0) {
      const surfaceY = TABLE.top + BALL_RADIUS;
      const ratio = (surfaceY - prev.y) / (world.position.y - prev.y || 1);
      const impact = {
        x: prev.x + (world.position.x - prev.x) * ratio,
        y: surfaceY,
        z: prev.z + (world.position.z - prev.z) * ratio
      };
      const onTable = Math.abs(impact.x) <= TABLE.width / 2 && Math.abs(impact.z) <= TABLE.length / 2;
      if (onTable) {
        world.position = impact;
        const bounced = bounceWithSpinPhysical(world.velocity, world.spin, CONTACT_FRICTION_MU);
        world.velocity = { ...bounced.vel };
        world.spin = { ...world.spin, ...bounced.spin };
        world.bounces += 1;
        emit(world, "TABLE_BOUNCE", { ...impact, bounce: world.bounces, epsilon: bounced.epsilon, regime: bounced.regime });
        if (world.bounces > MAX_TABLE_BOUNCES) {
          world.stopped = true;
          world.stopReason = "max_table_bounces";
        }
      }
    }

    if (!world.hitWindowEntered && world.velocity.z > 0 && world.position.z >= world.hitWindowZ) {
      world.hitWindowEntered = true;
      emit(world, "HIT_WINDOW_ENTERED", { ...world.position });
    }

    if (world.position.y <= BALL_RADIUS && prev.y > BALL_RADIUS) {
      world.position.y = BALL_RADIUS;
      world.stopped = true;
      world.stopReason = "ground";
      emit(world, "GROUND_HIT", { ...world.position });
    } else if (Math.abs(world.position.x) > 3 || Math.abs(world.position.z) > 4 || world.elapsedSec > 5) {
      world.stopped = true;
      world.stopReason = "out_of_bounds";
      emit(world, "OUT_OF_BOUNDS", { ...world.position });
    }
  }

  function stepWorld(world, deltaSec) {
    if (!world || typeof world !== "object") throw new Error("world 無效");
    const safeDelta = Math.max(0, Math.min(finite(deltaSec, "deltaSec"), 0.1));
    world.accumulatorSec += safeDelta;
    while (world.accumulatorSec + 1e-12 >= FIXED_DT_SEC && !world.stopped) {
      stepOnce(world);
      world.accumulatorSec -= FIXED_DT_SEC;
    }
    const events = world.pendingEvents.splice(0);
    return Object.freeze({
      position: Object.freeze({ ...world.position }),
      velocity: Object.freeze({ ...world.velocity }),
      spin: Object.freeze({ ...world.spin }),
      bounces: world.bounces,
      crossedNet: world.crossedNet,
      stopped: world.stopped,
      stopReason: world.stopReason,
      events
    });
  }

  function makeReturnInitialState(position, direction, towardPlayer) {
    const directionX = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    return {
      position_m: { ...position, y: Math.max(position.y, TABLE.top + 0.22) },
      velocity_mps: {
        x: directionX * (towardPlayer ? 0.85 : 0.7),
        y: towardPlayer ? 1.35 : 1.55,
        z: towardPlayer ? 4.4 : -4.2
      },
      spin_rps: { x: 0, y: directionX * 2.5, z: towardPlayer ? 7 : 5 }
    };
  }

  root.PrototypePhysicsBridge = Object.freeze({
    FIXED_DT_SEC,
    constants: CORE_CONSTANTS,
    createWorld,
    stepWorld,
    makeReturnInitialState,
    mapSpinRps
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
