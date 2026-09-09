import sourcesSnapshot from "../../../data/portfolio/sources.json";
import { PUBLICATION } from "@/lib/portfolio/config";
import type { ActionsScope, GitHubSettingsEntry } from "./github";

export type PublishMode = "build" | "repo" | "all";

export interface PublishPlan {
  mode: PublishMode;
  scope: ActionsScope;
  staleRepoIds: string[];
}

type SourceSummary = {
  repoId?: unknown;
  lastPublicVerifiedAt?: unknown;
};

const checkedInSources = Array.isArray(sourcesSnapshot.sources)
  ? (sourcesSnapshot.sources as SourceSummary[])
  : [];

function sourceMap(sources: SourceSummary[]): Map<string, SourceSummary> {
  return new Map(
    sources.flatMap(source => {
      const repoId =
        typeof source.repoId === "string"
          ? source.repoId
          : String(source.repoId ?? "");
      return /^\d{1,12}$/.test(repoId) ? [[repoId, source] as const] : [];
    })
  );
}

function sourceIsFresh(source: SourceSummary | undefined, now: number): boolean {
  if (!source || typeof source.lastPublicVerifiedAt !== "string") return false;
  const verifiedAt = Date.parse(source.lastPublicVerifiedAt);
  return (
    Number.isFinite(verifiedAt) &&
    verifiedAt + PUBLICATION.publicValidityMinutes * 60_000 >= now
  );
}

/**
 * Select the smallest safe Actions scope for a settings publication.
 *
 * Build-only is safe only when every currently visible repository has a fresh
 * checked-in observation. Otherwise a build would re-evaluate the publication
 * gate and could silently remove an otherwise visible project.
 */
export function selectPublishPlan(
  settings: Record<string, GitHubSettingsEntry>,
  now = Date.now(),
  sources = checkedInSources
): PublishPlan {
  const sourceByRepoId = sourceMap(sources);
  const staleRepoIds = Object.entries(settings)
    .filter(([, setting]) => setting.visible)
    .filter(([repoId]) => !sourceIsFresh(sourceByRepoId.get(repoId), now))
    .map(([repoId]) => repoId)
    .sort((a, b) => Number(a) - Number(b));

  if (staleRepoIds.length === 0) {
    return { mode: "build", scope: { kind: "build" }, staleRepoIds };
  }
  if (staleRepoIds.length === 1) {
    return {
      mode: "repo",
      scope: { kind: "repo", repoId: staleRepoIds[0] },
      staleRepoIds,
    };
  }
  return { mode: "all", scope: { kind: "all" }, staleRepoIds };
}
