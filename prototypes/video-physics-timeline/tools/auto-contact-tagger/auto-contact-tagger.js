#!/usr/bin/env node
'use strict';
// auto-contact-tagger.js — 自動粗標觸球時間 CLI（Phase 1：單檔模式）
//
// 用 vision API 兩階段掃描（粗掃定位區間 -> 細掃逐幀）找到觸球瞬間，
// 輸出可被 Direction C 標註器「匯入 draft」入口接受的 draft JSON。
// 腳本只偵測 contact_time_sec；其餘欄位為佔位值，待人工在標註器內微調。
//
// 用法：
//   node auto-contact-tagger.js <video.mp4> [--fps 60] [--out draft.json]
//       [--model <id>] [--endpoint <url>] [--api-key <key>]
//       [--hint <sec>] [--coarse-interval 0.5] [--half-window 0.5]
//       [--rate-limit 5] [--ffmpeg <path>] [--dry-run] [--keep-frames]
//
// 視覺模型必須支援影像輸入。endpoint 預設本地 Ollama (127.0.0.1:11434)，
// model 可用 --model 或環境變數 OLLAMA_VISION_MODEL 指定。

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

function bail(msg) { process.stderr.write('auto-contact-tagger: ' + msg + '\n'); process.exit(1); }

function cleanup(dir, keep) {
  if (keep) { process.stderr.write('[frames] kept in ' + dir + '\n'); return; }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const video = args.positional[0];
  if (!video) bail('usage: node auto-contact-tagger.js <video.mp4> [--fps 60] [--out draft.json] [--model <id>] [--endpoint <url>] [--hint <sec>] [--coarse-interval 0.5] [--half-window 0.5] [--ffmpeg <path>] [--dry-run]');
  if (!fs.existsSync(video)) bail('video not found: ' + video);
  const f = args.flags;
  const fpsArg = f.fps ? parseInt(f.fps, 10) : null;

  const ffmpeg = findTool('ffmpeg', f.ffmpeg || null);
  if (!ffmpeg) bail('ffmpeg not found. 安裝 ffmpeg 或用 --ffmpeg <path> 指定。');
  const probe = probeVideo(video);
  const fps = Math.round(fpsArg || (probe && probe.fps) || 60);
  const duration = (probe && probe.duration) || (probe && probe.nbFrames ? probe.nbFrames / fps : null);
  process.stderr.write('[ffmpeg] ' + ffmpeg + '\n');
  process.stderr.write('[fps] ' + fps + (duration ? ' [duration] ' + duration.toFixed(3) + 's' : '') + '\n');

  const outDir = makeTempDir('auto-contact-tagger-');
  let frames;
  try {
    frames = extractAllFrames(ffmpeg, video, fps, outDir);
  } catch (e) {
    cleanup(outDir, f['keep-frames']);
    bail('frame extraction failed: ' + (e.stderr ? e.stderr.toString().slice(0, 300) : e.message));
  }
  process.stderr.write('[frames] extracted ' + frames.length + ' frames\n');
  if (!frames.length) { cleanup(outDir, f['keep-frames']); bail('no frames extracted'); }

  const coarseInterval = f['coarse-interval'] ? parseFloat(f['coarse-interval']) : 0.5;
  const halfWindow = f['half-window'] ? parseFloat(f['half-window']) : 0.5;
  const hint = f.hint != null && f.hint !== true ? parseFloat(f.hint) : null;

  if (f['dry-run']) {
    const coarse = scan.selectCoarseFrames(frames, coarseInterval);
    const center = hint != null ? hint : (coarse.length ? coarse[Math.floor(coarse.length / 2)].timeSec : frames[0].timeSec);
    const fine = scan.selectFineFrames(frames, center, halfWindow);
    process.stderr.write('[dry-run] coarse sample: ' + coarse.length + ' frames @ ' + coarse.map(x => x.timeSec.toFixed(3)).join(' ') + '\n');
    process.stderr.write('[dry-run] fine window (' + center.toFixed(3) + ' ±' + halfWindow + 's): ' + fine.length + ' frames\n');
    process.stderr.write('[dry-run] estimated API calls: ' + (coarse.length + fine.length) + '\n');
    cleanup(outDir, f['keep-frames']);
    process.stderr.write('[dry-run] done (no API calls)\n');
    return;
  }

  let backend;
  try {
    backend = makeVisionBackend({
      endpoint: f.endpoint || null,
      model: f.model || null,
      apiKey: f['api-key'] || null,
      rateLimitPerSec: f['rate-limit'] ? parseFloat(f['rate-limit']) : 5
    });
  } catch (e) { cleanup(outDir, f['keep-frames']); bail(e.message); }
  process.stderr.write('[vision] model=' + backend.getModel() + ' endpoint=' + backend.getEndpoint() + '\n');

  const coarseFrames = scan.selectCoarseFrames(frames, coarseInterval);
  const estFine = scan.selectFineFrames(frames, hint != null ? hint : 0, halfWindow).length || 60;
  const totalEst = (hint != null ? 0 : coarseFrames.length) + Math.min(estFine, frames.length);
  let progress = 0;
  const wrap = function (fn) {
    return async function (frame) {
      const r = await fn(frame);
      progress++;
      process.stderr.write('\r[vision] ' + progress + '/' + totalEst + ' ');
      return r;
    };
  };

  const result = await scan.detectContact(frames, {
    coarseIntervalSec: coarseInterval,
    halfWindowSec: halfWindow,
    hintSec: hint,
    classifyFn: wrap(backend.classifyFrame),
    isContactFn: wrap(backend.isContact)
  });
  process.stderr.write('\n');
  cleanup(outDir, f['keep-frames']);

  for (const w of result.warnings) process.stderr.write('[warn] ' + w + '\n');

  const draft = buildDraft({
    sourceVideo: path.basename(video),
    fps: fps,
    contactTimeSec: result.contactTimeSec
  });
  const outPath = f.out || path.join(path.dirname(path.resolve(video)), path.basename(video, path.extname(video)) + '.draft.json');
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2) + '\n');
  process.stderr.write('[result] contact_time_sec=' + draft.contact_time_sec.toFixed(4) + ' confidence=' + result.confidence.toFixed(2) + ' stage=' + result.stage + '\n');
  process.stderr.write('[result] wrote ' + outPath + '\n');
  process.stdout.write(JSON.stringify({ contact_time_sec: draft.contact_time_sec, confidence: result.confidence, stage: result.stage, warnings: result.warnings }) + '\n');
}

main().catch(function (e) { process.stderr.write('FATAL: ' + (e.stack || e.message) + '\n'); process.exit(1); });