/**
 * 管理页前端逻辑(计划 §10.1):
 * - 会话获取 CSRF token(只驻留内存);
 * - 一次读取完整候选清单,搜索/筛选只作用于本地数据;
 * - 展示、精选和排序先写入本地草稿,明确保存后才提交;
 * - 202 手动同步任务显示服务端实际状态并轮询至终态;
 * - 有未保存修改时保护刷新、返回和页面离开。
 */
interface AdminRepo {
  repoId: string;
  fullName: string;
  visible: boolean;
  featured: boolean;
  order: number | null;
  mode: string;
  configState: string;
  releaseState: string;
  eligibility: string;
  warnings: string[];
}

interface AdminReposResponse {
  repos: AdminRepo[];
  cursor: string | null;
  inventoryComplete: boolean;
}

interface RepoDetail {
  repoId: string;
  settings: {
    revision: string;
    acknowledgedIncidentId: string | null;
  } | null;
  latestIncident: {
    incidentId: string;
    reason: string;
    observedAt: string;
  } | null;
  needsIncidentAcknowledgement: boolean;
}

interface SavedSettings {
  repoId: string;
  visible: boolean;
  featured: boolean;
  order: number;
  revision: string;
  acknowledgedIncidentId: string | null;
}

interface SyncJobResponse {
  jobId: string;
  state: string;
  counts: Record<string, number> | null;
  errorCodes: string[] | null;
  retryAt: string | null;
}

interface ApiFailureBody {
  message?: string;
  code?: string;
  retryAt?: string;
  fieldErrors?: { path: string; message: string }[];
}

class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAt?: string;

  constructor(status: number, body: ApiFailureBody | null) {
    const extra = body?.fieldErrors
      ?.map(field => `${field.path}: ${field.message}`)
      .join("; ");
    const details = [body?.message, extra].filter(Boolean).join(" ");
    super(`${status} ${body?.code ?? ""} ${details}`.trim());
    this.name = "ApiFailure";
    this.status = status;
    this.code = body?.code ?? "request_failed";
    this.retryAt = body?.retryAt;
  }
}

type RepoDraft = {
  visible: boolean;
  featured: boolean;
  order: string;
  acknowledgedIncidentId?: string;
  incidentAcknowledgementTouched: boolean;
};

const DEFAULT_ORDER = 1000;
const ORDER_MIN = 0;
const ORDER_MAX = 1_000_000;
const TERMINAL_JOB_STATES = new Set([
  "succeeded",
  "partial",
  "failed",
  "expired",
  "interrupted",
]);
const JOB_STATE_LABELS: Record<string, string> = {
  queued: "已排队",
  running: "执行中",
  succeeded: "成功",
  partial: "部分成功",
  failed: "失败",
  expired: "已过期",
  interrupted: "已中断",
  unknown: "未知",
};

const state = {
  csrfToken: "",
  revisions: new Map<string, string>(),
  serverAcknowledgements: new Map<string, string | null>(),
  latestIncidents: new Map<string, RepoDetail["latestIncident"]>(),
  needsIncidentAcknowledgement: new Set<string>(),
  drafts: new Map<string, RepoDraft>(),
  dirty: new Set<string>(),
  saving: new Set<string>(),
  syncing: new Set<string>(),
  repos: [] as AdminRepo[],
  inventoryComplete: false,
  reposLoaded: false,
  loading: false,
  bulkSaving: false,
  protectionInstalled: false,
};

const $ = (sel: string): HTMLElement =>
  document.querySelector(sel) as HTMLElement;

async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(state.csrfToken ? { "X-Portfolio-CSRF": state.csrfToken } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as ApiFailureBody | null;
    throw new ApiFailure(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  );
}

function getRepo(repoId: string): AdminRepo | undefined {
  return state.repos.find(repo => repo.repoId === repoId);
}

function serverDraft(repo: AdminRepo): RepoDraft {
  return {
    visible: repo.visible,
    featured: repo.featured,
    order: String(repo.order ?? DEFAULT_ORDER),
    incidentAcknowledgementTouched: false,
  };
}

function getDraft(repo: AdminRepo): RepoDraft {
  const existing = state.drafts.get(repo.repoId);
  if (existing) return existing;
  const draft = serverDraft(repo);
  state.drafts.set(repo.repoId, draft);
  return draft;
}

