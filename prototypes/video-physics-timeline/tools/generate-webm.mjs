#!/usr/bin/env node
import { once } from "node:events";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  PROTOTYPE_DIR,
  contentHashes,
  createStaticFrame,
  getFramePlan,
  loadProject,
  outputPathForServe,
  renderFrame,
  resolveTooling,
  selectServes,
  verifyWebm
} from "./webm-core.mjs";

function parseArgs(argv) {
  const options = { doctor: false, check: false, force: false, serveId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--doctor") options.doctor = true;
    else if (argument === "--check") options.check = true;
    else if (argument === "--force") options.force = true;
    else if (argument === "--all") options.serveId = null;
    else if (argument === "--serve") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--serve 需要 serve ID");
      options.serveId = value;
      index += 1;
    } else throw new Error(`未知參數：${argument}`);
  }
  if (options.doctor && (options.check || options.force || options.serveId)) throw new Error("--doctor 不可與產生參數混用");
  if (options.check && options.force) throw new Error("--check 不可與 --force 混用");
  return options;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function writeFrame(stream, frame) {
  if (stream.write(frame)) return;
  await once(stream, "drain");
}

async function replaceAtomically(tempPath, targetPath, force) {
  if (!await exists(targetPath)) {
    await rename(tempPath, targetPath);
    return;
  }
  if (!force) throw new Error(`${targetPath} 已存在；要重建請加 --force`);
  const backupPath = `${targetPath}.previous-${process.pid}`;
  await rename(targetPath, backupPath);
  try {
    await rename(tempPath, targetPath);
    await rm(backupPath, { force: true });
  } catch (error) {
    if (await exists(backupPath) && !await exists(targetPath)) await rename(backupPath, targetPath);
    throw error;
  }
}

async function generateServe(serve, settings, tooling, force) {
  const targetPath = outputPathForServe(serve);
  if (await exists(targetPath) && !force) throw new Error(`${basename(targetPath)} 已存在；要重建請加 --force`);
  await mkdir(dirname(targetPath), { recursive: true });
  const extension = extname(targetPath);
  const stem = basename(targetPath, extension);
  const tempPath = resolve(dirname(targetPath), `${stem}.tmp-${process.pid}${extension}`);
  await rm(tempPath, { force: true });

  const plan = getFramePlan(serve, settings);
  const staticFrame = createStaticFrame(settings);
  const deterministic = settings.determinism;
  const args = [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "rawvideo", "-pixel_format", "rgb24",
    "-video_size", `${settings.width}x${settings.height}`,
    "-framerate", String(settings.fps), "-i", "pipe:0",
    "-an", "-map_metadata", "-1",
    "-c:v", settings.codec, "-deadline", "good", "-cpu-used", String(settings.cpu_used),
    "-crf", String(settings.crf), "-b:v", "0", "-pix_fmt", settings.pixel_format,
    "-r", String(settings.fps), "-threads", String(deterministic.threads),
    "-row-mt", String(deterministic.row_mt), "-tile-columns", String(deterministic.tile_columns),
    "-frame-parallel", String(deterministic.frame_parallel), "-auto-alt-ref", String(deterministic.auto_alt_ref),
    "-fflags", "+bitexact", "-flags:v", "+bitexact",
    tempPath
  ];
  const child = spawn(tooling.ffmpeg, args, { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
  let stderr = "";
  let streamError = null;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.on("error", (error) => { streamError = error; });
  const completion = new Promise((resolveCompletion, rejectCompletion) => {
    child.once("error", rejectCompletion);
    child.once("close", (code) => {
      if (code === 0 && !streamError) resolveCompletion();
      else rejectCompletion(new Error(`FFmpeg 編碼 ${serve.id} 失敗：${stderr.trim() || streamError?.message || `exit ${code}`}`));
    });
  });

  try {
    for (let frameIndex = 0; frameIndex < plan.frameCount; frameIndex += 1) {
      if (streamError) throw streamError;
      await writeFrame(child.stdin, renderFrame(serve, settings, frameIndex, staticFrame));
    }
    child.stdin.end();
    await completion;
    await verifyWebm(tempPath, serve, settings, tooling);
    await replaceAtomically(tempPath, targetPath, force);
    return targetPath;
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function writeReport(report) {
  const reportPath = resolve(PROTOTYPE_DIR, "assets", "webm-generation-report.json");
  const tempPath = `${reportPath}.tmp-${process.pid}`;
  await writeFile(tempPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (await exists(reportPath)) await rm(reportPath, { force: true });
  await rename(tempPath, reportPath);
  return reportPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tooling = resolveTooling();
  if (options.doctor) {
    console.log(`FFmpeg: ${tooling.ffmpegVersion || "NOT FOUND"}`);
    console.log(`FFprobe: ${tooling.ffprobeVersion || "NOT FOUND"}`);
    if (!tooling.ffmpegVersion || !tooling.ffprobeVersion) {
      console.error("請安裝含 libvpx-vp9 的 FFmpeg，或設定 FFMPEG_PATH 與 FFPROBE_PATH。");
      process.exitCode = 1;
    }
    return;
  }
  if (!tooling.ffmpegVersion || !tooling.ffprobeVersion) {
    throw new Error("找不到 FFmpeg／FFprobe；請先執行 generate-webm.mjs --doctor");
  }

  const { config, settings, configText, settingsText } = await loadProject();
  const serves = selectServes(config, options.serveId);
  const results = [];
  for (const serve of serves) {
    const targetPath = outputPathForServe(serve);
    if (!options.check) {
      console.log(`render ${serve.id} -> ${basename(targetPath)}`);
      await generateServe(serve, settings, tooling, options.force);
    }
    console.log(`verify ${serve.id}`);
    results.push(await verifyWebm(targetPath, serve, settings, tooling));
  }
  const report = {
    schema_version: 1,
    generated_at_utc: new Date().toISOString(),
    determinism_strategy: "decoded-content",
    bitexact_container_promised: false,
    timecode_renderer: "node-5x7-bitmap-font",
    centroid_method: "trigger-frame-rgb-threshold-roi",
    ffmpeg_version: tooling.ffmpegVersion,
    ffprobe_version: tooling.ffprobeVersion,
    ...contentHashes(configText, settingsText),
    outputs: results
  };
  if (!options.check) {
    const reportPath = await writeReport(report);
    console.log(`report ${reportPath}`);
  }
  for (const result of results) {
    console.log(`${result.serve_id}: ${result.frame_count} frames, centroid ${result.centroid.error_px.toFixed(4)} px, decoded ${result.decoded_frames_sha256}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
