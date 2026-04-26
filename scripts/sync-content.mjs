import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureArray,
  extractDescription,
  extractTitle,
  formatDate,
  getFolderLabel,
  serializeFrontmatter,
  slugifyFilename,
  splitFrontmatter
} from "./content-helpers.mjs";

const rootDir = process.cwd();
const sources = {
  notes: path.join(rootDir, "content-source", "notes"),
  writing: path.join(rootDir, "content-source", "writing")
};
const outputs = {
  notes: path.join(rootDir, "src", "content", "notes"),
  writing: path.join(rootDir, "src", "content", "writing")
};

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(baseDir) {
  if (!(await exists(baseDir))) {
    return [];
  }

  const entries = await readdir(baseDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function recreateDir(target) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

async function readLabel(dirPath, fallback = "") {
  if (!dirPath) {
    return fallback;
  }

  try {
    const raw = await readFile(path.join(dirPath, "_label.json"), "utf8");
    return JSON.parse(raw).label || fallback;
  } catch {
    return fallback;
  }
}

async function syncNotes() {
  const files = (await collectMarkdownFiles(sources.notes)).sort((left, right) =>
    left.localeCompare(right)
  );

  await recreateDir(outputs.notes);

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const fileInfo = await stat(filePath);
    const { data, body } = splitFrontmatter(raw);
    const fallbackTitle = path.basename(filePath, ".md");
    const title = data.title || extractTitle(body, fallbackTitle);
    const description = data.description || extractDescription(body, title);
    const date = data.date || formatDate(fileInfo.mtime);
    const uploadDate = data.uploadDate || formatDate(fileInfo.birthtime || fileInfo.mtime);
    const relativeDir = path.relative(sources.notes, path.dirname(filePath));
    const [topicParam = "", subtopicParam = ""] = relativeDir.split(path.sep).filter(Boolean);
    const topicDir = topicParam ? path.join(sources.notes, topicParam) : "";
    const subtopicDir = subtopicParam ? path.join(topicDir, subtopicParam) : "";
    const topic = data.topic || (await readLabel(topicDir, topicParam)) || getFolderLabel(filePath, sources.notes) || "未分类";
    const subtopic = data.subtopic || (subtopicParam ? await readLabel(subtopicDir, subtopicParam) : "");
    const tags = ensureArray(data.tags);
    const draft = typeof data.draft === "boolean" ? data.draft : false;
    const sourcePath = path.relative(rootDir, filePath);
    const outputName = `${slugifyFilename(data.slug || fallbackTitle, sourcePath)}.md`;

    const frontmatter = serializeFrontmatter({
      title,
      description,
      date,
      uploadDate,
      topic,
      subtopic,
      tags,
      draft,
      sourcePath
    });

    await writeFile(path.join(outputs.notes, outputName), `${frontmatter}${body.trim()}\n`);
  }

  return files.length;
}

async function syncWriting() {
  const files = (await collectMarkdownFiles(sources.writing)).sort((left, right) =>
    left.localeCompare(right)
  );

  await recreateDir(outputs.writing);

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const fileInfo = await stat(filePath);
    const { data, body } = splitFrontmatter(raw);
    const fallbackTitle = path.basename(filePath, ".md");
    const title = data.title || extractTitle(body, fallbackTitle);
    const description = data.description || extractDescription(body, title);
    const date = data.date || formatDate(fileInfo.mtime);
    const relativeDir = path.relative(sources.writing, path.dirname(filePath));
    const [typeParam = "", subtypeParam = ""] = relativeDir.split(path.sep).filter(Boolean);
    const typeDir = typeParam ? path.join(sources.writing, typeParam) : "";
    const subtypeDir = subtypeParam ? path.join(typeDir, subtypeParam) : "";
    const type = data.type || (await readLabel(typeDir, typeParam)) || getFolderLabel(filePath, sources.writing) || "随笔";
    const subtype = data.subtype || (subtypeParam ? await readLabel(subtypeDir, subtypeParam) : "");
    const tags = ensureArray(data.tags);
    const draft = typeof data.draft === "boolean" ? data.draft : false;
    const format = data.format === "pdf" ? "pdf" : "markdown";
    const filePathValue = data.filePath || undefined;
    const publication = data.publication || undefined;
    const sourcePath = path.relative(rootDir, filePath);
    const outputName = `${slugifyFilename(data.slug || fallbackTitle, sourcePath)}.md`;

    const frontmatter = serializeFrontmatter({
      title,
      description,
      date,
      type,
      subtype,
      tags,
      draft,
      format,
      filePath: filePathValue,
      publication,
      sourcePath
    });

    await writeFile(path.join(outputs.writing, outputName), `${frontmatter}${body.trim()}\n`);
  }

  return files.length;
}

async function main() {
  const noteCount = await syncNotes();
  const writingCount = await syncWriting();
  console.log(`Synced ${noteCount} note file(s) and ${writingCount} writing file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
