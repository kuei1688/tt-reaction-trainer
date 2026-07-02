#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const write = args.includes('--write');
const inputPath = args.find(arg => arg !== '--write');
const presetPath = path.resolve('physics-presets.json');

if(!inputPath){
  console.error('Usage: node tools/import-serve-presets.mjs <serve-preset-batch.json|txt> [--write]');
  process.exit(1);
}

const TAG_LABELS = {
  spinType: {
    no_spin: '\u4e0d\u8f49',
    backspin: '下旋',
    sidebackspin: '側下',
    sidespin: '側旋',
    topspin: '上旋'
  },
  length: {
    short: '短球',
    half_long: '半出台',
    long: '長球'
  },
  placement: {
    backhand: '反手',
    forehand: '正手',
    middle: '中路'
  }
};

function readJsonish(filePath){
  const text = fs.readFileSync(filePath, 'utf8');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if(start < 0 || end < start) throw new Error(`No JSON object found in ${filePath}`);
  return JSON.parse(text.slice(start, end + 1));
}

function roundValue(value){
  return Number.isFinite(value) ? Number(value.toFixed(5)) : value;
}

function pointKey(point){
  return ['x', 'y', 'z'].map(key => roundValue(point?.[key] ?? 0)).join(',');
}

function solveKey(solve){
  return [
    solve?.targetMode || solve?.target || '',
    roundValue(solve?.flightTime ?? solve?.timeToFirst ?? 0),
    roundValue(solve?.secondLegTime ?? 0),
    roundValue(solve?.netClearance ?? 0),
    roundValue(solve?.gravity ?? -4.2)
  ].join(',');
}

function geometryFingerprint(preset){
  const tags = preset.tags || {};
  return [
    tags.spinType || '',
    tags.length || '',
    tags.placement || '',
    pointKey(preset.start),
    pointKey(preset.firstBounce),
    pointKey(preset.secondBounce || preset.target),
    pointKey(preset.target),
    solveKey(preset.solve)
  ].join('|');
}

function variationKey(variation){
  return [
    pointKey(variation?.velocity),
    roundValue(variation?.spin?.topspin ?? 0),
    roundValue(variation?.spin?.sidespin ?? 0),
    roundValue(variation?.bounce ?? 0)
  ].join(',');
}

function normalizedTags(preset){
  const tags = {...(preset.tags || {})};
  const spin = preset.variation?.spin || {};
  const secondX = preset.secondBounce?.x ?? preset.target?.x;
  if(Number.isFinite(secondX)){
    if(secondX <= -0.05) tags.placement = 'backhand';
    else if(secondX >= 0.05) tags.placement = 'forehand';
    else tags.placement = 'middle';
  }
  const sideAmount = Math.abs(spin.sidespin || 0);
  if(spin.topspin < -0.2 && sideAmount >= 0.6 && (!tags.spinType || tags.spinType === 'backspin' || tags.spinType === 'sidebackspin')){
    tags.spinType = 'sidebackspin';
  }else if(spin.topspin < -0.2 && sideAmount < 0.6 && (!tags.spinType || tags.spinType === 'sidebackspin')){
    tags.spinType = 'backspin';
  }
  return tags;
}

function withNormalizedTags(preset){
  const next = structuredClone(preset);
  next.tags = normalizedTags(next);
  return next;
}

function parameterFingerprint(preset){
  return [
    geometryFingerprint(preset),
    variationKey(preset.variation)
  ].join('|');
}

function baseIdFor(preset){
  const tags = preset.tags || {};
  return [tags.spinType, tags.length, tags.placement].filter(Boolean).join('_') || 'serve';
}

function labelFor(preset, id){
  const tags = preset.tags || {};
  const spin = TAG_LABELS.spinType[tags.spinType] || tags.spinType || '發球';
  const length = TAG_LABELS.length[tags.length] || tags.length || '';
  const placement = TAG_LABELS.placement[tags.placement] || tags.placement || '';
  const base = `${spin}${length}${placement ? `到${placement}` : ''}`;
  const suffix = id.match(/_(\d+)$/)?.[1];
  return suffix ? `${base}-${suffix}` : base;
}

