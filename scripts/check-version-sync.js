#!/usr/bin/env node

/**
 * Smoke test to verify CLI version matches package.json version
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Read version from package.json
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf8")
  );
  const packageVersion = packageJson.version;

  // Get version from CLI
  const cliVersion = execSync("node bin/mdchat.js --version", {
    cwd: join(__dirname, ".."),
    encoding: "utf8",
  }).trim();

  // Compare versions
  if (packageVersion === cliVersion) {
    console.log(`✔ Version sync check passed: ${packageVersion}`);
    process.exit(0);
  } else {
    console.error(
      `❌ Version mismatch!\n  package.json: ${packageVersion}\n  CLI output:   ${cliVersion}`
    );
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error checking version sync:", error.message);
  process.exit(1);
}
