const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "arsenal");
const OUTPUT_PATH = path.join(ROOT, "data", "articles-index.json");

const REQUIRED_FIELDS = ["title", "slug", "date", "excerpt", "tags", "cover"];

function assertValidFrontmatter(frontmatter, filePath) {
  for (const field of REQUIRED_FIELDS) {
    if (frontmatter[field] === undefined || frontmatter[field] === null || frontmatter[field] === "") {
      throw new Error(`Missing required field "${field}" in ${filePath}`);
    }
  }

  if (!Array.isArray(frontmatter.tags)) {
    throw new Error(`"tags" must be an array in ${filePath}`);
  }

  if (frontmatter.aliases && !Array.isArray(frontmatter.aliases)) {
    throw new Error(`"aliases" must be an array when present in ${filePath}`);
  }
}

function normalizeDate(dateValue, filePath) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${dateValue}" in ${filePath}`);
  }
  return date.toISOString().slice(0, 10);
}

function buildSearchIndexData(article) {
  return {
    title: article.title,
    excerpt: article.excerpt,
    tags: article.tags,
    text: `${article.title} ${article.excerpt} ${article.tags.join(" ")}`.toLowerCase().trim(),
  };
}

function readArticleFiles() {
  if (!fs.existsSync(CONTENT_DIR)) {
    throw new Error(`Content directory not found: ${CONTENT_DIR}`);
  }

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(CONTENT_DIR, name));
}

function toArticleIndexRecord(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data;

  assertValidFrontmatter(fm, filePath);

  const record = {
    title: String(fm.title).trim(),
    slug: String(fm.slug).trim(),
    date: normalizeDate(fm.date, filePath),
    excerpt: String(fm.excerpt).trim(),
    tags: fm.tags.map((tag) => String(tag).trim()).filter(Boolean),
    cover: String(fm.cover).trim(),
    category: fm.category ? String(fm.category).trim() : "Tactical Analysis",
    readTime: fm.readTime ? String(fm.readTime).trim() : "5 min",
    featured: Boolean(fm.featured),
    emoji: fm.emoji ? String(fm.emoji).trim() : "📄",
    aliases: Array.isArray(fm.aliases) ? fm.aliases.map((x) => String(x).trim()).filter(Boolean) : [],
  };

  record.search = buildSearchIndexData(record);
  return record;
}

function sortNewestFirst(records) {
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function main() {
  const records = sortNewestFirst(readArticleFiles().map(toArticleIndexRecord));
  const payload = {
    generatedAt: new Date().toISOString(),
    count: records.length,
    articles: records,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Generated ${OUTPUT_PATH} (${records.length} articles)`);
}

main();
