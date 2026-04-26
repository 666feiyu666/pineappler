import type { CollectionEntry } from "astro:content";

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

export function taxonomyLabel(primary: string, secondary?: string) {
  return secondary ? `${primary} / ${secondary}` : primary;
}

export function uniqueNonEmpty(values: Array<string | undefined | null>) {
  return uniqueValues(values.filter(Boolean) as string[]);
}

export function taxonomyPathSegments(primary: string, secondary?: string) {
  return [primary, secondary].filter(Boolean) as string[];
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
