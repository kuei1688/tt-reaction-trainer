#!/usr/bin/env node

// Aim-solver-BYPASSED variant of tools/push-clean-reference-sweep.js (2026-07-14).
// Same two clean single-variable sweeps (tiltY curve, incoming-speed curve) over
// the SAME representative case (backspin_long_backhand), against game4.html's
// currently deployed Stage 4a push contact model (bounceOffPlaneSubstepped /
// applyPushContact / computeBlendedNormal, post-commit 68179db) — but this
// version does NOT call solveRacketVelXForTargetLandingX at all. planeVel is
// built directly as {x:0, y:lift, z:-drive} (push technique's natural,
// un-aimed swing — this is literally what baseTechVel already is inside
// makeRacketReturnVelocity before the aim solver perturbs its x-component;
// see game4.html:1618-1623) and fed straight into applyPushContact.
//
// Why this exists: the original two sweeps (tools/push-clean-reference-sweep.js,
// entries dated 2026-07-14 in AI_CONTEXT/adhoc-experiments/push_clean_reference_library.md) found
// sharp cliffs in outTopspin/netClearance between adjacent grid points. Root
// cause diagnosed there: those sweeps went through
// makeReturnVelocity -> makeRacketReturnVelocity, which calls
// solveRacketVelXForTargetLandingX (the left-right AIM solver) BEFORE calling
// the contact model. That solver does a coarse rx∈[-8,8] grid search for a
// sideways racket velocity that lands the ball at table-center; when the ball
// can't clear the net at all for a given tiltY/speed, the search finds zero
// valid candidates and silently returns a physically-meaningless placeholder
// (-incomingVel.x) instead of a real value — and the moment the ball CAN clear
// the net, the search suddenly finds a real solution near the search boundary.
// This tool exists to answer: do the cliffs disappear once that solver is
// removed from the path entirely (confirming they were solver artifacts), or
// does a REAL discontinuity remain in the raw contact model itself?
//
// ── Confirmed by reading game4.html before writing this tool ───────────────
// computeRacketNormal(tiltY, tiltX, swingDirRef) (line 543-548):
//   function computeRacketNormal(tiltY, tiltX, swingDirRef){
//     const verticalTilted = normalize({x:0, y:tiltY || 0, z:-1});
//     if(!tiltX) return verticalTilted;
//     const axis = normalize(swingDirRef);
//     return rotateAroundAxis(verticalTilted, axis, tiltX);
//   }
// computeAdaptivePushTiltX() (line 1604-1606) always returns 0 for push. Since
// tiltX=0 is falsy, the `if(!tiltX) return verticalTilted;` early return fires
// BEFORE swingDirRef is ever read — confirmed swingDirRef's value genuinely
// does not matter for push's racket-normal computation (it's passed through
// this tool as planeVel purely for parameter-shape parity with
// makeRacketReturnVelocity's own call, not because it does anything).
//
// makeRacketReturnVelocity (line 1616-1641): for tech.adaptivePush, baseTechVel
// = {x:0, y:lift, z:-drive} (line 1622) — confirms x=0 is the technique's own
// neutral/un-aimed swing direction, not an arbitrary choice made by this tool.
//
// No "inBounds" (left-right) column is computed here — see header comment in
// runOnce() below for why that check is not meaningful without the aim
// solver, and what is reported instead.
//
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("../load-game4-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "push_clean_reference_sweep_noaim_2026-07-14_raw.txt");

const REPRESENTATIVE_PRESET_ID = "backspin_long_backhand"; // same case as the aim-solver-included sweeps

// Same landmine as push-clean-reference-sweep.js: instantiateGame4Symbols's
// dependency walker resolves a name listed DIRECTLY in symbolNames via LOCAL
// extraction ONLY — extraExternals overrides only take effect for names
// appearing as a TRANSITIVE dependency of a listed symbol. Sweep 1 overrides
// PUSH_TILT_Y via extraExternals, so "PUSH_TILT_Y" must NEVER appear directly
// in SYMBOL_NAMES below (computeAdaptivePushTiltY references it internally,
// which is where the override takes effect). solveRacketVelXForTargetLandingX
// is deliberately OMITTED from this symbol list entirely — this tool must not
// call it, not even as a diagnostic, since the whole point is to bypass it.
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
  "TECHNIQUES",
  "computeAdaptivePushLift",
  "computeAdaptivePushDrive",
  "computeAdaptivePushTiltX",
  "PADDLE_FRICTION",
  "computeRacketNormal",
  "dynamicPaddleEpsilon",
  "applyPushContact",
  "PADDLE_BLEND",
];

function round(value, digits = 4) {
  if (value == null || Number.isNaN(value)) return null;
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function linspace(lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * i) / (n - 1));
  return out;
}

