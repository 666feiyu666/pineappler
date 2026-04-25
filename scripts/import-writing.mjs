import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureArray,
  extractDescription,
  extractTitle,
  formatDate,
  serializeFrontmatter,
  slugifyFilename,
  splitFrontmatter,
  toParam
} from "./content-helpers.mjs";

const rootDir = process.cwd();
const writingRoot = path.join(rootDir, "content-source", "writing");
const assetRoot = path.join(rootDir, "public", "library", "writing");

function readArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }
    options[token.slice(2)] = args[index + 1];
    index += 1;
  }

  return options;
}

async function importMarkdown(sourceFile, options) {
  const raw = await readFile(sourceFile, "utf8");
  const sourceInfo = await stat(sourceFile);
  const { data, body } = splitFrontmatter(raw);
  const fallbackTitle = path.basename(sourceFile, ".md");
  const title = options.title || data.title || extractTitle(body, fallbackTitle);
  const description = options.description || data.description || extractDescription(body, title);
  const date = options.date || data.date || formatDate(sourceInfo.mtime);
  const tags = options.tags ? ensureArray(options.tags) : ensureArray(data.tags);
  const draft = options.draft ? options.draft === "true" : Boolean(data.draft);
  const type = options.type;
  const typeDir = path.join(writingRoot, toParam(type));
  const fileName = `${slugifyFilename(options.slug || title, sourceFile)}.md`;

  await mkdir(typeDir, { recursive: true });

  const frontmatter = serializeFrontmatter({
    title,
    description,
    date,
    type,
    tags,
    draft,
    format: "markdown",
    publication: options.publication,
    sourcePath: path.relative(rootDir, sourceFile)
  });

  await writeFile(path.join(typeDir, fileName), `${frontmatter}${body.trim()}\n`);
  console.log(`Imported writing -> ${path.relative(rootDir, path.join(typeDir, fileName))}`);
}

async function importPdf(sourceFile, options) {
  const sourceInfo = await stat(sourceFile);
  const title = options.title || path.basename(sourceFile, path.extname(sourceFile));
  const description = options.description || "PDF entry placeholder.";
  const date = options.date || formatDate(sourceInfo.mtime);
  const tags = ensureArray(options.tags);
  const draft = options.draft === "true";
  const type = options.type;
  const typeParam = toParam(type);
  const slug = slugifyFilename(options.slug || title, sourceFile);
  const assetDir = path.join(assetRoot, typeParam);
  const sourceExt = path.extname(sourceFile).toLowerCase();
  const assetPath = path.join(assetDir, `${slug}${sourceExt}`);
  const entryDir = path.join(writingRoot, typeParam);
  const entryPath = path.join(entryDir, `${slug}.md`);

  await mkdir(assetDir, { recursive: true });
  await mkdir(entryDir, { recursive: true });
  await copyFile(sourceFile, assetPath);

  const frontmatter = serializeFrontmatter({
    title,
    description,
    date,
    type,
    tags,
    draft,
    format: "pdf",
    filePath: path.posix.join("/library/writing", typeParam, `${slug}${sourceExt}`),
    publication: options.publication,
    sourcePath: path.relative(rootDir, sourceFile)
  });

  const body = options.abstract
    ? options.abstract
    : "这是一条 PDF 类型的 writing 条目。后续可以在这里补充摘要、会议信息或阅读说明。";

  await writeFile(entryPath, `${frontmatter}${body}\n`);
  console.log(`Imported PDF writing -> ${path.relative(rootDir, entryPath)}`);
}

async function main() {
  const options = readArgs();
  if (!options.source || !options.type) {
    throw new Error("Usage: npm run import:writing -- --source <file.md|file.pdf> --type <type>");
  }

  const sourceFile = path.resolve(rootDir, options.source);
  const ext = path.extname(sourceFile).toLowerCase();

  if (ext === ".md") {
    await importMarkdown(sourceFile, options);
    return;
  }

  if (ext === ".pdf") {
    await importPdf(sourceFile, options);
    return;
  }

  throw new Error("Only .md and .pdf sources are supported.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
