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
const notesRoot = path.join(rootDir, "content-source", "notes");

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

async function main() {
  const options = readArgs();
  if (!options.source || !options.topic) {
    throw new Error("Usage: npm run import:note -- --source <file.md> --topic <topic> [--subtopic <subtopic>]");
  }

  const sourceFile = path.resolve(rootDir, options.source);
  const raw = await readFile(sourceFile, "utf8");
  const sourceInfo = await stat(sourceFile);
  const { data, body } = splitFrontmatter(raw);
  const fallbackTitle = path.basename(sourceFile, ".md");
  const title = options.title || data.title || extractTitle(body, fallbackTitle);
  const description = options.description || data.description || extractDescription(body, title);
  const date = options.date || data.date || formatDate(sourceInfo.mtime);
  const uploadDate = options.uploadDate || data.uploadDate || formatDate(new Date());
  const tags = options.tags ? ensureArray(options.tags) : ensureArray(data.tags);
  const draft = options.draft ? options.draft === "true" : Boolean(data.draft);
  const topic = options.topic;
  const subtopic = options.subtopic || data.subtopic || "";
  const topicDir = path.join(
    notesRoot,
    toParam(topic),
    ...(subtopic ? [toParam(subtopic)] : [])
  );
  const fileName = `${slugifyFilename(options.slug || title, sourceFile)}.md`;

  await mkdir(topicDir, { recursive: true });

  const frontmatter = serializeFrontmatter({
    title,
    description,
    date,
    uploadDate,
    topic,
    subtopic,
    tags,
    draft,
    sourcePath: path.relative(rootDir, sourceFile)
  });

  await writeFile(path.join(topicDir, fileName), `${frontmatter}${body.trim()}\n`);
  console.log(`Imported note -> ${path.relative(rootDir, path.join(topicDir, fileName))}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
