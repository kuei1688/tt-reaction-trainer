#!/usr/bin/env node

// Two CLEAN, SINGLE-VARIABLE reference sweeps for game4.html's currently
// deployed Stage 4a push contact model (bounceOffPlaneSubstepped /
// applyPushContact / computeBlendedNormal, post-commit 68179db). This tool
// does NOT search for an optimal parameter combo — per the user's explicit
// methodology redirect (2026-07-14), it builds a library of isolated
// reference curves showing the SHAPE of how one input affects outputs, and
// flags any unexpected sharp jumps/discontinuities as a required deliverable.
// Results are hand-transcribed from this tool's console/JSON output into
// AI_CONTEXT/adhoc-experiments/push_clean_reference_library.md (append-only) by the calling
// agent, not auto-written — the library file has its own format rules.
//
// ── Historical failure mode this tool deliberately avoids repeating ────────
// docs/ARCHIVE/physics-engine-v2-plan.md's "指尖摩擦案例" episode + its
// "2026-07-14 補記": the original clean isolated-contact case used too
// small/unrepresentative a racket swing velocity, so when later fed into the
// full 14-serve task, retVel.z collapsed to ~0 (ball popped up, couldn't fly
// back) — the racket's own momentum contribution was never properly
// reflected. Both sweeps below therefore ALWAYS feed the contact model a
// REALISTIC racket swing velocity: lift/drive are computed by calling
// game4.html's own computeAdaptivePushLift/computeAdaptivePushDrive on the
// actual incoming ball velocity being tested (never hand-picked, never
// zeroed, never held at a placeholder), by going through game4.html's own
// makeReturnVelocity -> makeRacketReturnVelocity pipeline exactly as
// deployed (the same call the real game makes).
//
// ── Landmine (see push-stage4a-contact-sweep-calibration.js's header for the
// full explanation, verified again here by inspection) ─────────────────────
// instantiateGame4Symbols's dependency walker resolves a name listed DIRECTLY
// in the top-level symbolNames array via LOCAL extraction ONLY — it never
// checks extraExternals for names appearing directly in symbolNames (only for
// their TRANSITIVE dependencies). Sweep 1 overrides PUSH_TILT_Y, so
// "PUSH_TILT_Y" must NEVER appear in SYMBOL_NAMES below (computeAdaptivePushTiltY
// references it directly, which is where the extraExternals override takes
// effect). Sweep 2 does NOT override PUSH_TILT_Y (uses the deployed constant
// as-is) — the same extraction path handles both cases: pass {} for
// extraExternals to get the deployed value via local extraction instead.
//
// Determinism note: RANGE_SOLUTION_MODE defaults to false and
// RETURN_SKILL_LEVEL defaults to 'advanced' (correctionMean=1, spread=0,
// failureChance=0) in game4.html — makeReturnVelocity is therefore fully
// deterministic under default globals (no Math.random() branches taken),
// confirmed by reading applyExecutionVariance/sampleReturnCorrectionFraction
// before relying on this. No seeding/averaging needed.
//
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("../load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_clean_reference_sweep_2026-07-14_raw.txt");

const REPRESENTATIVE_PRESET_ID = "backspin_long_backhand"; // same case Phase B of physics-engine-v2-plan.md used

// Symbol list for the shared "board" (serve gen + flight sim + hit timing) +
// push contact formula. PUSH_TILT_Y intentionally NOT listed (landmine
// above) — always resolved either via extraExternals override (sweep 1) or
// via local extraction of the deployed const (sweep 2, when override is {}).
const SYMBOL_NAMES = [
  "simulateServe",
  "simulatePath",
  "solveBaseVelocity",
  "solveServeBounceVelocity",
  "solveVelocity",
  "makeServeAimCandidate",
  "getServeLengthProfile",
  "findServeBounceTime",
  "getServeBounces",
  "serveBounceScore",
  "clone",
  "findPushHitIndex",
  "findHitIndex",
  "makeReturnVelocity",
  "makeDirectReturnVelocity",
  "makeRacketReturnVelocity",
  "TECHNIQUES",
  "computeAdaptivePushLift",
  "computeAdaptivePushDrive",
  "PADDLE_FRICTION",
  // Diagnostic-only additions (not overridden): exposed so this tool can
  // manually recompute aimedX (the x-aiming secant/grid solve) per sweep
  // point, to check whether a jump in outgoing topspin/netClearance is
  // actually caused by the contact model itself or by the x-aiming solver's
  // known "regime-boundary discontinuity" behavior — game4.html's own
  // comment above solveRacketVelXForTargetLandingX (line ~1438) explicitly
  // warns that the push landing-x-vs-rx function "在滾動/滑動 regime 交界處
  // 會有不連續跳動" (has discontinuous jumps at rolling/sliding regime
  // boundaries), which is exactly the kind of non-smoothness this task asks
  // to check for.
  "computeRacketNormal",
  "dynamicPaddleEpsilon",
  "solveRacketVelXForTargetLandingX",
  "applyPushContact",
  "PADDLE_BLEND",
  "RETURN_TARGET_X",
];

