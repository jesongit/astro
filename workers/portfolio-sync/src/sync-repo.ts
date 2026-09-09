/**
 * 单仓库观察流程(计划 §8.3):
 * 1) 读最新观察与 LKG;2) 核对身份与公开资格(不合格立即写事件,不等内容);
 * 3) 固定 commit SHA 读 README/配置/引用,独立读 Release;
 * 4) 生成内容寻址 payload(坏配置复用 LKG 引用,身份/资格/Release 独立更新);
 * 5) observedAt 取资格请求开始时间,失败不续期;
 * 6) 先写 payload 再写完整观察;7) 失格同时写 incident。
 */
import {
  SANITIZER_VERSION,
  renderMarkdown,
  summarizePlainText,
  truncateChars,
} from "../../../src/lib/portfolio/markdown";
import {
  effectiveMode,
  normalizeContent,
  type PortfolioNormalizedConfig,
} from "../../../src/lib/portfolio/normalize";
import { mapLatestRelease } from "../../../src/lib/portfolio/releases";
import { LIMITS } from "../../../src/lib/portfolio/config";
import {
  validatePortfolioConfigText,
  type PortfolioConfig,
} from "../../../src/lib/portfolio/validate";
import type {
  ConfigState,
  Eligibility,
  Incident,
  ProjectRelease,
  ReleaseState,
  SourceObservation,
} from "../../../src/lib/portfolio/types";
import type {
  PublicCacheStore,
  SyncWriteStore,
} from "../../../src/lib/portfolio/store";
import { CredentialError, type GitHubClient } from "./github";

export interface SyncRepoDeps {
  client: GitHubClient;
  cache: SyncWriteStore;
  publicCache: PublicCacheStore;
  owner: string;
  /** 当前候选清单(ID → 当前名称),用于重命名恢复 */
  inventoryNames: Map<string, string>;
  now: number;
  runId: string;
}

export interface SyncRepoOutcome {
  repoId: string;
  state: "success" | "partial" | "error" | "rate_limited";
  warnings: string[];
}

