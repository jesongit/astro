/**
 * Server-only GitHub integration for the administration API.
 *
 * The settings file is the authority for display configuration.  The client
 * deliberately exposes only the small Contents and Actions surface needed by
 * the admin API; tokens and upstream response bodies never leave this module.
 */

export const DEFAULT_SETTINGS_PATH = "data/portfolio/settings.json";
export const DEFAULT_BRANCH = "main";
export const DEFAULT_WORKFLOW = "portfolio-sync.yml";
export const DEFAULT_API_VERSION = "2022-11-28";

const GITHUB_API = "https://api.github.com";
const MAX_SETTINGS_BYTES = 32 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const SAFE_OWNER_OR_REPO = /^[A-Za-z0-9_.-]+$/;
const SAFE_REPO_ID = /^\d{1,12}$/;

export interface GitHubAdminConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  settingsPath: string;
  workflow: string;
  apiVersion: string;
}

export interface GitHubSettingsEntry {
  visible: boolean;
  featured: boolean;
  order: number;
  acknowledgedIncidentId: string | null;
}

export interface GitHubSettingsFile {
  version: 1;
  repos: Record<string, GitHubSettingsEntry>;
}

export interface SettingsSnapshot {
  sha: string | null;
  version: 1;
  repos: Record<string, GitHubSettingsEntry>;
}

export interface SettingsPatch {
  [repoId: string]: Partial<GitHubSettingsEntry>;
}

export interface SettingsSaveResult {
  committed: boolean;
  sha: string | null;
  commitSha: string | null;
  changedRepoIds: string[];
  unchangedRepoIds: string[];
  settings: Record<string, GitHubSettingsEntry>;
}

export interface ActionsScope {
  kind: "all" | "repo";
  repoId?: string;
}

export interface DispatchedWorkflow {
  dispatchId: string;
  runId: string | null;
  state: ActionState;
  workflow: string;
  ref: string;
  scope: ActionsScope;
  createdAt: string;
}

export type ActionState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "unknown";

export interface ActionRunSummary {
  runId: string;
  state: ActionState;
  status: string;
  conclusion: string | null;
  workflow: string;
  ref: string;
  htmlUrl: string | null;
  runNumber: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ActionHandle {
  dispatchId: string;
  scope: ActionsScope;
  createdAt: string;
}

export class GitHubAdminError extends Error {
  constructor(
    public readonly status: number,
    public readonly operation: "read" | "write" | "dispatch" | "run",
    message = "GitHub 请求失败。"
  ) {
    super(message);
    this.name = "GitHubAdminError";
  }
}

export class SettingsFileError extends Error {
  constructor(message = "GitHub 设置文件格式无效。") {
    super(message);
    this.name = "SettingsFileError";
  }
}

export class SettingsConflictError extends Error {
  constructor(
    public readonly expectedSha: string | null,
    public readonly actualSha: string | null
  ) {
    super("GitHub 设置文件版本已变化。请刷新后重试。");
    this.name = "SettingsConflictError";
  }
}

const asString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const envValue = (env: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = asString(env[key]);
    if (value) return value;
  }
  return "";
};

/**
 * Build configuration without ever including the token in an error or
 * response. Defaults describe this repository only; deployment can override
 * them with explicit server-side variables.
 */
