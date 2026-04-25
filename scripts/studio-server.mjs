import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const port = 4323;

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function slugify(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const core = normalized.match(/[a-z0-9]+/g)?.join("-") ?? "";
  const hash = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return core ? `${core}-${hash.toString(16).slice(0, 4)}` : `entry-${Date.now()}`;
}

function toParam(value) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "");
}

function splitFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { data: {}, body: raw };
  }
  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { data: {}, body: raw };
  }
  return {
    data: parseFrontmatter(raw.slice(4, endIndex)),
    body: raw.slice(endIndex + 5)
  };
}

function parseFrontmatter(source) {
  const lines = source.split(/\r?\n/);
  const data = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const listMatch = line.match(/^([A-Za-z0-9_]+):\s*$/);
    if (listMatch) {
      const key = listMatch[1];
      const items = [];
      while (lines[index + 1]?.match(/^\s*-\s+/)) {
        index += 1;
        items.push(lines[index].replace(/^\s*-\s+/, "").trim().replace(/^['"]|['"]$/g, ""));
      }
      data[key] = items;
      continue;
    }

    const pairMatch = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (!pairMatch) continue;
    data[pairMatch[1]] = parseScalar(pairMatch[2].trim());
  }
  return data;
}

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/^['"]|['"]$/g, ""));
  }
  return value.replace(/^['"]|['"]$/g, "");
}

function yamlValue(value) {
  return JSON.stringify(value);
}

function yamlList(items) {
  if (!items.length) return "[]";
  return `\n${items.map((item) => `  - ${yamlValue(item)}`).join("\n")}`;
}

function frontmatter(data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: ${yamlList(value)}`);
      continue;
    }
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function collectMarkdownEntries(baseDir) {
  const results = [];

  async function walk(currentDir, relativeParts = []) {
    let dirEntries = [];
    try {
      dirEntries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of dirEntries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, [...relativeParts, entry.name]);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const raw = await readFile(fullPath, "utf8");
      const { data, body } = splitFrontmatter(raw);
      results.push({
        pathKey: path.relative(rootDir, fullPath),
        path: fullPath,
        relativeParts: [...relativeParts, entry.name],
        data,
        body: body.trim()
      });
    }
  }

  await walk(baseDir);
  return results.sort((left, right) => {
    const leftDate = new Date(left.data.uploadDate || left.data.date || 0).getTime();
    const rightDate = new Date(right.data.uploadDate || right.data.date || 0).getTime();
    return rightDate - leftDate;
  });
}

async function collectLabels(baseDir, fieldName) {
  let dirEntries = [];
  try {
    dirEntries = await readdir(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const labels = [];

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(baseDir, entry.name);
    let label = null;

    try {
      const labelJson = JSON.parse(await readFile(path.join(dirPath, "_label.json"), "utf8"));
      label = labelJson.label;
    } catch {
      const nestedEntries = await collectMarkdownEntries(dirPath);
      label = nestedEntries[0]?.data?.[fieldName] ?? entry.name;
    }

    labels.push(label);
  }

  return labels.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function getSiteState() {
  const site = await readJson(path.join(rootDir, "content-source", "site", "site.json"));
  const topics = await collectLabels(path.join(rootDir, "content-source", "notes"), "topic");
  const writingTypes = await collectLabels(path.join(rootDir, "content-source", "writing"), "type");
  const notes = await collectMarkdownEntries(path.join(rootDir, "content-source", "notes"));
  const writings = await collectMarkdownEntries(path.join(rootDir, "content-source", "writing"));
  const projects = await collectMarkdownEntries(path.join(rootDir, "src", "content", "projects"));

  return {
    root: rootDir,
    site,
    topics,
    writingTypes,
    notes,
    writings,
    projects
  };
}

async function runCommand(command) {
  return await new Promise((resolve) => {
    const child = spawn(command, {
      cwd: rootDir,
      shell: true,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        command,
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });
  });
}

async function syncContent() {
  return await runCommand("npm run sync:content");
}

function ensureLocalPath(filePath) {
  const normalized = path.resolve(rootDir, filePath);
  if (!normalized.startsWith(rootDir)) {
    throw new Error("Invalid path");
  }
  return normalized;
}

function sanitizeAssetStem(value, fallback = "asset") {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function sanitizeAssetName(fileName, fallback = "asset.png") {
  const ext = path.extname(fileName || "").toLowerCase();
  const safeExt = ext.match(/^\.[a-z0-9]+$/) ? ext : path.extname(fallback) || ".png";
  const baseName = path.basename(fileName || fallback, ext);
  return `${sanitizeAssetStem(baseName, path.basename(fallback, safeExt))}${safeExt}`;
}

function isLocalLibraryPath(filePath, prefix = "/library/") {
  return Boolean(filePath && filePath.startsWith(prefix));
}

async function removeLocalAsset(filePath, prefix = "/library/") {
  if (!isLocalLibraryPath(filePath, prefix)) return;
  const assetPath = path.join(rootDir, "public", filePath);
  await rm(assetPath, { recursive: true, force: true });
}

async function writeUploadedAsset({ directorySegments, fileName, base64, fallbackName }) {
  const safeFileName = sanitizeAssetName(fileName, fallbackName);
  const relativePath = path.posix.join("/library", ...directorySegments, safeFileName);
  const assetPath = path.join(rootDir, "public", relativePath);
  await mkdir(path.dirname(assetPath), { recursive: true });
  await writeFile(assetPath, Buffer.from(base64, "base64"));
  return relativePath;
}

function buildUploadedAssetPath({ directorySegments, fileName, fallbackName }) {
  const safeFileName = sanitizeAssetName(fileName, fallbackName);
  return path.posix.join("/library", ...directorySegments, safeFileName);
}

function extractMarkdownTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) {
    const endIndex = trimmed.indexOf(">");
    return endIndex === -1 ? trimmed : trimmed.slice(1, endIndex);
  }
  return trimmed.split(/\s+/)[0];
}

function replaceMarkdownTarget(rawTarget, nextTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("<")) {
    const endIndex = trimmed.indexOf(">");
    return endIndex === -1 ? nextTarget : `<${nextTarget}>${trimmed.slice(endIndex + 1)}`;
  }
  const currentTarget = extractMarkdownTarget(trimmed);
  return `${nextTarget}${trimmed.slice(currentTarget.length)}`;
}

async function persistMarkdownImages(markdown, images, directorySegments) {
  if (!images?.length) {
    return markdown;
  }

  const replacements = new Map();

  for (const [index, image] of images.entries()) {
    if (!image?.base64) continue;
    const publicPath = await writeUploadedAsset({
      directorySegments,
      fileName: image.fileName,
      base64: image.base64,
      fallbackName: `image-${index + 1}.png`
    });
    const key = path.basename(image.fileName || "");
    if (key) {
      replacements.set(key, publicPath);
      replacements.set(decodeURIComponent(key), publicPath);
    }
  }

  const rewritePath = (target) => {
    if (!target || /^(https?:|data:|\/)/i.test(target)) {
      return target;
    }
    const cleanTarget = decodeURIComponent(target.split("#")[0].split("?")[0]);
    return replacements.get(path.basename(cleanTarget)) || target;
  };

  const withMarkdownImages = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, target) => {
    const currentTarget = extractMarkdownTarget(target);
    const nextTarget = rewritePath(currentTarget);
    if (nextTarget === currentTarget) return full;
    return `![${alt}](${replaceMarkdownTarget(target, nextTarget)})`;
  });

  return withMarkdownImages.replace(/<img\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>/gi, (full, before, quote, target, after) => {
    const nextTarget = rewritePath(target);
    if (nextTarget === target) return full;
    return `<img${before}src=${quote}${nextTarget}${quote}${after}>`;
  });
}

async function saveHome(payload) {
  const sitePath = path.join(rootDir, "content-source", "site", "site.json");
  const site = await readJson(sitePath);
  site.meta.author = payload.author;
  site.meta.email = payload.email;
  site.meta.location = payload.location;
  site.homeQuote.text = payload.homeQuote;
  site.homeQuote.source = payload.homeQuoteSource;
  site.homeImage = site.homeImage || { path: "", alt: "" };
  site.homeImage.alt = payload.homeImageAlt || "";
  if (payload.homeImageBase64) {
    const nextImagePath = buildUploadedAssetPath({
      directorySegments: ["site", "home"],
      fileName: payload.homeImageFileName,
      fallbackName: "home-image.png"
    });
    const previousImagePath = payload.existingImagePath;
    site.homeImage.path = nextImagePath;
    await writeJson(sitePath, site);
    await writeUploadedAsset({
      directorySegments: ["site", "home"],
      fileName: payload.homeImageFileName,
      base64: payload.homeImageBase64,
      fallbackName: "home-image.png"
    });
    await removeLocalAsset(previousImagePath, "/library/site/");
    return;
  } else {
    site.homeImage.path = payload.existingImagePath || site.homeImage.path || "";
  }
  await writeJson(sitePath, site);
}

async function saveAbout(payload) {
  const sitePath = path.join(rootDir, "content-source", "site", "site.json");
  const site = await readJson(sitePath);
  site.about.name = payload.aboutName;
  site.about.intro = payload.aboutIntro;
  site.about.profile = payload.aboutProfile;
  site.about.researchInterests = payload.aboutResearch;
  site.about.experience = payload.aboutExperience;
  site.about.writing = payload.aboutWriting;
  site.about.contact = payload.aboutContact;
  await writeJson(sitePath, site);
}

async function saveWorkflow(payload) {
  const sitePath = path.join(rootDir, "content-source", "site", "site.json");
  const site = await readJson(sitePath);
  site.workflow.buildCommand = payload.buildCommand;
  site.workflow.publishCommand = payload.publishCommand;
  site.workflow.publishNote = payload.publishNote;
  await writeJson(sitePath, site);
}

async function createTopic(payload) {
  const dir = path.join(rootDir, "content-source", "notes", toParam(payload.topicName));
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "_label.json"), { label: payload.topicName });
}

async function deleteTopic(payload) {
  const dir = path.join(rootDir, "content-source", "notes", toParam(payload.topicName));
  await rm(dir, { recursive: true, force: true });
  await rm(path.join(rootDir, "public", "library", "notes", toParam(payload.topicName)), {
    recursive: true,
    force: true
  });
  await syncContent();
}

async function createWritingType(payload) {
  const dir = path.join(rootDir, "content-source", "writing", toParam(payload.typeName));
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "_label.json"), { label: payload.typeName });
}

async function deleteWritingType(payload) {
  const dir = path.join(rootDir, "content-source", "writing", toParam(payload.typeName));
  await rm(dir, { recursive: true, force: true });
  const assetDir = path.join(rootDir, "public", "library", "writing", toParam(payload.typeName));
  await rm(assetDir, { recursive: true, force: true });
  await syncContent();
}

async function saveNote(payload) {
  const noteStem = payload.pathKey ? path.basename(payload.pathKey, ".md") : slugify(payload.title);
  const rewrittenBody = await persistMarkdownImages(payload.body.trim(), payload.images, [
    "notes",
    toParam(payload.topic),
    noteStem
  ]);
  const content = frontmatter({
    title: payload.title,
    description: payload.description,
    date: payload.date,
    uploadDate: payload.uploadDate,
    topic: payload.topic,
    tags: payload.tags,
    draft: false
  }) + `${rewrittenBody}\n`;

  const targetPath = payload.pathKey
    ? ensureLocalPath(payload.pathKey)
    : path.join(rootDir, "content-source", "notes", toParam(payload.topic), `${slugify(payload.title)}.md`);

  const nextPath = path.join(
    rootDir,
    "content-source",
    "notes",
    toParam(payload.topic),
    path.basename(targetPath)
  );

  await mkdir(path.dirname(nextPath), { recursive: true });
  if (payload.pathKey && targetPath !== nextPath) {
    await rm(targetPath, { force: true });
  }
  await writeFile(nextPath, content);
  await syncContent();
}

async function importNote(payload) {
  const targetPath = path.join(
    rootDir,
    "content-source",
    "notes",
    toParam(payload.topic),
    `${slugify(payload.title)}.md`
  );

  const { body } = splitFrontmatter(payload.content);
  const rewrittenBody = await persistMarkdownImages(body.trim(), payload.images, [
    "notes",
    toParam(payload.topic),
    slugify(payload.title)
  ]);
  const output = frontmatter({
    title: payload.title,
    description: payload.description || "",
    date: payload.date || new Date().toISOString().slice(0, 10),
    uploadDate: payload.uploadDate || new Date().toISOString().slice(0, 10),
    topic: payload.topic,
    tags: payload.tags || [],
    draft: false
  }) + `${rewrittenBody}\n`;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, output);
  await syncContent();
}

async function deleteEntry(payload) {
  const targetPath = ensureLocalPath(payload.pathKey);
  const raw = await readFile(targetPath, "utf8");
  const { data } = splitFrontmatter(raw);
  await rm(targetPath, { force: true });

  if (payload.kind === "writing" && data.format === "pdf" && data.filePath?.startsWith("/library/writing/")) {
    const pdfPath = path.join(rootDir, "public", data.filePath);
    await rm(pdfPath, { force: true });
  }

  if (payload.kind === "note") {
    await rm(
      path.join(rootDir, "public", "library", "notes", toParam(data.topic || ""), path.basename(targetPath, ".md")),
      { recursive: true, force: true }
    );
  }

  if (payload.kind === "writing" && data.format !== "pdf") {
    await rm(
      path.join(rootDir, "public", "library", "writing", toParam(data.type || ""), path.basename(targetPath, ".md")),
      { recursive: true, force: true }
    );
  }

  if (payload.kind === "project" && data.imagePath) {
    await removeLocalAsset(data.imagePath, "/library/projects/");
  }

  if (payload.kind === "note" || payload.kind === "writing") {
    await syncContent();
  }
}

async function saveWriting(payload) {
  const targetPath = payload.pathKey
    ? ensureLocalPath(payload.pathKey)
    : path.join(rootDir, "content-source", "writing", toParam(payload.type), `${slugify(payload.title)}.md`);

  let pdfFilePath = payload.existingFilePath || "";
  if (payload.format === "pdf" && payload.fileBase64) {
    const pdfName = payload.fileName || `${slugify(payload.title)}.pdf`;
    const assetPath = path.join(rootDir, "public", "library", "writing", toParam(payload.type), pdfName);
    await mkdir(path.dirname(assetPath), { recursive: true });
    await writeFile(assetPath, Buffer.from(payload.fileBase64, "base64"));
    pdfFilePath = `/library/writing/${toParam(payload.type)}/${pdfName}`;
  }

  const writingStem = payload.pathKey ? path.basename(payload.pathKey, ".md") : slugify(payload.title);
  const rewrittenBody = payload.format === "markdown"
    ? await persistMarkdownImages(payload.body.trim(), payload.images, [
        "writing",
        toParam(payload.type),
        writingStem
      ])
    : payload.body.trim();

  const content = frontmatter({
    title: payload.title,
    description: payload.description,
    date: payload.date,
    type: payload.type,
    tags: payload.tags,
    draft: false,
    format: payload.format,
    publication: payload.publication,
    filePath: payload.format === "pdf" ? pdfFilePath : ""
  }) + `${rewrittenBody}\n`;

  const nextPath = path.join(
    rootDir,
    "content-source",
    "writing",
    toParam(payload.type),
    path.basename(targetPath)
  );

  await mkdir(path.dirname(nextPath), { recursive: true });
  if (payload.pathKey && targetPath !== nextPath) {
    await rm(targetPath, { force: true });
  }
  await writeFile(nextPath, content);
  await syncContent();
}

async function saveProject(payload) {
  const targetPath = payload.pathKey
    ? ensureLocalPath(payload.pathKey)
    : path.join(rootDir, "src", "content", "projects", `${slugify(payload.title)}.md`);

  let imagePath = payload.existingImagePath || "";
  const previousImagePath = payload.existingImagePath || "";
  if (payload.imageBase64) {
    imagePath = buildUploadedAssetPath({
      directorySegments: ["projects", path.basename(targetPath, ".md")],
      fileName: payload.imageFileName,
      fallbackName: "project-image.png"
    });
  }

  const content = frontmatter({
    title: payload.title,
    description: payload.description,
    date: payload.date,
    tags: payload.tags,
    draft: false,
    status: payload.status || "In progress",
    featured: false,
    link: payload.link,
    imagePath,
    imageAlt: payload.imageAlt
  }) + `${payload.body.trim()}\n`;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);

  if (payload.imageBase64) {
    await writeUploadedAsset({
      directorySegments: ["projects", path.basename(targetPath, ".md")],
      fileName: payload.imageFileName,
      base64: payload.imageBase64,
      fallbackName: "project-image.png"
    });
    await removeLocalAsset(previousImagePath, "/library/projects/");
  }
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  try {
    if (req.url === "/health" && req.method === "GET") {
      jsonResponse(res, 200, { ok: true });
      return;
    }

    if (req.url === "/state" && req.method === "GET") {
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/save/home" && req.method === "POST") {
      await saveHome(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/save/about" && req.method === "POST") {
      await saveAbout(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/save/workflow" && req.method === "POST") {
      await saveWorkflow(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/notes/topic" && req.method === "POST") {
      await createTopic(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/notes/topic/delete" && req.method === "POST") {
      await deleteTopic(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/notes/save" && req.method === "POST") {
      await saveNote(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/notes/import" && req.method === "POST") {
      await importNote(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/writing/type" && req.method === "POST") {
      await createWritingType(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/writing/type/delete" && req.method === "POST") {
      await deleteWritingType(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/writing/save" && req.method === "POST") {
      await saveWriting(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/projects/save" && req.method === "POST") {
      await saveProject(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/entry/delete" && req.method === "POST") {
      await deleteEntry(await parseBody(req));
      jsonResponse(res, 200, { ok: true, state: await getSiteState() });
      return;
    }

    if (req.url === "/workflow/build" && req.method === "POST") {
      const state = await getSiteState();
      const result = await runCommand(state.site.workflow.buildCommand || "npm run build");
      jsonResponse(res, 200, { ok: result.ok, result, state: await getSiteState() });
      return;
    }

    if (req.url === "/workflow/publish" && req.method === "POST") {
      const state = await getSiteState();
      const command = state.site.workflow.publishCommand?.trim();
      if (!command) {
        jsonResponse(res, 400, { ok: false, error: "未配置发布命令。" });
        return;
      }
      const result = await runCommand(command);
      jsonResponse(res, 200, { ok: result.ok, result, state: await getSiteState() });
      return;
    }

    jsonResponse(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    jsonResponse(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Studio server running on http://127.0.0.1:${port}`);
});