const base64Decode = (data: string): string => {
  const binary = atob(data);
  return new TextDecoder().decode(
    Uint8Array.from(binary, c => c.charCodeAt(0))
  );
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** homepage 校验:仅公网 HTTPS(§5.2 语义补充) */
function safeHomepage(homepage: unknown): string | null {
  if (typeof homepage !== "string" || homepage.trim() === "") return null;
  try {
    const url = new URL(homepage.trim());
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^169\.254\./.test(
        host
      )
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** 同 commit 相对路径解析:链接→blob,图片→raw(计划 §7.3) */
const makeResolver =
  (fullName: string, sha: string) =>
  (url: string, isImage: boolean): string => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return url;
    const clean = url.replace(/^\.\//, "").replace(/^\//, "");
    if (clean === "") return url;
    const encoded = clean.split("/").map(encodeURIComponent).join("/");
    return isImage
      ? `https://raw.githubusercontent.com/${fullName}/${sha}/${encoded}`
      : `https://github.com/${fullName}/blob/${sha}/${encoded}`;
  };

export async function syncRepoById(
  deps: SyncRepoDeps,
  repoId: string
): Promise<SyncRepoOutcome> {
  const { cache, publicCache, client, now, runId } = deps;
  const warnings: string[] = [];
  const observedAt = new Date(now).toISOString();

  const prev = await publicCache.getLatestObservation(repoId);
  const prevHash = prev?.payloadHash ?? null;

  // ── 2. 身份与公开资格(observedAt = 资格请求开始时间) ──
  const candidateNames: string[] = [];
  const inventoryName = deps.inventoryNames.get(repoId);
  if (inventoryName) candidateNames.push(inventoryName);
  const prevName = prev?.fullName ?? null;
  if (prevName && prevName !== inventoryName) candidateNames.push(prevName);
  if (candidateNames.length === 0) {
    candidateNames.push(`${deps.owner}/unknown-${repoId}`);
  }

  let fullName: string | null = null;
  let repoJson: Record<string, unknown> | null = null;
  for (const candidate of candidateNames) {
    try {
      const { status, repo } = await client.getRepo(candidate);
      if (status === 200 && repo) {
        if (repo.id === Number(repoId)) {
          fullName = candidate;
          repoJson = repo;
          break;
        }
        // 旧名已被其他 ID 使用:不是本仓库,继续尝试(§9.1)
      }
    } catch (e) {
      if (e instanceof CredentialError) throw e;
      // 单仓库网络错误不阻止其他候选;资格沿用上次确定值
      warnings.push("identity_request_error");
      break;
    }
  }

  const writeObservation = async (
    eligibility: Eligibility,
    attemptState: SourceObservation["attemptState"],
    payloadHash: string | null,
    configState: ConfigState,
    releaseState: ReleaseState,
    nameForRecord: string,
    nodeId: string
  ): Promise<void> => {
    const observation: SourceObservation = {
      schemaVersion: 1,
      repoId,
      nodeId: nodeId || prev?.nodeId || "",
      fullName: nameForRecord,
      eligibility,
      attemptState,
      observedAt,
      // 成功核验才续期;错误沿用上次确定值,不刷新有效期(§8.3)
      lastPublicVerifiedAt:
        eligibility === "public" && attemptState !== "error"
          ? observedAt
          : (prev?.lastPublicVerifiedAt ?? null),
      payloadHash,
      configState,
      mode: effectiveMode(
        configState,
        prev?.mode === "enhanced" && prev.payloadHash !== null
      ),
      releaseState,
      lastContentSuccessAt:
        attemptState !== "error"
          ? observedAt
          : (prev?.lastContentSuccessAt ?? null),
      warnings,
    };
    await cache.putObservation(observation, runId);
  };

  const writeIncident = async (
    reason: Incident["reason"],
    nameForRecord: string
  ): Promise<void> => {
    await cache.putIncident({
      incidentId: crypto.randomUUID(),
      repoId,
      fullName: nameForRecord,
      reason,
      observedAt,
    });
  };

  if (!repoJson || !fullName) {
    // 资格确定失败:沿用上次 eligibility,不续期;不写墓碑(§9.2)
    warnings.push("identity_unresolved");
    await writeObservation(
      prev?.eligibility ?? "unknown",
      "error",
      prevHash,
      prev?.configState ?? "absent",
      prev?.releaseState ?? "none",
      prevName ?? `${deps.owner}/unknown-${repoId}`,
      prev?.nodeId ?? ""
    );
    return { repoId, state: "partial", warnings };
  }

  if (repoJson.private === true) {
    await writeIncident("private", fullName);
    await writeObservation(
      "unavailable",
      "success",
      prevHash,
      prev?.configState ?? "absent",
      prev?.releaseState ?? "none",
      fullName,
      String(repoJson.node_id ?? "")
    );
    return { repoId, state: "success", warnings };
  }

  const ownerLogin =
    isRecord(repoJson.owner) && typeof repoJson.owner.login === "string"
      ? String(repoJson.owner.login)
      : deps.owner;
  if (ownerLogin.toLowerCase() !== deps.owner.toLowerCase()) {
    await writeIncident("out_of_scope", fullName);
    await writeObservation(
      "out_of_scope",
      "success",
      prevHash,
      prev?.configState ?? "absent",
      prev?.releaseState ?? "none",
      fullName,
      String(repoJson.node_id ?? "")
    );
    return { repoId, state: "success", warnings };
  }

  // ── 3. 固定 commit 读内容 ──
  const description =
    typeof repoJson.description === "string" ? repoJson.description : null;
  const defaultBranch =
    typeof repoJson.default_branch === "string"
      ? repoJson.default_branch
      : "main";
  const sha = await client.getCommitSha(fullName, defaultBranch);

  const githubFacts = {
    fullName,
    url: `https://github.com/${fullName}`,
    stars:
      typeof repoJson.stargazers_count === "number"
        ? repoJson.stargazers_count
        : 0,
    license:
      isRecord(repoJson.license) && typeof repoJson.license.spdx_id === "string"
        ? String(repoJson.license.spdx_id)
        : null,
    language: typeof repoJson.language === "string" ? repoJson.language : null,
  };

  let topics = Array.isArray(repoJson.topics)
    ? repoJson.topics.filter((t): t is string => typeof t === "string")
    : [];
  if (!Array.isArray(repoJson.topics)) {
    topics = await client.getTopics(fullName);
  }
  if (repoJson.archived === true) warnings.push("archived");

  const base = {
    name:
      typeof repoJson.name === "string"
        ? repoJson.name
        : fullName.split("/")[1],
    description,
    readmeHtml: "",
    readmeTextPlain: "",
    topics,
    github: githubFacts,
    homepage: safeHomepage(repoJson.homepage),
  };

  let configState: ConfigState = "absent";
  let config: PortfolioConfig | null = null;
  let enhancedBody: { html: string; textPlain: string } | null = null;
  let normalizedConfig: PortfolioNormalizedConfig | null = null;

  if (sha) {
    const resolve = makeResolver(fullName, sha);

    // README:缺失是合法基础空正文,不算配置错误(§9.2)
    const readme = await client.getReadme(fullName, sha);
    if (readme) {
      let text = base64Decode(readme.contentBase64);
      if (new TextEncoder().encode(text).byteLength > LIMITS.readmeMaxBytes) {
        text = `${truncateChars(text, 8000)}\n\n在 GitHub 阅读完整说明。`;
        warnings.push("readme_truncated");
      }
      const rendered = await renderMarkdown(text, { resolveUrl: resolve });
      base.readmeHtml = rendered.html;
      base.readmeTextPlain = summarizePlainText(text);
    }

    // 增强配置:确认缺失 → basic;损坏 → invalid,保留 LKG(§4.3/§5.3)
    const configFile = await client.getContents(
      fullName,
      ".portfolio/portfolio.json",
      sha
    );
    if (configFile) {
      const validated = validatePortfolioConfigText(
        base64Decode(configFile.contentBase64)
      );
      if (!validated.ok) {
        configState = "invalid";
        warnings.push(`config_invalid:${validated.errors[0]?.path ?? "$"}`);
      } else {
        configState = "valid";
        config = validated.config;
        const resolveImage = (path: string): string | null =>
          /^\.portfolio\/assets\//.test(path)
            ? `https://raw.githubusercontent.com/${fullName}/${sha}/${path.replace(/^\.\//, "").split("/").map(encodeURIComponent).join("/")}`
            : null;

        normalizedConfig = {
          title: config.title,
          summary: config.summary,
          bodyFile: config.bodyFile,
          features: config.features,
          techStack: config.techStack,
          links: config.links,
          additionalDownloads: config.additionalDownloads,
        };

        if (config.bodyFile) {
          const bodyFile = await client.getContents(
            fullName,
            config.bodyFile,
            sha
          );
          if (!bodyFile) {
            configState = "invalid";
            warnings.push("config_invalid:bodyFile_missing");
          } else {
            const bodyText = base64Decode(bodyFile.contentBase64);
            if (
              new TextEncoder().encode(bodyText).byteLength >
              LIMITS.bodyMaxBytes
            ) {
              configState = "invalid";
              warnings.push("config_invalid:bodyFile_too_large");
            } else {
              enhancedBody = await renderMarkdown(bodyText, {
                resolveUrl: resolve,
              });
            }
          }
        }

        if (configState === "valid" && config.cover) {
          const src = resolveImage(config.cover.path);
          if (!src) {
            configState = "invalid";
            warnings.push("config_invalid:cover_path");
          } else {
            normalizedConfig.cover = {
              src,
              alt: config.cover.alt,
              caption: config.cover.caption,
              width: config.cover.width,
              height: config.cover.height,
            };
          }
        }

        if (configState === "valid" && config.screenshots) {
          const shots = config.screenshots.map(s => {
            const src = resolveImage(s.path);
            return src
              ? {
                  src,
                  alt: s.alt,
                  caption: s.caption,
                  width: s.width,
                  height: s.height,
                }
              : null;
          });
          if (shots.some(s => s === null)) {
            configState = "invalid";
            warnings.push("config_invalid:screenshot_path");
          } else {
            normalizedConfig.screenshots = shots.filter(
              (shot): shot is NonNullable<(typeof shots)[number]> =>
                shot !== null
            );
          }
        }

        if (configState === "invalid") {
          normalizedConfig = null; // 整份配置无效:回退基础内容或 LKG
          config = null;
        }
      }
    }
  } else {
    warnings.push("no_commit");
  }

  // ── 独立读 Release(§7.4) ──
  let releaseState: ReleaseState = "none";
  let release: ProjectRelease | null = null;
  try {
    const { status, json } = await client.getLatestRelease(fullName);
    if (status === 200) {
      const mapped = mapLatestRelease(json);
      if (mapped.state === "present" && mapped.release) {
        const body =
          isRecord(json) && typeof json.body === "string" ? json.body : "";
        const rendered = await renderMarkdown(body);
        release = {
          ...mapped.release,
          notes: rendered.textPlain
            .split("\n")
            .filter(line => line.trim().length > 0)
            .slice(0, 10),
        };
        releaseState = "present";
      } else {
        releaseState = mapped.state;
      }
    } else if (status === 404) {
      releaseState = "none"; // 删除的 Release 立即移除旧版本与附件(§9.2)
      release = null;
    } else {
      releaseState = "error";
    }
  } catch (e) {
    if (e instanceof CredentialError) throw e;
    releaseState = "error";
    warnings.push("release_fetch_error");
  }

  // Release 获取失败:保留上一 payload 的 Release(stale,公开侧最多 24h,§7.4)
  if (releaseState === "error") {
    const prevPayload = prevHash
      ? await publicCache.getPayload(prevHash)
      : null;
    release = prevPayload?.release ?? null;
  }

  // ── 4/6. 先 payload 后观察 ──
  let payloadHash = prevHash;
  // 首次遇到坏配置时没有 LKG,仍应发布基础内容;只有存在 LKG 才复用旧引用。
  if (configState !== "invalid" || !prevHash) {
    const content = normalizeContent({
      base,
      config: configState === "invalid" ? null : normalizedConfig,
      enhancedBody: configState === "invalid" ? null : enhancedBody,
      release,
      sanitizerVersion: SANITIZER_VERSION,
    });
    const hash = await cache.putContentPayload(content);
    if (hash) payloadHash = hash;
    else warnings.push("payload_too_large");
  }
  // 坏配置:复用上一有效内容引用,身份/资格/Release 已在新观察中独立更新(§8.3.4)

  await writeObservation(
    "public",
    warnings.length > 0 ? "partial" : "success",
    payloadHash,
    configState,
    releaseState,
    fullName,
    String(repoJson.node_id ?? "")
  );

  return {
    repoId,
    state: warnings.length > 0 ? "partial" : "success",
    warnings,
  };
}
