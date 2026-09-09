/**
 * 构建期作品快照适配层。
 *
 * Actions 将人工设置、来源观察和公开作品分别写入
 * `data/portfolio/{settings,sources,projects}.json`，Astro 在构建时把它们
 * 编入页面。公开请求只会读取这些不可变模块，不访问 GitHub、KV 或 KV List。
 *
 * 阶段一/二的快照容器尚未合并到当前 HEAD，因此这里刻意把容器适配限制在
 * 两种等价外形：`{ repos: Record<repoId, value> }` 与数组容器（projects
 * 也接受 `{ projects: value[] }`，sources 接受 `{ sources: value[] }`）。
 * 数组记录必须带 repoId/id 或稳定的 gh-ID slug。记录本身仍以现有
 * DisplaySettings/SourceObservation/PortfolioContent 语义为准；未知或不完整
 * 记录会安全地被忽略，不会凭默认值把作品公开。
 */
import settingsSnapshot from "../../../data/portfolio/settings.json";
import sourcesSnapshot from "../../../data/portfolio/sources.json";
import projectsSnapshot from "../../../data/portfolio/projects.json";
import { evaluatePublication, toPublicProject } from "./publication";
import { projectIdFromSlug } from "./slug";
import type {
  DisplaySettings,
  Incident,
  PortfolioContent,
  ProjectCover,
  ProjectLinks,
  ProjectPlatform,
  ProjectRelease,
  ProjectScreenshot,
  PublicProject,
  ReleaseAsset,
  SourceObservation,
} from "./types";

type JsonRecord = Record<string, unknown>;

export interface PortfolioSettingsSnapshot {
  version?: number;
  repos?: unknown;
}

export interface PortfolioSourcesSnapshot {
  version?: number;
  repos?: unknown;
  sources?: unknown;
}

export interface PortfolioProjectsSnapshot {
  version?: number;
  repos?: unknown;
  projects?: unknown;
}

export interface PortfolioSnapshotInput {
  settings: unknown;
  sources: unknown;
  projects: unknown;
}

export interface SnapshotView {
  listPublicProjects(options?: {
    featuredOnly?: boolean;
    limit?: number;
  }): Promise<PublicProject[]>;
  listPublicSearchRecords(): Promise<
    { project: PublicProject; bodyTextPlain: string }[]
  >;
  lookupPublicProject(
    slug: string
  ): Promise<
    | { ok: true; project: PublicProject }
    | { ok: false; reason: "not_found" | "unavailable" }
  >;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const asNullableString = (value: unknown): string | null =>
  value === null ? null : asString(value);

const asStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  return value.every(item => typeof item === "string") ? value.slice() : null;
};

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asRepoId = (value: unknown): string | null => {
  const text =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : asString(value);
  return text && /^\d{1,12}$/.test(text) ? text : null;
};

const firstString = (value: JsonRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const text = asString(value[key]);
    if (text) return text;
  }
  return null;
};

const asSafeHttpUrl = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const asSafeImageSource = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  if (text.startsWith("/")) return text;
  return asSafeHttpUrl(text);
};

function imageFor(value: unknown): ProjectCover | ProjectScreenshot | null {
  if (!isRecord(value)) return null;
  const src = asSafeImageSource(value.src);
  const alt = asString(value.alt);
  if (!src || !alt) return null;

  const width = asFiniteNumber(value.width);
  const height = asFiniteNumber(value.height);
  const result = {
    src,
    alt,
    ...(width !== null && width > 0 ? { width } : {}),
    ...(height !== null && height > 0 ? { height } : {}),
  };
  if ("caption" in value && typeof value.caption === "string") {
    return { ...result, caption: value.caption };
  }
  return result;
}

function linksFor(value: unknown): ProjectLinks | null {
  if (!isRecord(value)) return null;
  const github = asSafeHttpUrl(value.github);
  if (!github) return null;
  return {
    github,
    website: value.website === null ? null : asSafeHttpUrl(value.website),
    demo: value.demo === null ? null : asSafeHttpUrl(value.demo),
    docs: value.docs === null ? null : asSafeHttpUrl(value.docs),
  };
}

function githubFor(value: unknown): PortfolioContent["github"] | null {
  if (!isRecord(value)) return null;
  const fullName = asString(value.fullName);
  const url = asSafeHttpUrl(value.url);
  const stars = asFiniteNumber(value.stars);
  if (!fullName || !url || stars === null || stars < 0) return null;
  return {
    fullName,
    url,
    stars,
    license: asNullableString(value.license),
    language: asNullableString(value.language),
  };
}