export function getGitHubAdminConfig(
  env: Record<string, unknown>
): GitHubAdminConfig | null {
  const token = envValue(env, "GITHUB_TOKEN", "GITHUB_PAT");
  if (!token || /[\u0000-\u001f\u007f]/.test(token)) return null;

  const repository = envValue(env, "GITHUB_REPOSITORY");
  const repositoryParts = repository.split("/");
  if (repository && repositoryParts.length !== 2) return null;
  const owner =
    envValue(env, "GITHUB_OWNER") || repositoryParts[0] || "jesongit";
  const repo =
    envValue(env, "GITHUB_REPO", "GITHUB_REPOSITORY_NAME") ||
    (repositoryParts.length === 2 ? repositoryParts[1] : "astro");

  if (!SAFE_OWNER_OR_REPO.test(owner) || !SAFE_OWNER_OR_REPO.test(repo)) {
    return null;
  }

  const settingsPath =
    envValue(env, "GITHUB_SETTINGS_PATH", "PORTFOLIO_SETTINGS_PATH") ||
    DEFAULT_SETTINGS_PATH;
  if (!isSafeRelativePath(settingsPath)) return null;

  const workflow =
    envValue(
      env,
      "GITHUB_WORKFLOW_ID",
      "GITHUB_WORKFLOW_FILE",
      "PORTFOLIO_WORKFLOW_ID",
      "PORTFOLIO_WORKFLOW"
    ) || DEFAULT_WORKFLOW;
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(workflow)) return null;

  const branch =
    envValue(env, "GITHUB_BRANCH", "PORTFOLIO_BRANCH") || DEFAULT_BRANCH;
  if (
    branch.length > 240 ||
    branch.startsWith("/") ||
    branch.includes("..") ||
    /[\u0000-\u001f\u007f]/.test(branch)
  ) {
    return null;
  }

  const apiVersion = envValue(env, "GITHUB_API_VERSION") || DEFAULT_API_VERSION;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiVersion)) return null;

  return {
    token,
    owner,
    repo,
    branch,
    settingsPath,
    workflow,
    apiVersion,
  };
}

function isSafeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").some(part => part === "" || part === "." || part === "..")
  );
}

function pathPart(value: string): string {
  return encodeURIComponent(value);
}

function settingsEntriesEqual(
  a: GitHubSettingsEntry,
  b: GitHubSettingsEntry
): boolean {
  return (
    a.visible === b.visible &&
    a.featured === b.featured &&
    a.order === b.order &&
    a.acknowledgedIncidentId === b.acknowledgedIncidentId
  );
}

function cloneEntry(entry: GitHubSettingsEntry): GitHubSettingsEntry {
  return { ...entry };
}

function defaultEntry(): GitHubSettingsEntry {
  return {
    visible: false,
    featured: false,
    order: 1000,
    acknowledgedIncidentId: null,
  };
}

function parseSettingsEntry(value: unknown): GitHubSettingsEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SettingsFileError();
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    "visible",
    "featured",
    "order",
    "acknowledgedIncidentId",
  ]);
  if (Object.keys(record).some(key => !allowed.has(key))) {
    throw new SettingsFileError();
  }
  const entry = defaultEntry();
  if (record.visible !== undefined) {
    if (typeof record.visible !== "boolean") throw new SettingsFileError();
    entry.visible = record.visible;
  }
  if (record.featured !== undefined) {
    if (typeof record.featured !== "boolean") throw new SettingsFileError();
    entry.featured = record.featured;
  }
  if (record.order !== undefined) {
    if (
      typeof record.order !== "number" ||
      !Number.isSafeInteger(record.order) ||
      record.order < 0 ||
      record.order > 1_000_000
    ) {
      throw new SettingsFileError();
    }
    entry.order = record.order;
  }
  if (record.acknowledgedIncidentId !== undefined) {
    if (
      record.acknowledgedIncidentId !== null &&
      typeof record.acknowledgedIncidentId !== "string"
    ) {
      throw new SettingsFileError();
    }
    entry.acknowledgedIncidentId = record.acknowledgedIncidentId as
      | string
      | null;
  }
  return entry;
}

export function parseSettingsFile(raw: string): GitHubSettingsFile {
  if (new TextEncoder().encode(raw).byteLength > MAX_SETTINGS_BYTES) {
    throw new SettingsFileError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SettingsFileError();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SettingsFileError();
  }
  const record = parsed as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.repos !== "object" ||
    record.repos === null ||
    Array.isArray(record.repos)
  ) {
    throw new SettingsFileError();
  }
  const repos: Record<string, GitHubSettingsEntry> = {};
  for (const [repoId, value] of Object.entries(record.repos)) {
    if (!SAFE_REPO_ID.test(repoId)) throw new SettingsFileError();
    repos[repoId] = parseSettingsEntry(value);
  }
  return { version: 1, repos };
}

