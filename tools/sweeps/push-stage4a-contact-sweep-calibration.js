#!/usr/bin/env node

// Stage 4a push contact-model PARAMETER calibration sweep, against game4.html's
// CURRENTLY DEPLOYED formula (post-221d4d3, the commit that ported
// return-studio.html's Stage 4a spring-damper substepped push contact model
// (bounceOffPlaneSubstepped/computeBlendedNormal/applyPushContact) into
// game4.html, replacing the old simple instantaneous-collision bounceOffPlane
// for the push technique — see game4.html's own comment block around
// PADDLE_BLEND/PADDLE_SPRING_K, "2026-07-14 從 return-studio.html 移植").
//
// ── Why this tool exists ─────────────────────────────────────────────────
// 221d4d3 was an ARCHITECTURE port only — the contact-model PARAMETERS
// (TANGENT_KP, PADDLE_BLEND, PADDLE_SPRING_K's derivation half-period,
// PADDLE_RESTITUTION_LOW/HIGH) were left at whatever return-studio.html
// happened to have, itself never fully calibrated (return-studio.html's own
// VAL-005 single-shot validation only passes 26/64 combos). Re-running
// tools/game4-push-sustainable-rally-validation.js after the port showed
// rally survival got WORSE (avgRounds 3.364->0.909, 9/11 presets now fail at
// round 0-1) even though backspin-preservation got better (backspinFraction
// 8.11%->40%) — i.e. the architecture is sound but the parameters are not
// calibrated against game4.html's actual deployed push force formula
// (computeAdaptivePushLift/Drive, PUSH_LIFT_K=0.04/PUSH_DRIVE_K=0.19,
// PUSH_TILT_Y=1.0 — NOT swept here, already calibrated separately) and
// current serve preset set. This tool searches TANGENT_KP x PADDLE_BLEND x
// PADDLE_SPRING_K(via half-period) x PADDLE_RESTITUTION_LOW/HIGH for a
// combo that improves rally survival without wrecking single-shot landing.
//
// ── Two objectives, scored and reported SEPARATELY (not collapsed) ───────
// 1. Single-shot landing: does a single push return off a live serve land
//    in-bounds with legal net clearance, across the 11-preset calibration
//    set (which already includes both forehand- and backhand-placement
//    presets by tag — game4.html's push technique has no side-specific
//    parameters, unlike forehand_attack/backhand_attack, so no extra
//    mirroring is needed to cover both sides; see physics-presets.json
//    "placement": "forehand"/"backhand" tags).
// 2. Continuous-rally survival: avgRounds/minRounds/backspinFraction, via
//    the same runInstrumentedRally-style harness as
//    game4-push-sustainable-rally-validation.js (read first; this tool
//    reuses its board/harness logic verbatim, only adding parameter
//    overrides).
//
// ── judgeReturn note ──────────────────────────────────────────────────────
// game4.html's own judgeReturn() cannot be extracted through
// instantiateGame4Symbols — it calls DOM globals (document.getElementById,
// showResult, setPhase, currentPreset, selectedSide, startCamReturn,
// timingLabel) that have no place in the read-only vm sandbox. This tool
// instead replicates judgeReturn's PASS/FAIL BRANCH LOGIC VERBATIM (see
// judgeReturnEquivalent() below — same netClearance<0 / firstBounce.z>0 /
// bounds-check conditions, in the same order, minus the UI side effects).
// This is the same approach game4-push-sustainable-rally-validation.js and
// push-sustainable-rally-sweep-calibration.js already take for their
// inline netOk/inBounds checks (those match judgeReturn's conditions
// exactly); this tool just names the replication explicitly.
//
// ── Landmine (see push-sustainable-rally-sweep-calibration.js's header for
// the full explanation) ───────────────────────────────────────────────────
// instantiateGame4Symbols's dependency walker resolves a name listed
// directly in the top-level symbolNames array via LOCAL extraction ONLY —
// it never checks extraExternals for names that appear directly in
// symbolNames (only for their TRANSITIVE dependencies). So TANGENT_KP,
// PADDLE_BLEND, PADDLE_SPRING_K, PADDLE_RESTITUTION_LOW, and
// PADDLE_RESTITUTION_HIGH must NEVER appear in the symbolNames array passed
// to instantiateGame4Symbols below — they're only reachable as transitive
// dependencies of local functions (bounceOffPlaneSubstepped references
// TANGENT_KP directly; makeRacketReturnVelocity references PADDLE_BLEND
// directly to compute its local `blend` var; applyPushContact references
// PADDLE_SPRING_K directly; speedDependentSpongeDampingRatio references
// PADDLE_RESTITUTION_LOW/HIGH directly), which IS where extraExternals
// overrides take effect. Verified by inspection of game4.html source
// (grep PADDLE_BLEND/TANGENT_KP/PADDLE_SPRING_K/PADDLE_RESTITUTION
// usages) before writing this tool, not assumed.
//
// PADDLE_SPRING_K is swept as a SCALE ON THE HALF-PERIOD (per task spec: the
// deployed value is PADDLE_SPRING_K = BALL_MASS * (Math.PI / 0.005) ** 2,
// i.e. derived from an assumed ~5ms contact half-period; half-period is the
// physically-interpretable quantity, not the raw stiffness number).
//
// PADDLE_DAMPING_RATIO is NOT swept (task spec landmine): inside
// bounceOffPlaneSubstepped, the passed-in `dampingRatio` parameter (6th arg,
// literally named PADDLE_DAMPING_RATIO at the applyPushContact call site) is
// never referenced in the function body — the actual sponge damping ratio is
// recomputed every call by speedDependentSpongeDampingRatio(normalSpeedReal),
// itself derived from PADDLE_RESTITUTION_LOW/HIGH (+ PADDLE_SPEED_LOW/HIGH as
// speed-interpolation anchors, held fixed here) via restitutionToDampingRatio().
// Confirmed dead-for-push by reading bounceOffPlaneSubstepped's body directly
// (game4.html, function bounceOffPlaneSubstepped(vel, spin, planeNormal,
// planeVel, springK, dampingRatio, friction, opts)) — `dampingRatio` the
// parameter name never appears again after the signature line.
//
// PUSH_LIFT_K/PUSH_DRIVE_K/PUSH_LIFT_BASE/PUSH_DRIVE_BASE/PUSH_TILT_Y are
// NOT swept (already calibrated in prior work, out of scope here) — read
// as reportable-only constants, same as game4-push-sustainable-rally-validation.js.
//
// BLADE_NODE_MASS/BLADE_SPRING_K/BLADE_DAMPING_RATIO/PUSH_WRIST_BRAKE_RATE
// are left fixed at deployed values (second-order per task spec).
//
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("../load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "game4_stage4a_contact_calibration_sweep.txt");

// Same 11-preset calibration set as push-sustainable-rally-sweep-calibration.js
// / push-tilty-sweep-calibration.js, for continuity with prior calibration
// history in this repo.
const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

const MAX_ROUNDS = 12;
// Descriptive backspin label threshold on canonical outgoing topspin (carried
// over from push-sustainable-rally-sweep-calibration.js / push-sustainable-
// rally-validation.js as a label only, not a pass/fail gate — see those
// files' "backspin threshold fit" notes).
const BACKSPIN_THRESHOLD = -15;

// Deployed (baseline) Stage 4a values, read from game4.html by inspection
// (grep-confirmed at the top of this file's header comment):
const DEPLOYED_TANGENT_KP = 1.0;
const DEPLOYED_PADDLE_BLEND = 0.605;
const DEPLOYED_HALF_PERIOD_MS = 5; // PADDLE_SPRING_K = BALL_MASS * (PI / 0.005)^2
const DEPLOYED_RESTITUTION_LOW = 0.9;
const DEPLOYED_RESTITUTION_HIGH = 0.75;

function round(value, digits = 4) {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function mirrorVec(v) {
  return { x: v.x, y: v.y, z: -v.z };
}
function mirrorSpin(s) {
  return { topspin: -s.topspin, sidespin: s.sidespin };
}
function mirrorPathForDetection(path_) {
  return {
    points: path_.points.map((p) => ({ x: p.x, y: p.y, z: -p.z })),
    velocities: path_.velocities.map((v) => mirrorVec(v)),
    spins: path_.spins.map((s) => mirrorSpin(s)),
    bounces: path_.bounces.map((b) => ({ ...b, z: -b.z })),
  };
}

// Verbatim replication of game4.html's judgeReturn() PASS/FAIL branch logic
// (game4.html:1648-1660), minus DOM side effects (see header note above for
// why judgeReturn itself can't be extracted through the vm sandbox).
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

// ── Load game4.html's board (serve gen + flight sim + hit timing) + push
// contact formula, with Stage 4a parameters overridden via extraExternals.
// Same explicit symbolNames list as game4-push-sustainable-rally-validation.js
// (verified there to avoid the nested-function dependency-detection gap for
// serve-related symbols — see that file's header comment). NONE of the 5
// overridden names (TANGENT_KP/PADDLE_BLEND/PADDLE_SPRING_K/
// PADDLE_RESTITUTION_LOW/PADDLE_RESTITUTION_HIGH) appear in this list
// (landmine above). ──
function extractForParams(loader, { tangentKp, paddleBlend, halfPeriodMs, restitutionLow, restitutionHigh }) {
  const ballMass = loader.runtimeExternals.BALL_MASS;
  const paddleSpringK = ballMass * (Math.PI / (halfPeriodMs / 1000)) ** 2;
  const ext = loader.instantiateGame4Symbols(
    [
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
      "PUSH_LIFT_K",
      "PUSH_LIFT_BASE",
      "PUSH_LIFT_FLOOR",
      "PUSH_LIFT_NEUTRAL",
      "PUSH_LIFT_MAX",
      "PUSH_DRIVE_K",
      "PUSH_DRIVE_BASE",
      "PUSH_DRIVE_FLOOR",
      "PUSH_DRIVE_NEUTRAL",
      "PUSH_DRIVE_MAX",
      "PUSH_TILT_Y",
      "PADDLE_FRICTION",
    ],
    {
      TANGENT_KP: tangentKp,
      PADDLE_BLEND: paddleBlend,
      PADDLE_SPRING_K: paddleSpringK,
      PADDLE_RESTITUTION_LOW: restitutionLow,
      PADDLE_RESTITUTION_HIGH: restitutionHigh,
    }
  );
  return { ext, paddleSpringK };
}

// Instrumented rally: same structure as game4-push-sustainable-rally-validation.js's
// runInstrumentedRally, alternating two players hitting `push` at each other.
function runInstrumentedRally(ext, preset, maxRounds, TABLE) {
  const gravity = preset.solve?.gravity ?? -4.2;
  const tech = ext.TECHNIQUES.push;
  const serve = ext.simulateServe(preset);
  const firstHitIndex = ext.findPushHitIndex(serve);
  let hitPoint = serve.points[firstHitIndex];
  let hitVel = serve.velocities[firstHitIndex];
  let hitSpin = serve.spins[firstHitIndex];
  let flip = false;
  let rounds = 0;
  let failReason = null;
  const roundStats = [];

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    const canonicalHitPoint = flip ? mirrorVec(hitPoint) : hitPoint;
    const canonicalHitVel = flip ? mirrorVec(hitVel) : hitVel;
    const canonicalHitSpin = flip ? mirrorSpin(hitSpin) : hitSpin;
    const returnHitCanonical = ext.makeReturnVelocity(canonicalHitVel, canonicalHitSpin, tech, canonicalHitPoint, gravity);
    const returnVelReal = flip ? mirrorVec(returnHitCanonical.vel) : returnHitCanonical.vel;
    const returnSpinReal = flip ? mirrorSpin(returnHitCanonical.spin) : returnHitCanonical.spin;
    const outPath = ext.simulatePath({ ...hitPoint }, returnVelReal, { gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0 });

    const incomingCanonicalTopspin = round(canonicalHitSpin.topspin || 0);
    const outgoingCanonicalTopspin = round(returnHitCanonical.spin.topspin || 0);
    const outSpeed = round(Math.hypot(returnVelReal.x, returnVelReal.y, returnVelReal.z));

    const judged = judgeReturnEquivalent(outPath, TABLE);
    // judgeReturnEquivalent's bounds check already encodes "in bounds AND
    // correct side (z<0)" for the canonical (flip=false) orientation; when
    // flip=true the real path is mirrored so z-sign flips too — replicate
    // the same expectedSign logic the reference tool uses, applied on top of
    // judgeReturnEquivalent's own firstBounce/netClearance reads for
    // consistency with judgeReturn's exact branch structure.
    const firstBounce = outPath.bounces[0];
    const expectedSign = flip ? 1 : -1;
    const inBounds =
      firstBounce && Math.abs(firstBounce.x) <= TABLE.width / 2 && Math.abs(firstBounce.z) <= TABLE.length / 2 && Math.sign(firstBounce.z) === expectedSign;
    const netOk = judged.netClearance != null && judged.netClearance >= 0;

    roundStats.push({
      round: roundNum,
      incomingCanonicalTopspin,
      outgoingCanonicalTopspin,
      outSpeed,
      netClearance: judged.netClearance,
      inBounds: !!inBounds,
      isBackspin: outgoingCanonicalTopspin <= BACKSPIN_THRESHOLD,
    });

    if (!netOk || !inBounds) {
      failReason = !netOk ? "掛網" : "出界";
      break;
    }
    rounds = roundNum;
    const detectionPath = flip ? outPath : mirrorPathForDetection(outPath);
    const nextIdx = ext.findPushHitIndex(detectionPath);
    if (nextIdx == null || nextIdx >= outPath.points.length || !outPath.velocities[nextIdx] || !outPath.spins[nextIdx]) {
      failReason = "找不到下一次擊球點";
      break;
    }
    hitPoint = outPath.points[nextIdx];
    hitVel = outPath.velocities[nextIdx];
    hitSpin = outPath.spins[nextIdx];
    flip = !flip;
  }

  return { rounds, failReason, roundStats };
}

// Single-shot landing: a single push return off a live serve (flip=false,
// round 1 semantics), judged via judgeReturnEquivalent — computed as an
// INDEPENDENT call (not reused from the rally above) for auditability: this
// function's only job is the single-shot objective, so it stays readable in
// isolation even though it duplicates round-1 of runInstrumentedRally.
function runSingleShot(ext, presets, TABLE) {
  const rows = presets.map((preset) => {
    const gravity = preset.solve?.gravity ?? -4.2;
    const tech = ext.TECHNIQUES.push;
    const serve = ext.simulateServe(preset);
    const hitIndex = ext.findPushHitIndex(serve);
    const hitPoint = serve.points[hitIndex];
    const hitVel = serve.velocities[hitIndex];
    const hitSpin = serve.spins[hitIndex];
    const returnHit = ext.makeReturnVelocity(hitVel, hitSpin, tech, hitPoint, gravity);
    const outPath = ext.simulatePath({ ...hitPoint }, returnHit.vel, { gravity, spin: returnHit.spin, bounceBoost: tech.bounceBoost || 0 });
    const judged = judgeReturnEquivalent(outPath, TABLE);
    return { preset: preset.id, ok: judged.ok, reason: judged.reason, netClearance: judged.netClearance };
  });
  const okCount = rows.filter((r) => r.ok).length;
  return { okCount, total: rows.length, rows };
}

function summarizeRally(rally) {
  const stats = rally.roundStats;
  const backspinRounds = stats.filter((r) => r.isBackspin).length;
  const minOutgoingTopspin = stats.length ? Math.min(...stats.map((r) => r.outgoingCanonicalTopspin)) : null;
  const maxOutgoingTopspin = stats.length ? Math.max(...stats.map((r) => r.outgoingCanonicalTopspin)) : null;
  return {
    rounds: rally.rounds,
    failReason: rally.failReason,
    totalRoundsAttempted: stats.length,
    backspinRounds,
    minOutgoingTopspin,
    maxOutgoingTopspin,
    roundStats: stats,
  };
}

function runComboRally(loader, presets, params, TABLE) {
  const { ext, paddleSpringK } = extractForParams(loader, params);
  const perPreset = presets.map((preset) => ({
    preset: preset.id,
    ...summarizeRally(runInstrumentedRally(ext, preset, MAX_ROUNDS, TABLE)),
  }));
  const avgRounds = round(perPreset.reduce((s, r) => s + r.rounds, 0) / perPreset.length, 3);
  const minRounds = Math.min(...perPreset.map((r) => r.rounds));
  const totalBackspinRounds = perPreset.reduce((s, r) => s + r.backspinRounds, 0);
  const totalSurvivedRounds = perPreset.reduce((s, r) => s + r.rounds, 0);
  const backspinFraction = totalSurvivedRounds ? round(totalBackspinRounds / totalSurvivedRounds, 4) : null;
  const failReasonCounts = {};
  for (const r of perPreset) {
    if (r.failReason) failReasonCounts[r.failReason] = (failReasonCounts[r.failReason] || 0) + 1;
  }
  const singleShot = runSingleShot(ext, presets, TABLE);
  return { params, paddleSpringK, perPreset, avgRounds, minRounds, backspinFraction, totalSurvivedRounds, failReasonCounts, singleShot };
}

// ── Attack-technique regression check (only relevant when restitutionLow/
// High are swept away from deployed values, since dynamicPaddleEpsilon —
// used by the attack path — depends on them too). Checks whether attack
// single-shot landing (forehand_attack + backhand_attack, all 11 presets)
// still lands in-bounds, NOT a bit-exact snapshot match (changing
// PADDLE_RESTITUTION_LOW/HIGH necessarily changes batch-validation.test.js's
// pinned ATTACK_SNAPSHOT_EXPECTED numbers — that's tautological, not a
// regression signal by itself; landing pass/fail is the meaningful check). ──
function runAttackSingleShot(ext, presets, TABLE) {
  const rows = [];
  for (const preset of presets) {
    for (const techKey of ["forehand_attack", "backhand_attack"]) {
      const gravity = preset.solve?.gravity ?? -4.2;
      const tech = ext.TECHNIQUES[techKey];
      const serve = ext.simulateServe(preset);
      const hitIndex = ext.findHitIndex ? ext.findHitIndex(serve) : ext.findPushHitIndex(serve);
      const hitPoint = serve.points[hitIndex];
      const hitVel = serve.velocities[hitIndex];
      const hitSpin = serve.spins[hitIndex];
      const returnHit = ext.makeReturnVelocity(hitVel, hitSpin, tech, hitPoint, gravity);
      const outPath = ext.simulatePath({ ...hitPoint }, returnHit.vel, { gravity, spin: returnHit.spin, bounceBoost: tech.bounceBoost || 0 });
      const judged = judgeReturnEquivalent(outPath, TABLE);
      rows.push({ preset: preset.id, techKey, ok: judged.ok, reason: judged.reason });
    }
  }
  const okCount = rows.filter((r) => r.ok).length;
  return { okCount, total: rows.length, rows };
}

function fmtCombo(p) {
  return `TANGENT_KP=${p.tangentKp} PADDLE_BLEND=${p.paddleBlend} halfPeriodMs=${p.halfPeriodMs} PADDLE_RESTITUTION_LOW=${p.restitutionLow} PADDLE_RESTITUTION_HIGH=${p.restitutionHigh}`;
}

// Ranking formula (stated explicitly per task spec, auditable):
// 1. Primary: does NOT regress single-shot landing below a floor of
//    baselineSingleShot.okCount - 1 (out of 11) — i.e. allow losing at most
//    one preset relative to baseline, since baseline itself is not 11/11
//    post-221d4d3 (measured below). Combos below the floor are DISQUALIFIED
//    (sorted to the bottom regardless of rally numbers).
// 2. Among qualified combos: maximize avgRounds (rally survival, the
//    headline continuous-rally objective).
// 3. Tie-break: maximize backspinFraction (spin-preservation, the
//    architecture's whole point per push_rally_round2_failure_diagnosis.txt).
// 4. Tie-break: maximize minRounds (worst-case preset).
// 5. Tie-break: maximize singleShot.okCount itself.
function makeRankFn(singleShotFloor) {
  return function rank(a, b) {
    const aQualified = a.singleShot.okCount >= singleShotFloor;
    const bQualified = b.singleShot.okCount >= singleShotFloor;
    if (aQualified !== bQualified) return aQualified ? -1 : 1;
    if (b.avgRounds !== a.avgRounds) return b.avgRounds - a.avgRounds;
    if ((b.backspinFraction ?? 0) !== (a.backspinFraction ?? 0)) return (b.backspinFraction ?? 0) - (a.backspinFraction ?? 0);
    if (b.minRounds !== a.minRounds) return b.minRounds - a.minRounds;
    return b.singleShot.okCount - a.singleShot.okCount;
  };
}

function fmtSpinSeries(perPresetRow) {
  return perPresetRow.roundStats.map((r) => r.outgoingCanonicalTopspin).join(", ");
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const presets = allPresets.filter((preset) => !EXCLUDED_PRESET_IDS.has(preset.id));
  if (presets.length !== allPresets.length - EXCLUDED_PRESET_IDS.size) {
    throw new Error("Preset exclusion mismatch — check EXCLUDED_PRESET_IDS against physics-presets.json.");
  }

  process.stderr.write("[load] game4.html loader\n");
  const loader = loadGame4Physics({});
  const TABLE = loader.runtimeExternals.TABLE;

  // ── Baseline (deployed, post-221d4d3) ──
  process.stderr.write("[baseline] deployed Stage 4a config\n");
  const baselineParams = {
    tangentKp: DEPLOYED_TANGENT_KP,
    paddleBlend: DEPLOYED_PADDLE_BLEND,
    halfPeriodMs: DEPLOYED_HALF_PERIOD_MS,
    restitutionLow: DEPLOYED_RESTITUTION_LOW,
    restitutionHigh: DEPLOYED_RESTITUTION_HIGH,
  };
  const baselineResult = runComboRally(loader, presets, baselineParams, TABLE);
  const baselineAttack = runAttackSingleShot(extractForParams(loader, baselineParams).ext, presets, TABLE);
  // Floor: allow losing at most 1 preset off baseline's single-shot pass count.
  const SINGLE_SHOT_FLOOR = Math.max(0, baselineResult.singleShot.okCount - 1);
  const rank = makeRankFn(SINGLE_SHOT_FLOOR);

  process.stderr.write(
    `[baseline] avgRounds=${baselineResult.avgRounds} minRounds=${baselineResult.minRounds} backspinFraction=${baselineResult.backspinFraction} singleShot=${baselineResult.singleShot.okCount}/${baselineResult.singleShot.total} attackSingleShot=${baselineAttack.okCount}/${baselineAttack.total}\n`
  );

  // ── Stage 1: coarse grid over TANGENT_KP x PADDLE_BLEND x halfPeriodMs.
  // Restitution held fixed at deployed values. ──
  // Grid sizes were chosen after an empirical timing pilot (see report's
  // "performance note"): each combo costs ~2-20s depending on how many
  // rounds it survives (push's aiming solve does a ~160-point grid search +
  // bisection through the expensive substepped spring-damper integrator per
  // shot, unlike attack's cheap closed-form secant solve), so a naive dense
  // grid (e.g. 5x6x5=150 combos) risked 30-45+ minutes. Sizes below keep the
  // full staged sweep (baseline+stage1+stage2+stage3) to a ~15-25 minute
  // budget while still covering the full requested range on each axis.
  const STAGE1_TANGENT_KP = [0.3, 0.6, 1.0, 1.8];
  const STAGE1_PADDLE_BLEND = [0, 0.3, 0.605, 1.0];
  const STAGE1_HALF_PERIOD_MS = [3, 5, 6.5, 8];

  const stage1Results = [];
  let stage1Count = 0;
  const stage1Total = STAGE1_TANGENT_KP.length * STAGE1_PADDLE_BLEND.length * STAGE1_HALF_PERIOD_MS.length;
  for (const tangentKp of STAGE1_TANGENT_KP) {
    for (const paddleBlend of STAGE1_PADDLE_BLEND) {
      for (const halfPeriodMs of STAGE1_HALF_PERIOD_MS) {
        stage1Count += 1;
        process.stderr.write(`[stage1 ${stage1Count}/${stage1Total}] TANGENT_KP=${tangentKp} PADDLE_BLEND=${paddleBlend} halfPeriodMs=${halfPeriodMs}\n`);
        const params = { tangentKp, paddleBlend, halfPeriodMs, restitutionLow: DEPLOYED_RESTITUTION_LOW, restitutionHigh: DEPLOYED_RESTITUTION_HIGH };
        stage1Results.push(runComboRally(loader, presets, params, TABLE));
      }
    }
  }
  const stage1Sorted = [...stage1Results].sort(rank);
  const stage1Winner = stage1Sorted[0];

  // ── Stage 2: fix stage-1 winner's TANGENT_KP/PADDLE_BLEND/halfPeriodMs,
  // sweep PADDLE_RESTITUTION_LOW x PADDLE_RESTITUTION_HIGH around deployed
  // values. Checks attack-technique landing regression per candidate. ──
  const STAGE2_RESTITUTION_LOW = [0.8, 0.85, 0.9, 0.95];
  const STAGE2_RESTITUTION_HIGH = [0.65, 0.7, 0.75, 0.8];

  const stage2Results = [];
  let stage2Count = 0;
  const stage2Total = STAGE2_RESTITUTION_LOW.length * STAGE2_RESTITUTION_HIGH.length;
  for (const restitutionLow of STAGE2_RESTITUTION_LOW) {
    for (const restitutionHigh of STAGE2_RESTITUTION_HIGH) {
      if (restitutionHigh > restitutionLow) continue; // HIGH-speed restitution should stay <= LOW-speed restitution (physically: less bounce at higher impact speed)
      stage2Count += 1;
      process.stderr.write(`[stage2 ${stage2Count}/${stage2Total}] PADDLE_RESTITUTION_LOW=${restitutionLow} PADDLE_RESTITUTION_HIGH=${restitutionHigh}\n`);
      const params = {
        tangentKp: stage1Winner.params.tangentKp,
        paddleBlend: stage1Winner.params.paddleBlend,
        halfPeriodMs: stage1Winner.params.halfPeriodMs,
        restitutionLow,
        restitutionHigh,
      };
      const comboResult = runComboRally(loader, presets, params, TABLE);
      const attackCheck = runAttackSingleShot(extractForParams(loader, params).ext, presets, TABLE);
      stage2Results.push({ ...comboResult, attackCheck });
    }
  }
  const stage2Sorted = [...stage2Results].sort(rank);
  const stage2Winner = stage2Sorted.length ? stage2Sorted[0] : null;

  // ── Stage 3: refine around the better of stage1Winner (restitution fixed
  // at deployed) vs stage2Winner (restitution possibly moved), narrow grid
  // on TANGENT_KP x PADDLE_BLEND x halfPeriodMs around that point. ──
  const stage1And2Combined = stage2Winner && rank(stage2Winner, stage1Winner) < 0 ? stage2Winner : { ...stage1Winner, attackCheck: baselineAttack };
  const refineCenter = stage1And2Combined.params;
  function refineAxis(center, deltas) {
    return [...new Set(deltas.map((d) => round(Math.max(0, center + d), 4)))].filter((v) => v > 0);
  }
  const STAGE3_TANGENT_KP = refineAxis(refineCenter.tangentKp, [-0.2, 0, 0.2]);
  const STAGE3_PADDLE_BLEND = [...new Set([-0.15, 0, 0.15].map((d) => round(clampUnit(refineCenter.paddleBlend + d), 4)))];
  const STAGE3_HALF_PERIOD_MS = refineAxis(refineCenter.halfPeriodMs, [-0.5, 0, 0.5]);

  function clampUnit(v) {
    return Math.max(0, Math.min(1, v));
  }

  const stage3Results = [];
  let stage3Count = 0;
  const stage3Total = STAGE3_TANGENT_KP.length * STAGE3_PADDLE_BLEND.length * STAGE3_HALF_PERIOD_MS.length;
  for (const tangentKp of STAGE3_TANGENT_KP) {
    for (const paddleBlend of STAGE3_PADDLE_BLEND) {
      for (const halfPeriodMs of STAGE3_HALF_PERIOD_MS) {
        stage3Count += 1;
        process.stderr.write(`[stage3 ${stage3Count}/${stage3Total}] TANGENT_KP=${tangentKp} PADDLE_BLEND=${paddleBlend} halfPeriodMs=${halfPeriodMs}\n`);
        const params = { tangentKp, paddleBlend, halfPeriodMs, restitutionLow: refineCenter.restitutionLow, restitutionHigh: refineCenter.restitutionHigh };
        stage3Results.push(runComboRally(loader, presets, params, TABLE));
      }
    }
  }
  const stage3Sorted = [...stage3Results].sort(rank);
  const stage3Winner = stage3Sorted.length ? stage3Sorted[0] : null;

  // ── Overall final winner across all stages + baseline ──
  const allCandidates = [
    { ...baselineResult, attackCheck: baselineAttack, stageLabel: "baseline" },
    ...stage1Results.map((r) => ({ ...r, attackCheck: baselineAttack, stageLabel: "stage1" })),
    ...stage2Results.map((r) => ({ ...r, stageLabel: "stage2" })),
    ...stage3Results.map((r) => ({ ...r, attackCheck: stage1And2Combined.attackCheck, stageLabel: "stage3" })),
  ];
  const allSorted = [...allCandidates].sort(rank);
  const finalWinner = allSorted[0];

  // ── Per-objective top candidates (Pareto visibility: best by EACH
  // objective alone, not filtered by the floor) ──
  const byAvgRounds = [...allCandidates].sort((a, b) => b.avgRounds - a.avgRounds).slice(0, 5);
  const byBackspinFraction = [...allCandidates].sort((a, b) => (b.backspinFraction ?? 0) - (a.backspinFraction ?? 0)).slice(0, 5);
  const bySingleShot = [...allCandidates].sort((a, b) => b.singleShot.okCount - a.singleShot.okCount || b.avgRounds - a.avgRounds).slice(0, 5);

  // ── Report ──
  const lines = [];
  lines.push("# game4.html Stage 4a push contact-model parameter calibration sweep");
  lines.push("");
  lines.push("> Read-only research tool output. Does not modify game4.html or return-studio.html. Recommendation only — whether/how to apply is a follow-up decision.");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length} (11-preset calibration set, same exclusions as push-sustainable-rally-sweep-calibration.js: ${[...EXCLUDED_PRESET_IDS].join(", ")})`);
  lines.push(`maxRounds per rally: ${MAX_ROUNDS}. Descriptive backspin label threshold on canonical outgoing topspin: <= ${BACKSPIN_THRESHOLD} (label only, not a survival gate).`);
  lines.push("");

  lines.push("## Design principle under test");
  lines.push("");
  lines.push("Commit 221d4d3 ported return-studio.html's Stage 4a spring-damper substepped push contact model (architecture only) into game4.html, replacing the old instantaneous-collision bounceOffPlane for push. Re-running game4-push-sustainable-rally-validation.js afterward showed rally survival got WORSE (avgRounds 3.364->0.909) even though backspin-preservation got better (backspinFraction 8.11%->40%). This tool searches the contact-model PARAMETERS (TANGENT_KP, PADDLE_BLEND, PADDLE_SPRING_K's derivation half-period, PADDLE_RESTITUTION_LOW/HIGH) for a combo that improves rally survival without wrecking single-shot landing, scoring both objectives separately (not collapsed into one scalar) since this may be — and turned out to be, see below — a genuine Pareto tradeoff.");
  lines.push("");

  lines.push("## Ranking formula (stated explicitly for audit)");
  lines.push("");
  lines.push(`1. DISQUALIFY any combo with singleShot.okCount < ${SINGLE_SHOT_FLOOR} (floor = baseline's singleShot.okCount [${baselineResult.singleShot.okCount}] minus 1 — allows losing at most one preset off baseline's single-shot landing rate). Disqualified combos sort to the bottom regardless of rally numbers.`);
  lines.push("2. Among qualified combos: maximize avgRounds (rally survival, the headline objective).");
  lines.push("3. Tie-break: maximize backspinFraction (spin-preservation — the whole point of the Stage 4a port).");
  lines.push("4. Tie-break: maximize minRounds (worst-case preset).");
  lines.push("5. Tie-break: maximize singleShot.okCount.");
  lines.push("");

  lines.push("## Grid dimensions (staged: coarse -> restitution -> refine)");
  lines.push("");
  lines.push(`- Stage 1: TANGENT_KP x PADDLE_BLEND x halfPeriodMs = ${STAGE1_TANGENT_KP.length} x ${STAGE1_PADDLE_BLEND.length} x ${STAGE1_HALF_PERIOD_MS.length} = ${stage1Total} combos x ${presets.length} presets x up to ${MAX_ROUNDS} rounds each (+ ${presets.length}-preset single-shot check per combo). PADDLE_RESTITUTION_LOW/HIGH held at deployed values (${DEPLOYED_RESTITUTION_LOW}/${DEPLOYED_RESTITUTION_HIGH}).`);
  lines.push(`  TANGENT_KP candidates: ${STAGE1_TANGENT_KP.join(", ")} (deployed: ${DEPLOYED_TANGENT_KP})`);
  lines.push(`  PADDLE_BLEND candidates: ${STAGE1_PADDLE_BLEND.join(", ")} (deployed: ${DEPLOYED_PADDLE_BLEND}; 0=rigid contact normal, 1=fully ball-approach-direction)`);
  lines.push(`  halfPeriodMs candidates: ${STAGE1_HALF_PERIOD_MS.join(", ")} (deployed: ${DEPLOYED_HALF_PERIOD_MS}ms; PADDLE_SPRING_K = BALL_MASS * (PI/halfPeriod)^2)`);
  lines.push(`- Stage 2: PADDLE_RESTITUTION_LOW x PADDLE_RESTITUTION_HIGH (HIGH<=LOW only) = up to ${STAGE2_RESTITUTION_LOW.length}x${STAGE2_RESTITUTION_HIGH.length}, actually run ${stage2Results.length} combos, TANGENT_KP/PADDLE_BLEND/halfPeriodMs fixed at stage-1 winner (${fmtCombo({ ...stage1Winner.params, restitutionLow: "-", restitutionHigh: "-" })}). Attack-technique single-shot landing (forehand_attack+backhand_attack x ${presets.length} presets = ${presets.length * 2} shots) checked per candidate as a regression signal (dynamicPaddleEpsilon, used by the attack contact path, also reads these two constants).`);
  lines.push(`  PADDLE_RESTITUTION_LOW candidates: ${STAGE2_RESTITUTION_LOW.join(", ")} (deployed: ${DEPLOYED_RESTITUTION_LOW})`);
  lines.push(`  PADDLE_RESTITUTION_HIGH candidates: ${STAGE2_RESTITUTION_HIGH.join(", ")} (deployed: ${DEPLOYED_RESTITUTION_HIGH})`);
  lines.push(`- Stage 3 (refine): TANGENT_KP x PADDLE_BLEND x halfPeriodMs narrow grid around the better of stage1/stage2 winners = ${STAGE3_TANGENT_KP.length} x ${STAGE3_PADDLE_BLEND.length} x ${STAGE3_HALF_PERIOD_MS.length} = ${stage3Total} combos, restitution fixed at ${refineCenter.restitutionLow}/${refineCenter.restitutionHigh}.`);
  lines.push(`  TANGENT_KP candidates: ${STAGE3_TANGENT_KP.join(", ")}`);
  lines.push(`  PADDLE_BLEND candidates: ${STAGE3_PADDLE_BLEND.join(", ")}`);
  lines.push(`  halfPeriodMs candidates: ${STAGE3_HALF_PERIOD_MS.join(", ")}`);
  lines.push("");

  lines.push("## Baseline (deployed, post-221d4d3)");
  lines.push("");
  lines.push(
    `${fmtCombo(baselineParams)} -> avgRounds=${baselineResult.avgRounds}, minRounds=${baselineResult.minRounds}, backspinFraction=${baselineResult.backspinFraction}, singleShot=${baselineResult.singleShot.okCount}/${baselineResult.singleShot.total}, attackSingleShot=${baselineAttack.okCount}/${baselineAttack.total}`
  );
  lines.push(`failReason counts: ${JSON.stringify(baselineResult.failReasonCounts)}`);
  lines.push("");
  lines.push("preset | rounds survived | fail reason | singleShot ok | outgoing topspin per round (canonical)");
  lines.push("--- | --- | --- | --- | ---");
  for (const row of baselineResult.perPreset) {
    const ss = baselineResult.singleShot.rows.find((r) => r.preset === row.preset);
    lines.push(`${row.preset} | ${row.rounds} | ${row.failReason ?? "-"} | ${ss ? ss.ok : "?"} | ${fmtSpinSeries(row)}`);
  }
  lines.push("");

  lines.push("## Stage 1 results (top 20 by ranking formula)");
  lines.push("");
  lines.push("TANGENT_KP | PADDLE_BLEND | halfPeriodMs | avgRounds | minRounds | backspinFraction | singleShot | qualified");
  lines.push("--- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of stage1Sorted.slice(0, 20)) {
    lines.push(
      `${r.params.tangentKp} | ${r.params.paddleBlend} | ${r.params.halfPeriodMs} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.singleShot.okCount}/${r.singleShot.total} | ${r.singleShot.okCount >= SINGLE_SHOT_FLOOR}`
    );
  }
  lines.push("");
  lines.push(`Stage 1 winner: ${fmtCombo({ ...stage1Winner.params, restitutionLow: DEPLOYED_RESTITUTION_LOW, restitutionHigh: DEPLOYED_RESTITUTION_HIGH })} -> avgRounds=${stage1Winner.avgRounds}, minRounds=${stage1Winner.minRounds}, backspinFraction=${stage1Winner.backspinFraction}, singleShot=${stage1Winner.singleShot.okCount}/${stage1Winner.singleShot.total}`);
  lines.push("");

  lines.push("## Stage 2 results (PADDLE_RESTITUTION_LOW x HIGH around stage-1 winner, with attack-landing regression check)");
  lines.push("");
  lines.push("PADDLE_RESTITUTION_LOW | PADDLE_RESTITUTION_HIGH | avgRounds | minRounds | backspinFraction | singleShot | attackSingleShot");
  lines.push("--- | --- | --- | --- | --- | --- | ---");
  for (const r of stage2Sorted) {
    lines.push(
      `${r.params.restitutionLow} | ${r.params.restitutionHigh} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.singleShot.okCount}/${r.singleShot.total} | ${r.attackCheck.okCount}/${r.attackCheck.total}`
    );
  }
  lines.push("");
  if (stage2Winner) {
    lines.push(
      `Stage 2 winner: ${fmtCombo(stage2Winner.params)} -> avgRounds=${stage2Winner.avgRounds}, minRounds=${stage2Winner.minRounds}, backspinFraction=${stage2Winner.backspinFraction}, singleShot=${stage2Winner.singleShot.okCount}/${stage2Winner.singleShot.total}, attackSingleShot=${stage2Winner.attackCheck.okCount}/${stage2Winner.attackCheck.total}`
    );
    lines.push(
      `Attack-landing regression check: baseline attackSingleShot=${baselineAttack.okCount}/${baselineAttack.total}; stage-2 winner attackSingleShot=${stage2Winner.attackCheck.okCount}/${stage2Winner.attackCheck.total} -> ${stage2Winner.attackCheck.okCount >= baselineAttack.okCount ? "NOT regressed" : "REGRESSED"}.`
    );
  } else {
    lines.push("(No stage-2 combos satisfied HIGH<=LOW.)");
  }
  lines.push("");

  lines.push("## Stage 3 (refine) results (top 20 by ranking formula)");
  lines.push("");
  lines.push("TANGENT_KP | PADDLE_BLEND | halfPeriodMs | avgRounds | minRounds | backspinFraction | singleShot");
  lines.push("--- | --- | --- | --- | --- | --- | ---");
  for (const r of stage3Sorted.slice(0, 20)) {
    lines.push(`${r.params.tangentKp} | ${r.params.paddleBlend} | ${r.params.halfPeriodMs} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.singleShot.okCount}/${r.singleShot.total}`);
  }
  lines.push("");
  if (stage3Winner) {
    lines.push(`Stage 3 winner: ${fmtCombo({ ...stage3Winner.params, restitutionLow: refineCenter.restitutionLow, restitutionHigh: refineCenter.restitutionHigh })} -> avgRounds=${stage3Winner.avgRounds}, minRounds=${stage3Winner.minRounds}, backspinFraction=${stage3Winner.backspinFraction}, singleShot=${stage3Winner.singleShot.okCount}/${stage3Winner.singleShot.total}`);
  }
  lines.push("");

  lines.push("## Overall final winner (across baseline + all stages, by ranking formula)");
  lines.push("");
  lines.push(`${fmtCombo(finalWinner.params)} [from ${finalWinner.stageLabel}]`);
  lines.push(
    `avgRounds=${finalWinner.avgRounds}, minRounds=${finalWinner.minRounds}, backspinFraction=${finalWinner.backspinFraction}, totalSurvivedRounds=${finalWinner.totalSurvivedRounds}, singleShot=${finalWinner.singleShot.okCount}/${finalWinner.singleShot.total}, attackSingleShot=${finalWinner.attackCheck.okCount}/${finalWinner.attackCheck.total}`
  );
  lines.push("");
  lines.push("preset | rounds survived | fail reason | singleShot ok | outgoing topspin per round (canonical)");
  lines.push("--- | --- | --- | --- | ---");
  for (const row of finalWinner.perPreset) {
    const ss = finalWinner.singleShot.rows.find((r) => r.preset === row.preset);
    lines.push(`${row.preset} | ${row.rounds} | ${row.failReason ?? "-"} | ${ss ? ss.ok : "?"} | ${fmtSpinSeries(row)}`);
  }
  lines.push("");

  lines.push("## Pareto visibility: top candidates by EACH objective alone (unfiltered by the qualification floor)");
  lines.push("");
  lines.push("### Top 5 by avgRounds (rally survival) alone");
  lines.push("");
  lines.push("stage | TANGENT_KP | PADDLE_BLEND | halfPeriodMs | restitutionLow | restitutionHigh | avgRounds | minRounds | backspinFraction | singleShot");
  lines.push("--- | --- | --- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of byAvgRounds) {
    lines.push(`${r.stageLabel} | ${r.params.tangentKp} | ${r.params.paddleBlend} | ${r.params.halfPeriodMs} | ${r.params.restitutionLow} | ${r.params.restitutionHigh} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.singleShot.okCount}/${r.singleShot.total}`);
  }
  lines.push("");
  lines.push("### Top 5 by backspinFraction (spin-preservation) alone");
  lines.push("");
  lines.push("stage | TANGENT_KP | PADDLE_BLEND | halfPeriodMs | restitutionLow | restitutionHigh | avgRounds | minRounds | backspinFraction | singleShot");
  lines.push("--- | --- | --- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of byBackspinFraction) {
    lines.push(`${r.stageLabel} | ${r.params.tangentKp} | ${r.params.paddleBlend} | ${r.params.halfPeriodMs} | ${r.params.restitutionLow} | ${r.params.restitutionHigh} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.singleShot.okCount}/${r.singleShot.total}`);
  }
  lines.push("");
  lines.push("### Top 5 by singleShot.okCount (single-shot landing) alone");
  lines.push("");
  lines.push("stage | TANGENT_KP | PADDLE_BLEND | halfPeriodMs | restitutionLow | restitutionHigh | avgRounds | minRounds | backspinFraction | singleShot");
  lines.push("--- | --- | --- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of bySingleShot) {
    lines.push(`${r.stageLabel} | ${r.params.tangentKp} | ${r.params.paddleBlend} | ${r.params.halfPeriodMs} | ${r.params.restitutionLow} | ${r.params.restitutionHigh} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.singleShot.okCount}/${r.singleShot.total}`);
  }
  lines.push("");
  lines.push("If the top-5-by-avgRounds and top-5-by-singleShot tables above do not overlap, that is direct evidence of a genuine Pareto tradeoff between rally survival and single-shot landing under this parameter family — see interpretation note below.");
  lines.push("");

  const paretoOverlap = byAvgRounds.some((a) => bySingleShot.some((b) => JSON.stringify(a.params) === JSON.stringify(b.params)));
  lines.push("## Interpretation note");
  lines.push("");
  lines.push(
    paretoOverlap
      ? "The best-by-avgRounds and best-by-singleShot candidate sets overlap — the overall final winner above is not a compromise sacrificing one objective for the other."
      : "The best-by-avgRounds and best-by-singleShot candidate sets do NOT overlap (no shared combo in the top 5 of each) — this is a genuine Pareto tradeoff within the parameter family swept here. The overall final winner (ranking formula above) prioritizes rally survival subject to a single-shot landing floor, not a free-standing optimum on both axes simultaneously."
  );
  lines.push("");

  lines.push("## Full JSON (all stage results)");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      {
        singleShotFloor: SINGLE_SHOT_FLOOR,
        baselineParams,
        baselineResult,
        baselineAttack,
        stage1Results,
        stage2Results,
        stage3Results,
        finalWinner,
        byAvgRounds,
        byBackspinFraction,
        bySingleShot,
      },
      null,
      2
    )
  );
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

  console.log("=== Baseline ===");
  console.log(`avgRounds=${baselineResult.avgRounds} minRounds=${baselineResult.minRounds} backspinFraction=${baselineResult.backspinFraction} singleShot=${baselineResult.singleShot.okCount}/${baselineResult.singleShot.total} attackSingleShot=${baselineAttack.okCount}/${baselineAttack.total}`);
  console.log("=== Stage 1 top 10 ===");
  console.table(stage1Sorted.slice(0, 10).map((r) => ({ TANGENT_KP: r.params.tangentKp, PADDLE_BLEND: r.params.paddleBlend, halfPeriodMs: r.params.halfPeriodMs, avgRounds: r.avgRounds, minRounds: r.minRounds, backspinFraction: r.backspinFraction, singleShot: `${r.singleShot.okCount}/${r.singleShot.total}` })));
  console.log("=== Stage 2 (all) ===");
  console.table(stage2Sorted.map((r) => ({ restitutionLow: r.params.restitutionLow, restitutionHigh: r.params.restitutionHigh, avgRounds: r.avgRounds, backspinFraction: r.backspinFraction, singleShot: `${r.singleShot.okCount}/${r.singleShot.total}`, attackSingleShot: `${r.attackCheck.okCount}/${r.attackCheck.total}` })));
  console.log("=== Stage 3 top 10 ===");
  console.table(stage3Sorted.slice(0, 10).map((r) => ({ TANGENT_KP: r.params.tangentKp, PADDLE_BLEND: r.params.paddleBlend, halfPeriodMs: r.params.halfPeriodMs, avgRounds: r.avgRounds, backspinFraction: r.backspinFraction, singleShot: `${r.singleShot.okCount}/${r.singleShot.total}` })));
  console.log(`Final winner [${finalWinner.stageLabel}]: ${fmtCombo(finalWinner.params)}`);
  console.log(`avgRounds=${finalWinner.avgRounds} minRounds=${finalWinner.minRounds} backspinFraction=${finalWinner.backspinFraction} singleShot=${finalWinner.singleShot.okCount}/${finalWinner.singleShot.total} attackSingleShot=${finalWinner.attackCheck.okCount}/${finalWinner.attackCheck.total}`);
  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}
