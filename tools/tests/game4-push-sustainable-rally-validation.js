#!/usr/bin/env node

// Push (切球) sustainable-rally validation AGAINST game4.html's currently
// DEPLOYED formula (post-68179db), NOT a parameter sweep.
//
// Commit 68179db (2026-07-14, "校準切球 PUSH_LIFT_K/PUSH_DRIVE_K") fixed
// game4.html's PUSH_LIFT_K/PUSH_DRIVE_K (both had been 0 since the split
// lift/drive formula was ported from return-studio.html in dc62c94), based on
// single-shot net-clearance checks across 16 serves. The commit message
// claims this was "one of the main reasons push couldn't sustain continuous
// rallies" (切球無法連續對打的主因之一) — but that claim was never checked
// against an actual multi-round rally simulation of game4.html's own deployed
// formula. This tool closes that gap: does a push-vs-push rally actually
// sustain under game4.html's deployed config, and where/how does it fail?
//
// ── Design decisions (read before modifying) ────────────────────────────────
//
// 1. Serve generation: game4.html has its OWN simulateServe/solveBaseVelocity/
//    solveServeBounceVelocity (confirmed present and already used by the VAL-003
//    tool, tools/serve-batch-validation.test.js) — no need to borrow anything
//    from return-studio.html for this. Both files' serve generators are
//    fingerprint-compared below (see FINGERPRINT DIAGNOSTICS section of the
//    report) rather than assumed identical.
//
// 2. Ball-flight/bounce simulation + hit-timing detection: game4.html also has
//    its own simulatePath/findPushHitIndex, and simulatePath was verified by
//    inspection to be generic shared-physics-only (TABLE/NET_COLLISION/
//    bounceWithSpinPhysical/CONTACT_FRICTION_MU/MAX_TABLE_BOUNCES — no
//    push-specific or return-studio-specific formulas). Both files' versions
//    were fingerprint-compared too (see report). Because these functions are
//    generic infrastructure sitting on the same shared bounce physics, THIS
//    TOOL USES GAME4.HTML'S simulateServe/simulatePath/findPushHitIndex AS A
//    SHARED "BOARD" FOR BOTH CONFIGS' RALLIES (game4-deployed AND
//    return-studio-deployed). This is a deliberate experimental-design choice:
//    it isolates the ONLY variable between the two configs to the
//    contact/return formula itself (makeReturnVelocity + TECHNIQUES.push +
//    constants), which is what's actually under test. If instead each engine
//    used its own flight simulator too, any result difference could be
//    (mis)attributed to subtle simulatePath divergence instead of the contact
//    formula divergence we actually care about.
//
// 3. Contact/return formula under test: game4.html's OWN currently-deployed
//    makeRacketReturnVelocity + bounceOffPlane (5-arg, instantaneous collision)
//    + computeAdaptivePushLift/Drive/TiltX/TiltY + real deployed constants,
//    extracted via load-game4-physics.js's instantiateGame4Symbols. NOT
//    overridden/swept — single config, deployed values as-is.
//
// 4. Landmine (see push-sustainable-rally-sweep-calibration.js's header
//    comment for the full explanation): instantiateGame4Symbols's top-level
//    visit() resolves requested symbolNames via LOCAL extraction ONLY — it
//    never checks availableExternals for names that appear directly in
//    symbolNames (only for their dependencies). Two consequences that bit this
//    tool during development and are worked around below:
//      a) Never list a symbol in symbolNames if you need it to resolve to an
//         override/external instead of local source.
//      b) return-studio.html declares PUSH_LIFT_BASE/PUSH_LIFT_K/PUSH_LIFT_FLOOR/
//         PUSH_LIFT_NEUTRAL/PUSH_LIFT_MAX (and the PUSH_DRIVE_* equivalents) as
//         ONE multi-declarator `const A = .., B = .., ...;` statement.
//         extractConstantDefinition only understands the first declarator of
//         such a statement, so asking for "PUSH_LIFT_K" etc. as a top-level
//         symbolName throws "missing symbols" (no standalone `const
//         PUSH_LIFT_K =` exists to match). load-return-studio-physics.js's
//         loader already solves this by pre-parsing the declarator group into
//         loader.multiDeclaratorConstants (evaluated literal values) — this
//         tool reads PUSH_LIFT_K/PUSH_DRIVE_K/etc for return-studio.html from
//         there directly, NOT via instantiateReturnStudioSymbols/symbolNames.
//         (game4.html declares each of these as its own separate single-
//         declarator `const NAME = value;` statement, so no such problem
//         exists on the game4.html side — they're requested directly.)
//
// 5. Comparison group: return-studio.html's own currently-deployed push
//    formula, read via its real declared constants/functions (NOT the sweep
//    tool's synthetic liftScale/driveScale/PUSH_TILT_Y override mechanism,
//    which bypasses PUSH_LIFT_K/PUSH_DRIVE_K entirely). Inspection of
//    return-studio.html found a SUBSTANTIAL divergence beyond just K: its
//    push technique's contact model is makeRacketReturnVelocity ->
//    applyPushContact -> bounceOffPlaneSubstepped (Stage 4a spring-damper
//    compression/release integrator, blended contact normal via
//    computeBlendedNormal/PADDLE_BLEND, tangential response via
//    TANGENT_KP·slip viscous damping) — a completely different contact
//    mechanism from game4.html's bounceOffPlane (5-arg instantaneous
//    Coulomb-friction collision, no normal blending, no TANGENT_KP concept at
//    all). This is NOT merely "different K constants" — the two files'
//    push contact PHYSICS MODELS have diverged since dc62c94 only ported the
//    lift/drive split formula (and later 68179db only fixed K) into
//    game4.html, without porting the Stage 4a substepped model that
//    return-studio.html has moved on to. Also: return-studio.html's own
//    PUSH_LIFT_K/PUSH_DRIVE_K are STILL 0 as currently deployed (never fixed
//    there — only game4.html got the 68179db fix), so the "return-studio
//    deployed" comparison group below is expected to reproduce the original
//    pre-fix net-clearance blowup behavior, not a competing fixed baseline.
//
// Read-only research tool. Does not modify game4.html or return-studio.html.

