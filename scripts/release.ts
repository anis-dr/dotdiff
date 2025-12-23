/**
 * Release script for publishing to npm.
 * 
 * This is called by changesets after version bump.
 * It publishes the main package, then triggers the
 * platform binary builds via GitHub Actions.
 */

import { $ } from "bun";

async function main() {
  console.log("Publishing main package to npm...\n");

  // Publish main package with provenance
  await $`npm publish --access public --provenance`;

  console.log("\n✓ Main package published");
  console.log("  Platform binaries will be built and published by GitHub Actions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};