function validOrder(value: string): boolean {
  if (value.trim() === "") return false;
  const order = Number(value);
  return Number.isInteger(order) && order >= ORDER_MIN && order <= ORDER_MAX;
}

function isDraftDirty(repoId: string): boolean {
  const repo = getRepo(repoId);
  const draft = repo && state.drafts.get(repoId);
  if (!repo || !draft) return false;

  const serverOrder = repo.order ?? DEFAULT_ORDER;
  const orderChanged =
    !validOrder(draft.order) || Number(draft.order) !== serverOrder;
  const acknowledgementChanged =
    draft.incidentAcknowledgementTouched &&
    (draft.acknowledgedIncidentId ?? null) !==
      (state.serverAcknowledgements.get(repoId) ?? null);
  return (
    draft.visible !== repo.visible ||
    draft.featured !== repo.featured ||
    orderChanged ||
    acknowledgementChanged
  );
}

function refreshDirty(repoId: string): void {
  if (isDraftDirty(repoId)) state.dirty.add(repoId);
  else state.dirty.delete(repoId);
}

function hasDirtyChanges(): boolean {
  return state.dirty.size > 0;
}

function cardFor(repoId: string): HTMLElement | null {
  return document.querySelector(`article[data-repo-id="${repoId}"]`);
}

function updateRepoControls(card: HTMLElement): void {
  const repoId = card.dataset.repoId ?? "";
  const isSaving = state.saving.has(repoId);
  const isSyncing = state.syncing.has(repoId);
  const dirty = state.dirty.has(repoId);
  const settingsDisabled = isSaving || state.bulkSaving;

  card
    .querySelectorAll<HTMLElement>(
      '[data-act="visible"], [data-act="featured"], [data-act="order"]'
    )
    .forEach(control => {
      (control as HTMLInputElement).disabled = settingsDisabled;
    });
  const save = card.querySelector('[data-act="save"]') as HTMLButtonElement;
  if (save) save.disabled = settingsDisabled || !dirty;
  const sync = card.querySelector('[data-act="sync"]') as HTMLButtonElement;
  if (sync) sync.disabled = isSaving || isSyncing || state.bulkSaving;

  card.dataset.dirty = dirty ? "1" : "0";
  card.classList.toggle("border-accent/60", dirty);
  const dirtyLabel = card.querySelector('[data-role="dirty"]');
  if (dirtyLabel) dirtyLabel.textContent = dirty ? "未保存修改" : "已保存";
}

function updateGlobalUi(): void {
  const count = state.dirty.size;
  const dirtyMeta = $("#dirty-meta");
  dirtyMeta.textContent = count > 0 ? `${count} 项未保存` : "没有未保存修改";
  dirtyMeta.classList.toggle("text-accent", count > 0);

  const saveAll = $("#btn-save-all") as HTMLButtonElement;
  saveAll.disabled = state.bulkSaving || state.saving.size > 0 || count === 0;
  const reload = $("#btn-reload") as HTMLButtonElement;
  reload.disabled = state.loading || state.bulkSaving || state.saving.size > 0;

  document
    .querySelectorAll<HTMLElement>("article[data-repo-id]")
    .forEach(updateRepoControls);
}

function setCardStatus(card: HTMLElement | null, message: string): void {
  const status = card?.querySelector('[data-role="status"]');
  if (status) status.textContent = message;
}

function setSyncStatus(card: HTMLElement | null, message: string): void {
  const status = card?.querySelector('[data-role="sync-status"]');
  if (status) status.textContent = message;
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiFailure) {
    const retry = error.retryAt
      ? `下次可重试时间:${new Date(error.retryAt).toLocaleString("zh-CN")}`
      : "";
    return [error.message, retry].filter(Boolean).join(" ");
  }
  return error instanceof Error ? error.message : "未知错误";
}

function formatJobStatus(
  job: Pick<SyncJobResponse, "state" | "counts" | "errorCodes" | "retryAt">
): string {
  const label = JOB_STATE_LABELS[job.state] ?? job.state;
  const counts = job.counts ? ` 计数:${JSON.stringify(job.counts)}` : "";
  const errors =
    job.errorCodes && job.errorCodes.length > 0
      ? ` 错误:${job.errorCodes.join(",")}`
      : "";
  const retry = job.retryAt
    ? ` 下次可重试:${new Date(job.retryAt).toLocaleString("zh-CN")}`
    : "";
  return `同步任务:${label}(${job.state})${counts}${errors}${retry}`;
}