function round(value, digits = 4) {
  if (value == null) return null;
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function linspace(lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * i) / (n - 1));
  return out;
}

// Same judgeReturn PASS/FAIL branch logic replicated verbatim, as in
// push-stage4a-contact-sweep-calibration.js's judgeReturnEquivalent (game4.html
// judgeReturn() itself can't be extracted — DOM globals).
function judgeReturnEquivalent(result, TABLE) {
  const firstBounce = result.bounces[0] || null;
  const netClearance = result.netY == null ? null : result.netY - (TABLE.height + TABLE.net);
  let ok = false;
  let reason = "出界";
  if (netClearance != null && netClearance < 0) {
    reason = "掛網";
  } else if (firstBounce && firstBounce.z > 0) {
    reason = "落在自己桌面";
  } else if (
    firstBounce &&
    firstBounce.z < 0 &&
    Math.abs(firstBounce.x) <= TABLE.width / 2 &&
    Math.abs(firstBounce.z) <= TABLE.length / 2
  ) {
    ok = true;
    reason = "成功落在對方桌面";
  }
  return { ok, reason, netClearance: netClearance == null ? null : round(netClearance) };
}

function extractGame4(loader, tiltYOverride) {
  const extraExternals = {};
  if (tiltYOverride != null) extraExternals.PUSH_TILT_Y = tiltYOverride;
  return loader.instantiateGame4Symbols(SYMBOL_NAMES, extraExternals);
}

