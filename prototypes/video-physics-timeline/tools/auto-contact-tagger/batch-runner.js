#!/usr/bin/env node
'use strict';
// batch-runner.js — 批次跑 auto-contact-tagger 流程於多支影片。
// 每支輸出 <stem>.draft.json 到 --out 目錄，並產出 batch-summary.json（逐支即時落盤）。
//
// 用法：
//   node batch-runner.js <v1.mp4> [v2.mp4 ...] --out <dir> [options]
//   node batch-runner.js --batch <videodir> [--recursive] --out <dir> [options]
//
// options: --model <id> --endpoint <url> --api-key <key> --rate-limit 5
//          --coarse-interval 0.5 --half-window 0.5 --fps 60 --ffmpeg <path>
//          --truth <jsonfile>   (basename -> true contact_time_sec，用來算誤差)
//          --force              (重做已存在 draft 的影片；預設會跳過已完成的)
//          --keep-frames

const fs = require('fs');
const path = require('path');
const { findTool, makeTempDir, probeVideo, extractAllFrames } = require('./frame-extractor');
const { makeVisionBackend } = require('./vision-backend');
const scan = require('./scan');
const { buildDraft } = require('./draft-builder');

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args.flags[key] = true;
      else { args.flags[key] = next; i++; }
    } else args.positional.push(a);
  }
  return args;
}
function bail(msg) { process.stderr.write('batch-runner: ' + msg + '\n'); process.exit(1); }
function cleanup(dir, keep) { if (keep) return; try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
function listVideosInDir(dir, recursive) {
  if (!recursive) return fs.readdirSync(dir).filter(function (f) { return VIDEO_EXT.test(f); }).sort().map(function (f) { return path.join(dir, f); });
  const out = [];
  (function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      let st;
      try { st = fs.statSync(full); } catch (e) { continue; }
      if (st.isDirectory()) walk(full);
      else if (VIDEO_EXT.test(name)) out.push(full);
    }
  })(dir);
  return out.sort();
}

