/**
 * Generate platform-specific npm packages from built binaries.
 * 
 * This creates package directories with package.json and binaries
 * ready for publishing to npm.
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface PlatformPackage {
  name: string;
  platform: string;
  arch: string;
  binaryName: string;
  distDir: string;
}

const PLATFORMS: PlatformPackage[] = [
  { name: "@dotdiff/darwin-arm64", platform: "darwin", arch: "arm64", binaryName: "dotdiff", distDir: "darwin-arm64" },
  { name: "@dotdiff/darwin-x64", platform: "darwin", arch: "x64", binaryName: "dotdiff", distDir: "darwin-x64" },
  { name: "@dotdiff/linux-arm64", platform: "linux", arch: "arm64", binaryName: "dotdiff", distDir: "linux-arm64" },
  { name: "@dotdiff/linux-x64", platform: "linux", arch: "x64", binaryName: "dotdiff", distDir: "linux-x64" },
  { name: "@dotdiff/win32-x64", platform: "win32", arch: "x64", binaryName: "dotdiff.exe", distDir: "win32-x64" },
];

const PACKAGES_DIR = "packages";
const DIST_DIR = "dist";

// Read version from main package.json
const mainPackageJson = await Bun.file("package.json").json();
const version = mainPackageJson.version;

function createPackageJson(pkg: PlatformPackage): object {
  return {
    name: pkg.name,
    version,
    description: `dotdiff binary for ${pkg.platform}-${pkg.arch}`,
    repository: mainPackageJson.repository,
    homepage: mainPackageJson.homepage,
    bugs: mainPackageJson.bugs,
    license: mainPackageJson.license,
    author: mainPackageJson.author,
    os: [pkg.platform],
    cpu: [pkg.arch],
    files: ["bin"],
    preferUnplugged: true, // For yarn PnP
  };
}

function buildPackage(pkg: PlatformPackage): void {
  const srcBinary = join(DIST_DIR, pkg.distDir, pkg.binaryName);
  const pkgDir = join(PACKAGES_DIR, pkg.distDir);
  const binDir = join(pkgDir, "bin");
  const destBinary = join(binDir, pkg.binaryName);

  // Check if binary exists
  if (!existsSync(srcBinary)) {
    console.warn(`  ⚠ Binary not found: ${srcBinary} (skipping)`);
    return;
  }

  // Create package directory structure
  if (existsSync(pkgDir)) {
    rmSync(pkgDir, { recursive: true });
  }
  mkdirSync(binDir, { recursive: true });

  // Copy binary
  cpSync(srcBinary, destBinary);

  // Write package.json
  const packageJson = createPackageJson(pkg);
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // Write README
  const readme = `# ${pkg.name}

This package contains the \`dotdiff\` binary for ${pkg.platform}-${pkg.arch}.

**Do not install this package directly.** Install the main package instead:

\`\`\`bash
npm install -g dotdiff
\`\`\`

The main package will automatically install the correct binary for your platform.

## About dotdiff

A TUI tool to compare and sync .env files.

See [dotdiff](https://github.com/YOUR_USERNAME/dotdiff) for more information.
`;
  writeFileSync(join(pkgDir, "README.md"), readme);

  console.log(`  ✓ ${pkg.name}`);
}

async function main() {
  console.log(`Building platform packages for version ${version}...\n`);

  // Ensure packages directory exists
  if (!existsSync(PACKAGES_DIR)) {
    mkdirSync(PACKAGES_DIR, { recursive: true });
  }

  // Check if dist directory exists
  if (!existsSync(DIST_DIR)) {
    console.error("Error: dist/ directory not found. Run 'bun run build:all' first.");
    process.exit(1);
  }

  // Build all platform packages
  for (const pkg of PLATFORMS) {
    buildPackage(pkg);
  }

  console.log(`\n✓ Platform packages created in ${PACKAGES_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};