// Local sensitivity + jump-flagging: compute slope between adjacent grid
// points for a numeric series, flag any |slope| > JUMP_FACTOR x median(|slope|)
// as a disproportionate jump (excluding segments where both slopes are ~0,
// which would produce spurious ratio blowups from near-zero medians).
const JUMP_FACTOR = 3;
function sensitivityReport(xs, ys, label) {
  const segments = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    const dy = ys[i + 1] - ys[i];
    const slope = dx !== 0 ? dy / dx : null;
    segments.push({ from: xs[i], to: xs[i + 1], dx: round(dx), dy: round(dy), slope: round(slope, 4) });
  }
  const absSlopes = segments.map((s) => Math.abs(s.slope)).filter((v) => Number.isFinite(v));
  const sorted = [...absSlopes].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const flagged = [];
  for (const seg of segments) {
    if (median > 1e-6 && Math.abs(seg.slope) > JUMP_FACTOR * median) {
      flagged.push({ ...seg, medianAbsSlope: round(median), ratio: round(Math.abs(seg.slope) / median, 2) });
    }
  }
  return { label, segments, medianAbsSlope: round(median), flagged };
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const preset = allPresets.find((p) => p.id === REPRESENTATIVE_PRESET_ID);
  if (!preset) throw new Error(`Preset ${REPRESENTATIVE_PRESET_ID} not found in physics-presets.json`);

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const TABLE = loader.runtimeExternals.TABLE;
  const gravity = preset.solve?.gravity ?? -4.2;

  // ── Extract the representative case's REAL incoming velocity/spin at the
  // push hit point, via game4.html's own simulateServe/findPushHitIndex
  // (not hand-invented numbers). ──
  const boardExt = extractGame4(loader, null); // deployed PUSH_TILT_Y, only used for board fns here
  const serve = boardExt.simulateServe(preset);
  const hitIndex = boardExt.findPushHitIndex(serve);
  const hitPoint = serve.points[hitIndex];
  const hitVel = serve.velocities[hitIndex];
  const hitSpin = serve.spins[hitIndex];
  const hitSpeedXZ = Math.hypot(hitVel.x, hitVel.z);
  const deployedLift = boardExt.computeAdaptivePushLift(hitVel);
  const deployedDrive = boardExt.computeAdaptivePushDrive(hitVel);
  // Read separately (own instantiateGame4Symbols([name]) call, no override in
  // play here) since PUSH_TILT_Y is deliberately never listed in SYMBOL_NAMES
  // (landmine note above) — needed only for the aimedX diagnostic default.
  const deployedTiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");

  process.stderr.write(
    `[representative case] ${REPRESENTATIVE_PRESET_ID}: hitVel=${JSON.stringify(round3(hitVel))} hitSpin=${JSON.stringify(round3(hitSpin))} speedXZ=${round(hitSpeedXZ)} deployedLift=${round(deployedLift)} deployedDrive=${round(deployedDrive)}\n`
  );

  function round3(v) {
    return { x: round(v.x, 4), y: round(v.y, 4), z: round(v.z, 4) };
  }

  function runOnce(loader2, tiltYOverride, incomingVel, incomingSpin) {
    const ext = extractGame4(loader2, tiltYOverride);
    const tech = { ...ext.TECHNIQUES.push };
    const lift = ext.computeAdaptivePushLift(incomingVel);
    const drive = ext.computeAdaptivePushDrive(incomingVel);
    const ret = ext.makeReturnVelocity(incomingVel, incomingSpin, tech, hitPoint, gravity);
    const outPath = ext.simulatePath({ ...hitPoint }, ret.vel, { gravity, spin: ret.spin, bounceBoost: tech.bounceBoost || 0 });
    const judged = judgeReturnEquivalent(outPath, TABLE);
    const outSpeed = Math.hypot(ret.vel.x, ret.vel.y, ret.vel.z);

    // ── Diagnostic: manually recompute aimedX (x-aiming solve) the same way
    // makeRacketReturnVelocity does internally, to separate "contact model
    // itself is non-smooth" from "the x-aiming secant/grid solver's known
    // regime-boundary jump behavior" (see comment above solveRacketVelXFor
    // TargetLandingX in game4.html) as the cause of any flagged jump. Not
    // used to compute ret/outPath above (those already come from the real
    // makeReturnVelocity call) — this is read-only diagnostic duplication.
    const swingDirRef = { x: 0, y: lift, z: -drive };
    const tiltXDiag = 0; // computeAdaptivePushTiltX() always returns 0 (game4.html:1604)
    const tiltYDiag = tiltYOverride != null ? tiltYOverride : deployedTiltY;
    const racketNormalDiag = ext.computeRacketNormal(tiltYDiag, tiltXDiag, swingDirRef);
    const epsilonDiag = ext.dynamicPaddleEpsilon(incomingVel, swingDirRef, racketNormalDiag);
    const aimedX = ext.solveRacketVelXForTargetLandingX(
      incomingVel, incomingSpin, racketNormalDiag, swingDirRef, epsilonDiag, ext.PADDLE_FRICTION, hitPoint, gravity, ext.RETURN_TARGET_X, ext.PADDLE_BLEND, tech
    );

    return {
      lift: round(lift),
      drive: round(drive),
      outTopspin: round(ret.spin.topspin),
      outSidespin: round(ret.spin.sidespin),
      outSpeed: round(outSpeed),
      netClearance: judged.netClearance,
      inBounds: judged.ok,
      reason: judged.reason,
      firstBounce: outPath.bounces[0] ? { x: round(outPath.bounces[0].x), z: round(outPath.bounces[0].z) } : null,
      dwellMs: round(ret.dwellMs, 3),
      regime: ret.regime || null,
      aimedX: round(aimedX, 4),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWEEP 1: paddle angle (tiltY) curve.
  // Fixed: incoming ball = representative case's real hitVel/hitSpin.
  //        Racket swing-force (lift/drive) = REAL computeAdaptivePushLift/
  //        Drive(hitVel) value (NOT overridden) — since lift/drive only
  //        depend on incomingVel (not on tiltY), this value is identical at
  //        every point in this sweep; computed fresh each point anyway as a
  //        self-check that it doesn't silently drift.
  // Swept: tiltY from 0.3 to 2.0, 18 points (step ~0.1), covering both the
  //        deployed PUSH_TILT_Y=1.0 and the historical 指尖 tiltY≈2.0 range.
  // ══════════════════════════════════════════════════════════════════════
  process.stderr.write("[sweep1] tiltY curve\n");
  const SWEEP1_TILT_Y = linspace(0.3, 2.0, 18).map((v) => round(v, 3));
  const sweep1Rows = SWEEP1_TILT_Y.map((tiltY) => ({ tiltY, ...runOnce(loader, tiltY, hitVel, hitSpin) }));

  const sweep1Sensitivity = {
    outTopspin: sensitivityReport(SWEEP1_TILT_Y, sweep1Rows.map((r) => r.outTopspin), "tiltY -> outTopspin"),
    outSpeed: sensitivityReport(SWEEP1_TILT_Y, sweep1Rows.map((r) => r.outSpeed), "tiltY -> outSpeed"),
    netClearance: sensitivityReport(
      SWEEP1_TILT_Y,
      sweep1Rows.map((r) => (r.netClearance == null ? NaN : r.netClearance)),
      "tiltY -> netClearance"
    ),
  };

  // Sign-flip point for outTopspin (regime boundary, reported separately from
  // "jump" flags since a sign change from a smoothly-varying curve is
  // expected/meaningful, not necessarily a discontinuity).
  let sweep1SignFlip = null;
  for (let i = 0; i < sweep1Rows.length - 1; i++) {
    if (Math.sign(sweep1Rows[i].outTopspin) !== Math.sign(sweep1Rows[i + 1].outTopspin) && sweep1Rows[i].outTopspin !== 0) {
      sweep1SignFlip = { between: [sweep1Rows[i].tiltY, sweep1Rows[i + 1].tiltY], values: [sweep1Rows[i].outTopspin, sweep1Rows[i + 1].outTopspin] };
      break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWEEP 2: incoming ball speed curve.
  // Fixed: tiltY = deployed PUSH_TILT_Y (1.0, via extraExternals={} -> local
  //        extraction of the real deployed const, not hand-copied).
  //        Direction of incoming velocity (unit vector) and spin (topspin/
  //        sidespin, unchanged, NOT rescaled) held fixed — ONLY the incoming
  //        velocity's magnitude is scaled. This isolates "what does incoming
  //        SPEED alone do to the deployed force formula", without also
  //        varying spin as a second variable in the same sweep.
  // Swept: scale factor 0.5x-2.0x on hitVel's magnitude, 16 points.
  //        lift/drive are NOT overridden — computeAdaptivePushLift/Drive's
  //        existing negative-feedback formula responds naturally to each
  //        scaled speed, exactly as it will in the live game.
  // ══════════════════════════════════════════════════════════════════════
  process.stderr.write("[sweep2] incoming speed curve\n");
  const SWEEP2_SCALE = linspace(0.5, 2.0, 16).map((v) => round(v, 3));
  const sweep2Rows = SWEEP2_SCALE.map((scale) => {
    const scaledVel = { x: hitVel.x * scale, y: hitVel.y * scale, z: hitVel.z * scale };
    const row = runOnce(loader, null, scaledVel, hitSpin);
    return { scale, incomingSpeedXZ: round(Math.hypot(scaledVel.x, scaledVel.z)), ...row };
  });

  const sweep2Sensitivity = {
    lift: sensitivityReport(SWEEP2_SCALE, sweep2Rows.map((r) => r.lift), "scale -> lift"),
    drive: sensitivityReport(SWEEP2_SCALE, sweep2Rows.map((r) => r.drive), "scale -> drive"),
    outTopspin: sensitivityReport(SWEEP2_SCALE, sweep2Rows.map((r) => r.outTopspin), "scale -> outTopspin"),
    outSpeed: sensitivityReport(SWEEP2_SCALE, sweep2Rows.map((r) => r.outSpeed), "scale -> outSpeed"),
    netClearance: sensitivityReport(
      SWEEP2_SCALE,
      sweep2Rows.map((r) => (r.netClearance == null ? NaN : r.netClearance)),
      "scale -> netClearance"
    ),
  };

  // Detect where lift/drive hit their formula clamps (PUSH_LIFT_FLOOR/MAX,
  // PUSH_DRIVE_FLOOR/MAX) — flat regions at a clamp are a DIFFERENT kind of
  // "non-smoothness" (a kink at the clamp boundary, not a jump) worth calling
  // out separately from the jump-flag mechanism above.
  const liftVals = sweep2Rows.map((r) => r.lift);
  const driveVals = sweep2Rows.map((r) => r.drive);
  const liftAtFloorOrMax = sweep2Rows.filter((r, i) => i > 0 && r.lift === sweep2Rows[i - 1].lift).map((r) => r.scale);
  const driveAtFloorOrMax = sweep2Rows.filter((r, i) => i > 0 && r.drive === sweep2Rows[i - 1].drive).map((r) => r.scale);

  const output = {
    generatedAt: new Date().toISOString(),
    representativeCase: {
      presetId: REPRESENTATIVE_PRESET_ID,
      hitPoint: round3(hitPoint),
      hitVel: round3(hitVel),
      hitSpin: { topspin: round(hitSpin.topspin), sidespin: round(hitSpin.sidespin) },
      hitSpeedXZ: round(hitSpeedXZ),
      gravity,
      deployedLift: round(deployedLift),
      deployedDrive: round(deployedDrive),
      deployedTiltY,
    },
    sweep1: { tiltYValues: SWEEP1_TILT_Y, rows: sweep1Rows, sensitivity: sweep1Sensitivity, signFlip: sweep1SignFlip },
    sweep2: {
      scaleValues: SWEEP2_SCALE,
      rows: sweep2Rows,
      sensitivity: sweep2Sensitivity,
      liftClampPlateauAt: liftAtFloorOrMax,
      driveClampPlateauAt: driveAtFloorOrMax,
    },
  };

  fs.writeFileSync(RAW_DUMP_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log("=== Representative case ===");
  console.log(output.representativeCase);
  console.log("=== Sweep 1: tiltY curve ===");
  console.table(sweep1Rows.map((r) => ({ tiltY: r.tiltY, outTopspin: r.outTopspin, outSpeed: r.outSpeed, netClearance: r.netClearance, inBounds: r.inBounds, reason: r.reason, aimedX: r.aimedX, dwellMs: r.dwellMs, regime: r.regime })));
  console.log("Sweep1 sign flip:", sweep1SignFlip);
  console.log("Sweep1 flagged jumps (outTopspin):", sweep1Sensitivity.outTopspin.flagged);
  console.log("Sweep1 flagged jumps (outSpeed):", sweep1Sensitivity.outSpeed.flagged);
  console.log("Sweep1 flagged jumps (netClearance):", sweep1Sensitivity.netClearance.flagged);

  console.log("=== Sweep 2: incoming speed curve ===");
  console.table(
    sweep2Rows.map((r) => ({ scale: r.scale, speedXZ: r.incomingSpeedXZ, lift: r.lift, drive: r.drive, outTopspin: r.outTopspin, outSpeed: r.outSpeed, netClearance: r.netClearance, inBounds: r.inBounds, reason: r.reason, aimedX: r.aimedX, dwellMs: r.dwellMs, regime: r.regime }))
  );
  console.log("Sweep2 lift clamp plateau at scale=", liftAtFloorOrMax);
  console.log("Sweep2 drive clamp plateau at scale=", driveAtFloorOrMax);
  console.log("Sweep2 flagged jumps (lift):", sweep2Sensitivity.lift.flagged);
  console.log("Sweep2 flagged jumps (drive):", sweep2Sensitivity.drive.flagged);
  console.log("Sweep2 flagged jumps (outTopspin):", sweep2Sensitivity.outTopspin.flagged);
  console.log("Sweep2 flagged jumps (outSpeed):", sweep2Sensitivity.outSpeed.flagged);
  console.log("Sweep2 flagged jumps (netClearance):", sweep2Sensitivity.netClearance.flagged);
  console.log(`\nFull JSON dump written to ${RAW_DUMP_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}
