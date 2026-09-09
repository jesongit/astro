import { afterEach, describe, expect, it, vi } from "vitest";
import { createSnapshotView } from "@/lib/portfolio/snapshot";
import { lookupPublicProject, listPublicProjects } from "@/lib/portfolio/view";

const NOW = new Date("2026-09-09T12:00:00.000Z");

const settings = (over: Record<string, unknown> = {}) => ({
  version: 1,
  repos: {
    "1001": {
      visible: true,
      featured: true,
      order: 20,
      acknowledgedIncidentId: null,
      ...over,
    },
  },
});

const source = (over: Record<string, unknown> = {}) => ({
  version: 1,
  repos: {
    "1001": {
      repoId: "1001",
      nodeId: "node-1",
      fullName: "jesongit/aurora-theme",
      eligibility: "public",
      attemptState: "success",
      observedAt: "2026-09-09T11:55:00.000Z",
      lastPublicVerifiedAt: "2026-09-09T11:55:00.000Z",
      payloadHash: "hash-1",
      configState: "absent",
      mode: "basic",
      releaseState: "none",
      lastContentSuccessAt: "2026-09-09T11:55:00.000Z",
      warnings: [],
      ...over,
    },
  },
});

const project = (over: Record<string, unknown> = {}) => ({
  repoId: "1001",
  title: "Aurora",
  summary: "A blog theme.",
  bodyHtml: "<p>Details</p>",
  bodyTextPlain: "Details",
  features: ["Fast"],
  techStack: ["Astro"],
  topics: ["blog"],
  links: {
    github: "https://github.com/jesongit/aurora-theme",
    website: null,
    demo: null,
    docs: null,
  },
  github: {
    fullName: "jesongit/aurora-theme",
    url: "https://github.com/jesongit/aurora-theme",
    stars: 10,
    license: "MIT",
    language: "TypeScript",
  },
  release: null,
  additionalDownloads: [],
  cover: null,
  screenshots: [],
  sanitizerVersion: "test",
  ...over,
});

const snapshots = (over: Record<string, unknown> = {}) => ({
  settings: settings(),
  sources: source(),
  projects: { version: 1, projects: [project(over)] },
});

afterEach(() => {
  vi.useRealTimers();
});

describe("build-generated portfolio snapshots", () => {
  it("reads settings, sources and projects without a KV binding", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const view = createSnapshotView(snapshots());
    await expect(view.listPublicProjects()).resolves.toMatchObject([
      { slug: "gh-1001", title: "Aurora" },
    ]);
    await expect(view.lookupPublicProject("gh-1001")).resolves.toMatchObject({
      ok: true,
      project: {
        links: { github: "https://github.com/jesongit/aurora-theme" },
      },
    });
  });

  it("accepts a project array keyed by its stable slug", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const input = snapshots();
    input.projects = {
      version: 1,
      projects: [{ ...project(), repoId: undefined, slug: "gh-1001" }],
    };

    await expect(
      createSnapshotView(input).listPublicProjects()
    ).resolves.toHaveLength(1);
  });

  it("keeps the publication gate for hidden, expired and unconfirmed records", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const hidden = createSnapshotView({
      ...snapshots(),
      settings: {
        version: 1,
        repos: { "1001": { ...settings().repos["1001"], visible: false } },
      },
    });
    await expect(hidden.listPublicProjects()).resolves.toEqual([]);

    const expired = createSnapshotView({
      ...snapshots(),
      sources: source({ lastPublicVerifiedAt: "2026-09-09T11:00:00.000Z" }),
    });
    await expect(expired.listPublicProjects()).resolves.toEqual([]);

    const unconfirmed = createSnapshotView({
      ...snapshots(),
      sources: source({
        incidents: [
          {
            incidentId: "incident-1",
            fullName: "jesongit/aurora-theme",
            reason: "private",
            observedAt: "2026-09-09T11:59:00.000Z",
          },
        ],
      }),
    });
    await expect(unconfirmed.lookupPublicProject("gh-1001")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("ignores an incomplete record instead of publishing it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const input = snapshots();
    input.projects = {
      version: 1,
      projects: [{ repoId: "1001", title: "bad" }],
    };

    const view = createSnapshotView(input);
    await expect(view.listPublicProjects()).resolves.toEqual([]);
    await expect(view.lookupPublicProject("gh-1001")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("does not inspect runtime KV, including list()", async () => {
    const forbidden = () => {
      throw new Error("public view must not use KV");
    };
    const locals = {
      runtime: {
        env: {
          PORTFOLIO_CONTROL: { get: forbidden, list: forbidden },
          PORTFOLIO_CACHE: { get: forbidden, list: forbidden },
        },
      },
    };

    await expect(listPublicProjects(locals)).resolves.toEqual([]);
    await expect(lookupPublicProject(locals, "gh-1001")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
