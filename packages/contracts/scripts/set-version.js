const { execFileSync } = require("child_process");
const { mkdirSync, writeFileSync } = require("fs");
const path = require("path");

// Prefer the SHA Railway injects at build time; fall back to local git; fall back
// to "unknown" so postinstall never aborts in environments without a .git directory
// (Docker build contexts, downloaded tarballs, npm pack artifacts, etc.).
const getCommitHash = () => {
  if (process.env.RAILWAY_GIT_COMMIT_SHA) {
    return process.env.RAILWAY_GIT_COMMIT_SHA;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "ascii",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unknown";
  }
};

mkdirSync("artifacts", { recursive: true });
writeFileSync(path.join("artifacts", "version"), `${getCommitHash()}\n`);
