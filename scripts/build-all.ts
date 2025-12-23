/**
 * Cross-platform build script for dotdiff.
 *
 * NOTE: Due to OpenTUI's platform-specific native bindings, cross-compilation
 * is NOT supported. This script builds only for the current platform locally.
 * Full cross-platform builds happen in GitHub Actions on native runners.
 *
 * In CI, pass --target to build for a specific platform.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type BunTarget =
  | "bun-darwin-arm64"
  | "bun-darwin-x64"
  | "bun-linux-arm64"
  | "bun-linux-x64"
  | "bun-windows-x64";

interface Platform {
  target: BunTarget;
  outDir: string;
  binaryName: string;
  nodeOs: string;
  nodeArch: string;
}

const ALL_PLATFORMS: Array<Platform> = [
  { target: "bun-darwin-arm64", outDir: "darwin-arm64", binaryName: "dotdiff", nodeOs: "darwin", nodeArch: "arm64" },
  { target: "bun-darwin-x64", outDir: "darwin-x64", binaryName: "dotdiff", nodeOs: "darwin", nodeArch: "x64" },
  { target: "bun-linux-arm64", outDir: "linux-arm64", binaryName: "dotdiff", nodeOs: "linux", nodeArch: "arm64" },
  { target: "bun-linux-x64", outDir: "linux-x64", binaryName: "dotdiff", nodeOs: "linux", nodeArch: "x64" },
  { target: "bun-windows-x64", outDir: "win32-x64", binaryName: "dotdiff.exe", nodeOs: "win32", nodeArch: "x64" },
];

const DIST_DIR = "dist";

function getCurrentPlatform(): Platform | undefined {
  return ALL_PLATFORMS.find(
    (p) => p.nodeOs === process.platform && p.nodeArch === process.arch,
  );
}

function getPlatformByTarget(target: string): Platform | undefined {
  return ALL_PLATFORMS.find((p) => p.target === target);
}

async function buildPlatform(platform: Platform): Promise<void> {
  const outDir = join(DIST_DIR, platform.outDir);
  const outFile = join(outDir, platform.binaryName);

  // Ensure output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  console.log(`Building for ${platform.target}...`);

  // Platform-specific targets only available via CLI, not Bun.build() API
  const result = await Bun
    .$`bun build ./src/index.tsx --compile --target ${platform.target} --minify --define process.env.NODE_ENV="production" --outfile ${outFile}`
    .quiet();

  if (result.exitCode !== 0) {
    console.error(`Build failed for ${platform.target}:`);
    console.error(result.stderr.toString());
    throw new Error(`Build failed for ${platform.target}`);
  }

  console.log(`  ✓ ${outFile}`);
}

async function main() {
  // Check for --target flag (used in CI)
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const targetValue = targetArg?.split("=")[1];

  let platformsToBuild: Array<Platform>;

  if (targetValue) {
    // Build specific target (CI mode)
    const platform = getPlatformByTarget(targetValue);
    if (!platform) {
      console.error(`Unknown target: ${targetValue}`);
      console.error(`Available targets: ${ALL_PLATFORMS.map((p) => p.target).join(", ")}`);
      process.exit(1);
    }
    platformsToBuild = [platform];
  } else {
    // Build current platform only (local mode)
    const currentPlatform = getCurrentPlatform();
    if (!currentPlatform) {
      console.error(`Unsupported platform: ${process.platform}-${process.arch}`);
      process.exit(1);
    }
    platformsToBuild = [currentPlatform];
    console.log(`Building for current platform only (${currentPlatform.target})...`);
    console.log(`Note: Cross-compilation not supported due to native dependencies.`);
    console.log(`Full cross-platform builds happen in GitHub Actions.\n`);
  }

  // Ensure dist directory exists
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  // Build platforms
  for (const platform of platformsToBuild) {
    await buildPlatform(platform);
  }

  console.log(`\n✓ Build complete`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
