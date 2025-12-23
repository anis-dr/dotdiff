/**
 * Sync version from package.json to optionalDependencies.
 * 
 * Run this after bumping the version to ensure platform packages
 * reference the correct version.
 */

import { readFileSync, writeFileSync } from "node:fs";

const packageJsonPath = "package.json";
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const { version } = packageJson;

// Update optionalDependencies versions
const optionalDeps = packageJson.optionalDependencies || {};
for (const dep of Object.keys(optionalDeps)) {
  if (dep.startsWith("@dotdiff/")) {
    optionalDeps[dep] = version;
  }
}

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

console.log(`✓ Synced optionalDependencies to version ${version}`);

export {};

