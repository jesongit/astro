/**
 * GitHub Actions 版作品同步的本地状态。
 *
 * 这个文件只负责可恢复状态和稳定序列化，不包含 token、请求头或原始错误。
 * 状态结构刻意使用与 src/lib/portfolio/types.ts 相同的 v1 语义：
 * inventory 是发现结果，records 是来源观察，settings 是只读的人工输入。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

export const STATE_SCHEMA_VERSION = 1;

export const sha256Hex = input =>
  createHash("sha256")
    .update(typeof input === "string" ? input : Buffer.from(input))
    .digest("hex");

/** JSON.stringify 不能保证对象键的顺序；快照和 payload hash 必须稳定。 */
export const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter(key => value[key] !== undefined)
        .sort()
        .map(key => [key, stableValue(value[key])])
    );
  }
  return value;
};

export const stableStringify = value =>
  JSON.stringify(stableValue(value), null, 2) + "\n";

export const emptyState = ({ owner = "", ownerType = "user" } = {}) => ({
  schemaVersion: STATE_SCHEMA_VERSION,
  owner,
  ownerType,
  updatedAt: null,
  inventory: null,
  records: {},
  // settings 由管理侧维护；Actions 只读取并原样保留。
  settings: {},
  httpCache: {},
});

const isObject = value =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeSettings = settings => {
  if (Array.isArray(settings)) {
    return Object.fromEntries(
      settings
        .filter(item => isObject(item) && typeof item.repoId === "string")
        .map(item => [item.repoId, item])
    );
  }
  return isObject(settings) ? settings : {};
};

const normalizeRecords = records => {
  if (Array.isArray(records)) {
    return Object.fromEntries(
      records
        .filter(item => isObject(item) && typeof item.repoId === "string")
        .map(item => [item.repoId, item])
    );
  }
  return isObject(records) ? records : {};
};

/** 兼容缺字段或上次中断的本地状态，但不把未知数据写回公开快照。 */
export const normalizeState = (value, defaults = {}) => {
  const source = isObject(value) ? value : {};
  const state = emptyState({
    owner: typeof source.owner === "string" ? source.owner : defaults.owner,
    ownerType:
      typeof source.ownerType === "string"
        ? source.ownerType
        : (defaults.ownerType ?? "user"),
  });
  state.updatedAt =
    typeof source.updatedAt === "string" ? source.updatedAt : null;
  state.inventory = isObject(source.inventory) ? source.inventory : null;
  state.records = normalizeRecords(source.records);
  state.settings = normalizeSettings(source.settings);
  state.httpCache = isObject(source.httpCache) ? source.httpCache : {};
  return state;
};

export async function readState(file, defaults = {}) {
  const path = resolve(file);
  try {
    const raw = await readFile(path, "utf8");
    return {
      path,
      state: normalizeState(JSON.parse(raw), defaults),
      exists: true,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path, state: emptyState(defaults), exists: false };
    }
    if (error instanceof SyntaxError) {
      throw new Error("state_invalid_json");
    }
    throw new Error("state_read_failed");
  }
}

/** 原子替换，避免 Actions 在进程被中断时留下半份 JSON。 */
export async function writeState(file, state) {
  const path = resolve(file);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, stableStringify(normalizeState(state)), "utf8");
  await rename(temporary, path);
  return path;
}

export const sortedRecords = state =>
  Object.values(state.records).sort(
    (a, b) =>
      Number(a.repoId) - Number(b.repoId) ||
      String(a.fullName ?? "").localeCompare(String(b.fullName ?? ""))
  );

export const sortedSettings = state =>
  Object.values(state.settings).sort(
    (a, b) =>
      Number(a.order ?? 0) - Number(b.order ?? 0) ||
      Number(a.repoId) - Number(b.repoId)
  );
