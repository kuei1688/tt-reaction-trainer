#!/usr/bin/env node
import { basename } from "node:path";
import { loadProject, outputPathForServe, resolveTooling, selectServes, verifyWebm } from "./webm-core.mjs";

function readServeId(argv) {
  if (!argv.length || (argv.length === 1 && argv[0] === "--all")) return null;
  if (argv.length === 2 && argv[0] === "--serve" && argv[1]) return argv[1];
  throw new Error("用法：verify-webm.mjs --all | --serve <id>");
}

async function main() {
  const serveId = readServeId(process.argv.slice(2));
  const tooling = resolveTooling();
  if (!tooling.ffmpegVersion || !tooling.ffprobeVersion) throw new Error("找不到 FFmpeg／FFprobe；請先執行 generate-webm.mjs --doctor");
  const { config, settings } = await loadProject();
  for (const serve of selectServes(config, serveId)) {
    const path = outputPathForServe(serve);
    const result = await verifyWebm(path, serve, settings, tooling);
    console.log(`ok ${serve.id} ${basename(path)}: ${result.frame_count} frames, ${result.duration_sec.toFixed(3)}s, centroid ${result.centroid.error_px.toFixed(4)} px`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
