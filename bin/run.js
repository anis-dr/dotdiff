#!/usr/bin/env node
/* global console */

/**
 * Platform-aware binary runner for dotdiff.
 *
 * This script detects the current platform and architecture,
 * then executes the appropriate native binary from the optional
 * platform-specific package.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Map Node.js platform/arch to package names
const PLATFORMS = {
  "darwin-arm64": "@dotdiff/darwin-arm64",
  "darwin-x64": "@dotdiff/darwin-x64",
  "linux-arm64": "@dotdiff/linux-arm64",
  "linux-x64": "@dotdiff/linux-x64",
  "win32-x64": "@dotdiff/win32-x64",
};

function getBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;
  const key = `${platform}-${arch}`;

  const packageName = PLATFORMS[key];
  if (!packageName) {
    throw new Error(
      `Unsupported platform: ${platform}-${arch}\n` +
        `Supported platforms: ${Object.keys(PLATFORMS).join(", ")}`,
    );
  }

  try {
    // Try to resolve the platform package
    const packagePath = dirname(require.resolve(`${packageName}/package.json`));
    const binaryName = platform === "win32" ? "dotdiff.exe" : "dotdiff";
    const binaryPath = join(packagePath, "bin", binaryName);

    if (!existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`);
    }

    return binaryPath;
  } catch (err) {
    throw new Error(
      `Could not find binary for ${platform}-${arch}.\n` +
        `Package ${packageName} may not be installed.\n` +
        `Try: npm install ${packageName}\n\n` +
        `Original error: ${err.message}`,
    );
  }
}

try {
  const binaryPath = getBinaryPath();

  // Execute the binary with all arguments passed through
  execFileSync(binaryPath, process.argv.slice(2), {
    stdio: "inherit",
    windowsHide: true,
  });
} catch (err) {
  if (err.status !== undefined) {
    // Binary exited with a status code
    process.exit(err.status);
  }
  console.error(err.message);
  process.exit(1);
}
