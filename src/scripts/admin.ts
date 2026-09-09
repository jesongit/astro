/**
 * 管理页前端逻辑(计划 §10.1):
 * - 会话获取 CSRF token(只驻留内存);
 * - 列表/筛选/刷新;逐仓库保存(保存期间禁用重复提交);
 * - 上下调整排序值(本地修改,点击保存后提交);
 * - 全量/单仓库同步 202 轮询;未确认事件显式确认后才能恢复展示。
 */
interface AdminReposResponse {
  repos: {
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
  }[];
  cursor: string | null;
  inventoryComplete: boolean;
}

interface RepoDetail {
  repoId: string;
  settings: { revision: string; acknowledgedIncidentId: string | null } | null;
  latestIncident: {
    incidentId: string;
    reason: string;
    observedAt: string;
  } | null;
  needsIncidentAcknowledgement: boolean;
}

const state = {
  csrfToken: "",
  revisions: new Map<string, string>(),
  saving: new Set<string>(),
  repos: [] as AdminReposResponse["repos"],
  inventoryComplete: false,
  reposLoaded: false,
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
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
      fieldErrors?: { path: string; message: string }[];
    } | null;
    const extra = body?.fieldErrors
      ?.map(f => `${f.path}: ${f.message}`)
      .join("; ");
    const details = [body?.message, extra].filter(Boolean).join(" ");
    throw new Error(`${response.status} ${body?.code ?? ""} ${details}`.trim());
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function loadSession(): Promise<void> {
  const session = await api<{
    email: string;
    csrfToken: string;
  }>("/api/admin/session");
  state.csrfToken = session.csrfToken;
  $("#admin-identity").textContent = session.email;
}

function renderRepos(): void {
  const q = ($("#filter-q") as HTMLInputElement).value.trim().toLowerCase();
  const status = ($("#filter-status") as HTMLSelectElement).value;
  let repos = state.repos.filter(repo =>
    q ? repo.fullName.toLowerCase().includes(q) || repo.repoId === q : true
  );
  if (status === "visible") repos = repos.filter(repo => repo.visible);
  if (status === "hidden") repos = repos.filter(repo => !repo.visible);
  if (status === "featured") repos = repos.filter(repo => repo.featured);
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
  container.innerHTML = "";
  for (const repo of repos) {
    container.append(renderRepo(repo));
  }
}

async function loadRepos(force = false): Promise<void> {
  if (!force && state.reposLoaded) {
    renderRepos();
    return;
  }
  $("#list-meta").textContent = "正在读取候选清单…";
  const data = await api<AdminReposResponse>("/api/admin/repos");
  state.repos = data.repos;
  state.inventoryComplete = data.inventoryComplete;
  state.reposLoaded = true;
  renderRepos();
}

function renderRepo(repo: AdminReposResponse["repos"][number]): HTMLElement {
  const card = document.createElement("article");
  card.className = "border border-border bg-muted/40 p-4";
  card.dataset.repoId = repo.repoId;

  const revision = state.revisions.get(repo.repoId);
  const busy = state.saving.has(repo.repoId);

  card.innerHTML = `
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <a class="font-semibold hover:text-accent" href="/projects/gh-${repo.repoId}/" target="_blank" rel="noopener noreferrer">${repo.fullName}</a>
      <span class="text-xs text-foreground/50">gh-${repo.repoId}</span>
      <span class="text-xs text-foreground/60">${repo.mode === "enhanced" ? "增强" : "基础"}${
        repo.configState === "invalid" ? " · 配置错误" : ""
      }${repo.releaseState === "error" ? " · Release 异常" : ""}${
        repo.eligibility !== "public" ? ` · 资格:${repo.eligibility}` : ""
      }</span>
      ${repo.warnings.map(w => `<span class="text-xs text-accent">${w}</span>`).join("")}
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-4 text-sm">
      <label><input type="checkbox" data-act="visible" ${repo.visible ? "checked" : ""} ${busy ? "disabled" : ""}/> 展示</label>
      <label><input type="checkbox" data-act="featured" ${repo.featured ? "checked" : ""} ${busy ? "disabled" : ""}/> 精选</label>
      <label>排序 <input type="number" data-act="order" value="${repo.order ?? 1000}" min="0" max="1000000" step="1" class="w-24 border border-border bg-background px-2 py-1" ${busy ? "disabled" : ""}/></label>
      <button type="button" data-act="save" class="btn-line" title="保存展示、精选和排序设置" ${busy ? "disabled" : ""}>保存设置</button>
      <button type="button" data-act="up" class="btn-line" title="排序值减 10,优先级提高" ${busy ? "disabled" : ""}>↑ 上移</button>
      <button type="button" data-act="down" class="btn-line" title="排序值加 10,优先级降低" ${busy ? "disabled" : ""}>↓ 下移</button>
      <button type="button" data-act="sync" class="btn-line" ${busy ? "disabled" : ""}>同步此仓库</button>
      <span data-role="status" class="text-xs text-foreground/60" aria-live="polite"></span>
    </div>
    <div data-role="incident" class="mt-3 hidden border border-accent/50 bg-muted p-3 text-sm"></div>
  `;
  if (revision) {
    (card.querySelector('[data-act="save"]') as HTMLElement).dataset.revision =
      revision;
  }

  card.addEventListener("click", event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-act]"
    );
    if (!target || busy) return;
    const act = target.dataset.act;
    void handleAct(card, repo.repoId, repo.fullName, act);
  });

  return card;
}

