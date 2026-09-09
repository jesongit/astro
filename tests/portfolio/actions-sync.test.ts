import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const { buildSnapshot, run } = await import("../../scripts/portfolio/sync.mjs");
const { emptyState, readState, stableStringify, writeState } =
  await import("../../scripts/portfolio/state.mjs");

const NOW = Date.parse("2026-09-09T12:00:00.000Z");
const REPO = "jesongit/demo";
const REPO_ID = 1001;

const repository = {
  id: REPO_ID,
  node_id: "node-demo",
  name: "demo",
  full_name: REPO,
  private: false,
  owner: { login: "jesongit" },
  description: "A real demo",
  default_branch: "main",
  topics: ["astro"],
  language: "TypeScript",
  stargazers_count: 7,
  license: { spdx_id: "MIT" },
  homepage: "",
  archived: false,
};

const configText = JSON.stringify({
  schemaVersion: 1,
  title: "Enhanced demo",
  features: ["Stable sync"],
  bodyFile: ".portfolio/overview.md",
});

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ETag: '"stable"',
      ...init.headers,
    },
    ...init,
  });

const contents = (text: string, path: string) => ({
  content: Buffer.from(text, "utf8").toString("base64"),
  encoding: "base64",
  size: Buffer.byteLength(text),
  path,
  sha: `sha-${path}`,
});

const release = {
  tag_name: "v2.0.0",
  published_at: "2026-09-01T00:00:00.000Z",
  html_url: `https://github.com/${REPO}/releases/tag/v2.0.0`,
  zipball_url: `https://github.com/${REPO}/zipball/v2.0.0`,
  tarball_url: `https://github.com/${REPO}/tarball/v2.0.0`,
  assets_url: "https://api.github.com/repos/jesongit/demo/releases/7/assets",
  assets: [],
  body: "## Notes\n\nPublished.",
};

const makeRepoFetch = ({
  listFailure = false,
  withEtags = false,
  repositoryFailureStatus = null,
} = {}) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const conditional =
      withEtags && Boolean(new Headers(init?.headers).get("If-None-Match"));
    if (pathname === "/users/jesongit/repos") {
      if (listFailure && parsed.searchParams.get("page") === "2") {
        return new Response("upstream", { status: 500 });
      }
      const page = parsed.searchParams.get("page");
      if (page === "1") {
        return jsonResponse(
          [
            {
              id: REPO_ID,
              node_id: "node-demo",
              full_name: REPO,
              private: false,
            },
          ],
          {
            headers: {
              Link: '<https://api.github.com/users/jesongit/repos?type=owner&per_page=100&sort=full_name&page=2>; rel="next"',
            },
          }
        );
      }
      return jsonResponse([]);
    }
    if (pathname === `/repos/${REPO}`) {
      if (repositoryFailureStatus)
        return new Response("upstream", { status: repositoryFailureStatus });
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse(repository);
    }
    if (pathname === `/repos/${REPO}/commits/main`) {
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse({ sha: "commit-1" });
    }
    if (pathname === `/repos/${REPO}/readme`) {
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse(contents("# Demo\n\nREADME text", "README.md"));
    }
    if (pathname === `/repos/${REPO}/contents/.portfolio/portfolio.json`) {
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse(contents(configText, ".portfolio/portfolio.json"));
    }
    if (pathname === `/repos/${REPO}/contents/.portfolio/overview.md`) {
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse(
            contents("# Enhanced\n\nBody", ".portfolio/overview.md")
          );
    }
    if (pathname === `/repos/${REPO}/releases/latest`) {
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse(release);
    }
    if (
      pathname === `/repos/${REPO}/releases/7/assets` &&
      parsed.searchParams.get("page") === "2"
    ) {
      return jsonResponse([
        {
          name: "demo-linux.AppImage",
          state: "uploaded",
          size: 20,
          browser_download_url:
            "https://github.com/jesongit/demo/releases/download/v2.0.0/demo-linux.AppImage",
        },
      ]);
    }
    if (pathname === `/repos/${REPO}/releases/7/assets`) {
      return conditional
        ? new Response(null, { status: 304 })
        : jsonResponse(
            [
              {
                name: "demo-win.exe",
                state: "uploaded",
                size: 10,
                browser_download_url:
                  "https://github.com/jesongit/demo/releases/download/v2.0.0/demo-win.exe",
              },
            ],
            {
              headers: {
                Link: '<https://api.github.com/repos/jesongit/demo/releases/7/assets?page=2>; rel="next"',
              },
            }
          );
    }
    throw new Error(`unexpected test URL ${url}`);
  };
  return { fetchImpl, calls };
};

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function temporaryState() {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-actions-"));
  directories.push(directory);
  return {
    directory,
    statePath: join(directory, "state.json"),
    outputPath: join(directory, "snapshot.json"),
  };
}

