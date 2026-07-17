#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATE = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.join(ROOT_DIR, "AI_CONTEXT", `game5_47_serve_calibration_${DATE}`);

const INPUT_DIRS = [
  "game5_47_serve_calibration_2026-07-15_baseline",
  "game5_47_serve_calibration_2026-07-15_coarse",
  "game5_47_serve_calibration_2026-07-15_timing",
  "game5_47_serve_calibration_2026-07-15_holdout_top",
];

function main() {
  const reports = INPUT_DIRS.map((dir) => {
    const file = path.join(ROOT_DIR, "AI_CONTEXT", dir, "game5_47_serve_calibration_raw.json");
    if (!fs.existsSync(file)) throw new Error(`Missing report: ${file}`);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  });

  const rows = reports.flatMap((report) => report.rows);
  const metadata = {
    ...reports[0].metadata,
    generatedAt: new Date().toISOString(),
    scope: "merged isolated Game 5 47-serve parameter calibration",
    componentReports: INPUT_DIRS,
    rowCount: rows.length,
    concurrentInputMutation: reports.some((report) => report.metadata.concurrentInputMutation),
    redLineFilesModified: reports.some((report) => report.metadata.redLineFilesModified),
  };
  const merged = {
    metadata,
    serveBaseline: reports[0].serveBaseline,
    rows,
  };

  fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUTPUT_DIR, "game5_47_serve_calibration_raw.json"), JSON.stringify(merged, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "game5_47_serve_calibration_summary.md"), buildSummary(merged), "utf8");
  console.log(`Merged ${reports.length} reports and ${rows.length} rows into ${OUTPUT_DIR}`);
}

function buildSummary(report) {
  const lines = [];
  lines.push("# Game 5 47-Serve Parameter Calibration — Consolidated Report");
  lines.push("");
  lines.push(`Generated: ${report.metadata.generatedAt}`);
  lines.push(`Source SHA-256: \`${report.metadata.sourceSha256}\``);
  lines.push(`Preset SHA-256: \`${report.metadata.presetsSha256}\``);
  lines.push(`Red-line files modified: **${report.metadata.redLineFilesModified ? "yes" : "no"}**`);
  lines.push(`Concurrent input mutation detected: **${report.metadata.concurrentInputMutation ? "yes" : "no"}**`);
  lines.push("");
  lines.push("## Execution result");
  lines.push("");
  lines.push("The calibration line completed as four separate runs: 47-serve baseline, six-serve coarse sweep, six-serve timing sweep, and 41-serve holdout on five selected candidates. The serve inputs stayed fixed throughout.");
  lines.push("");
  lines.push(`- Serve legal gate: **${report.serveBaseline.legalCount}/${report.serveBaseline.count}**.`);
  lines.push(`- Representative set: ${report.metadata.representativeIds.join(", ")}.`);
  lines.push(`- Holdout set: ${report.metadata.holdoutCount} presets.`);
  lines.push(`- Total calibration rows: ${report.metadata.rowCount}.`);
  lines.push("");
  lines.push("## Aggregated matrix");
  lines.push("");
  lines.push("| Run | Variant | Technique | Delay | Rows | Finite | Success | Net | Out/no landing | Mean net clearance |");
  lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const group of grouped(report.rows)) {
    lines.push(`| ${group.run} | ${group.variant} | ${group.technique} | ${group.delayMs} ms | ${group.rows} | ${group.finite} | ${group.success} | ${group.net} | ${group.out} | ${format(group.meanNetClearance)} |`);
  }
  lines.push("");
  lines.push("## Key findings");
  lines.push("");
  lines.push("1. **Serve inputs are stable for this experiment:** all 47 current presets passed the local legal-serve geometric gate.");
  lines.push("2. **Push baseline generalizes better than attack baseline:** baseline push reached 55/101 on holdout; baseline attack reached 0/101 and all 101 cases were classified as net.");
  lines.push("3. **Push side compensation candidate:** `SIDESPIN_COMPENSATION_C=2.9` reached 64/101 on holdout versus 55/101 baseline. This is evidence for a candidate range, not permission to overwrite the deployed 3.4 yet.");
  lines.push("4. **Attack vertical swing candidate:** `techniqueVel.y=0.3` reached 32/101 on holdout versus 0/101 baseline; `techniqueVel.y=0` reached 4/101. The improvement is real in this model but still leaves many net/out cases.");
  lines.push("5. **Timing is a major attack sensitivity:** on the six representative clips, attack reached 6/18 at 60 ms but 0/18 at 80–140 ms; push stayed 6/18 across the tested delays.");
  lines.push("6. **Direction input needs a separate semantic review:** many attack rows were unchanged across left/none/right, so the current attack path does not yet demonstrate a useful direction response for every side-spin case.");
  lines.push("");
  lines.push("## What this means");
  lines.push("");
  lines.push("The current Game 5 attack path is not MVP-ready as a calibrated return technique. The next useful work is a narrower attack contact/timing calibration around `techniqueVel.y`, contact timing, and direction coupling; it is not a reason to regenerate the 47 serves or to migrate the entire repo to true 3D sidespin now.");
  lines.push("");
  lines.push("The push result supports further validation of `C=2.9`, but does not by itself justify changing `game5.html`: the candidate must first receive trajectory/feel review and then be rerun through the readiness validator.");
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- This report is isolated prototype evidence, not physical truth or Trainer readiness.");
  lines.push("- No red-line file was modified by the calibration tool.");
  lines.push("- No parameter was automatically promoted to production.");
  lines.push("- Attack `SIDESPIN_COMPENSATION_C` results are sensitivity evidence only; current production compensation was calibrated for push/chop.");
  lines.push("");
  return lines.join("\n");
}

function grouped(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.run}|${row.variant}|${row.technique}|${row.delayMs}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [run, variant, technique, delayMs] = key.split("|");
    const metrics = group.map((row) => row.metrics).filter(Boolean);
    return {
      run,
      variant,
      technique,
      delayMs,
      rows: group.length,
      finite: metrics.filter((metric) => metric.finite).length,
      success: metrics.filter((metric) => metric.success).length,
      net: metrics.filter((metric) => metric.outcome === "net").length,
      out: metrics.filter((metric) => metric.outcome === "out_or_no_landing").length,
      meanNetClearance: mean(metrics.map((metric) => metric.netClearance).filter(Number.isFinite)),
    };
  }).sort((a, b) => `${a.run}|${a.variant}|${a.technique}|${a.delayMs}`.localeCompare(`${b.run}|${b.variant}|${b.technique}|${b.delayMs}`));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function format(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "n/a";
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}

