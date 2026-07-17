#!/usr/bin/env node

// Push (切球) "sustainable backspin-vs-backspin rally" calibration sweep.
//
// Target (user's design principle, restated): push is a backspin-PRESERVING/
// REGENERATING stroke, not a spin-neutralizing one. If the incoming ball has
// medium/strong backspin and push is executed correctly, the OUTGOING ball
// should also carry clear backspin — strong enough that two players trading
// pure pushes should be able to keep the ball in backspin indefinitely.
//
// Prior finding (AI_CONTEXT/adhoc-experiments/push_rally_round2_failure_diagnosis.txt): with the
// deployed formula, push contact neutralizes canonical incoming topspin
// (~-70..-83) down to near zero (~-3..-4) at contact, which then flips sign to
// genuine topspin (~+31..+33) by the time it becomes round 2's incoming ball —
// a regime the technique was never calibrated for, and rallies die at round 2.
//
// This sweep searches for a parameter combo where runRallyReal (the page's own
// continuous-rally simulator) survives many rounds AND the canonical outgoing
// spin at each surviving round's contact stays clearly negative (backspin).
//
// Grid design (two-stage, per coordinator correction on 2026-07-13):
// Stage 1 splits the old single "driveScale" into two INDEPENDENT multipliers
// on PUSH_LIFT_BASE (vertical/lift component -> vertical racket velocity) and
// PUSH_DRIVE_BASE (forward/drive component -> forward racket velocity). Their
// RATIO is the racket's own swing-direction angle (previously fixed at
// atan(0.35/0.7)=26.57° from horizontal); their product/magnitude is overall
// swing speed. tiltY (paddle face angle) is a third, independent axis. Stage 1
// sweeps tiltY x liftScale x driveScale with TANGENT_KP/PADDLE_FRICTION held
// at their currently-deployed values (1.0 / 0.4).
// Stage 2 fixes the stage-1 winner's tiltY/liftScale/driveScale and sweeps
// TANGENT_KP-scale x PADDLE_FRICTION around it, since more tangential spin
// transfer (and/or a higher Coulomb friction cap) is the mechanism most
// directly responsible for how much spin gets imparted at contact.
//
// Extraction pattern reused from push-candidate-rally-timing-validation.js /
// push-tiltxy-drivescaled-sweep-calibration.js. Landmine (documented in both):
// never list an overridden symbol in the top-level symbolNames array passed to
// instantiateReturnStudioSymbols alongside extraExternals for that same name —
// local extraction wins and the override silently no-ops. TANGENT_KP and
// PADDLE_FRICTION are simple single-declarator consts (return-studio.html:291,
// 324) so they can be overridden the same way PUSH_TILT_Y was: via
// extraExternals only, never added to symbolNames.
//
// Read-only research tool. Does not modify return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadReturnStudioPhysics } = require("../load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_final_sustainable_rally_calibration.txt");

// Same 11-preset calibration set as push-tilty-sweep-calibration.js.
const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

const PUSH_LIFT_BASE = 0.35, PUSH_LIFT_FLOOR = 0, PUSH_LIFT_MAX = 3.0;
const PUSH_DRIVE_BASE = 0.7, PUSH_DRIVE_FLOOR = 0.1, PUSH_DRIVE_MAX = 3.0;
const DEPLOYED_TANGENT_KP = 1.0;
const DEPLOYED_PADDLE_FRICTION = 0.4;

const MAX_ROUNDS = 12;
// Backspin-strength threshold on canonical outgoing topspin at contact. Chosen
// per task spec as an initial guess ("clearly negative, not just barely"),
// then empirically checked below against whether it actually predicts
// round-to-round survival (predictedFail vs actualFail agreement), refining if
// off. Negative topspin = backspin in this codebase's convention (see
// push_rally_round2_failure_diagnosis.txt).
let BACKSPIN_THRESHOLD = -15;

