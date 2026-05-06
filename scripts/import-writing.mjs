import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
    sourcePath: path.relative(rootDir, sourceFile)
  });

  await writeFile(path.join(typeDir, fileName), `${frontmatter}${body.trim()}\n`);
  console.log(`Imported writing -> ${path.relative(rootDir, path.join(typeDir, fileName))}`);
}

async function main() {
  const options = readArgs();
  if (!options.source || !options.type) {
    throw new Error("Usage: npm run import:writing -- --source <file.md> --type <type>");
  }

  const sourceFile = path.resolve(rootDir, options.source);
  const ext = path.extname(sourceFile).toLowerCase();

  if (ext === ".md") {
    await importMarkdown(sourceFile, options);
    return;
  }

  throw new Error("Only .md sources are supported.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
