import { describe, expect, it } from "vitest";
import {
  evaluatePublication,
  toPublicProject,
} from "@/lib/portfolio/publication";
import type {
  DisplaySettings,
  Incident,
  PortfolioContent,
  SourceObservation,
} from "@/lib/portfolio/types";

const NOW = Date.parse("2026-09-09T12:00:00Z");

const settings = (over: Partial<DisplaySettings> = {}): DisplaySettings => ({
  schemaVersion: 1,
  repoId: "1001",
  visible: true,
  featured: false,
  order: 100,
  acknowledgedIncidentId: null,
  revision: "r1",
  updatedAt: "2026-09-09T00:00:00Z",
  updatedBy: "admin",
  ...over,
});

const observation = (
  over: Partial<SourceObservation> = {}
): SourceObservation => ({
  schemaVersion: 1,
  repoId: "1001",
  nodeId: "node",
  fullName: "jesongit/aurora-theme",
  eligibility: "public",
  attemptState: "success",
  observedAt: "2026-09-09T11:55:00Z",
  lastPublicVerifiedAt: "2026-09-09T11:55:00Z",
  payloadHash: "abc",
  configState: "absent",
  mode: "basic",
  releaseState: "none",
  lastContentSuccessAt: "2026-09-09T11:55:00Z",
  warnings: [],
  ...over,
});

const verdictReason = (result: ReturnType<typeof evaluatePublication>) =>
  result.publishable ? "publishable" : result.reason;

describe("发布门禁(计划 §9)", () => {
  it("全部条件满足才可发布", () => {
    const result = evaluatePublication({
      settings: settings(),
      observation: observation(),
      incidents: [],
      now: NOW,
    });
    expect(result.publishable).toBe(true);
  });

  it("隐藏/无设置/无观察拒绝", () => {
    expect(
      verdictReason(
        evaluatePublication({
          settings: settings({ visible: false }),
          observation: observation(),
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("hidden");
    expect(
      verdictReason(
        evaluatePublication({
          settings: null,
          observation: observation(),
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("no_settings");
    expect(
      verdictReason(
        evaluatePublication({
          settings: settings(),
          observation: null,
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("no_observation");
  });

  it("资格过期/unknown/unavailable/out_of_scope 拒绝", () => {
    const expired = observation({
      lastPublicVerifiedAt: "2026-09-09T11:00:00Z", // 30 分钟资格已过
    });
    expect(
      verdictReason(
        evaluatePublication({
          settings: settings(),
          observation: expired,
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("eligibility_expired");

    expect(
      verdictReason(
        evaluatePublication({
          settings: settings(),
          observation: observation({
            eligibility: "unknown",
            lastPublicVerifiedAt: null,
          }),
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("unknown_eligibility");

    expect(
      verdictReason(
        evaluatePublication({
          settings: settings(),
          observation: observation({ eligibility: "unavailable" }),
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("unavailable");

    expect(
      verdictReason(
        evaluatePublication({
          settings: settings(),
          observation: observation({ eligibility: "out_of_scope" }),
          incidents: [],
          now: NOW,
        })
      )
    ).toBe("out_of_scope");
  });

  it("未确认的撤下事件阻止展示;确认最新事件后恢复", () => {
    const incidents: Incident[] = [
      {
        incidentId: "inc-1",
        repoId: "1001",
        fullName: "x",
        reason: "private",
        observedAt: "2026-09-09T10:00:00Z",
      },
      {
        incidentId: "inc-2",
        repoId: "1001",
        fullName: "x",
        reason: "not_found",
        observedAt: "2026-09-09T11:00:00Z",
      },
    ];

    expect(
      verdictReason(
        evaluatePublication({
          settings: settings({ acknowledgedIncidentId: "inc-1" }),
          observation: observation(),
          incidents,
          now: NOW,
        })
      )
    ).toBe("unconfirmed_incident");

    expect(
      evaluatePublication({
        settings: settings({ acknowledgedIncidentId: "inc-2" }),
        observation: observation(),
        incidents,
        now: NOW,
      }).publishable
    ).toBe(true);
  });
});

describe("公开投影", () => {
  it("内容缺失返回 null,不合成正文", () => {
    expect(toPublicProject(observation(), null)).toBeNull();
  });

  it("投影 slug 来自 gh-<ID>,内容白名单透传", () => {
    const content: PortfolioContent = {
      schemaVersion: 1,
      title: "T",
      summary: "S",
      bodyHtml: "<p>b</p>",
      bodyTextPlain: "b",
      features: [],
      techStack: ["TypeScript"],
      topics: ["astro"],
      links: {
        github: "https://github.com/jesongit/aurora-theme",
        website: null,
        demo: null,
        docs: null,
      },
      github: {
        fullName: "jesongit/aurora-theme",
        url: "https://github.com/jesongit/aurora-theme",
        stars: 1,
        license: null,
        language: "TypeScript",
      },
      release: null,
      additionalDownloads: [],
      cover: null,
      screenshots: [],
      sanitizerVersion: "t",
    };
    const project = toPublicProject(observation(), content);
    expect(project?.slug).toBe("gh-1001");
    expect(project?.title).toBe("T");
    expect(project?.bodyHtml).toBe("<p>b</p>");
  });
});