const PLATFORMS = new Set<ProjectPlatform>([
  "windows",
  "macos",
  "linux",
  "other",
  "checksum",
]);

function releaseAssetFor(value: unknown): ReleaseAsset | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name);
  const sizeBytes = asFiniteNumber(value.sizeBytes);
  const url = asSafeHttpUrl(value.url);
  const platform = value.platform;
  if (
    !name ||
    sizeBytes === null ||
    sizeBytes < 0 ||
    !url ||
    typeof platform !== "string" ||
    !PLATFORMS.has(platform as ProjectPlatform)
  ) {
    return null;
  }
  return { name, sizeBytes, url, platform: platform as ProjectPlatform };
}

function releaseFor(value: unknown): ProjectRelease | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  const tagName = asString(value.tagName);
  const publishedAt = asString(value.publishedAt);
  const releaseUrl = asSafeHttpUrl(value.releaseUrl);
  const notes = asStringArray(value.notes);
  const assets = Array.isArray(value.assets)
    ? value.assets.flatMap(item => {
        const asset = releaseAssetFor(item);
        return asset ? [asset] : [];
      })
    : null;
  if (
    !tagName ||
    !publishedAt ||
    !Number.isFinite(Date.parse(publishedAt)) ||
    !releaseUrl ||
    !notes ||
    assets === null
  ) {
    return null;
  }

  const sourceZipUrl =
    value.sourceZipUrl === undefined
      ? undefined
      : (asSafeHttpUrl(value.sourceZipUrl) ?? undefined);
  const sourceTarUrl =
    value.sourceTarUrl === undefined
      ? undefined
      : (asSafeHttpUrl(value.sourceTarUrl) ?? undefined);
  return {
    tagName,
    publishedAt,
    notes,
    assets,
    releaseUrl,
    ...(sourceZipUrl ? { sourceZipUrl } : {}),
    ...(sourceTarUrl ? { sourceTarUrl } : {}),
  };
}

/**
 * Extract keyed records without making the public layer depend on the exact
 * stage-two JSON envelope. Array entries must carry a stable repo ID or slug;
 * otherwise they are ignored rather than assigned an unstable index.
 */
function entriesFrom(value: unknown, keys: string[]): [string, unknown][] {
  if (Array.isArray(value)) {
    return value.flatMap(entry => {
      if (!isRecord(entry)) return [];
      const repoId = repoIdFromRecord(entry);
      return repoId ? ([[repoId, entry]] as [string, unknown][]) : [];
    });
  }

  if (!isRecord(value)) return [];
  for (const key of keys) {
    const nested = value[key];
    if (nested === undefined) continue;
    const entries = entriesFrom(nested, []);
    if (entries.length > 0 || isRecord(nested) || Array.isArray(nested)) {
      return entries;
    }
  }
  return Object.entries(value).filter(([key]) => key !== "version");
}

const isRepoId = (value: string): boolean => /^\d{1,12}$/.test(value);

const repoIdFromRecord = (value: JsonRecord): string | null => {
  const repoId = asRepoId(value.repoId) ?? asRepoId(value.id);
  if (repoId) return repoId;
  const slug = asString(value.slug);
  const fromSlug = slug ? projectIdFromSlug(slug) : null;
  return fromSlug && isRepoId(fromSlug) ? fromSlug : null;
};

function settingsFor(repoId: string, raw: unknown): DisplaySettings | null {
  if (!isRepoId(repoId)) return null;
  const value = isRecord(raw) && isRecord(raw.settings) ? raw.settings : raw;
  if (!isRecord(value)) return null;
  if (value.repoId !== undefined && asRepoId(value.repoId) !== repoId) {
    return null;
  }

  const order = asFiniteNumber(value.order ?? value.priority);
  if (value.visible !== true || order === null || order < 0) return null;

  return {
    schemaVersion: 1,
    repoId,
    visible: true,
    featured: value.featured === true,
    order,
    acknowledgedIncidentId: asNullableString(value.acknowledgedIncidentId),
    // These fields are not used by the public gate, but keep the shared type
    // honest without exposing the settings object in any public projection.
    revision: asString(value.revision) ?? `snapshot-${repoId}`,
    updatedAt: asString(value.updatedAt) ?? "1970-01-01T00:00:00.000Z",
    updatedBy: asString(value.updatedBy) ?? "snapshot",
  };
}

