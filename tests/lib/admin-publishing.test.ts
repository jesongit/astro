import { describe, expect, it } from "vitest";
import { selectPublishPlan } from "../../src/lib/admin/publishing";

const NOW = Date.parse("2026-09-09T10:00:00.000Z");
const FRESH = "2026-09-09T09:45:00.000Z";
const EXPIRED = "2026-09-09T09:00:00.000Z";

const setting = (visible: boolean) => ({
  visible,
  featured: false,
  order: 1,
  acknowledgedIncidentId: null,
});

describe("admin publishing plan", () => {
  it("uses build-only when all visible sources are fresh", () => {
    const plan = selectPublishPlan(
      { "101": setting(true) },
      NOW,
      [{ repoId: "101", lastPublicVerifiedAt: FRESH }]
    );

    expect(plan).toMatchObject({
      mode: "build",
      scope: { kind: "build" },
      staleRepoIds: [],
    });
  });

  it("uses targeted sync when one visible source is stale or missing", () => {
    expect(
      selectPublishPlan(
        { "101": setting(true) },
        NOW,
        [{ repoId: "101", lastPublicVerifiedAt: EXPIRED }]
      )
    ).toMatchObject({ mode: "repo", scope: { kind: "repo", repoId: "101" } });

    expect(
      selectPublishPlan({ "101": setting(true) }, NOW, [])
    ).toMatchObject({ mode: "repo", scope: { kind: "repo", repoId: "101" } });
  });

  it("uses full sync when multiple visible sources are stale", () => {
    const plan = selectPublishPlan(
      { "101": setting(true), "202": setting(true) },
      NOW,
      [
        { repoId: "101", lastPublicVerifiedAt: EXPIRED },
        { repoId: "202", lastPublicVerifiedAt: EXPIRED },
      ]
    );

    expect(plan).toMatchObject({
      mode: "all",
      scope: { kind: "all" },
      staleRepoIds: ["101", "202"],
    });
  });

  it("does not sync hidden sources", () => {
    const plan = selectPublishPlan(
      { "101": setting(false) },
      NOW,
      [{ repoId: "101", lastPublicVerifiedAt: EXPIRED }]
    );

    expect(plan).toMatchObject({ mode: "build", scope: { kind: "build" } });
  });
});
