/**
 * 候选池枚举(计划 §8.2/§9.2):
 * - 完整分页 + 数字 ID 去重;
 * - 分页未完成不提交 inventory(不做批量移除依据);
 * - 单页失败保留游标,下一 tick 续跑;
 * - token 可见的私有仓库不入候选(资格检查仍会在仓库转私时触发)。
 */
import type { Inventory } from "../../../src/lib/portfolio/types";
import type { GitHubClient } from "./github";
import { CredentialError, RateLimitedError, UpstreamError } from "./github";

export interface InventoryProgress {
  runId: string;
  startedAt: string;
  nextPage: number;
  repos: { repoId: string; fullName: string; nodeId: string }[];
}

export interface InventoryOutcome {
  inventory: Inventory | null;
  progress: InventoryProgress | null;
  error?:
    | { kind: "credential" }
    | { kind: "rate_limited"; retryAt: number }
    | { kind: "upstream"; status: number };
}

export async function continueInventory(
  client: GitHubClient,
  progress: InventoryProgress
): Promise<InventoryOutcome> {
  const repos = [...progress.repos];
  const seen = new Set(repos.map(r => r.repoId));
  let page = progress.nextPage;

  try {
    for (;;) {
      const { repos: pageRepos, hasMore } =
        await client.listRepositoriesPage(page);
      for (const repo of pageRepos) {
        if (repo.private) continue; // 私有仓库不入候选
        const repoId = String(repo.id);
        if (seen.has(repoId)) continue; // 数字 ID 去重(§17)
        seen.add(repoId);
        repos.push({
          repoId,
          fullName: repo.full_name,
          nodeId: repo.node_id,
        });
      }
      if (!hasMore) {
        const inventory: Inventory = {
          schemaVersion: 1,
          runId: progress.runId,
          completed: true,
          observedAt: new Date().toISOString(),
          repos,
        };
        return { inventory, progress: null };
      }
      page += 1;
    }
  } catch (e) {
    const checkpoint = { ...progress, nextPage: page, repos };
    if (e instanceof CredentialError) {
      return {
        inventory: null,
        progress: checkpoint,
        error: { kind: "credential" },
      };
    }
    if (e instanceof RateLimitedError) {
      return {
        inventory: null,
        progress: checkpoint,
        error: { kind: "rate_limited", retryAt: e.retryAt },
      };
    }
    if (e instanceof UpstreamError) {
      return {
        inventory: null,
        progress: checkpoint,
        error: { kind: "upstream", status: e.status },
      };
    }
    return { inventory: null, progress: checkpoint };
  }
}
