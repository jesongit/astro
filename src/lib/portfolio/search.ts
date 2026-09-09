/**
 * 作品搜索(计划 §12.2):
 * 中文 NFKC 归一化 + 大小写折叠 + 子串匹配;不引入外部搜索平台。
 * 排序:标题精确 > 标题前缀 > 标题子串 > 标签/技术栈 > 摘要 > 正文,
 * 同分按人工 order(调用方保证记录已按 order 升序传入)。
 */
import { LIMITS } from "./config";

export interface SearchRecord {
  slug: string;
  href: string;
  title: string;
  summary: string;
  topics: string[];
  techStack: string[];
  /** 截断后的正文纯文本 */
  bodyText: string;
  order: number;
}

export function normalizeQuery(query: string): string {
  return query.normalize("NFKC").toLowerCase().trim();
}

export function isValidQuery(rawQuery: string): boolean {
  const q = normalizeQuery(rawQuery);
  return q.length >= LIMITS.searchQueryMin && q.length <= LIMITS.searchQueryMax;
}

export function searchProjects(
  records: SearchRecord[],
  rawQuery: string
): SearchRecord[] {
  const q = normalizeQuery(rawQuery);
  if (!isValidQuery(rawQuery)) return [];

  const scored: { score: number; index: number; record: SearchRecord }[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const title = normalizeQuery(record.title);
    let score = 0;
    if (title === q) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (
      [...record.topics, ...record.techStack]
        .map(normalizeQuery)
        .some(tag => tag.includes(q))
    ) {
      score = 40;
    } else if (normalizeQuery(record.summary).includes(q)) {
      score = 30;
    } else if (normalizeQuery(record.bodyText).includes(q)) {
      score = 10;
    }
    if (score > 0) scored.push({ score, index, record });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score || records[a.index].order - records[b.index].order
    )
    .slice(0, LIMITS.searchMaxResults)
    .map(entry => entry.record);
}
