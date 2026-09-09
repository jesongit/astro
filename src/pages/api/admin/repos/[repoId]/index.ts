import type { APIRoute } from "astro";
import {
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
} from "@/lib/admin/api";
import type { Incident } from "@/lib/portfolio/types";

export const prerender = false;

/** GET /api/admin/repos/[repoId]:设置、观察摘要、校验警告、事件与 revision(§10.2) */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();

  const repoId = context.params.repoId ?? "";
  if (!/^\d{1,12}$/.test(repoId)) {
    return jsonError(404, "invalid_repo_id", "仓库 ID 不合法。");
  }

  const settings = await runtime.control.getSettings(repoId);
  const observation = await runtime.cache.getLatestObservation(repoId);
  const incidents: Incident[] = await runtime.cache.getIncidents(repoId);
  const latestIncident = incidents.length
    ? incidents.reduce((a, b) =>
        Date.parse(a.observedAt) >= Date.parse(b.observedAt) ? a : b
      )
    : null;

  return jsonOk({
    repoId,
    settings,
    observation,
    incidents,
    latestIncident,
    needsIncidentAcknowledgement:
      latestIncident !== null &&
      settings?.acknowledgedIncidentId !== latestIncident.incidentId,
  });
};
