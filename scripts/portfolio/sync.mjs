/**
 * GitHub Actions entry point for portfolio data.
 *
 * Commands:
 *   node scripts/portfolio/sync.mjs full [options]
 *   node scripts/portfolio/sync.mjs repo <repo-id|owner/name> [options]
 *   node scripts/portfolio/sync.mjs build [options]
 *
 * The command is intentionally a file synchronizer, not a deployment tool:
 * it never talks to Cloudflare and never changes management settings.
 */
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import { readState, sha256Hex, stableStringify, writeState } from "./state.mjs";
import { GITHUB_DEFAULTS, LIMITS, PUBLICATION } from "./constants.mjs";
import {
  GitHubBudgetError,
  GitHubClient,
  GitHubCredentialError,
  GitHubRateLimitError,
  GitHubUpstreamError,
} from "./github.mjs";
import {
  decodeBase64,
  makeGitHubResolver,
  normalizeContent,
  overlaySourceFacts,
  renderMarkdown,
  safeHomepage,
  summarizePlainText,
  truncateChars,
  validatePortfolioConfigText,
} from "./projection.mjs";
import { mapLatestRelease } from "./release.mjs";

const isObject = value =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const iso = now => new Date(now).toISOString();

const isCredentialOrRate = error =>
  error instanceof GitHubCredentialError ||
  error instanceof GitHubRateLimitError;

const publicSettings = setting => ({
  repoId: String(setting?.repoId ?? ""),
  visible: setting?.visible === true,
  featured: setting?.featured === true,
  order: Number.isFinite(Number(setting?.order)) ? Number(setting.order) : 0,
  acknowledgedIncidentId:
    typeof setting?.acknowledgedIncidentId === "string"
      ? setting.acknowledgedIncidentId
      : null,
});

const runIdFor = (kind, target, now) =>
  sha256Hex(`${kind}|${target ?? "all"}|${now}`).slice(0, 24);

const factsFromRepo = (repository, fullName) => ({
  fullName,
  url: `https://github.com/${fullName}`,
  stars:
    typeof repository.stargazers_count === "number" &&
    Number.isFinite(repository.stargazers_count)
      ? Math.max(0, repository.stargazers_count)
      : 0,
  license:
    isObject(repository.license) &&
    typeof repository.license.spdx_id === "string"
      ? repository.license.spdx_id
      : null,
  language:
    typeof repository.language === "string" ? repository.language : null,
});

const toRecordBase = (base, sha) => ({
  name: base.name,
  description: base.description,
  homepage: base.homepage,
  readmeHtml: base.readmeHtml,
  readmeTextPlain: base.readmeTextPlain,
  topics: [...base.topics],
  github: base.github,
  commitSha: sha,
});

const priorBase = (record, repository, fullName) => {
  const previous = isObject(record?.base) ? record.base : {};
  return {
    name:
      typeof previous.name === "string"
        ? previous.name
        : typeof repository.name === "string"
          ? repository.name
          : fullName.split("/").at(-1),
    description:
      typeof previous.description === "string"
        ? previous.description
        : typeof repository.description === "string"
          ? repository.description
          : null,
    homepage: typeof previous.homepage === "string" ? previous.homepage : null,
    readmeHtml:
      typeof previous.readmeHtml === "string" ? previous.readmeHtml : "",
    readmeTextPlain:
      typeof previous.readmeTextPlain === "string"
        ? previous.readmeTextPlain
        : "",
    topics: Array.isArray(previous.topics)
      ? previous.topics.filter(item => typeof item === "string")
      : [],
    github: factsFromRepo(repository, fullName),
  };
};

const mergeWarnings = warnings => [...new Set(warnings)].sort();

const withoutObservationTimes = record => {
  if (!record) return record;
  const copy = { ...record };
  delete copy.observedAt;
  delete copy.lastPublicVerifiedAt;
  delete copy.lastContentSuccessAt;
  delete copy.releaseLastSuccessAt;
  return copy;
};

