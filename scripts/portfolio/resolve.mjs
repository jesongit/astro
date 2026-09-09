#!/usr/bin/env node

const modes = new Set(["full", "repo", "build"]);
const event = process.env.WORKFLOW_EVENT || process.env.GITHUB_EVENT_NAME;
const mode =
  event === "schedule" ? "full" : process.env.REQUESTED_MODE || "build";
if (!modes.has(mode)) throw new Error("mode must be full, repo, or build");

const repoId = process.env.REQUESTED_REPO_ID || "";
if (mode === "repo" && !/^\d{1,12}$/.test(repoId)) {
  throw new Error("repo_id must be a GitHub numeric repository ID");
}

const output = process.env.GITHUB_OUTPUT;
if (output) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    output,
    `mode=${mode}\nrepo_id=${mode === "repo" ? repoId : ""}\n`
  );
}
console.log(`Resolved workflow mode: ${mode}${repoId ? ` (${repoId})` : ""}`);
