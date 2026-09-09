import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GitHubAdminClient,
  SettingsConflictError,
  getGitHubAdminConfig,
  parseSettingsFile,
  serializeSettingsFile,
} from "../../src/lib/admin/github";

const config = {
  token: "server-only-test-token",
  owner: "jesongit",
  repo: "astro",
  branch: "main",
  settingsPath: "data/portfolio/settings.json",
  workflow: "portfolio-sync.yml",
  apiVersion: "2022-11-28",
};

function encode(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function settingsResponse(sha: string, data = { version: 1, repos: {} }) {
  return new Response(
    JSON.stringify({
      type: "file",
      sha,
      content: encode(JSON.stringify(data)),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

afterEach(() => vi.restoreAllMocks());

describe("GitHub admin settings integration", () => {
  it("reads and updates the Contents file with the current SHA", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        settingsResponse("old-sha", {
          version: 1,
          repos: { "101": { visible: false, featured: false, order: 1000 } },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: { sha: "new-sha" },
            commit: { sha: "commit-sha" },
          }),
          { status: 200 }
        )
      );
    const client = new GitHubAdminClient(config, fetchImpl);

    const result = await client.saveSettings(
      { "101": { visible: true }, "202": { order: 5 } },
      "old-sha"
    );

    expect(result).toMatchObject({
      committed: true,
      sha: "new-sha",
      commitSha: "commit-sha",
      changedRepoIds: ["101", "202"],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const put = fetchImpl.mock.calls[1]![1]!;
    const body = JSON.parse(String(put.body)) as {
      sha: string;
      branch: string;
      content: string;
    };
    expect(body.sha).toBe("old-sha");
    expect(body.branch).toBe("main");
    expect(
      JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(body.content), c => c.charCodeAt(0))
        )
      )
    ).toEqual({
      version: 1,
      repos: {
        "101": {
          visible: true,
          featured: false,
          order: 1000,
          acknowledgedIncidentId: null,
        },
        "202": {
          visible: false,
          featured: false,
          order: 5,
          acknowledgedIncidentId: null,
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain(config.token);
  });

  it("does not commit an empty patch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      settingsResponse("same-sha", {
        version: 1,
        repos: { "101": { visible: true, featured: false, order: 1000 } },
      })
    );
    const client = new GitHubAdminClient(config, fetchImpl);

    const result = await client.saveSettings({}, "same-sha");

    expect(result.committed).toBe(false);
    expect(result.changedRepoIds).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("commits only the dirty repository entries", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        settingsResponse("same-sha", {
          version: 1,
          repos: { "101": { visible: true, featured: false, order: 1000 } },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: { sha: "new-sha" },
            commit: { sha: "commit-sha" },
          }),
          { status: 200 }
        )
      );
    const client = new GitHubAdminClient(config, fetchImpl);
    const result = await client.saveSettings(
      { "101": { visible: true }, "202": {} },
      "same-sha"
    );
    expect(result.committed).toBe(true);
    expect(result.changedRepoIds).toEqual(["202"]);
    expect(result.unchangedRepoIds).toEqual(["101"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects a stale file SHA before issuing a PUT", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(settingsResponse("actual-sha"));
    const client = new GitHubAdminClient(config, fetchImpl);

    await expect(
      client.saveSettings({ "101": { visible: true } }, "old-sha")
    ).rejects.toBeInstanceOf(SettingsConflictError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("dispatches a workflow with a constrained scope and normalizes run states", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 9001,
            status: "completed",
            conclusion: "success",
            workflow_id: 44,
            head_branch: "main",
            html_url: "https://github.com/jesongit/astro/actions/runs/9001",
            run_number: 12,
            created_at: "2026-09-09T06:00:00Z",
            updated_at: "2026-09-09T06:01:00Z",
          }),
          { status: 200 }
        )
      );
    const client = new GitHubAdminClient(config, fetchImpl);

    const dispatched = await client.dispatchWorkflow({
      kind: "repo",
      repoId: "101",
    });
    const run = await client.getWorkflowRun("9001");

    expect(dispatched).toMatchObject({
      state: "queued",
      runId: null,
      scope: { kind: "repo", repoId: "101" },
    });
    expect(run).toMatchObject({
      runId: "9001",
      state: "succeeded",
      conclusion: "success",
    });
    const dispatchBody = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(dispatchBody).toEqual({
      ref: "main",
      inputs: { scope: "repo", repoId: "101" },
    });
  });
});

describe("GitHub settings format and configuration", () => {
  it("keeps stable numeric repository order and rejects unknown fields", () => {
    const text = serializeSettingsFile({
      sha: null,
      version: 1,
      repos: {
        "20": {
          visible: false,
          featured: false,
          order: 1000,
          acknowledgedIncidentId: null,
        },
        "3": {
          visible: true,
          featured: false,
          order: 2,
          acknowledgedIncidentId: null,
        },
      },
    });
    expect(text.indexOf('"3"')).toBeLessThan(text.indexOf('"20"'));
    expect(parseSettingsFile(text).repos["3"]?.visible).toBe(true);
    expect(() =>
      parseSettingsFile('{"version":1,"repos":{"3":{"token":"x"}}}')
    ).toThrow();
  });

  it("accepts only server-side token configuration", () => {
    expect(getGitHubAdminConfig({})).toBeNull();
    expect(
      getGitHubAdminConfig({
        GITHUB_TOKEN: "secret-value",
        GITHUB_REPOSITORY: "jesongit/astro",
      })
    ).toMatchObject({ owner: "jesongit", repo: "astro", branch: "main" });
    expect(
      getGitHubAdminConfig({
        GITHUB_TOKEN: "x",
        GITHUB_REPOSITORY: "bad/path/extra",
      })
    ).toBeNull();
  });
});
