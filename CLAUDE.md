# CLAUDE.md

## Project Overview
This is a personal blog built with [AstroPaper](https://github.com/satnaing/astro-paper) (Astro + Tailwind CSS). The blog content is in Chinese, authored by Posase.

- Site: https://www.posase.im/
- Blog articles: `src/data/blog/*.md`
- Content schema: `src/content.config.ts`
- Site config: `src/config.ts`

## Important Files

### Blog Style Guide
**Path:** `BLOG_STYLE_GUIDE.md` (project root)

This file defines the writing standards for all blog articles, including:
- Frontmatter field rules (title, description, tags, dates)
- Tag taxonomy (standardized tag list)
- Chinese-English typography rules (spacing, punctuation)
- Markdown formatting conventions
- Content structure templates for tutorials and notes
- SEO checklist

**You MUST read `BLOG_STYLE_GUIDE.md` before creating or editing any blog article** to ensure consistency with the established standards.

## Common Commands
```bash
npm run dev       # Start dev server
npm run build     # Build (includes astro check + pagefind)
npm run preview   # Preview built site
npm run format    # Format with prettier
npm run lint      # Lint with eslint
```

## Key Conventions
- Blog articles are in `src/data/blog/` as `.md` files, organized into subdirectories:
  - `tutorials/` — 部署教程、入门指南
  - `notes/` — 学习笔记、速查手册
  - `leetcode/` — LeetCode 题解
  - `_drafts/` — 草稿（被 glob pattern `[^_]*.md` 排除，不会发布）
- Frontmatter schema is defined in `src/content.config.ts`
- Tags should follow the standardized list in `BLOG_STYLE_GUIDE.md`
- Description must NOT duplicate the title
- Chinese-English mixed text requires spaces between them
- Article headings start from `##` (h2), never use `#` (h1) in body
- Draft articles use `draft: true` in frontmatter
- Articles marked with `<!-- [建议删除] -->` are candidates for removal
- Articles marked with `<!-- [建议补充] -->` need more content before publishing

## Git 操作规则
- **Git 提交和推送必须经过用户手动确认后才能执行**
- 不要自动执行 `git commit` 或 `git push`，先向用户展示变更内容并等待确认
- Remote: `git@github.com:jesongit/astro.git`，分支: `main`
