/**
 * 发布门禁(计划 §9):首页/列表/详情/搜索/公开 API/动态 sitemap
 * 的唯一可发布判定。任何条件不满足都不得从任何缓存中补回作品。
 */
import { PUBLICATION } from "./config";
import type {
  DisplaySettings,
  Incident,
  PortfolioContent,
  PublicProject,
  SourceObservation,
} from "./types";
import { projectIdToSlug } from "./slug";

export type PublicationDenyReason =
  | "hidden"
  | "no_settings"
  | "no_observation"
  | "unavailable"
  | "out_of_scope"
  | "eligibility_expired"
  | "unknown_eligibility"
  | "unconfirmed_incident"
  | "no_content";

export interface PublicationInput {
  settings: DisplaySettings | null;
  observation: SourceObservation | null;
  /** 该仓库全部撤下事件(含已确认) */
  incidents: Incident[];
  /** 当前时间(epoch ms);由调用方注入以便测试 */
  now: number;
}

export type PublicationVerdict =
  | { publishable: true }
  | { publishable: false; reason: PublicationDenyReason };

const eligibilityValidUntil = (observation: SourceObservation): number =>
  observation.lastPublicVerifiedAt
    ? Date.parse(observation.lastPublicVerifiedAt) +
      PUBLICATION.publicValidityMinutes * 60_000
    : Number.NEGATIVE_INFINITY;

export function evaluatePublication(
  input: PublicationInput
): PublicationVerdict {
  const { settings, observation, incidents, now } = input;

  if (!settings) return { publishable: false, reason: "no_settings" };
  if (!settings.visible) return { publishable: false, reason: "hidden" };
  if (!observation) return { publishable: false, reason: "no_observation" };

  if (observation.eligibility === "unavailable") {
    return { publishable: false, reason: "unavailable" };
  }
  if (observation.eligibility === "out_of_scope") {
    return { publishable: false, reason: "out_of_scope" };
  }
  if (observation.eligibility !== "public") {
    return { publishable: false, reason: "unknown_eligibility" };
  }
  // 资格有效期(§9.2):限流/超时/401/未知错误不续期,到期即不可见
  if (eligibilityValidUntil(observation) < now) {
    return { publishable: false, reason: "eligibility_expired" };
  }

  // 未确认的撤下事件:比 acknowledgedIncidentId 更新(或未确认过)即阻止展示;
  // 恢复必须由管理员显式确认最新 incident(§8.4/§9.1)
  if (incidents.length > 0) {
    const latest = incidents.reduce((a, b) =>
      Date.parse(a.observedAt) >= Date.parse(b.observedAt) ? a : b
    );
    if (settings.acknowledgedIncidentId !== latest.incidentId) {
      return { publishable: false, reason: "unconfirmed_incident" };
    }
  }

  return { publishable: true };
}

/** 内容齐备后的公开投影:内容缺失时返回 null(调用方按 503/隐藏处理) */
export function toPublicProject(
  observation: SourceObservation,
  content: PortfolioContent | null
): PublicProject | null {
  if (!content) return null;
  return {
    slug: projectIdToSlug(observation.repoId),
    title: content.title,
    summary: content.summary,
    topics: content.topics,
    techStack: content.techStack,
    features: content.features,
    bodyHtml: content.bodyHtml || undefined,
    cover: content.cover ?? null,
    screenshots: content.screenshots,
    links: content.links,
    github: content.github,
    release: content.release,
  };
}
