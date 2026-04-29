const input = document.querySelector("[data-search-input]");
const summary = document.querySelector("[data-search-summary]");
const resultsNode = document.querySelector("[data-search-results]");
const indexNode = document.querySelector("#search-index");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTags(tags) {
  if (!tags?.length) {
    return "";
  }

  return `
    <ul class="tag-list" aria-label="Tags">
      ${tags
        .map(
          (tag) =>
            `<li><a href="/search?q=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a></li>`
        )
        .join("")}
    </ul>
  `;
}

function updateQueryString(query) {
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set("q", query);
  } else {
    url.searchParams.delete("q");
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function renderResults(entries, query) {
  if (!resultsNode || !summary) return;

  if (!query) {
    summary.textContent = `共索引 ${entries.length} 条内容。`;
    resultsNode.innerHTML = "";
    return;
  }

  const keyword = query.trim().toLocaleLowerCase();
  const matches = entries.filter((entry) =>
    String(entry.searchText || "").toLocaleLowerCase().includes(keyword)
  );

  summary.textContent = `“${query}” 共匹配到 ${matches.length} 条结果。`;

  if (!matches.length) {
    resultsNode.innerHTML = `
      <article class="search-result-card">
        <p class="search-result-empty">没有找到相关内容。可以尝试标题、标签、主题或更短的关键词。</p>
      </article>
    `;
    return;
  }

  resultsNode.innerHTML = matches
    .map(
      (entry) => `
        <article class="search-result-card">
          <div class="search-result-header">
            <p class="search-result-meta">${escapeHtml(entry.kindLabel)} · ${escapeHtml(entry.taxonomy || "Archive")}</p>
            <a class="search-result-link" href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a>
          </div>
          <p class="search-result-description">${escapeHtml(entry.description || "")}</p>
          <p class="search-result-snippet">${escapeHtml(entry.snippet || "")}</p>
          ${renderTags(entry.tags)}
        </article>
      `
    )
    .join("");
}

if (input && summary && resultsNode && indexNode?.textContent) {
  const entries = JSON.parse(indexNode.textContent);
  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  input.value = initialQuery;
  renderResults(entries, initialQuery);

  input.addEventListener("input", () => {
    const query = input.value.trim();
    updateQueryString(query);
    renderResults(entries, query);
  });
}
