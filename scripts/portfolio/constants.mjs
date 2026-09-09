/** Node-side mirror of the protocol limits in src/lib/portfolio/config.ts. */
export const LIMITS = Object.freeze({
  configMaxBytes: 32 * 1024,
  bodyMaxBytes: 128 * 1024,
  readmeMaxBytes: 256 * 1024,
  payloadMaxBytes: 512 * 1024,
  summaryFallback: "项目资料见 GitHub 仓库。",
  readmeSummaryChars: 180,
});

export const PUBLICATION = Object.freeze({
  publicValidityMinutes: 30,
  releaseStaleMaxHours: 24,
});

export const GITHUB_DEFAULTS = Object.freeze({
  apiVersion: "2026-03-10",
  owner: "jesongit",
  ownerType: "user",
  timeoutMs: 8_000,
  rateLimitPauseThreshold: 10,
});