async function handleAct(
  card: HTMLElement,
  repoId: string,
  fullName: string,
  act: string | null | undefined
): Promise<void> {
  const status = card.querySelector("[data-role=status]") as HTMLElement;
  const setBusy = (busy: boolean) => {
    if (busy) state.saving.add(repoId);
    else state.saving.delete(repoId);
    card
      .querySelectorAll("input,button")
      .forEach(el => ((el as HTMLInputElement).disabled = busy));
  };
  const show = (text: string) => (status.textContent = text);

  try {
    if (
      act === "save" ||
      act === "visible" ||
      act === "featured" ||
      act === "order"
    ) {
      // 保存当前卡片上的设置(读取卡片控件的当前值)
      const visible = (
        card.querySelector('[data-act="visible"]') as HTMLInputElement
      ).checked;
      const featured = (
        card.querySelector('[data-act="featured"]') as HTMLInputElement
      ).checked;
      const order = Number(
        (card.querySelector('[data-act="order"]') as HTMLInputElement).value
      );
      setBusy(true);
      show("保存中…");
      await saveSettings(repoId, {
        visible,
        featured,
        order,
        revision: state.revisions.get(repoId) ?? (await getRevision(repoId)),
      });
      show("已保存(传播中)");
      await loadRepos(true);
    } else if (act === "up" || act === "down") {
      const orderInput = card.querySelector(
        '[data-act="order"]'
      ) as HTMLInputElement;
      const current = Number(orderInput.value);
      const next =
        (Number.isInteger(current) ? current : 1000) +
        (act === "up" ? -10 : 10);
      orderInput.value = String(Math.max(0, Math.min(1_000_000, next)));
      show(`已调整排序值为 ${orderInput.value},点击“保存设置”生效`);
    } else if (act === "sync") {
      setBusy(true);
      show("排队中…");
      const { jobId } = await api<{ jobId: string }>("/api/admin/sync", {
        method: "POST",
        json: { scope: { kind: "repo", repoId } },
      });
      await pollJob(jobId, show);
      setBusy(false);
      show("同步完成");
    }
  } catch (e) {
    show(`失败:${(e as Error).message}`);
    setBusy(false);
    void fullName;
  }
}

async function getRevision(repoId: string): Promise<string> {
  const detail = await api<RepoDetail>(`/api/admin/repos/${repoId}`);
  state.revisions.set(repoId, detail.settings?.revision ?? "");
  if (detail.needsIncidentAcknowledgement && detail.latestIncident) {
    const box = document.querySelector(
      `article[data-repo-id="${repoId}"] [data-role=incident]`
    ) as HTMLElement | null;
    if (box) {
      box.classList.remove("hidden");
      box.innerHTML = `存在未确认撤下事件(${detail.latestIncident.reason},${detail.latestIncident.observedAt})。恢复展示前必须确认。`;
    }
  }
  return detail.settings?.revision ?? "";
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
): Promise<void> {
  const result = await api<{ settings: { revision: string } }>(
    `/api/admin/repos/${repoId}/settings`,
    { method: "PATCH", json: body }
  );
  state.revisions.set(repoId, result.settings.revision);
}

async function pollJob(
  jobId: string,
  show: (t: string) => void
): Promise<void> {
  for (;;) {
    const job = await api<{
      state: string;
      counts: Record<string, number> | null;
      errorCodes: string[] | null;
    }>(`/api/admin/sync/${jobId}`);
    show(
      `任务:${job.state}${job.counts ? ` ${JSON.stringify(job.counts)}` : ""}`
    );
    if (
      ["succeeded", "partial", "failed", "expired", "interrupted"].includes(
        job.state
      )
    ) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function fullSync(): Promise<void> {
  const stateEl = $("#sync-state");
  try {
    stateEl.textContent = "排队中…";
    const { jobId } = await api<{ jobId: string }>("/api/admin/sync", {
      method: "POST",
      json: { scope: { kind: "all" } },
    });
    await pollJob(jobId, t => (stateEl.textContent = t));
    stateEl.textContent = "完成";
    await loadRepos(true);
  } catch (e) {
    stateEl.textContent = `失败:${(e as Error).message}`;
  }
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-admin-root]");
  if (!root || root.dataset.adminBooted === "1") return;
  root.dataset.adminBooted = "1";

  try {
    await loadSession();
    await loadRepos();
  } catch (e) {
    const error = $("#error");
    error.classList.remove("hidden");
    error.textContent = `会话获取失败:${(e as Error).message}`;
    return;
  }
  $("#btn-reload").addEventListener("click", () => void loadRepos(true));
  $("#filter-status").addEventListener("change", () => renderRepos());
  $("#btn-full-sync").addEventListener("click", () => void fullSync());
  $("#filter-q").addEventListener("input", () => renderRepos());
}

document.addEventListener("astro:page-load", () => void main());
if (document.readyState !== "loading") {
  void main();
}
