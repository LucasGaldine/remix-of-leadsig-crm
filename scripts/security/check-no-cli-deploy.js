#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const targetFiles = [
  "package.json",
  "Makefile",
  ".github/workflows",
  ".husky",
  "scripts",
];

const forbiddenPatterns = [
  /\bvercel(?:\s+deploy|\s+--prod)?\b/i,
  /\bnetlify(?:\s+deploy)?\b/i,
  /\bfirebase\s+deploy\b/i,
  /\bwrangler\s+deploy\b/i,
  /\bflyctl?\s+deploy\b/i,
  /\brailway\s+up\b/i,
  /\brender\s+deploy\b/i,
  /\bsupabase\s+functions\s+deploy\b/i,
  /\bsupabase\s+db\s+push\b/i,
];

const shouldScanFile = (filePath) => {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".json") ||
    lower.endsWith(".js") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs") ||
    lower.endsWith(".sh") ||
    lower.endsWith("makefile") ||
    lower.endsWith(".mk")
  );
};

const walk = (entry, files) => {
  if (!fs.existsSync(entry)) return;
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    if (shouldScanFile(entry)) files.push(entry);
    return;
  }

  for (const name of fs.readdirSync(entry)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    walk(path.join(entry, name), files);
  }
};

const filesToScan = [];
for (const rel of targetFiles) {
  walk(path.join(root, rel), filesToScan);
}

const violations = [];

for (const filePath of filesToScan) {
  const text = fs.readFileSync(filePath, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      violations.push({
        file: path.relative(root, filePath),
        pattern: pattern.toString(),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Deploy policy violation: forbidden CLI deploy command found.");
  for (const violation of violations) {
    console.error(`- ${violation.file} matches ${violation.pattern}`);
  }
  process.exit(1);
}

console.log("Deploy policy check passed.");