// Bypassed-aim variant of judgeReturnEquivalent: without the aim solver, the
// outgoing ball's x-landing position is whatever the natural (un-aimed)
// contact model produces from the incoming ball's own x-velocity/spin — it is
// NOT corrected to table-center, so checking "|firstBounce.x| <= TABLE.width/2"
// would conflate "does the contact model behave discontinuously" with "does
// this particular unaimed shot happen to land within the table's width",
// which is not what this tool is testing. We therefore report netClearance
// (still meaningful — a real forward/vertical measure) and whether the ball
// physically lands forward on the opponent's side (z<0, width-unchecked) or
// mishits back onto the striker's own side (z>0), but explicitly do NOT
// compute or report an "inBounds" pass/fail column.
function judgeReturnBypassed(result, TABLE) {
  const firstBounce = result.bounces[0] || null;
  const netClearance = result.netY == null ? null : result.netY - (TABLE.height + TABLE.net);
  let clearsNet; // true/false/null(never reached net plane)
  if (result.netY == null) clearsNet = null;
  else clearsNet = netClearance >= 0;
  let landing = "no_bounce_recorded";
  if (firstBounce) {
    if (firstBounce.z < 0) landing = "forward_opponent_side_x_unchecked";
    else if (firstBounce.z > 0) landing = "back_on_own_side";
    else landing = "on_net_line";
  }
  return {
    netClearance: netClearance == null ? null : round(netClearance),
    clearsNet,
    landing,
    firstBounceRaw: firstBounce ? { x: round(firstBounce.x), z: round(firstBounce.z) } : null,
  };
}

function extractGame4(loader, tiltYOverride) {
  const extraExternals = {};
  if (tiltYOverride != null) extraExternals.PUSH_TILT_Y = tiltYOverride;
  return loader.instantiateGame4Symbols(SYMBOL_NAMES, extraExternals);
}

