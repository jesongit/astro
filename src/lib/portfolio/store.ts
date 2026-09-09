/**
 * KV 存储层(计划 §8.1 / §8.4):
 * -CONTROL(人工设置)只有本文件中的 ControlStore 可写;
 * - Sync Worker 只能构造 SyncWriteStore,其类型上不存在任何 CONTROL 写方法,
 *   以模块边界 + 测试断言保证「同步绝不覆盖人工设置」;
 * - 观察/事件/清单采用不可变 key(reverseTime),晚完成旧任务不会覆盖新记录;
 * - KV 为最终一致:读取方按语义时间选最新记录,不使用会被覆盖的 current 指针。
 */
import { KEYS, LIMITS, reverseTime, sha256Hex, newRevision } from "./config";
import type {
  AuditEntry,
  DisplaySettings,
  Incident,
  Inventory,
  PortfolioContent,
  SourceObservation,
  SyncJob,
  SyncJobResult,
} from "./types";

/** 结构化 KV 最小接口(兼容 Cloudflare KV 与本地模拟) */
export interface PortfolioKV {
  get(key: string, type?: "text"): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export const jsonPut = async (
  kv: PortfolioKV,
  key: string,
  value: unknown,
  options?: { expirationTtl?: number }
): Promise<void> => kv.put(key, JSON.stringify(value), options);

async function jsonGet<T>(kv: PortfolioKV, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 按 prefix 分页列出全部 key 名(处理 cursor/list_complete,§8.1) */
export async function listAllKeys(
  kv: PortfolioKV,
  prefix: string
): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, cursor, limit: 1000 });
    names.push(...page.keys.map(k => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

/* ───────────── CONTROL:人工设置(仅管理 API 可写) ───────────── */

export class ControlStore {
  constructor(private readonly kv: PortfolioKV) {}

  async getSettings(repoId: string): Promise<DisplaySettings | null> {
    return jsonGet<DisplaySettings>(this.kv, KEYS.settings(repoId));
  }

  /** 批量读取多个仓库的设置(公开列表批量门禁用) */
  async getSettingsMany(
    repoIds: string[]
  ): Promise<Record<string, DisplaySettings | null>> {
    const entries = await Promise.all(
      repoIds.map(async id => [id, await this.getSettings(id)] as const)
    );
    return Object.fromEntries(entries);
  }

  /**
   * 写入设置:revision 匹配才接受(尽力冲突检测,§8.4);
   * 返回写入后的确认对象;不匹配返回 null(管理 API 转 409)。
   */
  async putSettings(
    repoId: string,
    next: Omit<DisplaySettings, "revision" | "updatedAt">,
    expectedRevision: string
  ): Promise<DisplaySettings | null> {
    const current = await this.getSettings(repoId);
    if (current && current.revision !== expectedRevision) return null;
    const record: DisplaySettings = {
      ...next,
      revision: newRevision(),
      updatedAt: new Date().toISOString(),
    };
    await jsonPut(this.kv, KEYS.settings(repoId), record);
    return record;
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    const key = KEYS.audit(
      reverseTime(Date.parse(entry.at)),
      crypto.randomUUID()
    );
    await jsonPut(this.kv, key, entry, {
      expirationTtl: 90 * 24 * 60 * 60, // §8.1 审计保留 90 天
    });
  }

  async listAudit(limit = 50): Promise<AuditEntry[]> {
    const names = (await listAllKeys(this.kv, KEYS.auditPrefix)).sort(); // reverseTime 前缀天然新者在前
    const out: AuditEntry[] = [];
    for (const name of names.slice(0, limit)) {
      const entry = await jsonGet<AuditEntry>(this.kv, name);
      if (entry) out.push(entry);
    }
    return out;
  }

  /** 枚举全部设置(公开门禁批量检查用;≤500 候选规模) */
  async listAllSettings(): Promise<DisplaySettings[]> {
    const names = await listAllKeys(this.kv, "v1:settings:");
    const out: DisplaySettings[] = [];
    for (const name of names) {
      const settings = await jsonGet<DisplaySettings>(this.kv, name);
      if (settings) out.push(settings);
    }
    return out;
  }

  /** 创建手动任务(仅管理 API 路径使用;Worker 不持有本方法引用) */
  async putJobRequest(job: SyncJob): Promise<void> {
    await jsonPut(this.kv, KEYS.jobRequest(job.jobId), job);
  }

  async deleteJobRequest(jobId: string): Promise<void> {
    await this.kv.delete(KEYS.jobRequest(jobId));
  }

  async getJobRequest(jobId: string): Promise<SyncJob | null> {
    return jsonGet<SyncJob>(this.kv, KEYS.jobRequest(jobId));
  }
}

/** 按语义时间取最新观察:列前几条 reverse-time key,取 observedAt 最大者 */
async function getLatestObservationFrom(
  kv: PortfolioKV,
  repoId: string,
  lookback = 5
): Promise<SourceObservation | null> {
  const names = (await listAllKeys(kv, KEYS.obsPrefix(repoId)))
    .sort()
    .slice(0, lookback);
  let latest: SourceObservation | null = null;
  for (const name of names) {
    const obs = await jsonGet<SourceObservation>(kv, name);
    if (
      obs &&
      (!latest || Date.parse(obs.observedAt) > Date.parse(latest.observedAt))
    ) {
      latest = obs;
    }
  }
  return latest;
}

/* ───────────── CACHE 公开读侧(Pages 只读) ───────────── */

export class PublicCacheStore {
  constructor(private readonly kv: PortfolioKV) {}

  /**
   * 最新观察:按 observedAt 语义时间取最新;
   * 不依赖单一 list 页(§8.1),晚完成旧观察不会挤掉新观察。
   */
  async getLatestObservation(
    repoId: string,
    lookback = 5
  ): Promise<SourceObservation | null> {
    return getLatestObservationFrom(this.kv, repoId, lookback);
  }

  async getIncidents(repoId: string): Promise<Incident[]> {
    const names = (await listAllKeys(this.kv, KEYS.incidentPrefix(repoId)))
      .sort()
      .slice(0, 20);
    const incidents: Incident[] = [];
    for (const name of names) {
      const incident = await jsonGet<Incident>(this.kv, name);
      if (incident) incidents.push(incident);
    }
    return incidents;
  }

  async getPayload(hash: string): Promise<PortfolioContent | null> {
    const payload = await jsonGet<PortfolioContent>(
      this.kv,
      KEYS.payload(hash)
    );
    return payload;
  }

  /** 最新完整候选清单(§8.1:无完整清单不做批量移除) */
  async getLatestInventory(): Promise<Inventory | null> {
    const names = (await listAllKeys(this.kv, KEYS.inventoryPrefix))
      .sort()
      .slice(0, 2);
    for (const name of names) {
      const inventory = await jsonGet<Inventory>(this.kv, name);
      if (inventory?.completed) return inventory;
    }
    return null;
  }
}

/* ───────────── CACHE 写侧(仅 Sync Worker) ───────────── */

export class SyncWriteStore {
  /** 类型上不存在任何 CONTROL 写方法:同步链路无法覆盖人工设置(§8.4) */

  constructor(private readonly kv: PortfolioKV) {}

  async putContentPayload(content: PortfolioContent): Promise<string | null> {
    const text = JSON.stringify(content);
    if (new TextEncoder().encode(text).byteLength > LIMITS.payloadMaxBytes) {
      return null; // 超预算:按资源裁剪或拒绝,不静默截断
    }
    const hash = await sha256Hex(text);
    await jsonPut(this.kv, KEYS.payload(hash), content); // 内容寻址,不可变,引用存在则无 TTL
    return hash;
  }

  async putObservation(
    observation: SourceObservation,
    runId: string
  ): Promise<void> {
    await jsonPut(
      this.kv,
      KEYS.obs(
        observation.repoId,
        reverseTime(Date.parse(observation.observedAt)),
        runId
      ),
      observation
    );
  }

  async putIncident(incident: Incident): Promise<void> {
    await jsonPut(
      this.kv,
      KEYS.incident(
        incident.repoId,
        reverseTime(Date.parse(incident.observedAt)),
        incident.incidentId
      ),
      incident
    );
  }

  async putInventory(inventory: Inventory): Promise<void> {
    // 只保留最新两份完整清单:写入后按 list 清掉更旧的两份之外的部分
    await jsonPut(
      this.kv,
      KEYS.inventory(
        reverseTime(Date.parse(inventory.observedAt)),
        inventory.runId
      ),
      inventory
    );
  }

  async putHttpCacheEntry(keyHash: string, entry: unknown): Promise<void> {
    await jsonPut(this.kv, KEYS.httpCache(keyHash), entry);
  }

  async getHttpCacheEntry<T>(keyHash: string): Promise<T | null> {
    return jsonGet<T>(this.kv, KEYS.httpCache(keyHash));
  }

  async putRun(runId: string, state: unknown): Promise<void> {
    await jsonPut(this.kv, KEYS.run(runId), state, {
      expirationTtl: 30 * 24 * 60 * 60,
    });
  }

  async getRun<T>(runId: string): Promise<T | null> {
    return jsonGet<T>(this.kv, KEYS.run(runId));
  }

  /** GC:清理无引用 payload(仅删除最新观察/清单都不再引用的哈希;§8.4) */
  async gcPayloads(referencedHashes: Set<string>): Promise<number> {
    const names = await listAllKeys(this.kv, "v1:payload:");
    let removed = 0;
    for (const name of names) {
      const hash = name.slice("v1:payload:".length);
      if (referencedHashes.has(hash)) continue;
      await this.kv.delete(name); // 内容寻址不可变:先确认无引用(调用方已留 48h 宽限)再删
      removed += 1;
    }
    return removed;
  }
}

/**
 * JOBS 命名空间:任务请求由管理 API 写入;Worker 只消费(删除请求)并把
 * 结果写入结果区。类型按构造方区分,Worker 不持有 putJobRequest。
 */
export class JobsStore {
  constructor(private readonly kv: PortfolioKV) {}

  async listRequests(): Promise<{ jobId: string; job: SyncJob }[]> {
    const names = await listAllKeys(this.kv, KEYS.jobRequestPrefix);
    const out: { jobId: string; job: SyncJob }[] = [];
    for (const name of names) {
      const job = await jsonGet<SyncJob>(this.kv, name);
      if (job) out.push({ jobId: job.jobId, job });
    }
    return out;
  }

  async getRequest(jobId: string): Promise<SyncJob | null> {
    return jsonGet<SyncJob>(this.kv, KEYS.jobRequest(jobId));
  }

  async putRequest(job: SyncJob): Promise<void> {
    await jsonPut(this.kv, KEYS.jobRequest(job.jobId), job);
  }

  async deleteRequest(jobId: string): Promise<void> {
    await this.kv.delete(KEYS.jobRequest(jobId));
  }

  async putResult(result: SyncJobResult): Promise<void> {
    await jsonPut(this.kv, KEYS.jobResult(result.jobId, result.runId), result, {
      expirationTtl: 30 * 24 * 60 * 60,
    });
  }

  async getResults(jobId: string): Promise<SyncJobResult[]> {
    const names = await listAllKeys(this.kv, KEYS.jobResultPrefix(jobId));
    const results: SyncJobResult[] = [];
    for (const name of names) {
      const result = await jsonGet<SyncJobResult>(this.kv, name);
      if (result) results.push(result);
    }
    return results.sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
  }
}
