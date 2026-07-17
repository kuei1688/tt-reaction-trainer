#!/usr/bin/env node

// Read-only guardrail for cross-file physics sync checks.
// Known limitation: the initial symbol search is regex-based and does not skip
// comments before the first match, so a comment that mentions a whitelisted
// symbol before its real definition could cause a false positive/false lookup.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_WHITELIST_PATH = path.join(__dirname, "consistency-whitelist.json");

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const whitelistPath = path.resolve(
    options.whitelistPath ? options.whitelistPath : DEFAULT_WHITELIST_PATH
  );

  const whitelist = readWhitelist(whitelistPath);
  const fileCache = buildFileCache(whitelist, rootDir);
  const results = [];

  checkEntries("constant", whitelist.constants || [], fileCache, results);
  checkEntries("function", whitelist.functions || [], fileCache, results);

  if (results.length > 0) {
    console.error(`Consistency check failed with ${results.length} issue(s).`);
    for (const result of results) {
      console.error(formatResult(result));
    }
    process.exitCode = 1;
    return;
  }

  const constantCount = (whitelist.constants || []).length;
  const functionCount = (whitelist.functions || []).length;
  console.log(
    `Consistency check passed: ${constantCount} constant rule(s), ${functionCount} function rule(s).`
  );
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--whitelist") {
      options.whitelistPath = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--root") {
      options.rootDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function requireValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function printHelp() {
  console.log("Usage: node tools/cross-file-consistency-check.js [--whitelist <path>] [--root <path>]");
}

function readWhitelist(whitelistPath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(whitelistPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read whitelist at ${whitelistPath}: ${error.message}`);
  }

  validateWhitelistSchema(parsed, whitelistPath);
  return parsed;
}

function validateWhitelistSchema(whitelist, whitelistPath) {
  if (!whitelist || typeof whitelist !== "object" || Array.isArray(whitelist)) {
    throw new Error(`Whitelist must be a JSON object: ${whitelistPath}`);
  }

  for (const sectionName of ["constants", "functions"]) {
    const section = whitelist[sectionName];
    if (section == null) {
      continue;
    }
    if (!Array.isArray(section)) {
      throw new Error(`Whitelist section "${sectionName}" must be an array.`);
    }

    for (const entry of section) {
      validateEntry(entry, sectionName);
    }
  }
}

function validateEntry(entry, sectionName) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Every entry in "${sectionName}" must be an object.`);
  }

  if (typeof entry.name !== "string" || !entry.name.trim()) {
    throw new Error(`Every entry in "${sectionName}" must include a non-empty string "name".`);
  }

  if ("files" in entry && !Array.isArray(entry.files)) {
    throw new Error(`Entry "${entry.name}" in "${sectionName}" must use an array for "files".`);
  }

  if ("must_not_appear_in" in entry && !Array.isArray(entry.must_not_appear_in)) {
    throw new Error(
      `Entry "${entry.name}" in "${sectionName}" must use an array for "must_not_appear_in".`
    );
  }

  if ("expected_match" in entry && typeof entry.expected_match !== "boolean") {
    throw new Error(
      `Entry "${entry.name}" in "${sectionName}" must use a boolean for "expected_match".`
    );
  }
}

function buildFileCache(whitelist, rootDir) {
  const referencedFiles = new Set();

  for (const sectionName of ["constants", "functions"]) {
    for (const entry of whitelist[sectionName] || []) {
      for (const filePath of entry.files || []) {
        referencedFiles.add(filePath);
      }
      for (const filePath of entry.must_not_appear_in || []) {
        referencedFiles.add(filePath);
      }
    }
  }

  const cache = new Map();
  for (const fileRef of referencedFiles) {
    const absolutePath = path.resolve(rootDir, fileRef);
    let text;
    try {
      text = fs.readFileSync(absolutePath, "utf8");
    } catch (error) {
      throw new Error(`Failed to read "${fileRef}" (${absolutePath}): ${error.message}`);
    }

    cache.set(fileRef, {
      fileRef,
      absolutePath,
      text,
      scriptText: readScriptText(fileRef, text),
    });
  }

  return cache;
}

function readScriptText(fileRef, text) {
  if (path.extname(fileRef).toLowerCase() === ".js") {
    return text;
  }

  return extractInlineScript(text);
}

function extractInlineScript(html) {
  const regex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }

  return scripts.join("\n");
}

function checkEntries(kind, entries, fileCache, results) {
  for (const entry of entries) {
    const files = entry.files || [];
    const forbiddenFiles = entry.must_not_appear_in || [];

    if (entry.expected_match) {
      const extracted = [];

      for (const fileRef of files) {
        const source = readSymbol(kind, fileCache.get(fileRef), entry.name);
        if (source == null) {
          results.push({
            type: "MISSING",
            kind,
            name: entry.name,
            file: fileRef,
            message: `${kind} "${entry.name}" was not found in ${fileRef}.`,
          });
          continue;
        }

        extracted.push({ fileRef, source });
      }

      if (extracted.length >= 2) {
        const baseline = extracted[0];
        for (let index = 1; index < extracted.length; index += 1) {
          const candidate = extracted[index];
          if (normalizeForComparison(kind, baseline.source) !== normalizeForComparison(kind, candidate.source)) {
            results.push({
              type: "MISMATCH",
              kind,
              name: entry.name,
              baselineFile: baseline.fileRef,
              candidateFile: candidate.fileRef,
              baselineSource: baseline.source,
              candidateSource: candidate.source,
            });
          }
        }
      }
    }

    for (const fileRef of forbiddenFiles) {
      const source = readSymbol(kind, fileCache.get(fileRef), entry.name);
      if (source != null) {
        results.push({
          type: "UNEXPECTED_PRESENCE",
          kind,
          name: entry.name,
          file: fileRef,
          message: `${kind} "${entry.name}" unexpectedly appears in ${fileRef}.`,
        });
      }
    }
  }
}

