import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as saveSettings } from "../../src/pages/api/admin/settings";

class MemoryKV {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(options: {
    prefix: string;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
    return {
      keys: [...this.values.keys()]
        .filter(key => key.startsWith(options.prefix))
        .map(name => ({ name })),
      list_complete: true,
    };
  }
}

function encode(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function context(body: unknown, kv = new MemoryKV()) {
  return {
    request: new Request("https://example.com/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    locals: {
      adminIdentity: { email: "admin@example.com", sub: "admin" },
      runtime: {
        env: {
          PORTFOLIO_CACHE: kv,
          PORTFOLIO_JOBS: kv,
          GITHUB_TOKEN: "server-only-token",
          GITHUB_REPOSITORY: "jesongit/astro",
        },
      },
    },
  } as Parameters<NonNullable<typeof saveSettings>>[0];
}

afterEach(() => vi.restoreAllMocks());

describe("batch admin settings route", () => {
  it("writes all dirty entries with one Contents PUT", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_input, init) => {
        if (init?.method === "PUT") {
          return new Response(
            JSON.stringify({
              content: { sha: "new-sha" },
              commit: { sha: "commit-sha" },
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            type: "file",
            sha: "old-sha",
            content: encode(JSON.stringify({ version: 1, repos: {} })),
          }),
          { status: 200 }
        );
      });
    vi.stubGlobal("fetch", fetchImpl);

    const response = await saveSettings(
      context({
        revision: "old-sha",
        patch: {
          "101": { visible: true, order: 2 },
          "202": { featured: true },
        },
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).committed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(
      fetchImpl.mock.calls.filter(([, init]) => init?.method === "PUT")
    ).toHaveLength(1);
  });

  it("returns 409 for a stale SHA and never submits a write", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            type: "file",
            sha: "actual-sha",
            content: encode(JSON.stringify({ version: 1, repos: {} })),
          }),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchImpl);

    const response = await saveSettings(
      context({ revision: "stale-sha", patch: { "101": { visible: true } } })
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("settings_conflict");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown fields before contacting GitHub", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchImpl);
    const response = await saveSettings(
      context({
        revision: "old-sha",
        patch: { "101": { token: "must-not-pass" } },
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("unknown_fields");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
