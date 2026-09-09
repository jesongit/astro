/**
 * GitHub-backed portfolio data files.
 *
 * The three documents deliberately keep different ownership boundaries:
 * settings are curation input, sources are GitHub observations, and projects
 * are the safe public projection. None of these types contains credentials,
 * tokens, or request/challenge data.
 */
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import dataSchema from "./schema/data-v1.json";
import { ADMIN } from "./config";
import { projectIdFromSlug } from "./slug";
import { parseJsonRejectingDuplicateKeys } from "./validate";
import type { PublicProject, SourceObservation } from "./types";

export const PORTFOLIO_DATA_SCHEMA_VERSION = 1 as const;

/** Checked-in curation record. Missing records and missing fields are hidden. */
export interface PortfolioSettingsEntry {
  repoId: string;
  visible?: boolean;
  featured?: boolean;
  order?: number;
}

/** A versioned settings document kept separate from GitHub observations. */
export interface PortfolioSettingsFile {
  $schema?: string;
  schemaVersion: typeof PORTFOLIO_DATA_SCHEMA_VERSION;
  settings: PortfolioSettingsEntry[];
}

/** Source observations use the shared v1 observation contract. */
export type PortfolioSourceEntry = SourceObservation;

export interface PortfolioSourcesFile {
  $schema?: string;
  schemaVersion: typeof PORTFOLIO_DATA_SCHEMA_VERSION;
  sources: PortfolioSourceEntry[];
}

/** Projects contain only the public projection, never the raw source object. */
export type PortfolioProjectEntry = PublicProject;

export interface PortfolioProjectsFile {
  $schema?: string;
  schemaVersion: typeof PORTFOLIO_DATA_SCHEMA_VERSION;
  projects: PortfolioProjectEntry[];
}

export type PortfolioDataKind = "settings" | "sources" | "projects";

export interface PortfolioDataByKind {
  settings: PortfolioSettingsFile;
  sources: PortfolioSourcesFile;
  projects: PortfolioProjectsFile;
}

export type PortfolioDataDocument = PortfolioDataByKind[PortfolioDataKind];

export interface PortfolioDataError {
  path: string;
  message: string;
}

export type PortfolioDataValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: PortfolioDataError[] };

export interface EffectiveDisplaySettings {
  repoId: string;
  visible: boolean;
  featured: boolean;
  order: number;
}

/** Defaults are intentionally conservative: an unconfigured project is hidden. */
export const DEFAULT_DISPLAY_SETTINGS = {
  visible: false,
  featured: false,
  order: ADMIN.defaultOrder,
} as const;

const dataAjv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
addFormats(dataAjv);
const dataValidator = dataAjv.compile(
  dataSchema as unknown as Record<string, unknown>
);

