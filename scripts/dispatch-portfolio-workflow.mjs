#!/usr/bin/env node
/**
 * Dispatch the repository workflow and print the resulting run ID.
 *
 * GitHub's workflow_dispatch endpoint acknowledges the request with 204 and
 * does not return a run object.  We therefore poll the workflow's run list
 * and return the first newly-created workflow_dispatch run for the same ref.
 * The access token is read from the environment and is never printed.
 */
import { spawnSync } from "node:child_process";

const DEFAULT_WORKFLOW = "portfolio.yml";
const API_VERSION = "2022-11-28";

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      values.help = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2).replaceAll("-", "_");
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }
    values[key] = value;
    index += 1;
  }
  return values;
}

function repositoryFromRemote() {
  const result = spawnSync("git", ["config", "--get", "remote.origin.url"], {
    encoding: "utf8",
  });
  const remote = (result.stdout || "").trim();
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
  if (!match) throw new Error("set GITHUB_REPOSITORY to owner/repository");
  return match[1];
}

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("repository must be owner/repository");
  }
  return repository;
}

function validateMode(mode) {
  if (!new Set(["full", "repo", "build"]).has(mode)) {
    throw new Error("mode must be full, repo, or build");
  }
  return mode;
}

function validateRepoId(repoId) {
  if (repoId !== undefined && !/^\d{1,12}$/.test(repoId)) {
    throw new Error("repo_id must be a GitHub numeric repository ID");
  }
  return repoId;
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function waitForRun({
  repository,
  workflow,
  ref,
  startedAt,
  timeoutSeconds,
}) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "portfolio-workflow-dispatch",
  };
  const url =
    `https://api.github.com/repos/${repository}/actions/workflows/` +
    `${encodeURIComponent(workflow)}/runs?event=workflow_dispatch&branch=` +
    `${encodeURIComponent(ref)}&per_page=20`;

  while (Date.now() < deadline) {
    const payload = await request(url, { headers });
    const runs = Array.isArray(payload?.workflow_runs)
      ? payload.workflow_runs
      : [];
    const run = runs
      .filter(item => item?.event === "workflow_dispatch")
      .filter(item => item?.head_branch === ref)
      .filter(item => Date.parse(item.created_at) >= startedAt - 30_000)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
    if (run) return run;
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error("workflow dispatched, but no run ID appeared before timeout");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: node scripts/dispatch-portfolio-workflow.mjs " +
        "--mode full|repo|build [--repo-id ID] [--ref REF]"
    );
    return;
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error("set GITHUB_TOKEN or GH_TOKEN");

  const repository = validateRepository(
    process.env.GITHUB_REPOSITORY || args.repository || repositoryFromRemote()
  );
  const workflow =
    args.workflow || process.env.PORTFOLIO_WORKFLOW || DEFAULT_WORKFLOW;
  const ref = args.ref || process.env.PORTFOLIO_WORKFLOW_REF || "main";
  const mode = validateMode(args.mode || "build");
  const repoId = validateRepoId(args.repo_id);
  if (mode === "repo" && !repoId) {
    throw new Error("--repo-id is required when --mode repo is selected");
  }

  const timeoutSeconds = Number(args.timeout_seconds || "90");
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 5) {
    throw new Error("timeout-seconds must be at least 5 seconds");
  }

  const startedAt = Date.now();
  await request(
    `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "portfolio-workflow-dispatch",
      },
      body: JSON.stringify({
        ref,
        inputs: { mode, repo_id: repoId || "", deploy: "false" },
      }),
    }
  );

  const run = await waitForRun({
    repository,
    workflow,
    ref,
    startedAt,
    timeoutSeconds,
  });
  console.log(JSON.stringify({ run_id: run.id, html_url: run.html_url }));
}

try {
  await main();
} catch (error) {
  console.error(
    `portfolio workflow dispatch: ${
      error instanceof Error ? error.message : "unexpected error"
    }`
  );
  process.exitCode = 1;
}
