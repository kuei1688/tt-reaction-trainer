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