function readSymbol(kind, fileEntry, name) {
  if (!fileEntry) {
    return null;
  }

  if (kind === "constant") {
    return extractConstantValue(fileEntry.scriptText, name);
  }

  if (kind === "function") {
    return extractFunctionSource(fileEntry.scriptText, name);
  }

  throw new Error(`Unsupported kind: ${kind}`);
}

function extractConstantValue(scriptText, constantName) {
  const regex = new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(constantName)}\\s*=`, "g");
  const match = regex.exec(scriptText);
  if (!match) {
    return null;
  }

  const valueStart = regex.lastIndex;
  const valueEnd = findStatementEnd(scriptText, valueStart);
  if (valueEnd === -1) {
    throw new Error(`Unable to parse constant "${constantName}".`);
  }

  return scriptText.slice(valueStart, valueEnd).trim();
}

function extractFunctionSource(scriptText, functionName) {
  const regex = new RegExp(`\\bfunction\\s+${escapeRegExp(functionName)}\\s*\\(`, "g");
  const match = regex.exec(scriptText);
  if (!match) {
    return null;
  }

  const functionStart = match.index;
  const openParen = scriptText.indexOf("(", functionStart);
  const closeParen = findMatchingBracket(scriptText, openParen, "(", ")");
  const openBrace = findNextSignificantIndex(scriptText, closeParen + 1);

  if (openBrace === -1 || scriptText[openBrace] !== "{") {
    throw new Error(`Unable to locate body for function "${functionName}".`);
  }

  const closeBrace = findMatchingBracket(scriptText, openBrace, "{", "}");
  return scriptText.slice(functionStart, closeBrace + 1).trim();
}

function findStatementEnd(text, startIndex) {
  const stack = [];

  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    const char = text[index];

    if (char === "(" || char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === ")" || char === "}" || char === "]") {
      stack.pop();
      continue;
    }

    if (char === ";" && stack.length === 0) {
      return index;
    }
  }

  return -1;
}

function findMatchingBracket(text, startIndex, openChar, closeChar) {
  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    const char = text[index];
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`Unbalanced "${openChar}${closeChar}" pair while parsing source.`);
}

function findNextSignificantIndex(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    if (!/\s/.test(text[index])) {
      return index;
    }
  }

  return -1;
}

function consumeNonCode(text, index) {
  const char = text[index];
  const nextChar = text[index + 1];

  if (char === "'" || char === '"' || char === "`") {
    return skipStringLiteral(text, index, char);
  }

  if (char === "/" && nextChar === "/") {
    let cursor = index + 2;
    while (cursor < text.length && text[cursor] !== "\n") {
      cursor += 1;
    }
    return cursor;
  }

  if (char === "/" && nextChar === "*") {
    const closeIndex = text.indexOf("*/", index + 2);
    if (closeIndex === -1) {
      throw new Error("Unterminated block comment while parsing source.");
    }
    return closeIndex + 2;
  }

  return index;
}

function skipStringLiteral(text, startIndex, quote) {
  let index = startIndex + 1;

  while (index < text.length) {
    const char = text[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (quote === "`" && char === "$" && text[index + 1] === "{") {
      index = skipTemplateExpression(text, index + 2);
      continue;
    }

    if (char === quote) {
      return index + 1;
    }

    index += 1;
  }

  throw new Error("Unterminated string literal while parsing source.");
}

function skipTemplateExpression(text, startIndex) {
  let depth = 1;

  for (let index = startIndex; index < text.length; index += 1) {
    const advance = consumeNonCode(text, index);
    if (advance > index) {
      index = advance - 1;
      continue;
    }

    if (text[index] === "{") {
      depth += 1;
      continue;
    }

    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error("Unterminated template expression while parsing source.");
}

function normalizeForComparison(kind, source) {
  const normalized = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();

  if (kind === "constant") {
    return normalized;
  }

  return normalized;
}

function formatResult(result) {
  if (result.type !== "MISMATCH") {
    return `${result.type} [${result.kind}] ${result.name}: ${result.message}`;
  }

  const baselineFingerprint = fingerprint(result.baselineSource);
  const candidateFingerprint = fingerprint(result.candidateSource);
  const diff = firstDiffSummary(result.baselineSource, result.candidateSource);

  return [
    `${result.type} [${result.kind}] ${result.name}:`,
    `  baseline:  ${result.baselineFile} (${baselineFingerprint})`,
    `  candidate: ${result.candidateFile} (${candidateFingerprint})`,
    `  first diff: ${diff}`,
  ].join("\n");
}

function fingerprint(source) {
  const hash = crypto.createHash("sha1").update(source).digest("hex").slice(0, 10);
  const lineCount = normalizeForComparison("function", source).split("\n").length;
  return `${hash}, ${lineCount} line(s)`;
}

function firstDiffSummary(left, right) {
  const leftLines = normalizeForComparison("function", left).split("\n");
  const rightLines = normalizeForComparison("function", right).split("\n");
  const maxLength = Math.max(leftLines.length, rightLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    if ((leftLines[index] || "") !== (rightLines[index] || "")) {
      return `line ${index + 1}: "${previewLine(leftLines[index])}" vs "${previewLine(rightLines[index])}"`;
    }
  }

  return "normalized content differs, but no line-level delta was isolated.";
}

function previewLine(line) {
  const text = (line || "").trim();
  if (!text) {
    return "<blank>";
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