const fs = require("fs");
const path = require("path");
const {
  loadGame4Physics,
  extractFunctionSource,
  fingerprintSource,
  normalizeSource,
} = require("../load-game4-physics.js");
const { loadReturnStudioPhysics } = require("../load-return-studio-physics.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RETURN_STUDIO_FILE = path.join(ROOT_DIR, "return-studio.html");
const REPORT_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "game4_push_sustainable_rally_validation.txt");

// Same 11-preset calibration set as push-tilty-sweep-calibration.js /
// push-sustainable-rally-sweep-calibration.js, for apples-to-apples
// comparison with prior calibration history.
const EXCLUDED_PRESET_IDS = new Set([
  "no_spin_long_forehand",
  "no_spin_long_backhand",
  "backspin_short_forehand_2",
  "backspin_short_backhand_2",
  "backspin_short_backhand",
]);

const MAX_ROUNDS = 12;
// Same initial guess as push-sustainable-rally-sweep-calibration.js. Kept
// only as a descriptive label here (not used to gate pass/fail) — see the
// "backspin threshold fit" note in the report.
const BACKSPIN_THRESHOLD = -15;

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

// ── Load game4.html's shared "board" (serve gen + flight sim + hit timing)
// plus its own deployed push contact formula, in one extraction call. ──
function loadGame4Config() {
  const loader = loadGame4Physics({});
  // NOTE: instantiateGame4Symbols's dependency walker (detectSymbolDependencies)
  // was found NOT to detect identifiers referenced only inside a function that
  // is itself NESTED inside another top-level function body (e.g. the local
  // `consider()` helper defined inside solveServeBounceVelocity references
  // makeServeAimCandidate/serveBounceScore/findServeBounceTime/clamp, none of
  // which showed up in solveServeBounceVelocity's directDependencies) — this
  // fails SILENTLY (no missing/uncovered error at instantiation time; the
  // dependency is just never detected, so its source never makes it into the
  // vm bundle, and the gap only surfaces as a runtime ReferenceError deep
  // inside a rally). Confirmed by direct testing during this tool's
  // development. serve-batch-validation.test.js already works around this by
  // listing every serve-related symbol explicitly instead of relying on
  // transitive closure for that part of the call graph; this list does the
  // same (verified by successfully running full rallies with zero
  // ReferenceErrors after adding these).
  const ext = loader.instantiateGame4Symbols([
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
  ]);
  return {
    loader,
    board: { simulateServe: ext.simulateServe, simulatePath: ext.simulatePath, findPushHitIndex: ext.findPushHitIndex },
    makeReturnVelocity: ext.makeReturnVelocity,
    tech: ext.TECHNIQUES.push,
    constants: {
      PUSH_LIFT_K: ext.PUSH_LIFT_K,
      PUSH_LIFT_BASE: ext.PUSH_LIFT_BASE,
      PUSH_LIFT_FLOOR: ext.PUSH_LIFT_FLOOR,
      PUSH_LIFT_NEUTRAL: ext.PUSH_LIFT_NEUTRAL,
      PUSH_LIFT_MAX: ext.PUSH_LIFT_MAX,
      PUSH_DRIVE_K: ext.PUSH_DRIVE_K,
      PUSH_DRIVE_BASE: ext.PUSH_DRIVE_BASE,
      PUSH_DRIVE_FLOOR: ext.PUSH_DRIVE_FLOOR,
      PUSH_DRIVE_NEUTRAL: ext.PUSH_DRIVE_NEUTRAL,
      PUSH_DRIVE_MAX: ext.PUSH_DRIVE_MAX,
      PUSH_TILT_Y: ext.PUSH_TILT_Y,
      PADDLE_FRICTION: ext.PADDLE_FRICTION,
      contactModel: "bounceOffPlane (5-arg instantaneous Coulomb-friction collision)",
    },
  };
}