describe("portfolio Actions sync", () => {
  it("follows Link pagination, deduplicates inventory, and builds a public snapshot", async () => {
    const paths = await temporaryState();
    const state = emptyState({ owner: "jesongit", ownerType: "user" });
    state.settings[String(REPO_ID)] = {
      repoId: String(REPO_ID),
      visible: true,
      featured: false,
      order: 10,
      acknowledgedIncidentId: null,
    };
    await writeState(paths.statePath, state);
    const { fetchImpl, calls } = makeRepoFetch();

    const result = await run({
      command: "full",
      statePath: paths.statePath,
      outputPath: paths.outputPath,
      fetchImpl,
      now: NOW,
      token: "test-token",
    });
    expect(result.complete).toBe(true);
    expect(result.processed).toBe(1);
    expect(
      calls.filter(item => item.url.includes("/users/jesongit/repos")).length
    ).toBe(2);

    const built = await run({
      command: "build",
      statePath: paths.statePath,
      outputPath: paths.outputPath,
      now: NOW + 60_000,
    });
    expect(built.projects).toBe(1);
    const snapshot = JSON.parse(await readFile(paths.outputPath, "utf8"));
    expect(snapshot.projects[0].slug).toBe("gh-1001");
    expect(snapshot.projects[0].title).toBe("Enhanced demo");
    expect(
      snapshot.projects[0].release.assets.map(
        (item: { platform: string }) => item.platform
      )
    ).toEqual(["linux", "windows"]);
    const unchanged = await run({
      command: "build",
      statePath: paths.statePath,
      outputPath: paths.outputPath,
      now: NOW + 60_000,
    });
    expect(unchanged.changed).toBe(false);
  });

  it("uses cached bodies on 304 and produces no token in persisted state", async () => {
    const paths = await temporaryState();
    const state = emptyState({ owner: "jesongit", ownerType: "user" });
    state.inventory = {
      schemaVersion: 1,
      runId: "seed",
      completed: true,
      observedAt: new Date(NOW).toISOString(),
      repos: [{ repoId: String(REPO_ID), fullName: REPO, nodeId: "node-demo" }],
    };
    state.settings[String(REPO_ID)] = {
      repoId: String(REPO_ID),
      visible: true,
      featured: false,
      order: 0,
      acknowledgedIncidentId: null,
    };
    await writeState(paths.statePath, state);
    const first = makeRepoFetch({ withEtags: false });
    await run({
      command: "repo",
      target: String(REPO_ID),
      statePath: paths.statePath,
      fetchImpl: first.fetchImpl,
      now: NOW,
    });
    const second = makeRepoFetch({ withEtags: true });
    const result = await run({
      command: "repo",
      target: String(REPO_ID),
      statePath: paths.statePath,
      fetchImpl: second.fetchImpl,
      now: NOW,
    });
    expect(result.complete).toBe(true);
    expect(
      second.calls.some(item =>
        new Headers(item.init?.headers).has("If-None-Match")
      )
    ).toBe(true);
    const cachedState = await readState(paths.statePath, {
      owner: "jesongit",
      ownerType: "user",
    });
    expect(
      cachedState.state.records[String(REPO_ID)].content.release.assets
    ).toHaveLength(2);
    const raw = await readFile(paths.statePath, "utf8");
    expect(raw).not.toContain("test-token");
    const cacheEntries = Object.values(cachedState.state.httpCache ?? {}) as {
      headers?: Record<string, string | null>;
    }[];
    expect(
      cacheEntries.some(entry =>
        Object.keys(entry.headers ?? {}).some(
          key => key.toLowerCase() === "authorization"
        )
      )
    ).toBe(false);
  });

  it("retains the last complete inventory when a later full enumeration is interrupted", async () => {
    const paths = await temporaryState();
    const state = emptyState({ owner: "jesongit", ownerType: "user" });
    state.inventory = {
      schemaVersion: 1,
      runId: "previous",
      completed: true,
      observedAt: new Date(NOW - 60_000).toISOString(),
      repos: [{ repoId: String(REPO_ID), fullName: REPO, nodeId: "node-demo" }],
    };
    await writeState(paths.statePath, state);
    const result = await run({
      command: "full",
      statePath: paths.statePath,
      fetchImpl: makeRepoFetch({ listFailure: true }).fetchImpl,
      now: NOW,
    });
    expect(result.complete).toBe(false);
    const loaded = await readState(paths.statePath, {
      owner: "jesongit",
      ownerType: "user",
    });
    expect(loaded.state.inventory?.runId).toBe("previous");
    expect(() =>
      buildSnapshot(
        {
          ...loaded.state,
          inventory: { ...loaded.state.inventory!, completed: false },
        },
        { now: NOW }
      )
    ).toThrow("inventory_incomplete");
  });

  it("keeps a full run usable when one repository is unavailable upstream", async () => {
    const paths = await temporaryState();
    const result = await run({
      command: "full",
      statePath: paths.statePath,
      outputPath: paths.outputPath,
      fetchImpl: makeRepoFetch({ repositoryFailureStatus: 451 }).fetchImpl,
      now: NOW,
    });

    expect(result.complete).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.warnings).toContain("identity_unresolved");
    const loaded = await readState(paths.statePath, {
      owner: "jesongit",
      ownerType: "user",
    });
    expect(loaded.state.inventory?.completed).toBe(true);
    expect(loaded.state.records[String(REPO_ID)]?.nodeId).toBe("node-demo");
    expect(loaded.state.records[String(REPO_ID)]?.eligibility).toBe(
      "unknown"
    );
  });

  it("keeps stable JSON ordering for equivalent state objects", () => {
    expect(stableStringify({ z: 1, a: { d: 2, c: 1 } })).toBe(
      stableStringify({ a: { c: 1, d: 2 }, z: 1 })
    );
  });

  it("removes a stale release from the public projection after 24 hours", () => {
    const state = emptyState({ owner: "jesongit", ownerType: "user" });
    state.inventory = {
      schemaVersion: 1,
      runId: "r1",
      completed: true,
      observedAt: new Date(NOW).toISOString(),
      repos: [],
    };
    state.settings["1"] = {
      repoId: "1",
      visible: true,
      featured: false,
      order: 0,
      acknowledgedIncidentId: null,
    };
    state.records["1"] = {
      repoId: "1",
      eligibility: "public",
      lastPublicVerifiedAt: new Date(NOW + 24 * 60 * 60_000).toISOString(),
      payloadHash: "hash",
      releaseState: "stale",
      releaseLastSuccessAt: new Date(NOW).toISOString(),
      content: {
        schemaVersion: 1,
        title: "Demo",
        summary: "Summary",
        bodyHtml: "",
        bodyTextPlain: "",
        features: [],
        techStack: [],
        topics: [],
        links: { github: `https://github.com/${REPO}` },
        github: {
          fullName: REPO,
          url: `https://github.com/${REPO}`,
          stars: 0,
          license: null,
          language: null,
        },
        release: {
          tagName: "v1",
          publishedAt: "",
          notes: [],
          assets: [],
          releaseUrl: "",
        },
        additionalDownloads: [],
        screenshots: [],
        sanitizerVersion: "md-v1",
      },
    };
    const snapshot = buildSnapshot(state, {
      now: NOW + 24 * 60 * 60_000 + 1,
    });
    expect(snapshot.projects[0].release).toBeNull();
  });
});