function observationFor(
  repoId: string,
  raw: unknown
): SourceObservation | null {
  if (!isRepoId(repoId)) return null;
  const value =
    isRecord(raw) && isRecord(raw.observation)
      ? raw.observation
      : isRecord(raw) && isRecord(raw.source)
        ? raw.source
        : raw;
  if (!isRecord(value)) return null;
  if (value.repoId !== undefined && asRepoId(value.repoId) !== repoId) {
    return null;
  }

  const fullName = firstString(value, ["fullName", "full_name"]);
  const observedAt = firstString(value, [
    "observedAt",
    "verifiedAt",
    "publicVerifiedAt",
    "updatedAt",
    "syncedAt",
  ]);
  const eligibility =
    value.eligibility === "public" ||
    value.public === true ||
    value.isPublic === true ||
    value.status === "public"
      ? "public"
      : value.eligibility === "unavailable" ||
          value.public === false ||
          value.isPublic === false ||
          value.status === "unavailable"
        ? "unavailable"
        : value.eligibility === "out_of_scope"
          ? "out_of_scope"
          : value.eligibility === "unknown"
            ? "unknown"
            : null;
  if (
    !fullName ||
    !observedAt ||
    (eligibility !== "public" &&
      eligibility !== "unavailable" &&
      eligibility !== "out_of_scope" &&
      eligibility !== "unknown")
  ) {
    return null;
  }

  const lastPublicVerifiedAt =
    asNullableString(value.lastPublicVerifiedAt) ??
    firstString(value, ["publicVerifiedAt", "verifiedAt"]);
  const payloadHash = asNullableString(value.payloadHash);
  const attemptState =
    value.attemptState === "partial" || value.attemptState === "error"
      ? value.attemptState
      : "success";
  const configState =
    value.configState === "valid" ||
    value.configState === "invalid" ||
    value.configState === "fetch_error"
      ? value.configState
      : "absent";
  const mode = value.mode === "enhanced" ? "enhanced" : "basic";
  const releaseState =
    value.releaseState === "present" ||
    value.releaseState === "stale" ||
    value.releaseState === "error"
      ? value.releaseState
      : "none";

  return {
    schemaVersion: 1,
    repoId,
    nodeId: firstString(value, ["nodeId", "node_id"]) ?? "",
    fullName,
    eligibility,
    attemptState,
    observedAt,
    lastPublicVerifiedAt,
    payloadHash,
    configState,
    mode,
    releaseState,
    lastContentSuccessAt: asNullableString(value.lastContentSuccessAt),
    warnings: asStringArray(value.warnings) ?? [],
  };
}

function incidentsFor(raw: unknown, repoId: string): Incident[] {
  if (!isRecord(raw)) return [];
  const candidate = raw.incidents;
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap(item => {
    if (!isRecord(item)) return [];
    const incidentId = asString(item.incidentId);
    const fullName = asString(item.fullName);
    const observedAt = asString(item.observedAt);
    const reason = item.reason;
    if (
      !incidentId ||
      !fullName ||
      !observedAt ||
      (reason !== "private" &&
        reason !== "not_found" &&
        reason !== "out_of_scope")
    ) {
      return [];
    }
    return [
      {
        incidentId,
        repoId,
        fullName,
        reason,
        observedAt,
      },
    ];
  });
}

function contentFor(raw: unknown): PortfolioContent | null {
  let value = raw;
  if (isRecord(value) && isRecord(value.content)) value = value.content;
  if (isRecord(value) && isRecord(value.project)) value = value.project;
  if (isRecord(value) && isRecord(value.data)) value = value.data;
  if (!isRecord(value)) return null;

  const title = asString(value.title);
  const summary = asString(value.summary);
  const links = linksFor(value.links);
  const github = githubFor(value.github);
  const topics = asStringArray(value.topics);
  const techStack = asStringArray(value.techStack);
  const features = asStringArray(value.features);
  const screenshots = Array.isArray(value.screenshots)
    ? value.screenshots.flatMap(item => {
        const screenshot = imageFor(item);
        return screenshot ? [screenshot as ProjectScreenshot] : [];
      })
    : null;

  if (
    !title ||
    !summary ||
    !links ||
    !github ||
    topics === null ||
    techStack === null ||
    features === null ||
    screenshots === null
  ) {
    return null;
  }

  const bodyHtml = typeof value.bodyHtml === "string" ? value.bodyHtml : "";
  const bodyTextPlain =
    typeof value.bodyTextPlain === "string" ? value.bodyTextPlain : "";

  return {
    schemaVersion: 1,
    title,
    summary,
    bodyHtml,
    bodyTextPlain,
    features,
    techStack,
    topics,
    links,
    github,
    release: releaseFor(value.release),
    additionalDownloads: [],
    cover: imageFor(value.cover),
    screenshots: screenshots as ProjectScreenshot[],
    sanitizerVersion: asString(value.sanitizerVersion) ?? "snapshot",
  };
}