async function processVideo(video, opts, backend) {
  const probe = probeVideo(video);
  const fps = Math.round(opts.fps || (probe && probe.fps) || 60);
  const outDir = makeTempDir('auto-contact-tagger-');
  let frames;
  try { frames = extractAllFrames(opts.ffmpeg, video, fps, outDir); }
  catch (e) {
    cleanup(outDir, opts.keepFrames);
    throw new Error('extraction failed: ' + (e.stderr ? e.stderr.toString().slice(0, 200) : e.message));
  }
  if (!frames.length) { cleanup(outDir, opts.keepFrames); throw new Error('no frames extracted'); }
  let apiCalls = 0;
  const wrap = function (fn) { return async function (f) { apiCalls += 1; return fn(f); }; };
  const t0 = Date.now();
  const result = await scan.detectContact(frames, {
    coarseIntervalSec: opts.coarseInterval, halfWindowSec: opts.halfWindow,
    hintSec: opts.hints ? opts.hints[path.basename(video)] : null,
    classifyFn: wrap(backend.classifyFrame)
  });
  const elapsedMs = Date.now() - t0;
  cleanup(outDir, opts.keepFrames);
  const draft = buildDraft({ sourceVideo: path.basename(video), fps: fps, contactTimeSec: result.contactTimeSec });
  return { draft: draft, result: result, apiCalls: apiCalls, elapsedMs: elapsedMs, fps: fps, nbFrames: frames.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const f = args.flags;
  const outDir = f.out;
  if (!outDir) bail('usage: node batch-runner.js <videos...> --out <dir> [--model <id>] [--batch <dir> --recursive] [--truth <json>] [--force]');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let videos = args.positional.slice();
  if (f.batch && f.batch !== true) videos = videos.concat(listVideosInDir(f.batch, !!f.recursive));
  videos = Array.from(new Set(videos.map(function (p) { return path.resolve(p); })));
  if (!videos.length) bail('no videos (提供位置參數或 --batch <dir> [--recursive])');
  for (const v of videos) if (!fs.existsSync(v)) bail('video not found: ' + v);

  const ffmpeg = findTool('ffmpeg', f.ffmpeg || null);
  if (!ffmpeg) bail('ffmpeg not found. 用 --ffmpeg <path> 指定。');
  process.stderr.write('[batch] ' + videos.length + ' videos, ffmpeg=' + ffmpeg + ', out=' + outDir + '\n');

  let backend;
  try {
    backend = makeVisionBackend({ endpoint: f.endpoint || null, model: f.model || null, apiKey: f['api-key'] || null, rateLimitPerSec: f['rate-limit'] ? parseFloat(f['rate-limit']) : 5 });
  } catch (e) { bail(e.message); }
  process.stderr.write('[vision] model=' + backend.getModel() + ' endpoint=' + backend.getEndpoint() + '\n');

  let truth = {};
  if (f.truth && f.truth !== true) { try { truth = JSON.parse(fs.readFileSync(f.truth, 'utf8')); } catch (e) { bail('truth file parse failed: ' + e.message); } }

  const opts = {
    fps: f.fps ? parseInt(f.fps, 10) : null,
    ffmpeg: ffmpeg,
    coarseInterval: f['coarse-interval'] ? parseFloat(f['coarse-interval']) : 0.5,
    halfWindow: f['half-window'] ? parseFloat(f['half-window']) : 0.5,
    hints: null,
    keepFrames: !!f['keep-frames']
  };
  const force = !!f.force;

  const summaryPath = path.join(outDir, 'batch-summary.json');
  const summary = { batch_date: new Date().toISOString(), model: backend.getModel(), total_videos: videos.length, results: [] };

  let done = 0, skipped = 0;
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const base = path.basename(video);
    const stem = path.basename(video, path.extname(video));
    const draftPath = path.join(outDir, stem + '.draft.json');

    // 斷點續傳：已存在 draft 且未 --force 則跳過
    if (!force && fs.existsSync(draftPath)) {
      let existing = null;
      try { existing = JSON.parse(fs.readFileSync(draftPath, 'utf8')); } catch (e) {}
      const entry = { source_video: base, status: 'skipped', draft_path: draftPath };
      if (existing) {
        entry.contact_time_sec = existing.contact_time_sec;
        entry.fps = existing.fps;
        if (truth[base] != null) {
          entry.truth_sec = truth[base];
          entry.error_frames = Math.round(Math.abs(existing.contact_time_sec - truth[base]) * (existing.fps || 60));
        }
      }
      summary.results.push(entry);
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
      skipped += 1;
      process.stderr.write('[batch] (' + (i + 1) + '/' + videos.length + ') ' + base + ' SKIP (draft exists)\n');
      continue;
    }

    process.stderr.write('[batch] (' + (i + 1) + '/' + videos.length + ') ' + base + ' ...\n');
    const entry = { source_video: base, status: 'pending' };
    try {
      const r = await processVideo(video, opts, backend);
      fs.writeFileSync(draftPath, JSON.stringify(r.draft, null, 2) + '\n');
      entry.status = 'ok';
      entry.contact_time_sec = r.draft.contact_time_sec;
      entry.confidence = r.result.confidence;
      entry.stage = r.result.stage;
      entry.via = r.result.fine ? r.result.fine.via : null;
      entry.warnings = r.result.warnings;
      entry.api_calls = r.apiCalls;
      entry.elapsed_ms = r.elapsedMs;
      entry.fps = r.fps;
      entry.nb_frames = r.nbFrames;
      entry.draft_path = draftPath;
      if (truth[base] != null) {
        entry.truth_sec = truth[base];
        entry.error_frames = Math.round(Math.abs(r.draft.contact_time_sec - truth[base]) * r.fps);
        entry.error_ms = Math.abs(r.draft.contact_time_sec - truth[base]) * 1000;
        entry.bias = r.draft.contact_time_sec - truth[base];
      }
      done += 1;
      process.stderr.write('[batch]   -> ' + r.draft.contact_time_sec.toFixed(4) + 's conf=' + r.result.confidence.toFixed(2) + ' via=' + (r.result.fine ? r.result.fine.via : '?') + ' calls=' + r.apiCalls + ' ' + r.elapsedMs + 'ms' + (entry.error_frames != null ? ' err=' + entry.error_frames + 'f' : '') + '\n');
    } catch (e) {
      entry.status = 'error';
      entry.error = e.message;
      process.stderr.write('[batch]   -> ERROR: ' + e.message + '\n');
    }
    summary.results.push(entry);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  }

  console.log(JSON.stringify(summary, null, 2));
  process.stderr.write('[batch] done. done=' + done + ' skipped=' + skipped + ' errors=' + (summary.results.filter(function (r) { return r.status === 'error'; }).length) + ' summary: ' + summaryPath + '\n');
}

main().catch(function (e) { process.stderr.write('FATAL: ' + (e.stack || e.message) + '\n'); process.exit(1); });