async function loadSession(): Promise<void> {
  const session = await api<{
    email: string;
    csrfToken: string;
  }>("/api/admin/session");
  state.csrfToken = session.csrfToken;
  $("#admin-identity").textContent = session.email;
}

function renderIncident(repoId: string, card: HTMLElement | null): void {
  if (!card) return;
  const box = card.querySelector(
    '[data-role="incident"]'
  ) as HTMLElement | null;
  const incident = state.latestIncidents.get(repoId);
  if (!box || !incident || !state.needsIncidentAcknowledgement.has(repoId)) {
    box?.classList.add("hidden");
    return;
  }

  const repo = getRepo(repoId);
  if (!repo) return;
  const draft = getDraft(repo);
  const acknowledged = draft.acknowledgedIncidentId === incident.incidentId;
  box.classList.remove("hidden");
  box.innerHTML = `
    <p>存在未确认撤下事件(${escapeHtml(incident.reason)},${escapeHtml(incident.observedAt)})。恢复展示前必须确认。</p>
    <label class="mt-2 inline-flex items-start gap-2">
      <input type="checkbox" data-act="acknowledge" ${acknowledged ? "checked" : ""} />
      <span>我确认该事件，并允许保存为展示</span>
    </label>
  `;
}

function renderRepos(): void {
  const q = ($("#filter-q") as HTMLInputElement).value.trim().toLowerCase();
  const status = ($("#filter-status") as HTMLSelectElement).value;
  let repos = state.repos.filter(repo =>
    q
      ? repo.fullName.toLowerCase().includes(q) ||
        repo.repoId.toLowerCase().includes(q)
      : true
  );
  if (status === "visible")
    repos = repos.filter(repo => getDraft(repo).visible);
  if (status === "hidden")
    repos = repos.filter(repo => !getDraft(repo).visible);
  if (status === "featured")
    repos = repos.filter(repo => getDraft(repo).featured);
  if (status === "enhanced")
    repos = repos.filter(repo => repo.mode === "enhanced");
  if (status === "config_error")
    repos = repos.filter(repo => repo.configState === "invalid");
  if (status === "sync_error") {
    repos = repos.filter(
      repo =>
        repo.eligibility === "unknown" ||
        repo.releaseState === "error" ||
        repo.warnings.length > 0
    );
  }

  $("#list-meta").textContent = state.inventoryComplete
    ? `显示 ${repos.length} / ${state.repos.length} 个候选(清单完整)`
    : `显示 ${repos.length} / ${state.repos.length} 个候选(清单不完整,数据可能滞后)`;
  const container = $("#repos");
  container.replaceChildren();
  if (repos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "border border-border p-4 text-sm text-foreground/60";
    empty.textContent =
      state.repos.length === 0 ? "暂无候选作品。" : "没有匹配的候选作品。";
    container.append(empty);
  } else {
    for (const repo of repos) container.append(renderRepo(repo));
  }
  updateGlobalUi();
}

async function loadRepos(force = false): Promise<void> {
  if (!force && state.reposLoaded) {
    renderRepos();
    return;
  }
  if (state.loading) return;
  if (force && hasDirtyChanges()) {
    const confirmed = window.confirm(
      "当前有未保存修改。刷新会丢弃这些草稿，确定继续吗？"
    );
    if (!confirmed) return;
  }

  state.loading = true;
  updateGlobalUi();
  $("#list-meta").textContent = "正在读取完整候选清单…";
  try {
    const repos: AdminRepo[] = [];
    const seenRepoIds = new Set<string>();
    let cursor: string | null = null;
    const seenCursors = new Set<string>();
    let inventoryComplete = false;

    do {
      const path: string = cursor
        ? `/api/admin/repos?cursor=${encodeURIComponent(cursor)}`
        : "/api/admin/repos";
      const data: AdminReposResponse = await api<AdminReposResponse>(path);
      inventoryComplete = data.inventoryComplete;
      for (const repo of data.repos) {
        if (!seenRepoIds.has(repo.repoId)) {
          seenRepoIds.add(repo.repoId);
          repos.push(repo);
        }
      }
      if (data.cursor && seenCursors.has(data.cursor)) {
        throw new Error("候选清单分页游标未向前推进");
      }
      if (data.cursor) seenCursors.add(data.cursor);
      cursor = data.cursor;
    } while (cursor);

    state.repos = repos;
    state.inventoryComplete = inventoryComplete;
    state.reposLoaded = true;
    state.revisions.clear();
    state.serverAcknowledgements.clear();
    state.latestIncidents.clear();
    state.needsIncidentAcknowledgement.clear();
    state.drafts.clear();
    state.dirty.clear();
    renderRepos();
  } catch (error) {
    $("#list-meta").textContent = `读取失败:${formatApiError(error)}`;
    throw error;
  } finally {
    state.loading = false;
    updateGlobalUi();
  }
}

