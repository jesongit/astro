import { describe, expect, it } from "vitest";
import { PATCH } from "../../src/pages/api/admin/repos/[repoId]/settings";
import type { PortfolioKV } from "../../src/lib/portfolio/store";

class MemoryKV implements PortfolioKV {
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

  async list(options: { prefix: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
  }> {
    return {
      keys: [...this.values.keys()]
        .filter(key => key.startsWith(options.prefix))
        .map(name => ({ name })),
      list_complete: true,
    };
  }
}

function makeContext(control: PortfolioKV, body: unknown) {
  return {
    request: new Request("https://example.com/api/admin/repos/1001/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    params: { repoId: "1001" },
    locals: {
      adminIdentity: { email: "admin@example.com", sub: "admin" },
      runtime: {
        env: {
          PORTFOLIO_CONTROL: control,
          PORTFOLIO_CACHE: control,
          PORTFOLIO_JOBS: control,
        },
      },
    },
  } as Parameters<NonNullable<typeof PATCH>>[0];
}

describe("admin settings PATCH", () => {
  it("allows the first save with an empty revision", async () => {
    const kv = new MemoryKV();
    const response = await PATCH(
      makeContext(kv, {
        visible: true,
        featured: false,
        order: 1000,
        revision: "",
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).settings.revision).toBeTruthy();
  });

  it("still rejects an empty revision when settings already exist", async () => {
    const kv = new MemoryKV();
    const first = await PATCH(
      makeContext(kv, {
        visible: false,
        featured: false,
        order: 1000,
        revision: "",
      })
    );
    expect(first.status).toBe(200);

    const response = await PATCH(
      makeContext(kv, {
        visible: true,
        featured: false,
        order: 1000,
        revision: "",
      })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("revision_required");
  });
});
