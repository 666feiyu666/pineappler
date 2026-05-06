import type { CollectionEntry } from "astro:content";
import { taxonomyOrder } from "../data/site";

type SiteEntry = CollectionEntry<"notes" | "writing" | "projects">;

export function publishedEntries<T extends SiteEntry>(entries: T[]) {
  return entries.filter((entry) => !entry.data.draft);
}

export function sortEntries<T extends SiteEntry>(entries: T[]) {
  return [...entries].sort((left, right) => {
    const leftTime = getEntryTimestamp(left);
    const rightTime = getEntryTimestamp(right);
    return rightTime - leftTime;
  });
}

export function getEntryTimestamp(entry: SiteEntry) {
  if ("uploadDate" in entry.data && entry.data.uploadDate) {
    return entry.data.uploadDate.getTime();
  }
  return entry.data.date.getTime();
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function toParam(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "");
}

export function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
}

export function orderValues(values: string[], preferredOrder: string[] = []) {
  const normalized = [...new Set(values.filter(Boolean))];
  const remaining = new Set(normalized);
  const ordered = [];

  for (const item of preferredOrder) {
    if (!remaining.has(item)) continue;
    ordered.push(item);
    remaining.delete(item);
  }

  return [
    ...ordered,
    ...[...remaining].sort((left, right) => left.localeCompare(right, "zh-CN"))
  ];
}

export function orderedTaxonomyValues(
  values: string[],
  key: "notesTopics" | "writingTypes" | "projectCategories"
) {
  return orderValues(values, taxonomyOrder?.[key] || []);
}

export function groupByLabel<T>(items: T[], getLabel: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const label = getLabel(item);
    const bucket = groups.get(label);
    if (bucket) {
      bucket.push(item);
      continue;
    }
    groups.set(label, [item]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
    .map(([label, entries]) => ({ label, entries }));
}

export function toPlainText(markdown: string) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptText(value: string, maxLength = 180) {
  const normalized = toPlainText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export function formatExternalLinkLabel(url?: string) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    const compactPath = pathname.length > 18 ? `${pathname.slice(0, 18)}…` : pathname;
    return `${parsed.hostname}${compactPath}`;
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}
