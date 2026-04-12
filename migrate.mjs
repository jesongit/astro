/**
 * Hexo -> AstroPaper frontmatter migration script
 * Converts Hexo frontmatter to AstroPaper format
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';

const HEXO_ROOT = 'D:\\AppData\\Claude\\hexo';
const ASTRO_ROOT = 'D:\\AppData\\Claude\\astro';
const POSTS_SRC = join(HEXO_ROOT, 'source', '_posts');
const DRAFTS_SRC = join(HEXO_ROOT, 'source', '_drafts');
const BLOG_DEST = join(ASTRO_ROOT, 'src', 'data', 'blog');
const IMG_SRC = join(HEXO_ROOT, 'source', 'img');
const IMG_DEST = join(ASTRO_ROOT, 'public', 'img');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const fmStr = match[1];
  const body = content.slice(match[0].length).replace(/^\r?\n/, '');
  const frontmatter = {};
  let currentKey = null;

  for (const line of fmStr.split('\n')) {
    const trimmed = line.trimEnd();

    // Array item
    if (trimmed.match(/^\s+-\s+/) && currentKey) {
      const val = trimmed.replace(/^\s+-\s+/, '').trim();
      if (!frontmatter[currentKey]) frontmatter[currentKey] = [];
      if (Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey].push(val);
      }
      continue;
    }

    // Key: value
    const kvMatch = trimmed.match(/^(\w+):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '') {
        frontmatter[currentKey] = [];
      } else {
        frontmatter[currentKey] = val.replace(/^['"](.*)['"]$/, '$1');
      }
    }
  }

  return { frontmatter, body };
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().replace('.000Z', 'Z');
}

function buildAstroPaperFrontmatter(fm, isDraft = false) {
  const lines = ['---'];

  // author
  lines.push(`author: Posase`);

  // pubDatetime (required)
  if (fm.date) {
    lines.push(`pubDatetime: ${formatDate(fm.date)}`);
  } else {
    lines.push(`pubDatetime: ${new Date().toISOString()}`);
  }

  // modDatetime
  if (fm.updated && fm.updated !== fm.date) {
    lines.push(`modDatetime: ${formatDate(fm.updated)}`);
  }

  // title
  const title = fm.title || 'Untitled';
  lines.push(`title: "${title.replace(/"/g, '\\"')}"`);

  // draft
  lines.push(`draft: ${isDraft}`);

  // tags - merge categories into tags for AstroPaper
  const tags = new Set();
  if (fm.tags && Array.isArray(fm.tags)) {
    fm.tags.forEach(t => tags.add(t));
  }
  if (fm.categories && Array.isArray(fm.categories)) {
    fm.categories.forEach(c => tags.add(c));
  }
  if (tags.size > 0) {
    lines.push('tags:');
    for (const tag of tags) {
      lines.push(`  - ${tag}`);
    }
  } else {
    lines.push('tags:');
    lines.push('  - others');
  }

  // description
  lines.push(`description: "${title.replace(/"/g, '\\"')}"`);

  lines.push('---');
  return lines.join('\n');
}

function sanitizeFilename(name) {
  return name
    .replace(/\s+/g, '-')
    .replace(/[「」]/g, '')
    .replace(/----/g, '-')
    .replace(/---/g, '-')
    .replace(/--/g, '-');
}

function migrateFiles(srcDir, isDraft = false) {
  if (!existsSync(srcDir)) {
    console.log(`Source directory not found: ${srcDir}`);
    return;
  }

  const files = readdirSync(srcDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  console.log(`\nMigrating ${files.length} ${isDraft ? 'draft' : 'post'} files from ${srcDir}`);

  for (const file of files) {
    const srcPath = join(srcDir, file);
    const content = readFileSync(srcPath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const newFm = buildAstroPaperFrontmatter(frontmatter, isDraft);
    const newContent = newFm + '\n\n' + body;

    const newFilename = sanitizeFilename(file);
    const destPath = join(BLOG_DEST, newFilename);

    writeFileSync(destPath, newContent, 'utf-8');
    console.log(`  ✓ ${file} -> ${newFilename}`);
  }
}

function migrateImages() {
  if (!existsSync(IMG_SRC)) {
    console.log('\nNo images directory found');
    return;
  }

  if (!existsSync(IMG_DEST)) {
    mkdirSync(IMG_DEST, { recursive: true });
  }

  const files = readdirSync(IMG_SRC);
  console.log(`\nMigrating ${files.length} images`);

  for (const file of files) {
    copyFileSync(join(IMG_SRC, file), join(IMG_DEST, file));
    console.log(`  ✓ ${file}`);
  }
}

function removeDefaultPosts() {
  const defaults = readdirSync(BLOG_DEST).filter(f => f.endsWith('.md'));
  console.log(`Removing ${defaults.length} default template posts...`);
  for (const file of defaults) {
    unlinkSync(join(BLOG_DEST, file));
    console.log(`  ✗ Removed ${file}`);
  }
  // Also remove examples and _releases subdirectories
  const examplesDir = join(BLOG_DEST, 'examples');
  const releasesDir = join(BLOG_DEST, '_releases');
  if (existsSync(examplesDir)) {
    for (const f of readdirSync(examplesDir)) {
      unlinkSync(join(examplesDir, f));
    }
    rmdirSync(examplesDir);
    console.log(`  ✗ Removed examples/`);
  }
  if (existsSync(releasesDir)) {
    for (const f of readdirSync(releasesDir)) {
      unlinkSync(join(releasesDir, f));
    }
    rmdirSync(releasesDir);
    console.log(`  ✗ Removed _releases/`);
  }
}

// Main
console.log('=== Hexo -> AstroPaper Migration ===\n');

// Remove default posts
removeDefaultPosts();

// Migrate posts
migrateFiles(POSTS_SRC, false);

// Migrate drafts
migrateFiles(DRAFTS_SRC, true);

// Migrate images
migrateImages();

console.log('\n=== Migration complete! ===');