const recordChanged = (previous, next) =>
  !previous ||
  stableStringify(withoutObservationTimes(previous)) !==
    stableStringify(withoutObservationTimes(next));

const addIncident = (record, repoId, fullName, reason, observedAt) => {
  const incidents = Array.isArray(record?.incidents)
    ? [...record.incidents]
    : [];
  const exists = incidents.some(
    item => item?.reason === reason && item?.fullName === fullName
  );
  if (!exists) {
    incidents.push({
      incidentId: sha256Hex(
        `${repoId}|${fullName}|${reason}|${observedAt}`
      ).slice(0, 32),
      repoId,
      fullName,
      reason,
      observedAt,
    });
  }
  return incidents.sort(
    (a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
      String(a.incidentId).localeCompare(String(b.incidentId))
  );
};

const configProjection = (config, fullName, sha) => {
  const resolveImage = path =>
    /^\.portfolio\/assets\//.test(path)
      ? `https://raw.githubusercontent.com/${fullName}/${sha}/${path
          .replace(/^\.\//, "")
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      : null;
  const normalized = {
    title: config.title,
    summary: config.summary,
    bodyFile: config.bodyFile,
    features: config.features,
    techStack: config.techStack,
    links: config.links,
    additionalDownloads: config.additionalDownloads,
  };
  if (config.cover) {
    const src = resolveImage(config.cover.path);
    if (!src) return { ok: false, warning: "config_invalid:cover_path" };
    normalized.cover = {
      src,
      alt: config.cover.alt,
      caption: config.cover.caption,
      width: config.cover.width,
      height: config.cover.height,
    };
  } else if (config.cover === null) {
    normalized.cover = null;
  }
  if (config.screenshots) {
    const screenshots = config.screenshots.map(item => {
      const src = resolveImage(item.path);
      return src
        ? {
            src,
            alt: item.alt,
            caption: item.caption,
            width: item.width,
            height: item.height,
          }
        : null;
    });
    if (screenshots.some(item => item === null)) {
      return { ok: false, warning: "config_invalid:screenshot_path" };
    }
    normalized.screenshots = screenshots;
  }
  return { ok: true, config: normalized };
};

async function readPublicContent({
  client,
  repository,
  fullName,
  previous,
  warnings,
}) {
  let sha = null;
  const base = priorBase(previous, repository, fullName);
  const branch =
    typeof repository.default_branch === "string" && repository.default_branch
      ? repository.default_branch
      : "main";
  try {
    sha = await client.getCommitSha(fullName, branch);
  } catch (error) {
    if (isCredentialOrRate(error)) throw error;
    warnings.push("commit_fetch_error");
  }
  if (!sha) {
    warnings.push("no_commit");
    return {
      base,
      sha: null,
      configState: "absent",
      config: null,
      enhancedBody: null,
    };
  }

  const resolver = makeGitHubResolver(fullName, sha);
  try {
    const result = await client.getReadme(fullName, sha);
    if (result.status === 200 && result.content) {
      let text = decodeBase64(result.content.contentBase64);
      if (Buffer.byteLength(text, "utf8") > LIMITS.readmeMaxBytes) {
        text = `${truncateChars(text, 8000)}\n\n在 GitHub 阅读完整说明。`;
        warnings.push("readme_truncated");
      }
      const rendered = await renderMarkdown(text, {
        resolveUrl: makeGitHubResolver(fullName, sha, result.content.path),
      });
      base.readmeHtml = rendered.html;
      base.readmeTextPlain = summarizePlainText(text);
    }
  } catch (error) {
    if (isCredentialOrRate(error)) throw error;
    warnings.push("readme_fetch_error");
  }

  let configState = "absent";
  let config = null;
  let enhancedBody = null;
  try {
    const configFile = await client.getContentsDetailed(
      fullName,
      ".portfolio/portfolio.json",
      sha
    );
    if (configFile.status === 200 && configFile.content) {
      const validation = validatePortfolioConfigText(
        decodeBase64(configFile.content.contentBase64)
      );
      if (!validation.ok) {
        configState = "invalid";
        warnings.push(`config_invalid:${validation.errors[0]?.path ?? "$"}`);
      } else {
        const projection = configProjection(validation.config, fullName, sha);
        if (!projection.ok) {
          configState = "invalid";
          warnings.push(projection.warning);
        } else {
          configState = "valid";
          config = projection.config;
          if (validation.config.bodyFile) {
            const bodyFile = await client.getContentsDetailed(
              fullName,
              validation.config.bodyFile,
              sha
            );
            if (bodyFile.status !== 200 || !bodyFile.content) {
              configState = "invalid";
              warnings.push("config_invalid:bodyFile_missing");
            } else {
              const bodyText = decodeBase64(bodyFile.content.contentBase64);
              if (Buffer.byteLength(bodyText, "utf8") > LIMITS.bodyMaxBytes) {
                configState = "invalid";
                warnings.push("config_invalid:bodyFile_too_large");
              } else {
                enhancedBody = await renderMarkdown(bodyText, {
                  resolveUrl: makeGitHubResolver(
                    fullName,
                    sha,
                    validation.config.bodyFile
                  ),
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    if (isCredentialOrRate(error)) throw error;
    configState = "fetch_error";
    warnings.push("config_fetch_error");
  }
  return { base, sha, configState, config, enhancedBody, resolver };
}

async function readRelease({ client, fullName, previous, warnings }) {
  try {
    const result = await client.getLatestRelease(fullName);
    if (result.status === 404) return { state: "none", release: null };
    if (result.status !== 200 || !isObject(result.body)) {
      return { state: "error", release: null };
    }
    let assets = result.body.assets;
    if (result.body.assets_url) {
      try {
        assets = await client.getReleaseAssets(result.body);
      } catch (error) {
        if (isCredentialOrRate(error)) throw error;
        warnings.push("release_assets_fetch_error");
      }
    }
    const mapped = await mapLatestRelease(result.body, assets);
    return { state: mapped.state, release: mapped.release };
  } catch (error) {
    if (isCredentialOrRate(error)) throw error;
    warnings.push("release_fetch_error");
    const oldRelease = previous?.content?.release ?? null;
    return { state: oldRelease ? "stale" : "error", release: oldRelease };
  }
}

async function resolveRepository({ client, state, target, knownEntry }) {
  const targetId = /^\d{1,12}$/.test(String(target)) ? String(target) : null;
  const candidates = [];
  if (knownEntry?.full_name) candidates.push(knownEntry.full_name);
  if (targetId) {
    const inventoryEntry = state.inventory?.repos?.find(
      item => String(item.repoId) === targetId
    );
    const old = state.records[targetId];
    for (const name of [inventoryEntry?.fullName, old?.fullName]) {
      if (name && !candidates.includes(name)) candidates.push(name);
    }
  } else if (/^[^/]+\/[^/]+$/.test(String(target))) {
    candidates.push(String(target));
  } else {
    throw new Error("repo_target_invalid");
  }

  for (const fullName of candidates) {
    let result;
    try {
      result = await client.getRepository(fullName);
    } catch (error) {
      // A single repository can be unavailable upstream (for example, GitHub
      // may return 451). Keep the inventory run usable and let the caller
      // persist an identity-unresolved record for this repository.
      if (isCredentialOrRate(error)) throw error;
      if (error instanceof GitHubUpstreamError) continue;
      throw error;
    }
    if (result.status !== 200 || !result.repository) continue;
    if (targetId && String(result.repository.id) !== targetId) continue;
    return { fullName, repository: result.repository };
  }

  // 名称可能已改名；仅在 ID 无法由现有快照解析时做一次完整候选枚举。
  if (targetId) {
    const repositories = await client.listRepositories();
    const found = repositories.find(item => String(item.id) === targetId);
    if (found) {
      try {
        const result = await client.getRepository(found.full_name);
        if (result.status === 200 && result.repository) {
          return { fullName: found.full_name, repository: result.repository };
        }
      } catch (error) {
        if (isCredentialOrRate(error)) throw error;
        if (!(error instanceof GitHubUpstreamError)) throw error;
      }
    }
  }
  return { fullName: candidates[0] ?? String(target), repository: null };
}

async function syncRepository({ client, state, target, knownEntry, now }) {
  const resolved = await resolveRepository({
    client,
    state,
    target,
    knownEntry,
  });
  const repoId =
    knownEntry?.repoId ??
    (/^\d+$/.test(String(target)) ? String(target) : null) ??
    (resolved.repository && typeof resolved.repository.id === "number"
      ? String(resolved.repository.id)
      : null);
  if (!repoId) throw new Error("repo_id_unresolved");

  const previous = state.records[repoId] ?? null;
  const observedAt = iso(now);
  const warnings = [];
  if (!resolved.repository) {
    const next = {
      ...(previous ?? {}),
      repoId,
      fullName: previous?.fullName ?? resolved.fullName,
      observedAt,
      attemptState: "error",
      eligibility: previous?.eligibility ?? "unknown",
      lastPublicVerifiedAt: previous?.lastPublicVerifiedAt ?? null,
      warnings: ["identity_unresolved"],
    };
    state.records[repoId] = recordChanged(previous, next) ? next : previous;
    return {
      repoId,
      state: "partial",
      changed: recordChanged(previous, next),
      warnings: ["identity_unresolved"],
    };
  }

  const fullName = resolved.fullName;
  const repository = resolved.repository;
  const nodeId =
    typeof repository.node_id === "string"
      ? repository.node_id
      : (previous?.nodeId ?? "");
  if (repository.private === true) {
    const next = {
      ...(previous ?? {}),
      repoId,
      fullName,
      nodeId,
      eligibility: "unavailable",
      attemptState: "success",
      observedAt,
      lastPublicVerifiedAt: previous?.lastPublicVerifiedAt ?? null,
      payloadHash: previous?.payloadHash ?? null,
      configState: previous?.configState ?? "absent",
      mode: previous?.mode ?? "basic",
      releaseState: previous?.releaseState ?? "none",
      lastContentSuccessAt: previous?.lastContentSuccessAt ?? null,
      warnings: [],
      incidents: addIncident(previous, repoId, fullName, "private", observedAt),
    };
    const changed = recordChanged(previous, next);
    state.records[repoId] = changed ? next : previous;
    return { repoId, state: "success", changed, warnings: [] };
  }

  const owner =
    isObject(repository.owner) && typeof repository.owner.login === "string"
      ? repository.owner.login
      : state.owner;
  if (owner && owner.toLowerCase() !== state.owner.toLowerCase()) {
    const next = {
      ...(previous ?? {}),
      repoId,
      fullName,
      nodeId,
      eligibility: "out_of_scope",
      attemptState: "success",
      observedAt,
      lastPublicVerifiedAt: previous?.lastPublicVerifiedAt ?? null,
      payloadHash: previous?.payloadHash ?? null,
      configState: previous?.configState ?? "absent",
      mode: previous?.mode ?? "basic",
      releaseState: previous?.releaseState ?? "none",
      lastContentSuccessAt: previous?.lastContentSuccessAt ?? null,
      warnings: [],
      incidents: addIncident(
        previous,
        repoId,
        fullName,
        "out_of_scope",
        observedAt
      ),
    };
    const changed = recordChanged(previous, next);
    state.records[repoId] = changed ? next : previous;
    return { repoId, state: "success", changed, warnings: [] };
  }

  const facts = factsFromRepo(repository, fullName);
  const baseResult = await readPublicContent({
    client,
    repository,
    fullName,
    previous,
    warnings,
  });
  const base = baseResult.base;
  base.github = facts;
  base.homepage = safeHomepage(repository.homepage);
  base.topics = Array.isArray(repository.topics)
    ? repository.topics.filter(item => typeof item === "string")
    : [];
  if (!Array.isArray(repository.topics)) {
    try {
      base.topics = await client.getTopics(fullName);
    } catch (error) {
      if (isCredentialOrRate(error)) throw error;
      warnings.push("topics_fetch_error");
    }
  }
  if (repository.archived === true) warnings.push("archived");

  const releaseResult = await readRelease({
    client,
    fullName,
    previous,
    warnings,
  });
  let content;
  let lkg = previous?.lkg ?? null;
  if (baseResult.configState === "valid") {
    content = normalizeContent({
      base,
      config: baseResult.config,
      enhancedBody: baseResult.enhancedBody,
      release: releaseResult.release,
    });
    lkg = content;
  } else if (
    baseResult.configState === "invalid" ||
    baseResult.configState === "fetch_error"
  ) {
    content = lkg
      ? overlaySourceFacts(lkg, base, releaseResult.release)
      : normalizeContent({
          base,
          config: null,
          enhancedBody: null,
          release: releaseResult.release,
        });
  } else {
    content = normalizeContent({
      base,
      config: null,
      enhancedBody: null,
      release: releaseResult.release,
    });
  }

  const contentText = stableStringify(content);
  const tooLarge =
    Buffer.byteLength(contentText, "utf8") > LIMITS.payloadMaxBytes;
  const payloadHash = tooLarge
    ? (previous?.payloadHash ?? null)
    : sha256Hex(contentText);
  if (tooLarge) warnings.push("payload_too_large");
  const nextRecord = {
    ...(previous ?? {}),
    repoId,
    fullName,
    nodeId,
    eligibility: "public",
    attemptState: warnings.length ? "partial" : "success",
    observedAt,
    lastPublicVerifiedAt: observedAt,
    payloadHash,
    configState: baseResult.configState,
    mode:
      baseResult.configState === "valid" ||
      ((baseResult.configState === "invalid" ||
        baseResult.configState === "fetch_error") &&
        Boolean(lkg))
        ? "enhanced"
        : "basic",
    releaseState: releaseResult.state,
    releaseLastSuccessAt:
      releaseResult.state === "present" || releaseResult.state === "none"
        ? observedAt
        : (previous?.releaseLastSuccessAt ?? null),
    lastContentSuccessAt: tooLarge
      ? (previous?.lastContentSuccessAt ?? null)
      : observedAt,
    warnings: mergeWarnings(warnings),
    content: tooLarge ? (previous?.content ?? null) : content,
    lkg,
    base: toRecordBase(base, baseResult.sha),
    incidents: Array.isArray(previous?.incidents) ? previous.incidents : [],
  };
  const changed = recordChanged(previous, nextRecord);
  state.records[repoId] = changed ? nextRecord : previous;
  return {
    repoId,
    state: warnings.length ? "partial" : "success",
    changed,
    warnings: mergeWarnings(warnings),
  };
}

const incidentsFor = record =>
  Array.isArray(record?.incidents) ? record.incidents : [];

function publicationVerdict(setting, record, now) {
  if (!setting) return { publishable: false, reason: "no_settings" };
  if (setting.visible !== true) return { publishable: false, reason: "hidden" };
  if (!record) return { publishable: false, reason: "no_observation" };
  if (record.eligibility === "unavailable")
    return { publishable: false, reason: "unavailable" };
  if (record.eligibility === "out_of_scope")
    return { publishable: false, reason: "out_of_scope" };
  if (record.eligibility !== "public")
    return { publishable: false, reason: "unknown_eligibility" };
  const verified = Date.parse(record.lastPublicVerifiedAt ?? "");
  if (
    !Number.isFinite(verified) ||
    verified + PUBLICATION.publicValidityMinutes * 60_000 < now
  ) {
    return { publishable: false, reason: "eligibility_expired" };
  }
  const incidents = incidentsFor(record);
  if (incidents.length) {
    const latest = incidents.reduce((a, b) =>
      Date.parse(a.observedAt) >= Date.parse(b.observedAt) ? a : b
    );
    if (setting.acknowledgedIncidentId !== latest.incidentId) {
      return { publishable: false, reason: "unconfirmed_incident" };
    }
  }
  return record.payloadHash && record.content
    ? { publishable: true }
    : { publishable: false, reason: "no_content" };
}

export function buildSnapshot(state, { now = Date.now() } = {}) {
  if (!state.inventory?.completed) {
    const error = new Error("inventory_incomplete");
    error.code = "inventory_incomplete";
    throw error;
  }
  const projects = [];
  const settings = Object.values(state.settings ?? {})
    .map(publicSettings)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.order - b.order ||
        Number(a.repoId) - Number(b.repoId)
    );
  for (const setting of settings) {
    const record = state.records[setting.repoId];
    if (publicationVerdict(setting, record, now).publishable) {
      const content = record.content;
      const releaseCheckedAt = Date.parse(record.releaseLastSuccessAt ?? "");
      const releaseFresh =
        record.releaseState !== "stale" ||
        (Number.isFinite(releaseCheckedAt) &&
          releaseCheckedAt + PUBLICATION.releaseStaleMaxHours * 60 * 60_000 >=
            now);
      projects.push({
        slug: `gh-${setting.repoId}`,
        title: content.title,
        summary: content.summary,
        topics: [...(content.topics ?? [])],
        techStack: [...(content.techStack ?? [])],
        features: [...(content.features ?? [])],
        ...(content.bodyHtml ? { bodyHtml: content.bodyHtml } : {}),
        cover: content.cover ?? null,
        screenshots: [...(content.screenshots ?? [])],
        links: content.links,
        github: content.github,
        release: releaseFresh ? (content.release ?? null) : null,
      });
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: iso(now),
    owner: state.owner,
    ownerType: state.ownerType,
    inventoryRunId: state.inventory.runId,
    projects,
  };
}

const DATA_SCHEMA = "../../src/lib/portfolio/schema/data-v1.json";

const readJsonFile = async path => {
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(resolvePath(path), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error("portfolio_data_read_failed");
  }
};

const keyedEntries = (value, key) => {
  if (Array.isArray(value?.[key]))
    return Object.fromEntries(
      value[key]
        .filter(
          item => isObject(item) && /^\d{1,12}$/.test(String(item.repoId))
        )
        .map(item => [String(item.repoId), item])
    );
  return isObject(value?.repos) ? value.repos : {};
};

async function hydrateCheckedInData(state, settingsPath, sourcesPath) {
  const settings = await readJsonFile(settingsPath);
  const sources = await readJsonFile(sourcesPath);
  if (settings)
    state.settings = {
      ...keyedEntries(settings, "settings"),
      ...state.settings,
    };
  if (sources) {
    const sourceEntries = keyedEntries(sources, "sources");
    state.records = { ...sourceEntries, ...state.records };
    const inventory = Object.values(sourceEntries).flatMap(record =>
      isObject(record) &&
      /^\d{1,12}$/.test(String(record.repoId)) &&
      typeof record.fullName === "string"
        ? [
            {
              repoId: String(record.repoId),
              fullName: record.fullName,
              nodeId: String(record.nodeId ?? ""),
            },
          ]
        : []
    );
    if (!state.inventory) {
      state.inventory = {
        schemaVersion: 1,
        runId: "checked-in-sources",
        completed: true,
        observedAt: state.updatedAt ?? new Date(0).toISOString(),
        repos: inventory,
      };
    }
  }
}

const publicSettingsFile = state => ({
  $schema: DATA_SCHEMA,
  schemaVersion: 1,
  settings: Object.values(state.settings ?? {})
    .map(publicSettings)
    .sort((a, b) => Number(a.repoId) - Number(b.repoId)),
});

const sourcesFile = state => ({
  $schema: DATA_SCHEMA,
  schemaVersion: 1,
  sources: Object.values(state.records ?? {})
    .sort((a, b) => Number(a.repoId) - Number(b.repoId))
    .map(record => ({ schemaVersion: 1, ...record })),
});

const projectsFile = snapshot => ({
  $schema: DATA_SCHEMA,
  schemaVersion: 1,
  projects: snapshot.projects,
});

async function writePortfolioFiles({
  state,
  snapshot,
  settingsPath,
  sourcesPath,
  outputPath,
}) {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const writes = [
    [settingsPath, stableStringify(publicSettingsFile(state))],
    [sourcesPath, stableStringify(sourcesFile(state))],
    [outputPath, stableStringify(projectsFile(snapshot))],
  ];
  for (const [file, content] of writes) {
    const path = resolve(file);
    await mkdir(dirname(path), { recursive: true });
    let previous = null;
    try {
      previous = await readFile(path, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT")
        throw new Error("portfolio_data_read_failed");
    }
    if (previous !== content) await writeFile(path, content, "utf8");
  }
}

export async function run({
  command,
  target = null,
  statePath = process.env.PORTFOLIO_STATE ?? ".cache/portfolio-state.json",
  outputPath = process.env.PORTFOLIO_OUTPUT ?? "data/portfolio/projects.json",
  settingsPath = process.env.PORTFOLIO_SETTINGS ??
    "data/portfolio/settings.json",
  sourcesPath = process.env.PORTFOLIO_SOURCES ?? "data/portfolio/sources.json",
  writeDataFiles = false,
  owner = process.env.GITHUB_OWNER ?? GITHUB_DEFAULTS.owner,
  ownerType = process.env.GITHUB_OWNER_TYPE ?? GITHUB_DEFAULTS.ownerType,
  token = process.env.GITHUB_TOKEN ?? "",
  apiVersion = process.env.GITHUB_API_VERSION ?? GITHUB_DEFAULTS.apiVersion,
  authScope = process.env.GITHUB_AUTH_SCOPE ?? "public-read",
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  maxRequests = Number.POSITIVE_INFINITY,
} = {}) {
  if (!["full", "repo", "build"].includes(command))
    throw new Error("command_invalid");
  const loaded = await readState(statePath, { owner, ownerType });
  const state = loaded.state;
  await hydrateCheckedInData(state, settingsPath, sourcesPath);
  state.owner = owner;
  state.ownerType = ownerType;
  const client = new GitHubClient({
    token,
    owner,
    ownerType,
    apiVersion,
    authScope,
    cache: state.httpCache,
    fetchImpl,
    maxRequests,
    now: () => now,
  });

  if (command === "build") {
    const snapshot = buildSnapshot(state, { now });
    const { readFile, writeFile, mkdir } = await import("node:fs/promises");
    const { dirname, resolve } = await import("node:path");
    const path = resolve(outputPath);
    await mkdir(dirname(path), { recursive: true });
    const serialized = stableStringify(projectsFile(snapshot));
    try {
      if ((await readFile(path, "utf8")) === serialized) {
        return {
          command,
          changed: false,
          projects: snapshot.projects.length,
          outputPath: path,
        };
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw new Error("snapshot_read_failed");
    }
    await writeFile(path, serialized, "utf8");
    return {
      command,
      changed: true,
      projects: snapshot.projects.length,
      outputPath: path,
    };
  }

  const runId = runIdFor(command, target, now);
  const report = {
    command,
    runId,
    processed: 0,
    changed: 0,
    warnings: [],
    complete: true,
  };
  if (command === "full") {
    let repositories;
    try {
      repositories = await client.listRepositories();
    } catch (error) {
      report.complete = false;
      report.warnings.push(error.code ?? "inventory_failed");
      if (error instanceof GitHubRateLimitError) report.retryAt = error.retryAt;
      // 不写入不完整 inventory；只保存已拿到的条件缓存，供下次复用。
      state.updatedAt = iso(now);
      await writeState(statePath, state);
      return { ...report, requestCount: client.requestsUsed, statePath };
    }
    state.inventory = {
      schemaVersion: 1,
      runId,
      completed: true,
      observedAt: iso(now),
      repos: repositories.map(item => ({
        repoId: String(item.id),
        fullName: item.full_name,
        nodeId: item.node_id,
      })),
    };
    for (const entry of state.inventory.repos) {
      try {
        const result = await syncRepository({
          client,
          state,
          target: entry.repoId,
          knownEntry: entry,
          now,
        });
        report.processed += 1;
        report.changed += result.changed ? 1 : 0;
        report.warnings.push(...result.warnings);
      } catch (error) {
        report.complete = false;
        report.warnings.push(error.code ?? "repo_sync_failed");
        if (error instanceof GitHubRateLimitError)
          report.retryAt = error.retryAt;
        if (isCredentialOrRate(error) || error instanceof GitHubBudgetError)
          break;
      }
    }
  } else {
    if (!target) throw new Error("repo_target_required");
    const knownEntry = state.inventory?.repos?.find(
      item => item.repoId === String(target) || item.fullName === String(target)
    );
    try {
      const result = await syncRepository({
        client,
        state,
        target: String(target),
        knownEntry,
        now,
      });
      report.processed = 1;
      report.changed = result.changed ? 1 : 0;
      report.warnings.push(...result.warnings);
    } catch (error) {
      report.complete = false;
      report.warnings.push(error.code ?? "repo_sync_failed");
      if (error instanceof GitHubRateLimitError) report.retryAt = error.retryAt;
    }
  }
  state.updatedAt = iso(now);
  await writeState(statePath, state);
  if (writeDataFiles && report.complete) {
    const snapshot = buildSnapshot(state, { now });
    await writePortfolioFiles({
      state,
      snapshot,
      settingsPath,
      sourcesPath,
      outputPath,
    });
  }
  return {
    ...report,
    warnings: [...new Set(report.warnings)].sort(),
    requestCount: client.requestsUsed,
    statePath: loaded.path,
  };
}

const parseArgs = argv => {
  const [command, maybeTarget, ...rest] = argv;
  const options = {};
  let target = null;
  if (command === "repo") target = maybeTarget;
  else if (maybeTarget?.startsWith("--")) rest.unshift(maybeTarget);
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const [key, inline] = item.slice(2).split("=", 2);
    const value = inline ?? rest[++index];
    if (key === "state") options.statePath = value;
    else if (key === "output") options.outputPath = value;
    else if (key === "owner") options.owner = value;
    else if (key === "owner-type") options.ownerType = value;
    else if (key === "now") options.now = Date.parse(value);
    else if (key === "max-requests") options.maxRequests = Number(value);
  }
  return { command, target, options };
};

if (
  process.argv[1] &&
  (resolvePath(process.argv[1]) ===
    resolvePath(fileURLToPath(import.meta.url)) ||
    process.argv[1]
      .replaceAll("\\", "/")
      .endsWith("scripts/portfolio/sync.mjs"))
) {
  const parsed = parseArgs(process.argv.slice(2));
  run({
    ...parsed.options,
    command: parsed.command,
    target: parsed.target,
    writeDataFiles: true,
  })
    .then(result => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.complete === false) process.exitCode = 1;
    })
    .catch(error => {
      const code = error.code ?? error.message ?? "portfolio_sync_failed";
      process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
      process.exitCode = code === "inventory_incomplete" ? 2 : 1;
    });
}