function normalizedTagLabels(preset){
  const tags = preset.tags || {};
  return {
    spinType: TAG_LABELS.spinType[tags.spinType] || preset.tagLabels?.spinType || tags.spinType || '',
    length: TAG_LABELS.length[tags.length] || preset.tagLabels?.length || tags.length || '',
    placement: TAG_LABELS.placement[tags.placement] || preset.tagLabels?.placement || tags.placement || ''
  };
}

function normalizePreset(preset, id){
  const next = withNormalizedTags(preset);
  next.id = id;
  next.label = labelFor(next, id);
  next.type = next.type || 'serve';
  next.mode = next.mode || 'cheat_solve';
  next.tagLabels = normalizedTagLabels(next);
  next.solve = {...next.solve};
  if(next.solve.flightTime != null && next.solve.timeToFirst == null){
    next.solve.timeToFirst = next.solve.flightTime;
  }
  return next;
}

function nextId(base, usedIds, typeCounts){
  const nextCount = (typeCounts.get(base) || 0) + 1;
  typeCounts.set(base, nextCount);
  let candidate = nextCount === 1 ? base : `${base}_${nextCount}`;
  let serial = nextCount;
  while(usedIds.has(candidate)){
    serial += 1;
    typeCounts.set(base, serial);
    candidate = `${base}_${serial}`;
  }
  usedIds.add(candidate);
  return candidate;
}

const batch = readJsonish(path.resolve(inputPath));
const incoming = batch.presets || [];
const presetsFile = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
presetsFile.serves ||= [];

const usedIds = new Set(presetsFile.serves.map(preset => preset.id));
const seenParameters = new Map();
const seenGeometryByBase = new Map();
const typeCounts = new Map();

for(const rawPreset of presetsFile.serves){
  const preset = withNormalizedTags(rawPreset);
  const base = baseIdFor(preset);
  const suffix = preset.id?.match(new RegExp(`^${base}_(\\d+)$`))?.[1];
  const count = suffix ? Number(suffix) : (preset.id === base ? 1 : 0);
  typeCounts.set(base, Math.max(typeCounts.get(base) || 0, count));
  seenParameters.set(parameterFingerprint(preset), preset.id);
  seenGeometryByBase.set(`${base}|${geometryFingerprint(preset)}`, preset.id);
}

const added = [];
const skipped = [];

for(const rawPreset of incoming){
  const preset = withNormalizedTags(rawPreset);
  const base = baseIdFor(preset);
  const fingerprint = parameterFingerprint(preset);
  const existingId = seenParameters.get(fingerprint);
  if(existingId){
    skipped.push({label: preset.label, reason: 'duplicate-parameters', existingId});
    continue;
  }
  const sourceHasSerial = /(?:-|_)\d+$/.test(String(preset.id || preset.label || ''));
  const geometryId = seenGeometryByBase.get(`${base}|${geometryFingerprint(preset)}`);
  if(geometryId && !sourceHasSerial){
    skipped.push({label: preset.label, reason: 'duplicate-geometry', existingId: geometryId});
    continue;
  }
  const id = nextId(base, usedIds, typeCounts);
  const normalized = normalizePreset(preset, id);
  presetsFile.serves.push(normalized);
  seenParameters.set(fingerprint, id);
  seenGeometryByBase.set(`${base}|${geometryFingerprint(preset)}`, id);
  added.push({id, label: normalized.label, sourceLabel: preset.label});
}

console.log(`incoming=${incoming.length} added=${added.length} skipped=${skipped.length}`);
for(const item of added) console.log(`ADD ${item.id} <- ${item.sourceLabel}`);
for(const item of skipped) console.log(`SKIP ${item.existingId} <- ${item.label} (${item.reason})`);

if(write){
  fs.writeFileSync(presetPath, JSON.stringify(presetsFile, null, 2) + '\n');
  console.log(`Wrote ${presetPath}`);
}else{
  console.log('Dry run only. Add --write to update physics-presets.json.');
}