const expectedCollectionKey: Record<PortfolioDataKind, string> = {
  settings: "settings",
  sources: "sources",
  projects: "projects",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const error = (path: string, message: string): PortfolioDataError => ({
  path,
  message,
});

const repoIdPattern = /^\d{1,12}$/;

const duplicateIds = (
  values: readonly { repoId: string }[],
  path: string
): PortfolioDataError[] => {
  const seen = new Set<string>();
  const errors: PortfolioDataError[] = [];
  values.forEach((value, index) => {
    if (seen.has(value.repoId)) {
      errors.push(error(`${path}.${index}.repoId`, "repoId 不能重复"));
    }
    seen.add(value.repoId);
  });
  return errors;
};

const duplicateSlugs = (
  values: readonly { slug: string }[],
  path: string
): PortfolioDataError[] => {
  const seen = new Set<string>();
  const errors: PortfolioDataError[] = [];
  values.forEach((value, index) => {
    if (seen.has(value.slug)) {
      errors.push(error(`${path}.${index}.slug`, "slug 不能重复"));
    }
    seen.add(value.slug);
  });
  return errors;
};

function semanticErrors(
  kind: PortfolioDataKind,
  value: Record<string, unknown>
): PortfolioDataError[] {
  const collection = value[expectedCollectionKey[kind]];
  if (!Array.isArray(collection)) return [];

  if (kind === "settings") {
    const settings = collection as PortfolioSettingsEntry[];
    return duplicateIds(settings, "settings");
  }

  if (kind === "sources") {
    const sources = collection as SourceObservation[];
    return duplicateIds(sources, "sources");
  }

  const projects = collection as PublicProject[];
  const errors = duplicateSlugs(projects, "projects");
  projects.forEach((project, index) => {
    const repoId = projectIdFromSlug(project.slug);
    if (repoId === null) return;
    if (!repoIdPattern.test(repoId)) {
      errors.push(
        error(`projects.${index}.slug`, "slug 必须绑定 GitHub 数字 ID")
      );
    }
  });
  return errors;
}

/**
 * Validate an already parsed data document. The kind discriminator prevents a
 * settings document from accidentally being accepted as a sources document.
 */
export function validatePortfolioDataFile<K extends PortfolioDataKind>(
  kind: K,
  value: unknown
): PortfolioDataValidationResult<PortfolioDataByKind[K]> {
  if (!isRecord(value)) {
    return { ok: false, errors: [error("$", "数据文件必须是 JSON 对象")] };
  }

  const collectionKey = expectedCollectionKey[kind];
  if (!Array.isArray(value[collectionKey])) {
    return {
      ok: false,
      errors: [error(collectionKey, `必须是 ${collectionKey} 数组`)],
    };
  }

  if (!dataValidator(value)) {
    const schemaErrors = (dataValidator.errors ?? []).map(item => ({
      path: item.instancePath || "$",
      message: item.message ?? "Schema 校验失败",
    }));
    return { ok: false, errors: schemaErrors };
  }

  const semantic = semanticErrors(kind, value);
  if (semantic.length > 0) return { ok: false, errors: semantic };

  return {
    ok: true,
    data: value as unknown as PortfolioDataByKind[K],
  };
}

/** Parse and validate a checked-in JSON document, including duplicate keys. */
export function validatePortfolioDataText<K extends PortfolioDataKind>(
  kind: K,
  text: string
): PortfolioDataValidationResult<PortfolioDataByKind[K]> {
  const parsed = parseJsonRejectingDuplicateKeys(text);
  if (!parsed.ok) {
    return { ok: false, errors: [error("$", parsed.error)] };
  }
  return validatePortfolioDataFile(kind, parsed.value);
}

/** Apply curation defaults without allowing a hidden entry to become featured. */
export function normalizeDisplaySettings(
  repoId: string,
  entry?: PortfolioSettingsEntry
): EffectiveDisplaySettings {
  const visible = entry?.visible ?? DEFAULT_DISPLAY_SETTINGS.visible;
  const featured =
    visible && (entry?.featured ?? DEFAULT_DISPLAY_SETTINGS.featured);
  const order =
    typeof entry?.order === "number" &&
    Number.isInteger(entry.order) &&
    entry.order >= ADMIN.orderMin &&
    entry.order <= ADMIN.orderMax
      ? entry.order
      : DEFAULT_DISPLAY_SETTINGS.order;

  return { repoId, visible, featured, order };
}

export interface PortfolioPriorityOptions {
  /** Use for a home-page presentation where featured items precede others. */
  featuredFirst?: boolean;
  /** Default true: an absent or hidden setting cannot enter a public list. */
  visibleOnly?: boolean;
}

const compareRepoIds = (a: string, b: string): number => {
  const numberDifference = Number(a) - Number(b);
  return numberDifference || a.localeCompare(b);
};

/** Compare using the frozen rule: featured (when requested), order, repo ID. */
export function comparePortfolioPriority(
  a: EffectiveDisplaySettings,
  b: EffectiveDisplaySettings,
  options: Pick<PortfolioPriorityOptions, "featuredFirst"> = {}
): number {
  if (options.featuredFirst && a.featured !== b.featured) {
    return a.featured ? -1 : 1;
  }
  return a.order - b.order || compareRepoIds(a.repoId, b.repoId);
}

/**
 * Sort public project projections by their separate settings document.
 * Returns a new array, so callers cannot accidentally mutate parsed JSON data.
 */
export function sortPortfolioProjects<T extends { slug: string }>(
  projects: readonly T[],
  settings: readonly PortfolioSettingsEntry[],
  options: PortfolioPriorityOptions = {}
): T[] {
  const settingsByRepoId = new Map(
    settings.map(entry => [entry.repoId, entry])
  );
  const visibleOnly = options.visibleOnly ?? true;
  const decorated = projects.map((project, index) => {
    const repoId = projectIdFromSlug(project.slug) ?? project.slug;
    return {
      project,
      index,
      priority: normalizeDisplaySettings(repoId, settingsByRepoId.get(repoId)),
    };
  });

  return decorated
    .filter(({ priority }) => !visibleOnly || priority.visible)
    .sort(
      (a, b) =>
        comparePortfolioPriority(a.priority, b.priority, options) ||
        a.index - b.index
    )
    .map(({ project }) => project);
}

/** Public-list helper with the safe default-hidden policy made explicit. */
export function selectVisiblePortfolioProjects<T extends { slug: string }>(
  projects: readonly T[],
  settings: readonly PortfolioSettingsEntry[],
  options: Omit<PortfolioPriorityOptions, "visibleOnly"> = {}
): T[] {
  return sortPortfolioProjects(projects, settings, {
    ...options,
    visibleOnly: true,
  });
}