function renderRepo(repo: AdminRepo): HTMLElement {
  const card = document.createElement("article");
  card.className = "border border-border bg-muted/40 p-4";
  card.dataset.repoId = repo.repoId;

  const draft = getDraft(repo);
  const isSaving = state.saving.has(repo.repoId);
  const isSyncing = state.syncing.has(repo.repoId);
  const dirty = state.dirty.has(repo.repoId);
  const warningHtml = repo.warnings
    .map(
      warning =>
        `<span class="text-xs text-accent">${escapeHtml(warning)}</span>`
    )
    .join("");
  const stateText = `${repo.mode === "enhanced" ? "增强" : "基础"}${
    repo.configState === "invalid" ? " · 配置错误" : ""
  }${repo.releaseState === "error" ? " · Release 异常" : ""}${
    repo.eligibility !== "public"
      ? ` · 资格:${escapeHtml(repo.eligibility)}`
      : ""
  }`;

  card.innerHTML = `
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <a class="font-semibold hover:text-accent" href="/projects/gh-${escapeHtml(repo.repoId)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.fullName)}</a>
      <span class="text-xs text-foreground/50">gh-${escapeHtml(repo.repoId)}</span>
      <span class="text-xs text-foreground/60">${stateText}</span>
      ${warningHtml}
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-4 text-sm">
      <label><input type="checkbox" data-act="visible" ${draft.visible ? "checked" : ""} ${isSaving || state.bulkSaving ? "disabled" : ""}/> 展示</label>
      <label><input type="checkbox" data-act="featured" ${draft.featured ? "checked" : ""} ${isSaving || state.bulkSaving ? "disabled" : ""}/> 精选</label>
      <label>排序 <input type="number" data-act="order" value="${escapeHtml(draft.order)}" min="${ORDER_MIN}" max="${ORDER_MAX}" step="1" class="w-24 border border-border bg-background px-2 py-1" ${isSaving || state.bulkSaving ? "disabled" : ""}/></label>
      <button type="button" data-act="save" class="btn-line" title="保存展示、精选和排序设置" ${isSaving || state.bulkSaving || !dirty ? "disabled" : ""}>保存设置</button>
      <button type="button" data-act="sync" class="btn-line" ${isSaving || isSyncing || state.bulkSaving ? "disabled" : ""}>同步此仓库</button>
      <span data-role="dirty" class="text-xs ${dirty ? "text-accent" : "text-foreground/60"}" aria-live="polite">${dirty ? "未保存修改" : "已保存"}</span>
      <span data-role="status" class="text-xs text-foreground/60" aria-live="polite">${dirty ? "请保存草稿" : ""}</span>
      <span data-role="sync-status" class="text-xs text-foreground/60" aria-live="polite">${isSyncing ? "同步任务:执行中" : ""}</span>
    </div>
    <div data-role="incident" class="mt-3 hidden border border-accent/50 bg-muted p-3 text-sm"></div>
  `;

  renderIncident(repo.repoId, card);

  card.addEventListener("input", event => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.act === "order")
      updateDraftFromControl(card, repo.repoId, target);
  });
  card.addEventListener("change", event => {
    const target = event.target as HTMLInputElement;
    if (
      target.dataset.act === "visible" ||
      target.dataset.act === "featured" ||
      target.dataset.act === "acknowledge"
    ) {
      updateDraftFromControl(card, repo.repoId, target);
    }
  });
  card.addEventListener("click", event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "button[data-act]"
    );
    if (!target) return;
    const act = target.dataset.act;
    if (act === "save" || act === "sync") {
      void handleAct(card, repo.repoId, act);
    }
  });

  return card;
}

