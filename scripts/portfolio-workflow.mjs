#!/usr/bin/env node
/**
 * Glue for the GitHub Portfolio workflow.
 *
 * The deployed Sync Worker is the data producer.  This script writes only a
 * v1:request:* record to the existing JOBS KV binding, then waits for the
 * Worker to publish a v1:result:* record.  It deliberately does not call the
 * protected admin API, write CONTROL, or expose a new Worker HTTP endpoint.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = process.env.PORTFOLIO_WRANGLER_CONFIG || "wrangler.jsonc";
const BINDING = "PORTFOLIO_JOBS";
const TERMINAL_STATES = new Set([
  "succeeded",
  "partial",
  "failed",
  "expired",
  "interrupted",
]);
const VALID_MODES = new Set(["full", "repo", "build"]);

const sleep = ms =>
  new Promise(resolvePromise => setTimeout(resolvePromise, ms));

function fail(message) {
  console.error(`portfolio workflow: ${message}`);
  process.exitCode = 1;
}

function validateMode(mode) {
  if (!VALID_MODES.has(mode)) {
    throw new Error("mode must be full, repo, or build");
  }
  return mode;
}

function validateRepoId(repoId) {
  if (!/^\d{1,12}$/.test(repoId ?? "")) {
    throw new Error("repo_id must be a GitHub numeric repository ID");
  }
  return repoId;
}

function writeOutput(values) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  writeFileSync(output, `${lines.join("\n")}\n`, { flag: "a" });
}

function resolveMode() {
  const event = process.env.WORKFLOW_EVENT || process.env.GITHUB_EVENT_NAME;
  // The Worker already owns the every-minute tick and its hourly content
  // cadence.  The GitHub hourly schedule is build-only to avoid a duplicate
  // full sync; full/repo remain explicit manual workflow_dispatch modes.
  const mode =
    event === "schedule"
      ? "build"
      : process.env.REQUESTED_MODE || process.env.PORTFOLIO_MODE || "build";
  validateMode(mode);

  const requestedRepoId =
    process.env.REQUESTED_REPO_ID || process.env.PORTFOLIO_REPO_ID || "";
  const repoId = mode === "repo" ? validateRepoId(requestedRepoId) : "";

  writeOutput({ mode, repo_id: repoId });
  console.log(`Resolved workflow mode: ${mode}${repoId ? ` (${repoId})` : ""}`);
}

function commandArgs(args) {
  const configured = isAbsolute(CONFIG) ? CONFIG : join(ROOT, CONFIG);
  const result = [
    ...args,
    "--binding",
    BINDING,
    "--remote",
    "--config",
    configured,
  ];
  const environment = process.env.PORTFOLIO_WRANGLER_ENV || "";
  if (environment && environment !== "production") {
    result.push("--env", environment);
  }
  return result;
}

function runWrangler(args, { tolerateFailure = false } = {}) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...commandArgs(args)], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    if (tolerateFailure) return null;
    throw new Error("Wrangler KV operation failed");
  }
  return { stdout: result.stdout || "" };
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function parseJsonOutput(output, expected) {
  const clean = stripAnsi(output).trim();
  const start = clean.indexOf(expected === "array" ? "[" : "{");
  const end = clean.lastIndexOf(expected === "array" ? "]" : "}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
}

function assertCloudflareAuth() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is not configured");
  }
}

function createJob(mode, repoId) {
  const jobId = crypto.randomUUID();
  const now = Date.now();
  return {
    jobId,
    key: `v1:request:${jobId}`,
    value: {
      schemaVersion: 1,
      jobId,
      scope: mode === "full" ? { kind: "all" } : { kind: "repo", repoId },
      requestedBy: process.env.PORTFOLIO_REQUESTED_BY || "github-actions",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function putJob(job) {
  const tempRoot = mkdtempSync(join(tmpdir(), "portfolio-job-"));
  const valueFile = join(tempRoot, "job.json");
  writeFileSync(valueFile, JSON.stringify(job.value));
  try {
    runWrangler([
      "kv",
      "key",
      "put",
      job.key,
      "--path",
      valueFile,
      "--ttl",
      String(25 * 60 * 60),
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function listResults(jobId) {
  const result = runWrangler(
    ["kv", "key", "list", "--prefix", `v1:result:${jobId}:`],
    { tolerateFailure: true }
  );
  if (!result) return [];
  const keys = parseJsonOutput(result.stdout, "array");
  return Array.isArray(keys)
    ? keys.filter(key => key && typeof key.name === "string")
    : [];
}

function readResult(key) {
  const result = runWrangler(["kv", "key", "get", key.name, "--text"], {
    tolerateFailure: true,
  });
  if (!result) return null;
  const parsed = parseJsonOutput(result.stdout, "object");
  return parsed && typeof parsed.state === "string" ? parsed : null;
}

async function waitForResult(jobId) {
  const timeoutSeconds = Number(
    process.env.PORTFOLIO_SYNC_TIMEOUT_SECONDS || "900"
  );
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10) {
    throw new Error(
      "PORTFOLIO_SYNC_TIMEOUT_SECONDS must be at least 10 seconds"
    );
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const results = listResults(jobId)
      .map(readResult)
      .filter(Boolean)
      .filter(result => result.jobId === jobId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const latest = results[0];
    if (latest && TERMINAL_STATES.has(latest.state)) {
      if (latest.state !== "succeeded") {
        throw new Error(
          `Sync Worker finished with state ${latest.state}; build skipped`
        );
      }
      return latest;
    }
    await sleep(15_000);
  }
  throw new Error("Timed out waiting for the Sync Worker result");
}

async function sync() {
  assertCloudflareAuth();
  const mode = validateMode(process.env.PORTFOLIO_MODE || "");
  if (mode === "build") {
    throw new Error("build mode does not generate portfolio data");
  }
  const repoId =
    mode === "repo" ? validateRepoId(process.env.PORTFOLIO_REPO_ID) : "";
  const job = createJob(mode, repoId);
  putJob(job);
  writeOutput({ job_id: job.jobId });
  console.log(
    `Queued portfolio sync job ${job.jobId}; waiting for Worker result`
  );
  await waitForResult(job.jobId);
  console.log(`Portfolio sync job ${job.jobId} succeeded`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "resolve") {
    resolveMode();
    return;
  }
  if (command === "sync") {
    await sync();
    return;
  }
  if (command === "--help" || command === undefined) {
    console.log(
      "Usage: node scripts/portfolio-workflow.mjs resolve | sync\n" +
        "resolve reads WORKFLOW_EVENT/REQUESTED_MODE/REQUESTED_REPO_ID.\n" +
        "sync reads PORTFOLIO_MODE/PORTFOLIO_REPO_ID and uses remote JOBS KV."
    );
    return;
  }
  void args;
  throw new Error(`unknown command: ${command}`);
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : "unexpected error");
}
