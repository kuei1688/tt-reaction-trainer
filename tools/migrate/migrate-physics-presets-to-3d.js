#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");

function canonicalSpinForPreset(preset) {
  const legacy = (preset.variation && preset.variation.spin) || {};
  const sideName = preset.tags && preset.tags.sideName;
  const magnitude = Math.abs(legacy.sidespin || 0);
  const omegaY = sideName === "left" ? magnitude : sideName === "right" ? -magnitude : 0;
  return {
    schema: 2,
    omega: {
      x: legacy.topspin || 0,
      y: omegaY,
      z: 0,
    }
  };
}

const data = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8"));
let migrated = 0;
for (const preset of data.serves || []) {
  if (!preset.variation || !preset.variation.spin) continue;
  preset.variation.spin3d = canonicalSpinForPreset(preset);
  migrated += 1;
}

fs.writeFileSync(PRESETS_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Added canonical spin3d to ${migrated} presets`);