function repoIdForProject(key: string, raw: unknown): string | null {
  if (key !== "" && isRepoId(key)) return key;
  if (!isRecord(raw)) return null;
  return repoIdFromRecord(raw);
}

function publishedEntryFor(
  entry: SnapshotEntry,
  now: number
): { project: PublicProject; bodyTextPlain: string } | null {
  const verdict = evaluatePublication({
    settings: entry.settings,
    observation: entry.observation,
    incidents: incidentsFor(entry.sourceRaw, entry.settings.repoId),
    now,
  });
  if (!verdict.publishable) return null;

  const content = contentFor(entry.projectRaw);
  if (!content) return null;
  if (
    content.github.fullName !== entry.observation.fullName ||
    content.github.url !== content.links.github
  ) {
    return null;
  }
  const project = toPublicProject(entry.observation, content);
  return project ? { project, bodyTextPlain: content.bodyTextPlain } : null;
}

interface SnapshotEntry {
  settings: DisplaySettings;
  observation: SourceObservation;
  sourceRaw: unknown;
  projectRaw?: unknown;
}

function createEntries(input: PortfolioSnapshotInput): SnapshotEntry[] {
  const settings = new Map<string, unknown>(
    entriesFrom(input.settings, ["repos"])
  );
  const sources = new Map<string, unknown>(
    entriesFrom(input.sources, ["repos", "sources"])
  );
  const projects = new Map<string, unknown>();
  for (const [key, raw] of entriesFrom(input.projects, ["repos", "projects"])) {
    const repoId = repoIdForProject(key, raw);
    if (repoId) projects.set(repoId, raw);
  }

  const out: SnapshotEntry[] = [];
  for (const [repoId, rawSettings] of settings) {
    const setting = settingsFor(repoId, rawSettings);
    const rawSource = sources.get(repoId);
    const observation = observationFor(repoId, rawSource);
    if (!setting || !observation || !rawSource) continue;
    out.push({
      settings: setting,
      observation,
      sourceRaw: rawSource,
      projectRaw: projects.get(repoId),
    });
  }
  return out.sort(
    (a, b) =>
      a.settings.order - b.settings.order ||
      Number(a.settings.repoId) - Number(b.settings.repoId)
  );
}

export function createSnapshotView(
  input: PortfolioSnapshotInput
): SnapshotView {
  const entries = createEntries(input);

  return {
    async listPublicProjects(options = {}) {
      const now = Date.now();
      const candidates = entries
        .filter(entry => !options.featuredOnly || entry.settings.featured)
        .slice(0, options.limit ?? Number.POSITIVE_INFINITY);

      const out: PublicProject[] = [];
      for (const entry of candidates) {
        const published = publishedEntryFor(entry, now);
        if (published) out.push(published.project);
      }
      return out;
    },

    async listPublicSearchRecords() {
      const now = Date.now();
      return entries.flatMap(entry => {
        const published = publishedEntryFor(entry, now);
        return published ? [published] : [];
      });
    },

    async lookupPublicProject(slug) {
      const repoId = projectIdFromSlug(slug);
      if (!repoId) return { ok: false, reason: "not_found" };
      const entry = entries.find(item => item.settings.repoId === repoId);
      if (!entry) return { ok: false, reason: "not_found" };

      const now = Date.now();
      const verdict = evaluatePublication({
        settings: entry.settings,
        observation: entry.observation,
        incidents: incidentsFor(entry.sourceRaw, repoId),
        now,
      });
      if (!verdict.publishable) return { ok: false, reason: "not_found" };

      const published = publishedEntryFor(entry, now);
      return published
        ? { ok: true, project: published.project }
        : { ok: false, reason: "unavailable" };
    },
  };
}

const defaultView = createSnapshotView({
  settings: settingsSnapshot,
  sources: sourcesSnapshot,
  projects: projectsSnapshot,
});

export const defaultSnapshotView = defaultView;