// Local sensitivity + jump-flagging: identical mechanism to
// push-clean-reference-sweep.js (median-slope-ratio flag), kept identical so
// the two tools' flagged-jump outputs are directly comparable.
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

  const boardExt = extractGame4(loader, null);
  const serve = boardExt.simulateServe(preset);
  const hitIndex = boardExt.findPushHitIndex(serve);
  const hitPoint = serve.points[hitIndex];
  const hitVel = serve.velocities[hitIndex];
  const hitSpin = serve.spins[hitIndex];
  const hitSpeedXZ = Math.hypot(hitVel.x, hitVel.z);
  const deployedLift = boardExt.computeAdaptivePushLift(hitVel);
  const deployedDrive = boardExt.computeAdaptivePushDrive(hitVel);
  const deployedTiltY = loader.evaluateExtractedConstant("PUSH_TILT_Y");
  const tiltXAlwaysZero = boardExt.computeAdaptivePushTiltX();

  function round3(v) {
    return { x: round(v.x, 4), y: round(v.y, 4), z: round(v.z, 4) };
  }

  process.stderr.write(
    `[representative case] ${REPRESENTATIVE_PRESET_ID}: hitVel=${JSON.stringify(round3(hitVel))} hitSpin=${JSON.stringify(round3(hitSpin))} speedXZ=${round(hitSpeedXZ)} deployedLift=${round(deployedLift)} deployedDrive=${round(deployedDrive)} computeAdaptivePushTiltX()=${tiltXAlwaysZero}\n`
  );
  if (tiltXAlwaysZero !== 0) {
    throw new Error(
      `computeAdaptivePushTiltX() returned ${tiltXAlwaysZero}, not 0 — the "swingDirRef doesn't matter" assumption this tool relies on (computeRacketNormal's if(!tiltX) early return) no longer holds. Aborting rather than silently producing misleading results.`
    );
  }

  function runOnce(loader2, tiltYOverride, incomingVel, incomingSpin) {
    const ext = extractGame4(loader2, tiltYOverride);
    const tech = { ...ext.TECHNIQUES.push };
    const lift = ext.computeAdaptivePushLift(incomingVel);
    const drive = ext.computeAdaptivePushDrive(incomingVel);

    // ── The core of this tool's methodology change vs push-clean-reference-
    // sweep.js: planeVel is built DIRECTLY, no solveRacketVelXForTargetLandingX
    // call anywhere in this function. x=0 = push technique's own neutral swing
    // direction (verbatim baseTechVel construction from game4.html:1622).
    const planeVel = { x: 0, y: lift, z: -drive };
    const tiltX = ext.computeAdaptivePushTiltX(); // confirmed always 0 above
    const tiltY = tiltYOverride != null ? tiltYOverride : deployedTiltY;
    // swingDirRef=planeVel passed only for call-shape parity with
    // makeRacketReturnVelocity's own computeRacketNormal call; confirmed above
    // (tiltX=0 -> early return) that its actual value is never read.
    const racketNormal = ext.computeRacketNormal(tiltY, tiltX, planeVel);
    const epsilon = ext.dynamicPaddleEpsilon(incomingVel, planeVel, racketNormal); // computed for call-shape parity; applyPushContact's push branch does not use it
    const blend = tech.model === "push" ? ext.PADDLE_BLEND : 0;

    const contactResult = ext.applyPushContact(incomingVel, incomingSpin, racketNormal, planeVel, epsilon, tech, blend);
    const outPath = ext.simulatePath({ ...hitPoint }, contactResult.vel, { gravity, spin: contactResult.spin, bounceBoost: tech.bounceBoost || 0 });
    const judged = judgeReturnBypassed(outPath, TABLE);
    const outSpeed = Math.hypot(contactResult.vel.x, contactResult.vel.y, contactResult.vel.z);

    return {
      lift: round(lift),
      drive: round(drive),
      outTopspin: round(contactResult.spin.topspin),
      outSidespin: round(contactResult.spin.sidespin),
      outSpeed: round(outSpeed),
      netClearance: judged.netClearance,
      clearsNet: judged.clearsNet,
      landing: judged.landing,
      firstBounceRaw: judged.firstBounceRaw,
      dwellMs: round(contactResult.dwellMs, 3),
      regime: contactResult.regime || null,
      effectiveEpsilon: round(contactResult.effectiveEpsilon, 4),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWEEP 1 (aim-solver-bypassed): paddle angle (tiltY) curve.
  // Fixed: incoming ball = representative case's real hitVel/hitSpin.
  //        Racket swing-force (lift/drive) = REAL computeAdaptivePushLift/
  //        Drive(hitVel), never a placeholder/zero.
  // Swept: tiltY 0.3 -> 2.0, 18 points — SAME grid as the aim-solver-included
  //        sweep, for direct comparison.
  // ══════════════════════════════════════════════════════════════════════
  process.stderr.write("[sweep1] tiltY curve (aim solver bypassed)\n");
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

  let sweep1SignFlip = null;
  for (let i = 0; i < sweep1Rows.length - 1; i++) {
    if (Math.sign(sweep1Rows[i].outTopspin) !== Math.sign(sweep1Rows[i + 1].outTopspin) && sweep1Rows[i].outTopspin !== 0) {
      sweep1SignFlip = { between: [sweep1Rows[i].tiltY, sweep1Rows[i + 1].tiltY], values: [sweep1Rows[i].outTopspin, sweep1Rows[i + 1].outTopspin] };
      break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWEEP 2 (aim-solver-bypassed): incoming ball speed curve.
  // Fixed: tiltY = deployed PUSH_TILT_Y (1.0, local extraction, not hand-copied).
  //        Direction of incoming velocity + spin held fixed, only magnitude scaled.
  // Swept: scale 0.5x -> 2.0x on hitVel's magnitude, 16 points — SAME grid as
  //        the aim-solver-included sweep.
  // ══════════════════════════════════════════════════════════════════════
  process.stderr.write("[sweep2] incoming speed curve (aim solver bypassed)\n");
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

  const liftAtFloorOrMax = sweep2Rows.filter((r, i) => i > 0 && r.lift === sweep2Rows[i - 1].lift).map((r) => r.scale);
  const driveAtFloorOrMax = sweep2Rows.filter((r, i) => i > 0 && r.drive === sweep2Rows[i - 1].drive).map((r) => r.scale);

  const output = {
    generatedAt: new Date().toISOString(),
    note: "Aim-solver-bypassed variant — planeVel built directly as {x:0,y:lift,z:-drive}, solveRacketVelXForTargetLandingX never called.",
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
  console.log("=== Sweep 1 (aim bypassed): tiltY curve ===");
  console.table(sweep1Rows.map((r) => ({ tiltY: r.tiltY, outTopspin: r.outTopspin, outSpeed: r.outSpeed, netClearance: r.netClearance, clearsNet: r.clearsNet, landing: r.landing, dwellMs: r.dwellMs, regime: r.regime })));
  console.log("Sweep1 sign flip:", sweep1SignFlip);
  console.log("Sweep1 flagged jumps (outTopspin):", sweep1Sensitivity.outTopspin.flagged);
  console.log("Sweep1 flagged jumps (outSpeed):", sweep1Sensitivity.outSpeed.flagged);
  console.log("Sweep1 flagged jumps (netClearance):", sweep1Sensitivity.netClearance.flagged);

  console.log("=== Sweep 2 (aim bypassed): incoming speed curve ===");
  console.table(
    sweep2Rows.map((r) => ({ scale: r.scale, speedXZ: r.incomingSpeedXZ, lift: r.lift, drive: r.drive, outTopspin: r.outTopspin, outSpeed: r.outSpeed, netClearance: r.netClearance, clearsNet: r.clearsNet, landing: r.landing, dwellMs: r.dwellMs, regime: r.regime }))
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