function clampLocal(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}
function round(value, digits = 4) {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function makeScaledLift(liftScale) {
  return function computeAdaptivePushLift() {
    return clampLocal(PUSH_LIFT_BASE, PUSH_LIFT_FLOOR, PUSH_LIFT_MAX) * liftScale;
  };
}
function makeScaledDrive(driveScale) {
  return function computeAdaptivePushDrive() {
    return clampLocal(PUSH_DRIVE_BASE, PUSH_DRIVE_FLOOR, PUSH_DRIVE_MAX) * driveScale;
  };
}

function swingAngleDeg(liftScale, driveScale) {
  return (Math.atan((liftScale * PUSH_LIFT_BASE) / (driveScale * PUSH_DRIVE_BASE)) * 180) / Math.PI;
}

function extractForParams(loader, { tiltY, liftScale, driveScale, tangentKp, paddleFriction }) {
  // Only request the top-level output symbols we actually call directly.
  // computeAdaptivePushLift/Drive/PUSH_TILT_Y/TANGENT_KP/PADDLE_FRICTION must
  // NOT appear here (landmine above) — they resolve to our external overrides
  // transitively through the local dependency chain instead.
  return loader.instantiateReturnStudioSymbols(
    [
      "runRallyReal",
      "simulateServe",
      "simulateReturnForPreset",
      "findPushHitIndex",
      "simulatePath",
      "makeReturnVelocity",
      "mirrorVec",
      "mirrorSpin",
      "mirrorPathForDetection",
      "judgeResult",
      "TECHNIQUES",
    ],
    {
      PUSH_TILT_Y: tiltY,
      computeAdaptivePushLift: makeScaledLift(liftScale),
      computeAdaptivePushDrive: makeScaledDrive(driveScale),
      TANGENT_KP: tangentKp,
      PADDLE_FRICTION: paddleFriction,
    }
  );
}

// Instrumented copy of runRallyReal (return-studio.html:1589-1626), matching
// push-candidate-rally-timing-validation.js's runInstrumentedRally, extended
// to record the CANONICAL outgoing topspin at every round's contact (the
// spin immediately produced by push contact, before mirroring — always in the
// same sign convention regardless of which side is hitting) so we can check
// the backspin-preservation criterion round by round.
function runInstrumentedRally(ext, preset, maxRounds) {
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
    const canonicalHitPoint = flip ? ext.mirrorVec(hitPoint) : hitPoint;
    const canonicalHitVel = flip ? ext.mirrorVec(hitVel) : hitVel;
    const canonicalHitSpin = flip ? ext.mirrorSpin(hitSpin) : hitSpin;
    const returnHitCanonical = ext.makeReturnVelocity(canonicalHitVel, canonicalHitSpin, tech, canonicalHitPoint, gravity);
    const returnVelReal = flip ? ext.mirrorVec(returnHitCanonical.vel) : returnHitCanonical.vel;
    const returnSpinReal = flip ? ext.mirrorSpin(returnHitCanonical.spin) : returnHitCanonical.spin;
    const outPath = ext.simulatePath({ ...hitPoint }, returnVelReal, { gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0 });

    const incomingCanonicalTopspin = round(canonicalHitSpin.topspin || 0);
    const outgoingCanonicalTopspin = round(returnHitCanonical.spin.topspin || 0);
    const outSpeed = round(Math.hypot(returnVelReal.x, returnVelReal.y, returnVelReal.z));

    const netClearance = outPath.netY == null ? null : outPath.netY - (0.76 + 0.1525);
    const firstBounce = outPath.bounces[0];
    const expectedSign = flip ? 1 : -1;
    const inBounds = firstBounce && Math.abs(firstBounce.x) <= 1.525 / 2 && Math.abs(firstBounce.z) <= 2.74 / 2 && Math.sign(firstBounce.z) === expectedSign;
    const netOk = netClearance != null && netClearance >= 0;

    roundStats.push({
      round: roundNum,
      incomingCanonicalTopspin,
      outgoingCanonicalTopspin,
      outSpeed,
      netClearance: netClearance == null ? null : round(netClearance),
      inBounds: !!inBounds,
      isBackspin: outgoingCanonicalTopspin <= BACKSPIN_THRESHOLD,
    });

    if (!netOk || !inBounds) {
      failReason = !netOk ? "掛網" : "出界";
      break;
    }
    rounds = roundNum;
    const detectionPath = flip ? outPath : ext.mirrorPathForDetection(outPath);
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

function summarizeRally(rally) {
  const stats = rally.roundStats;
  const backspinRounds = stats.filter((r) => r.isBackspin).length;
  const nonBackspinButSurvivedRounds = stats.filter((r, i) => !r.isBackspin && i < rally.rounds).length;
  const minOutgoingTopspin = stats.length ? Math.min(...stats.map((r) => r.outgoingCanonicalTopspin)) : null;
  const maxOutgoingTopspin = stats.length ? Math.max(...stats.map((r) => r.outgoingCanonicalTopspin)) : null;
  return {
    rounds: rally.rounds,
    failReason: rally.failReason,
    totalRoundsAttempted: stats.length,
    backspinRounds,
    nonBackspinButSurvivedRounds,
    minOutgoingTopspin,
    maxOutgoingTopspin,
    roundStats: stats,
  };
}

function runComboRally(loader, presets, params) {
  const ext = extractForParams(loader, params);
  const perPreset = presets.map((preset) => ({
    preset: preset.id,
    ...summarizeRally(runInstrumentedRally(ext, preset, MAX_ROUNDS)),
  }));
  const avgRounds = round(perPreset.reduce((s, r) => s + r.rounds, 0) / perPreset.length, 3);
  const minRounds = Math.min(...perPreset.map((r) => r.rounds));
  const totalBackspinRounds = perPreset.reduce((s, r) => s + r.backspinRounds, 0);
  const totalSurvivedRounds = perPreset.reduce((s, r) => s + r.rounds, 0);
  const backspinFraction = totalSurvivedRounds ? round(totalBackspinRounds / totalSurvivedRounds, 4) : null;
  return { params, perPreset, avgRounds, minRounds, backspinFraction, totalSurvivedRounds };
}

function runSingleShot(loader, presets, params) {
  const ext = extractForParams(loader, params);
  const rows = presets.map((preset) => {
    const sim = ext.simulateReturnForPreset(preset, "forehand", "push");
    const judged = ext.judgeResult(sim.result);
    return { preset: preset.id, ok: judged.ok, reason: judged.reason };
  });
  const okCount = rows.filter((r) => r.ok).length;
  return { okCount, total: rows.length, rows };
}

function fmtCombo(p) {
  return `tiltY=${p.tiltY} liftScale=${p.liftScale} driveScale=${p.driveScale} angle=${round(swingAngleDeg(p.liftScale, p.driveScale), 1)}° TANGENT_KP=${p.tangentKp} PADDLE_FRICTION=${p.paddleFriction}`;
}

function main() {
  const allPresets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")).serves || [];
  const presets = allPresets.filter((preset) => !EXCLUDED_PRESET_IDS.has(preset.id));
  if (presets.length !== allPresets.length - EXCLUDED_PRESET_IDS.size) {
    throw new Error("Preset exclusion mismatch — check EXCLUDED_PRESET_IDS against physics-presets.json.");
  }

  const loader = loadReturnStudioPhysics({});

  // ── Baseline (deployed) for comparison ──
  process.stderr.write("[baseline] deployed config\n");
  const baselineParams = { tiltY: 0.8, liftScale: 1.0, driveScale: 1.0, tangentKp: DEPLOYED_TANGENT_KP, paddleFriction: DEPLOYED_PADDLE_FRICTION };
  const baselineResult = runComboRally(loader, presets, baselineParams);

  // ── Stage 1: tiltY x liftScale x driveScale, TANGENT_KP/PADDLE_FRICTION fixed at deployed values ──
  const STAGE1_TILT_Y = [0.8, 1.0, 1.2];
  const STAGE1_LIFT_SCALE = [0.5, 0.8, 1.1, 1.4];
  const STAGE1_DRIVE_SCALE = [0.3, 0.5, 0.7, 0.9];

  const stage1Results = [];
  let stage1Count = 0;
  const stage1Total = STAGE1_TILT_Y.length * STAGE1_LIFT_SCALE.length * STAGE1_DRIVE_SCALE.length;
  for (const tiltY of STAGE1_TILT_Y) {
    for (const liftScale of STAGE1_LIFT_SCALE) {
      for (const driveScale of STAGE1_DRIVE_SCALE) {
        stage1Count += 1;
        process.stderr.write(`[stage1 ${stage1Count}/${stage1Total}] tiltY=${tiltY} liftScale=${liftScale} driveScale=${driveScale}\n`);
        const params = { tiltY, liftScale, driveScale, tangentKp: DEPLOYED_TANGENT_KP, paddleFriction: DEPLOYED_PADDLE_FRICTION };
        stage1Results.push(runComboRally(loader, presets, params));
      }
    }
  }

  // Rank: maximize avgRounds primarily, then backspinFraction (rounds that
  // actually stayed backspin), then minRounds (worst-case preset).
  const rankRally = (a, b) => {
    if (b.avgRounds !== a.avgRounds) return b.avgRounds - a.avgRounds;
    if ((b.backspinFraction ?? 0) !== (a.backspinFraction ?? 0)) return (b.backspinFraction ?? 0) - (a.backspinFraction ?? 0);
    return b.minRounds - a.minRounds;
  };
  const stage1Sorted = [...stage1Results].sort(rankRally);
  const stage1Winner = stage1Sorted[0];

  // ── Stage 2: fix stage-1 winner's tiltY/liftScale/driveScale, sweep TANGENT_KP-scale x PADDLE_FRICTION ──
  const STAGE2_TANGENT_KP_SCALE = [1.0, 1.5, 2.0, 3.0];
  const STAGE2_PADDLE_FRICTION = [0.4, 0.6, 0.8, 1.0];

  const stage2Results = [];
  let stage2Count = 0;
  const stage2Total = STAGE2_TANGENT_KP_SCALE.length * STAGE2_PADDLE_FRICTION.length;
  for (const kpScale of STAGE2_TANGENT_KP_SCALE) {
    for (const paddleFriction of STAGE2_PADDLE_FRICTION) {
      stage2Count += 1;
      const tangentKp = round(DEPLOYED_TANGENT_KP * kpScale, 4);
      process.stderr.write(`[stage2 ${stage2Count}/${stage2Total}] TANGENT_KP=${tangentKp} PADDLE_FRICTION=${paddleFriction}\n`);
      const params = {
        tiltY: stage1Winner.params.tiltY,
        liftScale: stage1Winner.params.liftScale,
        driveScale: stage1Winner.params.driveScale,
        tangentKp,
        paddleFriction,
      };
      stage2Results.push(runComboRally(loader, presets, params));
    }
  }
  const stage2Sorted = [...stage2Results].sort(rankRally);
  const stage2Winner = stage2Sorted[0];

  // ── Empirical check of BACKSPIN_THRESHOLD: does outgoingCanonicalTopspin <= threshold
  // at round N actually predict round N+1 survival, across everything we just ran? ──
  const allRallyResults = [baselineResult, ...stage1Results, ...stage2Results];
  let predictSurvivedAndBackspin = 0, predictSurvivedNotBackspin = 0;
  let predictFailedAndBackspin = 0, predictFailedNotBackspin = 0;
  for (const comboResult of allRallyResults) {
    for (const presetResult of comboResult.perPreset) {
      const stats = presetResult.roundStats;
      for (let i = 0; i < stats.length; i++) {
        const round_ = stats[i];
        const survivedToNextRound = i < presetResult.rounds; // this round's contact was legal (net+inbounds)
        if (survivedToNextRound && round_.isBackspin) predictSurvivedAndBackspin += 1;
        else if (survivedToNextRound && !round_.isBackspin) predictSurvivedNotBackspin += 1;
        else if (!survivedToNextRound && round_.isBackspin) predictFailedAndBackspin += 1;
        else predictFailedNotBackspin += 1;
      }
    }
  }
  const thresholdAgreement = round(
    (predictSurvivedAndBackspin + predictFailedNotBackspin) /
      (predictSurvivedAndBackspin + predictSurvivedNotBackspin + predictFailedAndBackspin + predictFailedNotBackspin),
    4
  );

  // ── Final single-shot verification for the overall winner ──
  const finalWinner = rankRally(stage1Winner, stage2Winner) <= 0 ? stage1Winner : stage2Winner;
  process.stderr.write(`[verify] single-shot landing check for final winner: ${fmtCombo(finalWinner.params)}\n`);
  const finalSingleShot = runSingleShot(loader, presets, finalWinner.params);
  const baselineSingleShot = runSingleShot(loader, presets, baselineParams);

  // ── Report ──
  const lines = [];
  lines.push("# Push sustainable backspin-vs-backspin rally calibration (return-studio.html)");
  lines.push("");
  lines.push("> Research tool output (return-studio.html), not game4.html acceptance. Does not modify return-studio.html.");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length} (11-preset calibration set, same exclusions as push-tilty-sweep-calibration.js: ${[...EXCLUDED_PRESET_IDS].join(", ")})`);
  lines.push(`maxRounds per rally: ${MAX_ROUNDS}. Backspin threshold on canonical outgoing topspin: <= ${BACKSPIN_THRESHOLD}.`);
  lines.push("");
  lines.push("## Design principle under test");
  lines.push("");
  lines.push("Push should PRESERVE/REGENERATE backspin, not neutralize it — a legal push-vs-push rally should be able to continue indefinitely with the ball staying in backspin. Prior finding (push_rally_round2_failure_diagnosis.txt): deployed config neutralizes canonical incoming topspin (~-70..-83) to near-zero (~-3..-4) at contact, flipping to genuine topspin (~+31..+33) by round 2, killing rallies at round 2.");
  lines.push("");
  lines.push("## Grid dimensions (two-stage, per split of driveScale into independent liftScale/driveScale)");
  lines.push("");
  lines.push("liftScale multiplies PUSH_LIFT_BASE's output only (vertical racket velocity); driveScale multiplies PUSH_DRIVE_BASE's output only (forward racket velocity). Their ratio is the racket's own swing-direction angle (deployed baseline: atan(0.35/0.7)=26.57° from horizontal); their magnitude is overall swing speed. tiltY (paddle face angle) is independent of both.");
  lines.push("");
  lines.push(`- Stage 1: tiltY x liftScale x driveScale = ${STAGE1_TILT_Y.length} x ${STAGE1_LIFT_SCALE.length} x ${STAGE1_DRIVE_SCALE.length} = ${stage1Total} combos x ${presets.length} presets x up to ${MAX_ROUNDS} rounds each. TANGENT_KP/PADDLE_FRICTION held at deployed values (${DEPLOYED_TANGENT_KP}/${DEPLOYED_PADDLE_FRICTION}).`);
  lines.push(`  tiltY candidates: ${STAGE1_TILT_Y.join(", ")}`);
  lines.push(`  liftScale candidates: ${STAGE1_LIFT_SCALE.join(", ")}`);
  lines.push(`  driveScale candidates: ${STAGE1_DRIVE_SCALE.join(", ")}`);
  lines.push(`- Stage 2: TANGENT_KP-scale x PADDLE_FRICTION = ${STAGE2_TANGENT_KP_SCALE.length} x ${STAGE2_PADDLE_FRICTION.length} = ${stage2Total} combos, tiltY/liftScale/driveScale fixed at stage-1 winner (${fmtCombo(stage1Winner.params)}).`);
  lines.push(`  TANGENT_KP-scale candidates (x deployed ${DEPLOYED_TANGENT_KP}): ${STAGE2_TANGENT_KP_SCALE.join(", ")}`);
  lines.push(`  PADDLE_FRICTION candidates: ${STAGE2_PADDLE_FRICTION.join(", ")}`);
  lines.push("");
  lines.push("## Baseline (deployed config)");
  lines.push("");
  lines.push(`${fmtCombo(baselineParams)} -> avgRounds=${baselineResult.avgRounds}, minRounds=${baselineResult.minRounds}, backspinFraction=${baselineResult.backspinFraction}, single-shot landing=${baselineSingleShot.okCount}/${baselineSingleShot.total}`);
  lines.push("");
  lines.push("preset | rounds survived | fail reason | outgoing topspin per round (canonical)");
  lines.push("--- | --- | --- | ---");
  for (const row of baselineResult.perPreset) {
    lines.push(`${row.preset} | ${row.rounds} | ${row.failReason ?? "-"} | ${row.roundStats.map((r) => r.outgoingCanonicalTopspin).join(", ")}`);
  }
  lines.push("");

  lines.push("## Stage 1 results (top 20 by avgRounds desc, backspinFraction desc, minRounds desc)");
  lines.push("");
  lines.push("tiltY | liftScale | driveScale | angle(deg) | avgRounds | minRounds | backspinFraction | totalSurvivedRounds");
  lines.push("--- | --- | --- | --- | --- | --- | --- | ---");
  for (const r of stage1Sorted.slice(0, 20)) {
    lines.push(`${r.params.tiltY} | ${r.params.liftScale} | ${r.params.driveScale} | ${round(swingAngleDeg(r.params.liftScale, r.params.driveScale), 1)} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.totalSurvivedRounds}`);
  }
  lines.push("");
  lines.push(`Stage 1 winner: ${fmtCombo(stage1Winner.params)} -> avgRounds=${stage1Winner.avgRounds}, minRounds=${stage1Winner.minRounds}, backspinFraction=${stage1Winner.backspinFraction}`);
  lines.push("");

  lines.push("## Stage 2 results (TANGENT_KP x PADDLE_FRICTION around stage-1 winner)");
  lines.push("");
  lines.push("TANGENT_KP | PADDLE_FRICTION | avgRounds | minRounds | backspinFraction | totalSurvivedRounds");
  lines.push("--- | --- | --- | --- | --- | ---");
  for (const r of stage2Sorted) {
    lines.push(`${r.params.tangentKp} | ${r.params.paddleFriction} | ${r.avgRounds} | ${r.minRounds} | ${r.backspinFraction} | ${r.totalSurvivedRounds}`);
  }
  lines.push("");
  lines.push(`Stage 2 winner: ${fmtCombo(stage2Winner.params)} -> avgRounds=${stage2Winner.avgRounds}, minRounds=${stage2Winner.minRounds}, backspinFraction=${stage2Winner.backspinFraction}`);
  lines.push("");

  lines.push("## Overall final winner");
  lines.push("");
  lines.push(`${fmtCombo(finalWinner.params)}`);
  lines.push(`avgRounds=${finalWinner.avgRounds}, minRounds=${finalWinner.minRounds}, backspinFraction=${finalWinner.backspinFraction}, totalSurvivedRounds=${finalWinner.totalSurvivedRounds}`);
  lines.push(`Single-shot 11-preset landing pass-rate: ${finalSingleShot.okCount}/${finalSingleShot.total}`);
  const finalFailingSingleShot = finalSingleShot.rows.filter((r) => !r.ok);
  if (finalFailingSingleShot.length) {
    lines.push(`Single-shot failures: ${finalFailingSingleShot.map((r) => `${r.preset}(${r.reason})`).join("; ")}`);
  }
  lines.push("");
  lines.push("preset | rounds survived | fail reason | outgoing topspin per round (canonical)");
  lines.push("--- | --- | --- | ---");
  for (const row of finalWinner.perPreset) {
    lines.push(`${row.preset} | ${row.rounds} | ${row.failReason ?? "-"} | ${row.roundStats.map((r) => r.outgoingCanonicalTopspin).join(", ")}`);
  }
  lines.push("");

  lines.push("## Backspin threshold empirical check");
  lines.push("");
  lines.push(`Threshold: canonical outgoing topspin <= ${BACKSPIN_THRESHOLD} classified as "backspin"/isBackspin=true. Agreement rate between isBackspin(round i) and round i's contact being legal (net+inbounds), aggregated over baseline+stage1+stage2 (${allRallyResults.length} combos x ${presets.length} presets x up to ${MAX_ROUNDS} rounds):`);
  lines.push("");
  lines.push(`- survived & backspin: ${predictSurvivedAndBackspin}`);
  lines.push(`- survived & NOT backspin: ${predictSurvivedNotBackspin}`);
  lines.push(`- failed & backspin: ${predictFailedAndBackspin}`);
  lines.push(`- failed & NOT backspin: ${predictFailedNotBackspin}`);
  lines.push(`- agreement rate: ${thresholdAgreement} (isBackspin==true predicting survival, isBackspin==false predicting failure)`);
  lines.push("");

  lines.push("## Full JSON (all stage results)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ baselineResult, stage1Results, stage2Results, finalWinner, finalSingleShot, baselineSingleShot }, null, 2));
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

  console.log("=== Baseline ===");
  console.log(`avgRounds=${baselineResult.avgRounds} minRounds=${baselineResult.minRounds} backspinFraction=${baselineResult.backspinFraction} singleShot=${baselineSingleShot.okCount}/${baselineSingleShot.total}`);
  console.log("=== Stage 1 top 10 ===");
  console.table(stage1Sorted.slice(0, 10).map((r) => ({ tiltY: r.params.tiltY, liftScale: r.params.liftScale, driveScale: r.params.driveScale, angle: round(swingAngleDeg(r.params.liftScale, r.params.driveScale), 1), avgRounds: r.avgRounds, minRounds: r.minRounds, backspinFraction: r.backspinFraction })));
  console.log("=== Stage 2 (all) ===");
  console.table(stage2Sorted.map((r) => ({ TANGENT_KP: r.params.tangentKp, PADDLE_FRICTION: r.params.paddleFriction, avgRounds: r.avgRounds, minRounds: r.minRounds, backspinFraction: r.backspinFraction })));
  console.log(`Final winner: ${fmtCombo(finalWinner.params)}`);
  console.log(`avgRounds=${finalWinner.avgRounds} minRounds=${finalWinner.minRounds} backspinFraction=${finalWinner.backspinFraction} singleShot=${finalSingleShot.okCount}/${finalSingleShot.total}`);
  console.log(`Threshold agreement rate: ${thresholdAgreement}`);
  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}
