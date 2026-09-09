import type { ControlStore } from "@/lib/portfolio/store";
import type { DisplaySettings } from "@/lib/portfolio/types";
import {
  GitHubAdminClient,
  SettingsConflictError,
  type GitHubSettingsEntry,
  type SettingsPatch,
  type SettingsSaveResult as GitHubSaveResult,
  type SettingsSnapshot as GitHubSnapshot,
} from "./github";

export interface AdminSettingsSnapshot {
  source: "github" | "kv-compat";
  sha: string | null;
  version: 1;
  repos: Record<string, GitHubSettingsEntry>;
  revisions: Record<string, string>;
}

export interface AdminSettingsSaveResult {
  source: AdminSettingsSnapshot["source"];
  committed: boolean;
  sha: string | null;
  commitSha: string | null;
  changedRepoIds: string[];
  unchangedRepoIds: string[];
  settings: Record<string, GitHubSettingsEntry>;
  revisions: Record<string, string>;
}

export interface AdminSettingsBackend {
  readonly source: AdminSettingsSnapshot["source"];
  read(): Promise<AdminSettingsSnapshot>;
  save(
    patch: SettingsPatch,
    expectedRevision: string | null | undefined,
    actor: string
  ): Promise<AdminSettingsSaveResult>;
}

export function settingsEntry(
  snapshot: AdminSettingsSnapshot,
  repoId: string
): GitHubSettingsEntry | null {
  const entry = snapshot.repos[repoId];
  return entry ? { ...entry } : null;
}

export function settingsRevision(
  snapshot: AdminSettingsSnapshot,
  repoId: string
): string {
  return snapshot.revisions[repoId] ?? snapshot.sha ?? "";
}

export class GitHubSettingsBackend implements AdminSettingsBackend {
  readonly source = "github" as const;

  constructor(private readonly github: GitHubAdminClient) {}

  async read(): Promise<AdminSettingsSnapshot> {
    const snapshot = await this.github.getSettings();
    return fromGitHubSnapshot(snapshot);
  }

  async save(
    patch: SettingsPatch,
    expectedRevision: string | null | undefined,
    actor: string
  ): Promise<AdminSettingsSaveResult> {
    void actor;
    const result = await this.github.saveSettings(patch, expectedRevision);
    return fromGitHubSaveResult(result);
  }
}

/**
 * Compatibility-only adapter for deployments that have not supplied the new
 * GitHub variables yet. It is intentionally selected only when the GitHub
 * client cannot be constructed; the GitHub path is authoritative whenever it
 * is configured.
 */
export class LegacyKvSettingsBackend implements AdminSettingsBackend {
  readonly source = "kv-compat" as const;

  constructor(private readonly control: ControlStore) {}

  async read(): Promise<AdminSettingsSnapshot> {
    const values = await this.control.listAllSettings();
    const repos: Record<string, GitHubSettingsEntry> = {};
    const revisions: Record<string, string> = {};
    for (const value of values) {
      repos[value.repoId] = fromDisplaySettings(value);
      revisions[value.repoId] = value.revision;
    }
    return { source: this.source, sha: null, version: 1, repos, revisions };
  }

  async save(
    patch: SettingsPatch,
    expectedRevision: string | null | undefined,
    actor: string
  ): Promise<AdminSettingsSaveResult> {
    const changedRepoIds: string[] = [];
    const unchangedRepoIds: string[] = [];
    for (const [repoId, rawPatch] of Object.entries(patch)) {
      const before = await this.control.getSettings(repoId);
      const beforeEntry = before ? fromDisplaySettings(before) : defaultEntry();
      const after = { ...beforeEntry, ...rawPatch } as GitHubSettingsEntry;
      if (
        before &&
        expectedRevision !== undefined &&
        expectedRevision !== before.revision
      ) {
        throw new SettingsConflictError(
          expectedRevision || null,
          before.revision
        );
      }
      if (before && entriesEqual(beforeEntry, after)) {
        unchangedRepoIds.push(repoId);
        continue;
      }
      const saved = await this.control.putSettings(
        repoId,
        {
          schemaVersion: 1,
          repoId,
          ...after,
          updatedBy: actor,
        },
        before?.revision ?? ""
      );
      if (!saved) {
        throw new SettingsConflictError(
          before?.revision ?? null,
          (await this.control.getSettings(repoId))?.revision ?? null
        );
      }
      changedRepoIds.push(repoId);
    }
    const snapshot = await this.read();
    return {
      source: this.source,
      committed: changedRepoIds.length > 0,
      sha: null,
      commitSha: null,
      changedRepoIds,
      unchangedRepoIds,
      settings: snapshot.repos,
      revisions: snapshot.revisions,
    };
  }
}

export function createSettingsBackend(
  github: GitHubAdminClient | null,
  control: ControlStore | null
): AdminSettingsBackend | null {
  if (github) return new GitHubSettingsBackend(github);
  if (control) return new LegacyKvSettingsBackend(control);
  return null;
}

function defaultEntry(): GitHubSettingsEntry {
  return {
    visible: false,
    featured: false,
    order: 1000,
    acknowledgedIncidentId: null,
  };
}

function fromDisplaySettings(value: DisplaySettings): GitHubSettingsEntry {
  return {
    visible: value.visible,
    featured: value.featured,
    order: value.order,
    acknowledgedIncidentId: value.acknowledgedIncidentId,
  };
}

function entriesEqual(a: GitHubSettingsEntry, b: GitHubSettingsEntry): boolean {
  return (
    a.visible === b.visible &&
    a.featured === b.featured &&
    a.order === b.order &&
    a.acknowledgedIncidentId === b.acknowledgedIncidentId
  );
}

function fromGitHubSnapshot(snapshot: GitHubSnapshot): AdminSettingsSnapshot {
  const revisions: Record<string, string> = {};
  for (const repoId of Object.keys(snapshot.repos)) {
    revisions[repoId] = snapshot.sha ?? "";
  }
  return { source: "github", ...snapshot, revisions };
}

function fromGitHubSaveResult(
  result: GitHubSaveResult
): AdminSettingsSaveResult {
  const revisions: Record<string, string> = {};
  for (const repoId of Object.keys(result.settings))
    revisions[repoId] = result.sha ?? "";
  return { source: "github", ...result, revisions };
}
