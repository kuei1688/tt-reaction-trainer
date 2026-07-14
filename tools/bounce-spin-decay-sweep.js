#!/usr/bin/env node

// Group 1A/1B: Table bounce spin-decay sweep.
// Directly calls bounceWithSpinPhysical from physics-v2-contact-mechanics.js
// with REAL-SCALE inputs (no SIM_TIME_DILATION conversion needed).
//
// 1A: topspin [-250,+250] x |vy| [1,6] → post-bounce topspin, vz, epsilon, regime
// 1B: sidespin [-200,+200] x vx [-3,+3] → post-bounce sidespin, vx, regime
//
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const {
  bounceWithSpinPhysical,
  R,
  M,
  EPSILON,
  CONTACT_FRICTION_MU: _unused,
} = require("./physics-v2-contact-mechanics.js");

// CONTACT_FRICTION_MU is not exported by physics-v2-contact-mechanics.js;
// use the shared-core value directly.
const MU = 0.13;

const ROOT_DIR = path.resolve(__dirname, "..");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "bounce_spin_decay_sweep_2026-07-14_raw.json");

function round(v, digits = 4) {
  if (v == null || Number.isNaN(v)) return null;
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

function linspace(lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * i) / (n - 1));
  return out;
}

function sensitivityReport(xs, ys, label) {
  const segments = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    const dy = ys[i + 1] - ys[i];
    const slope = dx !== 0 ? dy / dx : null;
    segments.push({ from: round(xs[i]), to: round(xs[i + 1]), dx: round(dx), dy: round(dy), slope: round(slope, 4) });
  }
  const absSlopes = segments.map((s) => Math.abs(s.slope)).filter((v) => Number.isFinite(v));
  const sorted = [...absSlopes].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const flagged = [];
  for (const seg of segments) {
    if (median > 1e-6 && Math.abs(seg.slope) > 3 * median) {
      flagged.push({ ...seg, medianAbsSlope: round(median), ratio: round(Math.abs(seg.slope) / median, 2) });
    }
  }
  return { label, segments, medianAbsSlope: round(median), flagged };
}

// ── Experiment 1A: topspin × |vy| → post-bounce ─────────────────────────
function run1A() {
  const TOPSPIN_VALUES = linspace(-250, 250, 20);
  const VY_VALUES = linspace(1, 6, 10);
  const VZ_FIXED = 3.0; // real scale m/s
  const grid = [];

  for (const ts of TOPSPIN_VALUES) {
    for (const vy of VY_VALUES) {
      const vel = { x: 0, y: -vy, z: VZ_FIXED };
      const spin = { topspin: ts, sidespin: 0 };
      const result = bounceWithSpinPhysical(vel, spin, MU);
      grid.push({
        topspin_in: round(ts),
        vy_in: round(vy),
        topspin_out: round(result.spin.topspin),
        vz_out: round(result.vel.z),
        vy_out: round(result.vel.y),
        epsilon: round(result.epsilon, 4),
        regime_topspin: result.regime?.topspin || null,
        regime_sidespin: result.regime?.sidespin || null,
        retention: round(ts !== 0 ? (result.spin.topspin / ts) * 100 : null, 2),
      });
    }
  }

  // Extract regime boundary curve (where rolling→sliding transition happens)
  const regimeBoundary = [];
  for (const vy of VY_VALUES) {
    for (let i = 0; i < TOPSPIN_VALUES.length - 1; i++) {
      const r1 = grid.find((g) => g.topspin_in === round(TOPSPIN_VALUES[i]) && g.vy_in === round(vy));
      const r2 = grid.find((g) => g.topspin_in === round(TOPSPIN_VALUES[i + 1]) && g.vy_in === round(vy));
      if (r1 && r2 && r1.regime_topspin !== r2.regime_topspin) {
        regimeBoundary.push({ vy: round(vy), between: [r1.topspin_in, r2.topspin_in], from: r1.regime_topspin, to: r2.regime_topspin });
      }
    }
  }

  // Sign-flip detection: where does topspin_out cross zero?
  const signFlips = [];
  for (const vy of VY_VALUES) {
    for (let i = 0; i < TOPSPIN_VALUES.length - 1; i++) {
      const r1 = grid.find((g) => g.topspin_in === round(TOPSPIN_VALUES[i]) && g.vy_in === round(vy));
      const r2 = grid.find((g) => g.topspin_in === round(TOPSPIN_VALUES[i + 1]) && g.vy_in === round(vy));
      if (r1 && r2 && Math.sign(r1.topspin_out) !== Math.sign(r2.topspin_out) && r1.topspin_out !== 0) {
        signFlips.push({ vy: round(vy), between: [r1.topspin_in, r2.topspin_in], values: [r1.topspin_out, r2.topspin_out] });
      }
    }
  }

  // Sensitivity along topspin axis at vy=3 (representative)
  const tsAxis_vy3 = TOPSPIN_VALUES.map((ts) => {
    const r = bounceWithSpinPhysical({ x: 0, y: -3, z: VZ_FIXED }, { topspin: ts, sidespin: 0 }, MU);
    return round(r.spin.topspin);
  });
  const tsSensitivity = sensitivityReport(TOPSPIN_VALUES, tsAxis_vy3, "topspin→topspin_out (vy=3)");

  return {
    experiment: "1A",
    description: "topspin × |vy| → post-bounce topspin/vz/epsilon/regime",
    fixed: { vz: VZ_FIXED, sidespin: 0, mu: MU },
    grid: { topspin: TOPSPIN_VALUES.map(round), vy: VY_VALUES.map(round), totalPoints: grid.length },
    rows: grid,
    regimeBoundary,
    signFlips,
    tsSensitivity,
  };
}

