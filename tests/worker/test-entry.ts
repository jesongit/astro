/**
 * 池化测试使用生产 Worker 入口,确保 scheduled/fetch 契约与实际部署一致。
 * 依赖内联配置见 vitest.worker.config.ts。
 */
export { default } from "../../workers/portfolio-sync/src/index";