// ── Load return-studio.html's own deployed push contact formula. Does NOT
// borrow its simulateServe/simulatePath/findPushHitIndex (see design note 2
// above) — only makeReturnVelocity + TECHNIQUES + reportable constants. ──
function loadReturnStudioConfig() {
  const rsLoader = loadReturnStudioPhysics({});
  // PUSH_LIFT_K/PUSH_LIFT_BASE/... and PUSH_DRIVE_K/PUSH_DRIVE_BASE/... are
  // NOT requested here (landmine 4b above) — read from
  // rsLoader.multiDeclaratorConstants instead, further down.
  const ext = rsLoader.instantiateReturnStudioSymbols([
    "makeReturnVelocity",
    "TECHNIQUES",
    "PUSH_TILT_Y",
    "PADDLE_FRICTION",
    "TANGENT_KP",
    "PADDLE_BLEND",
  ]);
  const mdc = rsLoader.multiDeclaratorConstants;
  return {
    loader: rsLoader,
    makeReturnVelocity: ext.makeReturnVelocity,
    tech: ext.TECHNIQUES.push,
    constants: {
      PUSH_LIFT_K: mdc.PUSH_LIFT_K,
      PUSH_LIFT_BASE: mdc.PUSH_LIFT_BASE,
      PUSH_LIFT_FLOOR: mdc.PUSH_LIFT_FLOOR,
      PUSH_LIFT_NEUTRAL: mdc.PUSH_LIFT_NEUTRAL,
      PUSH_LIFT_MAX: mdc.PUSH_LIFT_MAX,
      PUSH_DRIVE_K: mdc.PUSH_DRIVE_K,
      PUSH_DRIVE_BASE: mdc.PUSH_DRIVE_BASE,
      PUSH_DRIVE_FLOOR: mdc.PUSH_DRIVE_FLOOR,
      PUSH_DRIVE_NEUTRAL: mdc.PUSH_DRIVE_NEUTRAL,
      PUSH_DRIVE_MAX: mdc.PUSH_DRIVE_MAX,
      PUSH_TILT_Y: ext.PUSH_TILT_Y,
      PADDLE_FRICTION: ext.PADDLE_FRICTION,
      TANGENT_KP: ext.TANGENT_KP,
      PADDLE_BLEND: ext.PADDLE_BLEND,
      contactModel: "applyPushContact -> bounceOffPlaneSubstepped (Stage 4a spring-damper, blended normal)",
    },
  };
}