function updateDraftFromControl(
  card: HTMLElement,
  repoId: string,
  control: HTMLInputElement
): void {
  const repo = getRepo(repoId);
  if (!repo) return;
  const draft = getDraft(repo);
  if (control.dataset.act === "visible") draft.visible = control.checked;
  else if (control.dataset.act === "featured") draft.featured = control.checked;
  else if (control.dataset.act === "order") draft.order = control.value;
  else if (control.dataset.act === "acknowledge") {
    const incident = state.latestIncidents.get(repoId);
    draft.incidentAcknowledgementTouched = true;
    draft.acknowledgedIncidentId =
      control.checked && incident
        ? incident.incidentId
        : (state.serverAcknowledgements.get(repoId) ?? undefined);
  }
  refreshDirty(repoId);
  setCardStatus(card, state.dirty.has(repoId) ? "请保存草稿" : "");
  updateGlobalUi();
}

async function getRevision(repoId: string): Promise<RepoDetail> {
  const detail = await api<RepoDetail>(`/api/admin/repos/${repoId}`);
  state.revisions.set(repoId, detail.settings?.revision ?? "");
  state.serverAcknowledgements.set(
    repoId,
    detail.settings?.acknowledgedIncidentId ?? null
  );
  const repo = getRepo(repoId);
  const draft = repo && getDraft(repo);
  if (draft && !draft.incidentAcknowledgementTouched) {
    draft.acknowledgedIncidentId =
      detail.settings?.acknowledgedIncidentId ?? undefined;
    refreshDirty(repoId);
  }
  if (detail.latestIncident) {
    state.latestIncidents.set(repoId, detail.latestIncident);
    if (detail.needsIncidentAcknowledgement)
      state.needsIncidentAcknowledgement.add(repoId);
    else state.needsIncidentAcknowledgement.delete(repoId);
    renderIncident(repoId, cardFor(repoId));
  }
  return detail;
}

async function saveSettings(
  repoId: string,
  body: {
    visible: boolean;
    featured: boolean;
    order: number;
    revision: string;
    acknowledgedIncidentId?: string;
  }
): Promise<SavedSettings> {
  const result = await api<{ settings: SavedSettings }>(
    `/api/admin/repos/${repoId}/settings`,
    { method: "PATCH", json: body }
  );
  state.revisions.set(repoId, result.settings.revision);
  return result.settings;
}

function applySavedSettings(settings: SavedSettings): void {
  const repo = getRepo(settings.repoId);
  if (!repo) return;
  repo.visible = settings.visible;
  repo.featured = settings.featured;
  repo.order = settings.order;
  state.serverAcknowledgements.set(
    settings.repoId,
    settings.acknowledgedIncidentId ?? null
  );
  const draft = getDraft(repo);
  draft.visible = settings.visible;
  draft.featured = settings.featured;
  draft.order = String(settings.order);
  draft.acknowledgedIncidentId = settings.acknowledgedIncidentId ?? undefined;
  draft.incidentAcknowledgementTouched = false;
  state.dirty.delete(settings.repoId);
}

async function saveRepo(repoId: string): Promise<boolean> {
  const repo = getRepo(repoId);
  const card = cardFor(repoId);
  if (!repo || !state.dirty.has(repoId)) return true;
  const draft = getDraft(repo);
  if (!validOrder(draft.order)) {
    setCardStatus(card, "排序必须是 0 到 1000000 的整数");
    card?.querySelector<HTMLInputElement>('[data-act="order"]')?.focus();
    return false;
  }

  state.saving.add(repoId);
  updateGlobalUi();
  setCardStatus(card, "保存中…");
  try {
    const detail = state.revisions.has(repoId)
      ? null
      : await getRevision(repoId);
    if (
      draft.visible &&
      detail?.needsIncidentAcknowledgement &&
      draft.acknowledgedIncidentId !== detail.latestIncident?.incidentId
    ) {
      setCardStatus(card, "请先确认撤下事件,再保存恢复展示");
      renderIncident(repoId, card);
      return false;
    }

    const acknowledgedIncidentId = draft.acknowledgedIncidentId;
    const saved = await saveSettings(repoId, {
      visible: draft.visible,
      featured: draft.featured,
      order: Number(draft.order),
      revision: state.revisions.get(repoId) ?? "",
      ...(acknowledgedIncidentId ? { acknowledgedIncidentId } : {}),
    });
    applySavedSettings(saved);
    setCardStatus(card, "已保存(服务端已确认,正在传播)");
    return true;
  } catch (error) {
    setCardStatus(card, `保存失败:${formatApiError(error)}`);
    return false;
  } finally {
    state.saving.delete(repoId);
    updateGlobalUi();
  }
}

