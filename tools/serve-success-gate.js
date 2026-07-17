#!/usr/bin/env node

// Shared legal-serve acceptance gate.
// This deliberately does not use preset target-error thresholds: those are
// solver diagnostics, while a successful serve only needs legal table travel.

const DEFAULT_TABLE = {width: 1.525, length: 2.74};

function isOnTable(point, table = DEFAULT_TABLE) {
  return Boolean(
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.z) &&
    Math.abs(point.x) <= table.width / 2 &&
    Math.abs(point.z) <= table.length / 2
  );
}

function evaluateServeSuccess(simResult, table = DEFAULT_TABLE) {
  const bounces = Array.isArray(simResult?.bounces) ? simResult.bounces : [];
  const firstBounce = bounces.find((bounce) => bounce.z < 0) || null;
  const secondBounce = bounces.find((bounce) => bounce.z > 0) || null;
  const reasons = [];

  if (simResult?.netHit) reasons.push("net_hit");
  if (!firstBounce) reasons.push("no_first_bounce");
  else if (!isOnTable(firstBounce, table)) reasons.push("first_bounce_out");
  if (!secondBounce) reasons.push("no_second_bounce");
  else if (!isOnTable(secondBounce, table)) reasons.push("second_bounce_out");

  const netClearance = simResult?.netY == null
    ? null
    : simResult.netY - (0.76 + 0.1525);

  return {
    pass: reasons.length === 0,
    reasons,
    firstBounce,
    secondBounce,
    netClearance,
  };
}

module.exports = {DEFAULT_TABLE, isOnTable, evaluateServeSuccess};