// Fingerprint-compare game4.html's board functions against return-studio.html's
// own versions of the same-named functions, to check requirement 1/2's "don't
// just assume they're identical" instruction.
function fingerprintDiagnostics(game4ScriptText, returnStudioScriptText) {
  const names = ["simulateServe", "simulatePath", "findPushHitIndex", "findHitIndex", "solveBaseVelocity", "solveServeBounceVelocity"];
  const rows = [];
  for (const name of names) {
    const g4src = extractFunctionSource(game4ScriptText, name);
    const rsSrc = extractFunctionSource(returnStudioScriptText, name);
    const g4fp = g4src ? fingerprintSource(g4src) : null;
    const rsFp = rsSrc ? fingerprintSource(rsSrc) : null;
    const identical = g4src != null && rsSrc != null && normalizeSource(g4src) === normalizeSource(rsSrc);
    rows.push({ name, foundInGame4: g4src != null, foundInReturnStudio: rsSrc != null, game4Fingerprint: g4fp, returnStudioFingerprint: rsFp, identical });
  }
  return rows;
}

// Instrumented rally: alternates two players hitting `push` at each other.
// Uses `board` (shared game4.html simulateServe/simulatePath/findPushHitIndex)
// for serve generation, ball-flight simulation, and hit-timing detection in
// BOTH configs; uses `cfg.makeReturnVelocity`/`cfg.tech` (which differs between
// game4-deployed and return-studio-deployed) for the actual contact/return.
function runInstrumentedRally(board, cfg, preset, maxRounds) {
  const gravity = preset.solve?.gravity ?? -4.2;
  const tech = cfg.tech;
  const serve = board.simulateServe(preset);
  const firstHitIndex = board.findPushHitIndex(serve);
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
    const returnHitCanonical = cfg.makeReturnVelocity(canonicalHitVel, canonicalHitSpin, tech, canonicalHitPoint, gravity);
    const returnVelReal = flip ? mirrorVec(returnHitCanonical.vel) : returnHitCanonical.vel;
    const returnSpinReal = flip ? mirrorSpin(returnHitCanonical.spin) : returnHitCanonical.spin;
    const outPath = board.simulatePath({ ...hitPoint }, returnVelReal, { gravity, spin: returnSpinReal, bounceBoost: tech.bounceBoost || 0 });

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
    const detectionPath = flip ? outPath : mirrorPathForDetection(outPath);
    const nextIdx = board.findPushHitIndex(detectionPath);
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

function runConfigRally(board, cfg, presets) {
  const perPreset = presets.map((preset) => ({
    preset: preset.id,
    ...summarizeRally(runInstrumentedRally(board, cfg, preset, MAX_ROUNDS)),
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
  return { perPreset, avgRounds, minRounds, backspinFraction, totalSurvivedRounds, failReasonCounts };
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

  process.stderr.write("[load] game4.html config + board\n");
  const game4 = loadGame4Config();
  process.stderr.write("[load] return-studio.html config\n");
  const returnStudio = loadReturnStudioConfig();

  process.stderr.write("[diagnostics] fingerprinting board functions across both files\n");
  const returnStudioScriptText = fs.readFileSync(RETURN_STUDIO_FILE, "utf8");
  const rsInlineScript = returnStudio.loader.base.scriptText;
  const fpRows = fingerprintDiagnostics(game4.loader.scriptText, rsInlineScript);

  process.stderr.write("[rally] game4.html deployed config x 11 presets\n");
  const game4Result = runConfigRally(game4.board, game4, presets);
  process.stderr.write("[rally] return-studio.html deployed config x 11 presets (using game4.html's board)\n");
  const returnStudioResult = runConfigRally(game4.board, returnStudio, presets);

  // ── Report ──
  const lines = [];
  lines.push("# Push sustainable backspin-vs-backspin rally validation (game4.html deployed, post-68179db)");
  lines.push("");
  lines.push("> Read-only research tool output. Does not modify game4.html or return-studio.html.");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Presets: ${presets.length} (11-preset calibration set, same exclusions as push-tilty-sweep-calibration.js: ${[...EXCLUDED_PRESET_IDS].join(", ")})`);
  lines.push(`maxRounds per rally: ${MAX_ROUNDS}. Descriptive backspin label threshold on canonical outgoing topspin: <= ${BACKSPIN_THRESHOLD} (not a pass/fail gate — net+inbounds is the only survival criterion; see note below).`);
  lines.push("");

  lines.push("## Question under test");
  lines.push("");
  lines.push("Commit 68179db fixed game4.html's PUSH_LIFT_K (0 -> 0.04) and PUSH_DRIVE_K (0 -> 0.19), based only on single-shot net-clearance checks (16 serves), claiming this was one of the main reasons push couldn't sustain continuous rallies. This tool runs an actual multi-round push-vs-push rally against game4.html's own currently-deployed formula (post-68179db) to check that claim directly, and runs the identical rally harness against return-studio.html's own currently-deployed formula as a comparison group.");
  lines.push("");

  lines.push("## Design notes / divergences found (see full explanation in tool source header)");
  lines.push("");
  lines.push("- game4.html has its OWN simulateServe/simulatePath/findPushHitIndex (generic shared-physics-only flight simulation + hit-timing detection, no push-specific formulas baked in) — confirmed by inspection and by the fingerprint diagnostics below. This tool uses game4.html's versions as a SHARED \"board\" for BOTH configs' rallies (game4-deployed and return-studio-deployed), so the only variable between the two configs is the contact/return formula itself.");
  lines.push(`- Contact model divergence: game4.html's push technique uses bounceOffPlane (5-arg instantaneous Coulomb-friction collision). return-studio.html's push technique uses applyPushContact -> bounceOffPlaneSubstepped (Stage 4a spring-damper compression/release integrator with blended contact normal via PADDLE_BLEND=${returnStudio.constants.PADDLE_BLEND} and TANGENT_KP=${returnStudio.constants.TANGENT_KP} viscous tangential damping). This is a fundamentally different contact PHYSICS MODEL, not just different K constants — dc62c94 only ported the lift/drive split formula into game4.html, and 68179db only fixed K there; neither ported the Stage 4a substepped model.`);
  lines.push(`- return-studio.html's own PUSH_LIFT_K/PUSH_DRIVE_K are STILL 0 as currently deployed (PUSH_LIFT_K=${returnStudio.constants.PUSH_LIFT_K}, PUSH_DRIVE_K=${returnStudio.constants.PUSH_DRIVE_K}) — only game4.html received the 68179db fix. The "return-studio deployed" comparison group below is expected to reproduce pre-fix-style behavior, not act as a competing fixed baseline.`);
  lines.push("");

  lines.push("## Deployed constants read from each file (not hardcoded/assumed)");
  lines.push("");
  lines.push("constant | game4.html (deployed) | return-studio.html (deployed)");
  lines.push("--- | --- | ---");
  const constNames = ["PUSH_LIFT_BASE", "PUSH_LIFT_K", "PUSH_LIFT_FLOOR", "PUSH_LIFT_NEUTRAL", "PUSH_LIFT_MAX", "PUSH_DRIVE_BASE", "PUSH_DRIVE_K", "PUSH_DRIVE_FLOOR", "PUSH_DRIVE_NEUTRAL", "PUSH_DRIVE_MAX", "PUSH_TILT_Y", "PADDLE_FRICTION"];
  for (const name of constNames) {
    lines.push(`${name} | ${game4.constants[name]} | ${returnStudio.constants[name]}`);
  }
  lines.push(`contactModel | ${game4.constants.contactModel} | ${returnStudio.constants.contactModel}`);
  lines.push(`TANGENT_KP | n/a (no such concept in game4.html) | ${returnStudio.constants.TANGENT_KP}`);
  lines.push(`PADDLE_BLEND | n/a (no such concept in game4.html) | ${returnStudio.constants.PADDLE_BLEND}`);
  lines.push("");

  lines.push("## Fingerprint diagnostics: game4.html vs return-studio.html board functions");
  lines.push("");
  lines.push("function | found in game4.html | found in return-studio.html | source-identical (normalized)");
  lines.push("--- | --- | --- | ---");
  for (const row of fpRows) {
    lines.push(`${row.name} | ${row.foundInGame4} | ${row.foundInReturnStudio} | ${row.identical}`);
  }
  lines.push("");
  lines.push("(This tool only USES game4.html's versions for both configs' rallies, per the design note above — this table is diagnostic only, checking whether that choice would have mattered.)");
  lines.push("");

  lines.push("## game4.html deployed config — rally results");
  lines.push("");
  lines.push(`avgRounds=${game4Result.avgRounds}, minRounds=${game4Result.minRounds}, backspinFraction=${game4Result.backspinFraction}, totalSurvivedRounds=${game4Result.totalSurvivedRounds}`);
  lines.push(`failReason counts: ${JSON.stringify(game4Result.failReasonCounts)}`);
  lines.push("");
  lines.push("preset | rounds survived | fail reason | outgoing topspin per round (canonical)");
  lines.push("--- | --- | --- | ---");
  for (const row of game4Result.perPreset) {
    lines.push(`${row.preset} | ${row.rounds} | ${row.failReason ?? "-"} | ${fmtSpinSeries(row)}`);
  }
  lines.push("");

  lines.push("## return-studio.html deployed config — rally results (using game4.html's board)");
  lines.push("");
  lines.push(`avgRounds=${returnStudioResult.avgRounds}, minRounds=${returnStudioResult.minRounds}, backspinFraction=${returnStudioResult.backspinFraction}, totalSurvivedRounds=${returnStudioResult.totalSurvivedRounds}`);
  lines.push(`failReason counts: ${JSON.stringify(returnStudioResult.failReasonCounts)}`);
  lines.push("");
  lines.push("preset | rounds survived | fail reason | outgoing topspin per round (canonical)");
  lines.push("--- | --- | --- | ---");
  for (const row of returnStudioResult.perPreset) {
    lines.push(`${row.preset} | ${row.rounds} | ${row.failReason ?? "-"} | ${fmtSpinSeries(row)}`);
  }
  lines.push("");

  lines.push("## Head-to-head summary");
  lines.push("");
  lines.push("config | avgRounds | minRounds | backspinFraction | totalSurvivedRounds(11 presets, max 12 rounds each = 132 max)");
  lines.push("--- | --- | --- | --- | ---");
  lines.push(`game4.html deployed | ${game4Result.avgRounds} | ${game4Result.minRounds} | ${game4Result.backspinFraction} | ${game4Result.totalSurvivedRounds}`);
  lines.push(`return-studio.html deployed | ${returnStudioResult.avgRounds} | ${returnStudioResult.minRounds} | ${returnStudioResult.backspinFraction} | ${returnStudioResult.totalSurvivedRounds}`);
  lines.push("");

  lines.push("## Backspin threshold fit note");
  lines.push("");
  lines.push(`Threshold <= ${BACKSPIN_THRESHOLD} on canonical outgoing topspin is carried over unchanged from push-sustainable-rally-sweep-calibration.js as a descriptive label only (isBackspin flag in the per-round data below/JSON), not used to gate rounds/rounds-survived here (survival = net clearance >= 0 AND in-bounds, matching runRallyReal's own criteria). See per-round outgoing-topspin series above/JSON for whether the observed values actually cluster clearly negative or hover near the threshold.`);
  lines.push("");

  lines.push("## Full JSON (all per-round data)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ game4Constants: game4.constants, returnStudioConstants: returnStudio.constants, fingerprintDiagnostics: fpRows, game4Result, returnStudioResult }, null, 2));
  lines.push("```");

  fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf8");

  console.log("=== game4.html deployed ===");
  console.log(`avgRounds=${game4Result.avgRounds} minRounds=${game4Result.minRounds} backspinFraction=${game4Result.backspinFraction} totalSurvivedRounds=${game4Result.totalSurvivedRounds}`);
  console.table(game4Result.perPreset.map((r) => ({ preset: r.preset, rounds: r.rounds, failReason: r.failReason })));
  console.log("=== return-studio.html deployed ===");
  console.log(`avgRounds=${returnStudioResult.avgRounds} minRounds=${returnStudioResult.minRounds} backspinFraction=${returnStudioResult.backspinFraction} totalSurvivedRounds=${returnStudioResult.totalSurvivedRounds}`);
  console.table(returnStudioResult.perPreset.map((r) => ({ preset: r.preset, rounds: r.rounds, failReason: r.failReason })));
  console.log(`Report written to ${REPORT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Script-level failure: ${error.stack || error.message}`);
  process.exit(1);
}