async function handleAct(
  card: HTMLElement,
  repoId: string,
  act: string | undefined
): Promise<void> {
  if (act === "save") {
    await saveRepo(repoId);
    return;
  }
  if (act !== "sync") return;

  state.syncing.add(repoId);
  updateGlobalUi();
  setSyncStatus(card, "同步任务:已排队(queued)");
  try {
    const { jobId } = await api<{ jobId: string }>("/api/admin/sync", {
      method: "POST",
      json: { scope: { kind: "repo", repoId } },
    });
    await pollJob(jobId, message => setSyncStatus(cardFor(repoId), message));
  } catch (error) {
    setSyncStatus(card, `同步失败:${formatApiError(error)}`);
  } finally {
    state.syncing.delete(repoId);
    updateGlobalUi();
  }
}

async function saveAll(): Promise<void> {
  if (state.bulkSaving || state.saving.size > 0 || !hasDirtyChanges()) return;
  const repoIds = [...state.dirty];
  state.bulkSaving = true;
  const stateEl = $("#save-all-state");
  stateEl.textContent = `正在保存 ${repoIds.length} 项…`;
  updateGlobalUi();

  let failed = 0;
  try {
    for (const repoId of repoIds) {
      if (!(await saveRepo(repoId))) failed += 1;
    }
    stateEl.textContent =
      failed > 0
        ? `${failed} 项保存失败,未保存修改仍保留`
        : `已保存 ${repoIds.length} 项(正在传播)`;
  } finally {
    state.bulkSaving = false;
    updateGlobalUi();
  }
}

async function pollJob(
  jobId: string,
  show: (message: string) => void
): Promise<SyncJobResponse> {
  for (;;) {
    const job = await api<SyncJobResponse>(`/api/admin/sync/${jobId}`);
    show(formatJobStatus(job));
    if (TERMINAL_JOB_STATES.has(job.state)) return job;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function fullSync(): Promise<void> {
  const stateEl = $("#sync-state");
  const button = $("#btn-full-sync") as HTMLButtonElement;
  button.disabled = true;
  try {
    stateEl.textContent = "同步任务:已排队(queued)";
    const { jobId } = await api<{ jobId: string }>("/api/admin/sync", {
      method: "POST",
      json: { scope: { kind: "all" } },
    });
    const job = await pollJob(
      jobId,
      message => (stateEl.textContent = message)
    );
    if (!hasDirtyChanges()) await loadRepos(true);
    else
      stateEl.textContent = `${formatJobStatus(job)};有未保存修改,未自动刷新`;
  } catch (error) {
    stateEl.textContent = `同步失败:${formatApiError(error)}`;
  } finally {
    button.disabled = false;
    updateGlobalUi();
  }
}

function installUnsavedProtection(): void {
  if (state.protectionInstalled) return;
  state.protectionInstalled = true;
  window.addEventListener("beforeunload", event => {
    if (!hasDirtyChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const link = target.closest<HTMLAnchorElement>(
      "a[data-unsaved-navigation]"
    );
    if (!link || !hasDirtyChanges()) return;
    if (!window.confirm("当前有未保存修改,确定离开并丢弃这些草稿吗？")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-admin-root]");
  if (!root || root.dataset.adminBooted === "1") return;
  root.dataset.adminBooted = "1";
  installUnsavedProtection();

  try {
    await loadSession();
    await loadRepos();
  } catch (error) {
    const errorEl = $("#error");
    errorEl.classList.remove("hidden");
    errorEl.textContent = `页面读取失败:${formatApiError(error)}`;
    return;
  }
  $("#btn-reload").addEventListener("click", () => void loadRepos(true));
  $("#filter-status").addEventListener("change", () => renderRepos());
  $("#filter-q").addEventListener("input", () => renderRepos());
  $("#btn-save-all").addEventListener("click", () => void saveAll());
  $("#btn-full-sync").addEventListener("click", () => void fullSync());
}

document.addEventListener("astro:page-load", () => void main());
if (document.readyState !== "loading") {
  void main();
}
