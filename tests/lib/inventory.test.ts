import { describe, expect, it, vi } from "vitest";
import {
  continueInventory,
  type InventoryProgress,
} from "../../workers/portfolio-sync/src/inventory";
import {
  UpstreamError,
  type GitHubClient,
} from "../../workers/portfolio-sync/src/github";

type Repo = {
  id: number;
  node_id: string;
  full_name: string;
  private: boolean;
};

const page = (repos: Repo[], hasMore: boolean) => ({ repos, hasMore });

const makeClient = (
  pages: Record<number, ReturnType<typeof page> | Error>
): GitHubClient => {
  const listRepositoriesPage = vi.fn(async (numberPage: number) => {
    const result = pages[numberPage];
    if (result instanceof Error) throw result;
    if (!result) throw new UpstreamError(500);
    return result;
  });
  return { listRepositoriesPage } as unknown as GitHubClient;
};

const initialProgress = (): InventoryProgress => ({
  runId: "inventory-run",
  startedAt: "2026-09-09T12:00:00.000Z",
  nextPage: 1,
  repos: [],
});

const repos = (start: number, count: number): Repo[] =>
  Array.from({ length: count }, (_, index) => {
    const id = start + index;
    return {
      id,
      node_id: `node-${id}`,
      full_name: `jesongit/project-${id}`,
      private: false,
    };
  });

describe("候选清单分页与检查点", () => {
  it("完整处理 101+ 仓库、跨页去重并排除私有仓库", async () => {
    const firstPage = repos(1, 100);
    const client = makeClient({
      1: page(firstPage, true),
      2: page(
        [
          firstPage[99]!,
          repos(101, 1)[0]!,
          { ...repos(102, 1)[0]!, private: true },
        ],
        false
      ),
    });

    const outcome = await continueInventory(client, initialProgress());

    expect(outcome.error).toBeUndefined();
    expect(outcome.progress).toBeNull();
    expect(outcome.inventory?.completed).toBe(true);
    expect(outcome.inventory?.repos).toHaveLength(101);
    expect(outcome.inventory?.repos.map(repo => repo.repoId)).not.toContain(
      "102"
    );
    expect(outcome.inventory?.repos.map(repo => repo.repoId)).toEqual(
      expect.arrayContaining(["1", "100", "101"])
    );
  });

  it("第二页失败时保留已完成页与 nextPage 检查点", async () => {
    const firstPage = repos(1, 100);
    const outcome = await continueInventory(
      makeClient({
        1: page(firstPage, true),
        2: new UpstreamError(502),
      }),
      initialProgress()
    );

    expect(outcome.inventory).toBeNull();
    expect(outcome.error).toEqual({ kind: "upstream", status: 502 });
    expect(outcome.progress?.nextPage).toBe(2);
    expect(outcome.progress?.repos).toHaveLength(100);
  });

  it("从第二页检查点续跑后才提交完整清单", async () => {
    const firstPage = repos(1, 100);
    const failed = await continueInventory(
      makeClient({
        1: page(firstPage, true),
        2: new UpstreamError(502),
      }),
      initialProgress()
    );

    const resumed = await continueInventory(
      makeClient({ 2: page([repos(101, 1)[0]!], false) }),
      failed.progress!
    );

    expect(resumed.error).toBeUndefined();
    expect(resumed.progress).toBeNull();
    expect(resumed.inventory?.repos).toHaveLength(101);
    expect(resumed.inventory?.runId).toBe("inventory-run");
  });
});