// ── Experiment 1B: sidespin × vx → post-bounce ──────────────────────────
function run1B() {
  const SIDESPIN_VALUES = linspace(-200, 200, 16);
  const VX_VALUES = linspace(-3, 3, 10);
  const VY_FIXED = -3.0;
  const VZ_FIXED = 3.0;
  const grid = [];

  for (const ss of SIDESPIN_VALUES) {
    for (const vx of VX_VALUES) {
      const vel = { x: vx, y: VY_FIXED, z: VZ_FIXED };
      const spin = { topspin: 0, sidespin: ss };
      const result = bounceWithSpinPhysical(vel, spin, MU);
      grid.push({
        sidespin_in: round(ss),
        vx_in: round(vx),
        sidespin_out: round(result.spin.sidespin),
        vx_out: round(result.vel.x),
        vy_out: round(result.vel.y),
        epsilon: round(result.epsilon, 4),
        regime_sidespin: result.regime?.sidespin || null,
        retention: round(ss !== 0 ? (result.spin.sidespin / ss) * 100 : null, 2),
      });
    }
  }

  const regimeBoundary = [];
  for (const vx of VX_VALUES) {
    for (let i = 0; i < SIDESPIN_VALUES.length - 1; i++) {
      const r1 = grid.find((g) => g.sidespin_in === round(SIDESPIN_VALUES[i]) && g.vx_in === round(vx));
      const r2 = grid.find((g) => g.sidespin_in === round(SIDESPIN_VALUES[i + 1]) && g.vx_in === round(vx));
      if (r1 && r2 && r1.regime_sidespin !== r2.regime_sidespin) {
        regimeBoundary.push({ vx: round(vx), between: [r1.sidespin_in, r2.sidespin_in], from: r1.regime_sidespin, to: r2.regime_sidespin });
      }
    }
  }

  const ssSensitivity = sensitivityReport(
    SIDESPIN_VALUES,
    SIDESPIN_VALUES.map((ss) => round(bounceWithSpinPhysical({ x: 0, y: VY_FIXED, z: VZ_FIXED }, { topspin: 0, sidespin: ss }, MU).spin.sidespin)),
    "sidespin→sidespin_out (vx=0)"
  );

  return {
    experiment: "1B",
    description: "sidespin × vx → post-bounce sidespin/vx/regime",
    fixed: { vy: VY_FIXED, vz: VZ_FIXED, topspin: 0, mu: MU },
    grid: { sidespin: SIDESPIN_VALUES.map(round), vx: VX_VALUES.map(round), totalPoints: grid.length },
    rows: grid,
    regimeBoundary,
    ssSensitivity,
  };
}

function main() {
  process.stderr.write("[1A] topspin × |vy| sweep\n");
  const result1A = run1A();
  process.stderr.write("[1B] sidespin × vx sweep\n");
  const result1B = run1B();

  const output = {
    generatedAt: new Date().toISOString(),
    tool: "bounce-spin-decay-sweep.js",
    note: "Direct bounceWithSpinPhysical calls with real-scale inputs (no D conversion). All spin values already in real rad/s.",
    experiments: [result1A, result1B],
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  // Console summary
  console.log("=== Experiment 1A: topspin × |vy| → post-bounce ===");
  console.log(`Grid: ${result1A.grid.totalPoints} points (${result1A.grid.topspin.length} topspin × ${result1A.grid.vy.length} vy)`);
  console.log("Regime boundaries (rolling↔sliding):");
  console.table(result1A.regimeBoundary.slice(0, 15));
  console.log("Sign flips (topspin_out crosses zero):");
  console.table(result1A.signFlips);
  console.log("Sensitivity (topspin→topspin_out at vy=3):");
  console.log("  flagged jumps:", result1A.tsSensitivity.flagged.length, result1A.tsSensitivity.flagged);

  // Retention summary at vy=3
  console.log("\nRetention at vy=3 m/s:");
  const retentionRows = result1A.rows.filter((r) => r.vy_in === round(VY_VALUES[3], 4)).map((r) => ({
    topspin_in: r.topspin_in,
    topspin_out: r.topspin_out,
    retention_pct: r.retention,
    regime: r.regime_topspin,
  }));
  console.table(retentionRows);

  console.log("\n=== Experiment 1B: sidespin × vx → post-bounce ===");
  console.log(`Grid: ${result1B.grid.totalPoints} points (${result1B.grid.sidespin.length} sidespin × ${result1B.grid.vx.length} vx)`);
  console.log("Regime boundaries:");
  console.table(result1B.regimeBoundary.slice(0, 15));
  console.log("Sensitivity (sidespin→sidespin_out at vx=0):");
  console.log("  flagged jumps:", result1B.ssSensitivity.flagged.length, result1B.ssSensitivity.flagged);

  // Retention summary at vx=0
  console.log("\nRetention at vx=0 m/s:");
  const ssRetentionRows = result1B.rows.filter((r) => r.vx_in === round(VX_VALUES[4], 4) || r.vx_in === round(VX_VALUES[5], 4))
    sidespin_in: r.sidespin_in,
    sidespin_out: r.sidespin_out,
    retention_pct: r.retention,
    regime: r.regime_sidespin,
  }));
  console.table(ssRetentionRows);

  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}