export function serializeSettingsFile(snapshot: SettingsSnapshot): string {
  const repos: Record<string, GitHubSettingsEntry> = {};
  for (const repoId of Object.keys(snapshot.repos).sort(
    (a, b) => Number(a) - Number(b)
  )) {
    repos[repoId] = cloneEntry(snapshot.repos[repoId]!);
  }
  const text = `${JSON.stringify({ version: 1, repos }, null, 2)}\n`;
  if (new TextEncoder().encode(text).byteLength > MAX_SETTINGS_BYTES) {
    throw new SettingsFileError("GitHub 设置文件超过大小上限。");
  }
  return text;
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }
  return btoa(binary);
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Opaque, non-secret polling handle; it contains no token or upstream body. */
export function encodeActionHandle(handle: ActionHandle): string {
  return encodeBase64Utf8(JSON.stringify(handle))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeActionHandle(value: string): ActionHandle | null {
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const handle = JSON.parse(
      decodeBase64Utf8(padded + "=".repeat((4 - (padded.length % 4)) % 4))
    ) as unknown;
    if (typeof handle !== "object" || handle === null || Array.isArray(handle))
      return null;
    const record = handle as Record<string, unknown>;
    const dispatchId =
      typeof record.dispatchId === "string" ? record.dispatchId : "";
    const createdAt =
      typeof record.createdAt === "string" ? record.createdAt : "";
    const scope = record.scope;
    if (
      !/^[0-9a-f-]{36}$/i.test(dispatchId) ||
      !createdAt ||
      !scope ||
      typeof scope !== "object" ||
      Array.isArray(scope)
    )
      return null;
    const scopeRecord = scope as Record<string, unknown>;
    if (scopeRecord.kind !== "all" && scopeRecord.kind !== "repo") return null;
    if (
      scopeRecord.kind === "repo" &&
      (typeof scopeRecord.repoId !== "string" ||
        !SAFE_REPO_ID.test(scopeRecord.repoId))
    )
      return null;
    return {
      dispatchId,
      createdAt,
      scope:
        scopeRecord.kind === "repo"
          ? { kind: "repo", repoId: scopeRecord.repoId as string }
          : { kind: "all" },
    };
  } catch {
    return null;
  }
}

function contentsPath(path: string): string {
  return path.split("/").map(pathPart).join("/");
}

