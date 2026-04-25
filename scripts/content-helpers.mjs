import { createHash } from "node:crypto";
import path from "node:path";

export function splitFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { data: {}, body: raw };
  }

  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { data: {}, body: raw };
  }

  const frontmatter = raw.slice(4, endIndex);
  const body = raw.slice(endIndex + 5);
  return { data: parseFrontmatter(frontmatter), body };
}

export function parseFrontmatter(source) {
  const lines = source.split(/\r?\n/);
  const data = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const listMatch = line.match(/^([A-Za-z0-9_]+):\s*$/);
    if (listMatch) {
      const key = listMatch[1];
      const items = [];
      while (lines[index + 1]?.match(/^\s*-\s+/)) {
        index += 1;
        items.push(stripQuotes(lines[index].replace(/^\s*-\s+/, "").trim()));
      }
      data[key] = items;
      continue;
    }

    const pairMatch = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (!pairMatch) {
      continue;
    }

    const [, key, rawValue] = pairMatch;
    data[key] = parseScalar(rawValue.trim());
  }

  return data;
}

export function parseScalar(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map(stripQuotes);
  }
  return stripQuotes(value);
}

export function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, "");
}

export function stripMarkdown(value) {
  return value
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]*]\([^)]+\)/g, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

export function extractTitle(body, fallback) {
  const heading = body.match(/^#\s+(.+)$/m)?.[1];
  if (heading) {
    return stripMarkdown(heading);
  }
  return fallback.replace(/\.md$/i, "");
}

export function extractDescription(body, fallbackTitle) {
  const cleanedLines = stripMarkdown(body)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== fallbackTitle);

  const description =
    cleanedLines.find((line) => line.length > 20) ??
    cleanedLines[0] ??
    fallbackTitle;
  return description.slice(0, 160);
}

export function slugifyFilename(input, salt = "") {
  const ascii = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const words = ascii.match(/[a-z0-9]+/g)?.join("-") ?? "";
  const hash = createHash("sha1")
    .update(`${salt}-${input}`)
    .digest("hex")
    .slice(0, 6);
  return words ? `${words}-${hash}` : `entry-${hash}`;
}

export function toParam(value) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "");
}

export function yamlValue(value) {
  return JSON.stringify(value);
}

export function yamlList(items) {
  if (!items.length) {
    return "[]";
  }
  return `\n${items.map((item) => `  - ${yamlValue(item)}`).join("\n")}`;
}

export function formatDate(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function serializeFrontmatter(data) {
  const lines = ["---"];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${key}: ${yamlList(value)}`);
      continue;
    }

    lines.push(`${key}: ${yamlValue(value)}`);
  }

  lines.push("---", "");
  return `${lines.join("\n")}\n`;
}

export function getFolderLabel(filePath, baseDir) {
  const relativeDir = path.relative(baseDir, path.dirname(filePath));
  if (!relativeDir || relativeDir === ".") {
    return "";
  }
  return relativeDir.split(path.sep).at(-1) ?? "";
}

export function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