function safeActionState(status: unknown, conclusion: unknown): ActionState {
  const s = typeof status === "string" ? status : "";
  const c = typeof conclusion === "string" ? conclusion : null;
  if (s === "completed") {
    if (c === "success" || c === "neutral" || c === "skipped")
      return "succeeded";
    if (c === "cancelled") return "cancelled";
    return "failed";
  }
  if (s === "queued" || s === "waiting" || s === "pending") return "queued";
  if (s === "in_progress") return "running";
  return "unknown";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export class GitHubAdminClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: GitHubAdminConfig,
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {
    this.fetchImpl = fetchImpl;
  }

  get settingsConfig(): GitHubAdminConfig {
    return this.config;
  }

  private repoPrefix(): string {
    return `/repos/${pathPart(this.config.owner)}/${pathPart(this.config.repo)}`;
  }

  private async request(
    path: string,
    init: RequestInit | undefined,
    operation: GitHubAdminError["operation"]
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${GITHUB_API}${path}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "posase-portfolio-admin",
          "X-GitHub-Api-Version": this.config.apiVersion,
          Authorization: `Bearer ${this.config.token}`,
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new GitHubAdminError(503, operation, "GitHub 暂时不可用。");
    }
    if (!response.ok) {
      const status = response.status;
      const message =
        status === 401
          ? "GitHub 凭据无效。"
          : status === 403 || status === 429
            ? "GitHub 请求受限,请稍后重试。"
            : status >= 500
              ? "GitHub 暂时不可用。"
              : "GitHub 请求失败。";
      throw new GitHubAdminError(status, operation, message);
    }
    return response;
  }

  private async getJson(
    path: string,
    operation: GitHubAdminError["operation"]
  ): Promise<Record<string, unknown>> {
    const response = await this.request(path, undefined, operation);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new GitHubAdminError(502, operation, "GitHub 返回格式无效。");
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new GitHubAdminError(502, operation, "GitHub 返回格式无效。");
    }
    return value as Record<string, unknown>;
  }

  async readSettingsFile(): Promise<{
    sha: string | null;
    file: GitHubSettingsFile;
  }> {
    const path = `${this.repoPrefix()}/contents/${contentsPath(this.config.settingsPath)}?ref=${encodeURIComponent(this.config.branch)}`;
    let response: Response;
    try {
      response = await this.fetchImpl(`${GITHUB_API}${path}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "posase-portfolio-admin",
          "X-GitHub-Api-Version": this.config.apiVersion,
          Authorization: `Bearer ${this.config.token}`,
        },
      });
    } catch {
      throw new GitHubAdminError(503, "read", "GitHub 暂时不可用。");
    }
    if (response.status === 404) {
      return { sha: null, file: { version: 1, repos: {} } };
    }
    if (!response.ok) {
      const status = response.status;
      throw new GitHubAdminError(
        status,
        "read",
        status === 401 ? "GitHub 凭据无效。" : "GitHub 请求失败。"
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new GitHubAdminError(502, "read", "GitHub 返回格式无效。");
    }
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new GitHubAdminError(502, "read", "GitHub 返回格式无效。");
    }
    const record = payload as Record<string, unknown>;
    if (
      record.type !== "file" ||
      typeof record.sha !== "string" ||
      typeof record.content !== "string"
    ) {
      throw new GitHubAdminError(502, "read", "GitHub 设置文件响应无效。");
    }
    try {
      return {
        sha: record.sha,
        file: parseSettingsFile(decodeBase64Utf8(record.content)),
      };
    } catch (error) {
      if (error instanceof SettingsFileError) throw error;
      throw new SettingsFileError();
    }
  }

  async getSettings(): Promise<SettingsSnapshot> {
    const result = await this.readSettingsFile();
    return { sha: result.sha, version: 1, repos: result.file.repos };
  }

  async saveSettings(
    patch: SettingsPatch,
    expectedSha: string | null | undefined
  ): Promise<SettingsSaveResult> {
    const current = await this.getSettings();
    const isInitialRepoSave =
      expectedSha === "" &&
      Object.keys(patch).every(repoId => !current.repos[repoId]);
    // The legacy UI represented a missing repo entry with an empty revision.
    // Once the file exists, bind that first save to the current file SHA while
    // still using the PUT sha guard against a concurrent update.
    const effectiveExpected = isInitialRepoSave ? current.sha : expectedSha;
    const normalizedExpected = effectiveExpected || null;
    if (effectiveExpected !== undefined && normalizedExpected !== current.sha) {
      throw new SettingsConflictError(normalizedExpected, current.sha);
    }

    const next: SettingsSnapshot = {
      sha: current.sha,
      version: 1,
      repos: Object.fromEntries(
        Object.entries(current.repos).map(([repoId, entry]) => [
          repoId,
          cloneEntry(entry),
        ])
      ),
    };
    const changedRepoIds: string[] = [];
    const unchangedRepoIds: string[] = [];
    for (const [repoId, rawPatch] of Object.entries(patch)) {
      if (!SAFE_REPO_ID.test(repoId))
        throw new SettingsFileError("仓库 ID 不合法。");
      const before = next.repos[repoId] ?? defaultEntry();
      const after = parseSettingsEntry({ ...before, ...rawPatch });
      if (settingsEntriesEqual(before, after) && next.repos[repoId]) {
        unchangedRepoIds.push(repoId);
        continue;
      }
      next.repos[repoId] = after;
      changedRepoIds.push(repoId);
    }

    if (changedRepoIds.length === 0) {
      return {
        committed: false,
        sha: current.sha,
        commitSha: null,
        changedRepoIds,
        unchangedRepoIds,
        settings: next.repos,
      };
    }

    const content = serializeSettingsFile(next);
    const path = `${this.repoPrefix()}/contents/${contentsPath(this.config.settingsPath)}`;
    const body: Record<string, unknown> = {
      message: "chore(portfolio): update display settings",
      content: encodeBase64Utf8(content),
      branch: this.config.branch,
    };
    if (current.sha) body.sha = current.sha;
    const response = await this.request(
      path,
      { method: "PUT", body: JSON.stringify(body) },
      "write"
    );
    const payload = await this.readJsonResponse(response, "write");
    const contentRecord = this.asObject(payload.content);
    const commitRecord = this.asObject(payload.commit);
    const sha =
      typeof contentRecord?.sha === "string" ? contentRecord.sha : null;
    if (!sha)
      throw new GitHubAdminError(502, "write", "GitHub 未返回设置版本。");
    return {
      committed: true,
      sha,
      commitSha:
        typeof commitRecord?.sha === "string" ? commitRecord.sha : null,
      changedRepoIds,
      unchangedRepoIds,
      settings: next.repos,
    };
  }

  async dispatchWorkflow(scope: ActionsScope): Promise<DispatchedWorkflow> {
    const createdAt = new Date().toISOString();
    const dispatchId = crypto.randomUUID();
    const path = `${this.repoPrefix()}/actions/workflows/${pathPart(this.config.workflow)}/dispatches`;
    const inputs: Record<string, string> = { scope: scope.kind };
    if (scope.kind === "repo" && scope.repoId) inputs.repoId = scope.repoId;
    await this.request(
      path,
      {
        method: "POST",
        body: JSON.stringify({ ref: this.config.branch, inputs }),
      },
      "dispatch"
    );

    return {
      dispatchId,
      // GitHub's dispatch endpoint intentionally returns no run id. The
      // status endpoint resolves it by dispatch time, then polls by numeric
      // run id once one is available.
      runId: null,
      state: "queued",
      workflow: this.config.workflow,
      ref: this.config.branch,
      scope,
      createdAt,
    };
  }

  async getWorkflowRun(runId: string): Promise<ActionRunSummary | null> {
    if (!/^\d{1,32}$/.test(runId)) return null;
    const path = `${this.repoPrefix()}/actions/runs/${pathPart(runId)}`;
    let record: Record<string, unknown>;
    try {
      record = await this.getJson(path, "run");
    } catch (error) {
      if (error instanceof GitHubAdminError && error.status === 404)
        return null;
      throw error;
    }
    return this.toRunSummary(record);
  }

  async listWorkflowRuns(): Promise<ActionRunSummary[]> {
    const path = `${this.repoPrefix()}/actions/workflows/${pathPart(this.config.workflow)}/runs?branch=${encodeURIComponent(this.config.branch)}&event=workflow_dispatch&per_page=20`;
    const payload = await this.getJson(path, "run");
    if (!Array.isArray(payload.workflow_runs)) {
      throw new GitHubAdminError(502, "run", "GitHub 返回格式无效。");
    }
    return payload.workflow_runs.flatMap(item => {
      if (typeof item !== "object" || item === null || Array.isArray(item))
        return [];
      return [this.toRunSummary(item as Record<string, unknown>)];
    });
  }

  private toRunSummary(record: Record<string, unknown>): ActionRunSummary {
    const runId =
      typeof record.id === "number" || typeof record.id === "string"
        ? String(record.id)
        : "";
    if (!runId) throw new GitHubAdminError(502, "run", "GitHub 返回格式无效。");
    return {
      runId,
      state: safeActionState(record.status, record.conclusion),
      status: typeof record.status === "string" ? record.status : "unknown",
      conclusion: asNullableString(record.conclusion),
      workflow:
        typeof record.workflow_id === "number" ||
        typeof record.workflow_id === "string"
          ? String(record.workflow_id)
          : this.config.workflow,
      ref:
        typeof record.head_branch === "string"
          ? record.head_branch
          : this.config.branch,
      htmlUrl: asNullableString(record.html_url),
      runNumber:
        typeof record.run_number === "number" ? record.run_number : null,
      createdAt: asNullableString(record.created_at),
      updatedAt: asNullableString(record.updated_at),
    };
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private async readJsonResponse(
    response: Response,
    operation: GitHubAdminError["operation"]
  ): Promise<Record<string, unknown>> {
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new GitHubAdminError(502, operation, "GitHub 返回格式无效。");
    }
    const record = this.asObject(value);
    if (!record)
      throw new GitHubAdminError(502, operation, "GitHub 返回格式无效。");
    return record;
  }
}

export function actionStateFromRun(run: ActionRunSummary | null): ActionState {
  return run?.state ?? "unknown";
}
