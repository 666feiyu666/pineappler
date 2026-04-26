const apiBase = `${window.location.protocol}//${window.location.hostname}:4323`;
const sectionStorageKey = "studio-active-section";

const statusNode = document.querySelector("[data-status]");
const noteTopicList = document.querySelector("#note-topic-list");
const writingTypeList = document.querySelector("#writing-type-list");

const state = {
  site: null,
  topics: [],
  writingTypes: [],
  notes: [],
  writings: [],
  projects: []
};

const today = new Date().toISOString().slice(0, 10);

const ui = {
  sectionButtons: [...document.querySelectorAll("[data-section-target]")],
  sections: [...document.querySelectorAll("[data-section]")],
  topicList: document.querySelector('[data-list="topics"]'),
  noteList: document.querySelector('[data-list="notes"]'),
  writingTypeList: document.querySelector('[data-list="writing-types"]'),
  writingList: document.querySelector('[data-list="writing"]'),
  projectList: document.querySelector('[data-list="projects"]'),
  workflowNote: document.querySelector("[data-workflow-note]"),
  logOutput: document.querySelector("[data-log-output]"),
  homeImageMeta: document.querySelector("[data-home-image-meta]"),
  projectImageMeta: document.querySelector("[data-project-image-meta]"),
  homeForm: document.querySelector('[data-form="home-editor"]'),
  aboutForm: document.querySelector('[data-form="about-editor"]'),
  noteTopicForm: document.querySelector('[data-form="note-topic"]'),
  noteImportForm: document.querySelector('[data-form="note-import"]'),
  noteForm: document.querySelector('[data-form="note-editor"]'),
  writingTypeForm: document.querySelector('[data-form="writing-type"]'),
  writingImportForm: document.querySelector('[data-form="writing-import"]'),
  writingForm: document.querySelector('[data-form="writing-editor"]'),
  projectForm: document.querySelector('[data-form="project-editor"]'),
  workflowForm: document.querySelector('[data-form="workflow-editor"]')
};

const markdownEditors = {};

function setStatus(message, tone = "muted") {
  if (!statusNode) return;
  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
}

function setLog(message) {
  if (ui.logOutput) {
    ui.logOutput.textContent = message;
  }
}

function setActiveSection(section) {
  ui.sectionButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.sectionTarget === section);
  });
  ui.sections.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.section === section);
  });
  window.sessionStorage.setItem(sectionStorageKey, section);
  if (window.location.hash !== `#${section}`) {
    window.history.replaceState(null, "", `#${section}`);
  }
}

ui.sectionButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveSection(button.dataset.sectionTarget));
});

function getInitialSection() {
  const fromHash = window.location.hash.replace(/^#/, "");
  if (fromHash && ui.sections.some((panel) => panel.dataset.section === fromHash)) {
    return fromHash;
  }
  const stored = window.sessionStorage.getItem(sectionStorageKey);
  if (stored && ui.sections.some((panel) => panel.dataset.section === stored)) {
    return stored;
  }
  return "home";
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

function splitTags(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fillDatalist(target, values) {
  if (!target) return;
  target.innerHTML = values.map((value) => `<option value="${value}"></option>`).join("");
}

function taxonomyLabel(primary, secondary) {
  return [primary, secondary].filter(Boolean).join(" / ");
}

function renderChipList(target, values, kind) {
  if (!target) return;
  target.innerHTML = "";

  if (!values.length) {
    target.innerHTML = '<p class="studio-empty">暂无条目。</p>';
    return;
  }

  values.forEach((value) => {
    const item = document.createElement("div");
    item.className = "studio-chip-item";

    const chip = document.createElement("span");
    chip.className = "studio-chip";
    chip.textContent = value;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "studio-chip-delete";
    del.dataset.action = kind === "topic" ? "delete-topic" : "delete-writing-type";
    del.dataset.name = value;
    del.textContent = "删除";

    item.append(chip, del);
    target.appendChild(item);
  });
}

function renderEntryList(target, entries, kind) {
  if (!target) return;
  target.innerHTML = "";

  if (!entries.length) {
    target.innerHTML = '<p class="studio-empty">暂无条目。</p>';
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "studio-entry-row";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "studio-entry-item";
    open.dataset.entryType = kind;
    open.dataset.path = entry.pathKey;

    const title = document.createElement("strong");
    title.textContent = entry.data.title || entry.pathKey;

    const meta = document.createElement("span");
    if (kind === "note") {
      meta.textContent = [taxonomyLabel(entry.data.topic, entry.data.subtopic), entry.data.uploadDate || entry.data.date]
        .filter(Boolean)
        .join(" · ");
    } else if (kind === "writing") {
      meta.textContent = [taxonomyLabel(entry.data.type, entry.data.subtype), entry.data.format, entry.data.date]
        .filter(Boolean)
        .join(" · ");
    } else {
      meta.textContent = [taxonomyLabel(entry.data.category || "未分类", entry.data.subcategory), entry.data.status, entry.data.date]
        .filter(Boolean)
        .join(" · ");
    }

    open.append(title, meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "studio-entry-delete";
    del.dataset.action = `delete-${kind}`;
    del.dataset.path = entry.pathKey;
    del.textContent = "删除";

    row.append(open, del);
    target.appendChild(row);
  });
}

function setEditorTitle(key, label) {
  const node = document.querySelector(`[data-editor-title="${key}"]`);
  if (node) {
    node.textContent = label;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function basename(value) {
  return String(value || "").split(/[\\/]/).pop() || "";
}

function removeExtension(value) {
  return value.replace(/\.[^.]+$/, "");
}

function extractMarkdownTarget(rawTarget) {
  const trimmed = String(rawTarget || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) {
    const endIndex = trimmed.indexOf(">");
    return endIndex === -1 ? trimmed.slice(1) : trimmed.slice(1, endIndex);
  }
  return trimmed.split(/\s+/)[0];
}

function makeUniqueFileName(editor, fileName) {
  const safeName = fileName || `image-${Date.now()}.png`;
  const dotIndex = safeName.lastIndexOf(".");
  const stem = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const ext = dotIndex > 0 ? safeName.slice(dotIndex) : "";
  const taken = new Set(editor.pendingImages.map((item) => item.file.name));

  if (!taken.has(safeName)) {
    return safeName;
  }

  let counter = 2;
  while (taken.has(`${stem}-${counter}${ext}`)) {
    counter += 1;
  }
  return `${stem}-${counter}${ext}`;
}

function toPreviewUrl(editor, target) {
  const extracted = extractMarkdownTarget(target);
  if (!extracted) return "";
  if (/^(https?:|data:|\/)/i.test(extracted)) {
    return extracted;
  }
  const decoded = decodeURIComponent(extracted);
  const targetName = basename(decoded);
  const match = editor.pendingImages.find((item) => item.file.name === decoded || item.file.name === targetName);
  return match?.previewUrl || extracted;
}

function formatInline(text, resolveAsset) {
  let html = escapeHtml(text);

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, target) => {
    const src = resolveAsset(target);
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" />`;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
    const href = extractMarkdownTarget(target);
    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${label}</a>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return html;
}

function renderMarkdownToHtml(markdown, resolveAsset) {
  const source = String(markdown || "").replace(/\r\n?/g, "\n");
  if (!source.trim()) {
    return '<p class="studio-markdown-preview-empty">预览会显示在这里。</p>';
  }

  const codeBlocks = [];
  const protectedSource = source.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlocks.push({ language, code: code.replace(/\n$/, "") }) - 1;
    return `@@CODE_BLOCK_${index}@@`;
  });

  const lines = protectedSource.split("\n");
  const html = [];
  let paragraph = [];
  let quote = [];
  let listType = "";
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map((line) => formatInline(line, resolveAsset)).join("<br />")}</p>`);
    paragraph = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    html.push(`<blockquote>${quote.map((line) => `<p>${formatInline(line, resolveAsset) || "<br />"}</p>`).join("")}</blockquote>`);
    quote = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${formatInline(item, resolveAsset)}</li>`).join("")}</${listType}>`);
    listType = "";
    listItems = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushQuote();
    flushList();
  };

  lines.forEach((rawLine) => {
    if (!rawLine.trim()) {
      flushAll();
      return;
    }

    const codeMatch = rawLine.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (codeMatch) {
      flushAll();
      const block = codeBlocks[Number(codeMatch[1])];
      const languageClass = block.language ? ` class="language-${escapeAttribute(block.language)}"` : "";
      html.push(`<pre><code${languageClass}>${escapeHtml(block.code)}</code></pre>`);
      return;
    }

    const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInline(headingMatch[2].trim(), resolveAsset)}</h${level}>`);
      return;
    }

    if (/^(-{3,}|\*{3,})$/.test(rawLine.trim())) {
      flushAll();
      html.push("<hr />");
      return;
    }

    const quoteMatch = rawLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote.push(quoteMatch[1]);
      return;
    }

    const unorderedMatch = rawLine.match(/^\s*[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      return;
    }

    const orderedMatch = rawLine.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      return;
    }

    flushQuote();
    flushList();
    paragraph.push(rawLine.trim());
  });

  flushAll();
  return html.join("\n");
}

function replaceRange(textarea, start, end, replacement, selectionStart, selectionEnd) {
  const value = textarea.value;
  textarea.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  textarea.focus();
  textarea.selectionStart = selectionStart;
  textarea.selectionEnd = selectionEnd;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function wrapSelection(textarea, before, after = before, placeholder = "text") {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const replacement = `${before}${selected}${after}`;
  replaceRange(
    textarea,
    start,
    end,
    replacement,
    start + before.length,
    start + before.length + selected.length
  );
}

function prefixLines(textarea, prefix) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const block = value.slice(lineStart, lineEnd);
  const replaced = block
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
  replaceRange(textarea, lineStart, lineEnd, replaced, lineStart, lineStart + replaced.length);
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  replaceRange(textarea, start, end, text, start + text.length, start + text.length);
}

function getQueuedImageMarkdown(fileName) {
  return `![${removeExtension(fileName)}](<${fileName}>)`;
}

function renderUploadList(editor) {
  if (!editor.uploadsNode) return;
  editor.uploadsNode.innerHTML = "";

  if (!editor.pendingImages.length) {
    return;
  }

  editor.pendingImages.forEach((item) => {
    const row = document.createElement("div");
    row.className = "studio-upload-item";

    const label = document.createElement("span");
    label.textContent = item.file.name;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "studio-upload-remove";
    removeButton.dataset.removeUpload = item.id;
    removeButton.textContent = "移除";

    row.append(label, removeButton);
    editor.uploadsNode.appendChild(row);
  });
}

function updateMarkdownPreview(editor) {
  if (!editor.previewNode) return;
  editor.previewNode.innerHTML = renderMarkdownToHtml(editor.textarea.value, (target) =>
    toPreviewUrl(editor, target)
  );
}

function clearPendingImages(editor) {
  editor.pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  editor.pendingImages = [];
  renderUploadList(editor);
  updateMarkdownPreview(editor);
}

function removePendingImage(editor, id) {
  const index = editor.pendingImages.findIndex((item) => item.id === id);
  if (index === -1) return;
  URL.revokeObjectURL(editor.pendingImages[index].previewUrl);
  editor.pendingImages.splice(index, 1);
  renderUploadList(editor);
  updateMarkdownPreview(editor);
}

function queueImages(editor, files) {
  const accepted = [...files].filter((file) =>
    file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
  );

  if (!accepted.length) {
    return;
  }

  const snippets = [];

  accepted.forEach((file) => {
    const uniqueName = makeUniqueFileName(editor, file.name);
    const queuedFile =
      uniqueName === file.name
        ? file
        : new File([file], uniqueName, {
            type: file.type,
            lastModified: file.lastModified
          });

    editor.pendingImages.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file: queuedFile,
      previewUrl: URL.createObjectURL(queuedFile)
    });
    snippets.push(getQueuedImageMarkdown(queuedFile.name));
  });

  renderUploadList(editor);
  const separator = editor.textarea.value && !editor.textarea.value.endsWith("\n") ? "\n\n" : "";
  insertAtCursor(editor.textarea, `${separator}${snippets.join("\n\n")}`);
}

function runEditorCommand(editor, command) {
  switch (command) {
    case "heading":
      prefixLines(editor.textarea, "## ");
      break;
    case "bold":
      wrapSelection(editor.textarea, "**", "**", "重点");
      break;
    case "quote":
      prefixLines(editor.textarea, "> ");
      break;
    case "list":
      prefixLines(editor.textarea, "- ");
      break;
    case "code":
      wrapSelection(editor.textarea, "```md\n", "\n```", "code");
      break;
    case "image":
      editor.uploadInput?.click();
      break;
  }
}

function initMarkdownEditor(key) {
  const container = document.querySelector(`[data-markdown-editor="${key}"]`);
  if (!container) return null;

  const editor = {
    key,
    container,
    textarea: container.querySelector(`[data-markdown-input="${key}"]`),
    previewNode: container.querySelector(`[data-markdown-preview="${key}"]`),
    uploadsNode: container.querySelector(`[data-markdown-uploads="${key}"]`),
    uploadInput: container.querySelector("[data-markdown-upload]"),
    pendingImages: []
  };

  if (!editor.textarea) {
    return null;
  }

  container.addEventListener("click", (event) => {
    const commandButton = event.target.closest("[data-editor-command]");
    if (commandButton) {
      runEditorCommand(editor, commandButton.dataset.editorCommand);
      return;
    }

    const removeButton = event.target.closest("[data-remove-upload]");
    if (removeButton) {
      removePendingImage(editor, removeButton.dataset.removeUpload);
    }
  });

  editor.textarea.addEventListener("input", () => updateMarkdownPreview(editor));

  editor.textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    insertAtCursor(editor.textarea, "  ");
  });

  editor.textarea.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files || [])];
    if (!files.some((file) => file.type.startsWith("image/"))) {
      return;
    }
    event.preventDefault();
    queueImages(editor, files);
  });

  ["dragenter", "dragover"].forEach((type) => {
    container.addEventListener(type, (event) => {
      if (![...(event.dataTransfer?.items || [])].some((item) => item.type.startsWith("image/"))) {
        return;
      }
      event.preventDefault();
      container.classList.add("is-dragover");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((type) => {
    container.addEventListener(type, () => {
      container.classList.remove("is-dragover");
    });
  });

  container.addEventListener("drop", (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.some((file) => file.type.startsWith("image/"))) {
      return;
    }
    event.preventDefault();
    queueImages(editor, files);
  });

  editor.uploadInput?.addEventListener("change", (event) => {
    const files = event.target.files;
    if (files?.length) {
      queueImages(editor, files);
    }
    event.target.value = "";
  });

  updateMarkdownPreview(editor);
  renderUploadList(editor);
  return editor;
}

function getEditor(key) {
  return markdownEditors[key];
}

function resetMarkdownEditor(key) {
  const editor = getEditor(key);
  if (!editor) return;
  clearPendingImages(editor);
  editor.textarea.value = "";
  updateMarkdownPreview(editor);
}

function setMarkdownEditorValue(key, value) {
  const editor = getEditor(key);
  if (!editor) return;
  clearPendingImages(editor);
  editor.textarea.value = value || "";
  updateMarkdownPreview(editor);
}

async function getMarkdownEditorPayload(key) {
  const editor = getEditor(key);
  if (!editor) {
    return { body: "", images: [] };
  }
  return {
    body: editor.textarea.value,
    images: await filesToPayload(editor.pendingImages.map((item) => item.file))
  };
}

function setMarkdownEditorPassive(key, passive) {
  const editor = getEditor(key);
  if (!editor) return;
  editor.container.classList.toggle("is-passive", passive);
}

function resetNoteForm() {
  const form = ui.noteForm;
  form.reset();
  form.pathKey.value = "";
  form.date.value = today;
  form.uploadDate.value = today;
  form.subtopic.value = "";
  form.images.value = "";
  setEditorTitle("note", "Note editor");
}

function resetWritingForm() {
  const form = ui.writingForm;
  form.reset();
  form.pathKey.value = "";
  form.existingFilePath.value = "";
  form.date.value = today;
  form.format.value = "markdown";
  form.subtype.value = "";
  resetMarkdownEditor("writing");
  updateWritingFormatUI();
  setEditorTitle("writing", "Writing editor");
}

function resetProjectForm() {
  const form = ui.projectForm;
  form.reset();
  form.pathKey.value = "";
  form.existingImagePath.value = "";
  form.date.value = today;
  form.category.value = "未分类";
  form.subcategory.value = "";
  form.status.value = "In progress";
  resetMarkdownEditor("project");
  if (ui.projectImageMeta) {
    ui.projectImageMeta.textContent = "当前未设置项目图片。";
  }
  setEditorTitle("project", "Project editor");
}

function updateWritingFormatUI() {
  const isPdf = ui.writingForm.format.value === "pdf";
  ui.writingForm.querySelectorAll(".studio-pdf-field").forEach((field) => {
    field.classList.toggle("is-hidden", !isPdf);
  });
  setMarkdownEditorPassive("writing", isPdf);
}

function populateSiteForms() {
  if (!state.site) return;

  ui.homeForm.author.value = state.site.meta.author || "";
  ui.homeForm.email.value = state.site.meta.email || "";
  ui.homeForm.location.value = state.site.meta.location || "";
  ui.homeForm.homeQuote.value = state.site.homeQuote.text || "";
  ui.homeForm.homeQuoteSource.value = state.site.homeQuote.source || "";
  ui.homeForm.existingImagePath.value = state.site.homeImage?.path || "";
  ui.homeForm.homeImageAlt.value = state.site.homeImage?.alt || "";
  if (ui.homeImageMeta) {
    ui.homeImageMeta.textContent = state.site.homeImage?.path
      ? `当前图片：${state.site.homeImage.path}`
      : "当前未设置首页图片。";
  }

  ui.aboutForm.aboutName.value = state.site.about.name || "";
  ui.aboutForm.aboutIntro.value = state.site.about.intro || "";
  ui.aboutForm.aboutProfile.value = state.site.about.profile || "";
  ui.aboutForm.aboutResearch.value = (state.site.about.researchInterests || []).join("\n");
  ui.aboutForm.aboutExperience.value = state.site.about.experience || "";
  ui.aboutForm.aboutWriting.value = state.site.about.writing || "";
  ui.aboutForm.aboutContact.value = state.site.about.contact || "";

  ui.workflowForm.buildCommand.value = state.site.workflow?.buildCommand || "npm run build";
  ui.workflowForm.publishCommand.value = state.site.workflow?.publishCommand || "";
  ui.workflowForm.publishNote.value = state.site.workflow?.publishNote || "";
  ui.workflowNote.textContent = state.site.workflow?.publishNote || "未配置发布说明。";
}

function applyState(next) {
  state.site = next.site;
  state.topics = next.topics;
  state.writingTypes = next.writingTypes;
  state.notes = next.notes;
  state.writings = next.writings;
  state.projects = next.projects;

  populateSiteForms();
  fillDatalist(noteTopicList, state.topics);
  fillDatalist(writingTypeList, state.writingTypes);
  renderChipList(ui.topicList, state.topics, "topic");
  renderChipList(ui.writingTypeList, state.writingTypes, "writing-type");
  renderEntryList(ui.noteList, state.notes, "note");
  renderEntryList(ui.writingList, state.writings, "writing");
  renderEntryList(ui.projectList, state.projects, "project");
}

function findEntry(entries, pathKey) {
  return entries.find((entry) => entry.pathKey === pathKey);
}

function focusSavedEntry(entries, pathKey, fallbackTitle) {
  if (pathKey) {
    return findEntry(entries, pathKey);
  }
  return entries.find((entry) => entry.data.title === fallbackTitle);
}

function loadNote(pathKey) {
  const entry = findEntry(state.notes, pathKey);
  if (!entry) return;
  setActiveSection("notes");
  ui.noteForm.images.value = "";
  ui.noteForm.pathKey.value = entry.pathKey;
  ui.noteForm.title.value = entry.data.title || "";
  ui.noteForm.topic.value = entry.data.topic || "";
  ui.noteForm.subtopic.value = entry.data.subtopic || "";
  ui.noteForm.description.value = entry.data.description || "";
  ui.noteForm.tags.value = (entry.data.tags || []).join(", ");
  ui.noteForm.date.value = entry.data.date || today;
  ui.noteForm.uploadDate.value = entry.data.uploadDate || entry.data.date || today;
  ui.noteForm.body.value = entry.body || "";
  setEditorTitle("note", `Editing: ${entry.data.title || entry.pathKey}`);
}

function loadWriting(pathKey) {
  const entry = findEntry(state.writings, pathKey);
  if (!entry) return;
  setActiveSection("writing");
  ui.writingForm.file.value = "";
  ui.writingForm.pathKey.value = entry.pathKey;
  ui.writingForm.existingFilePath.value = entry.data.filePath || "";
  ui.writingForm.format.value = entry.data.format || "markdown";
  ui.writingForm.title.value = entry.data.title || "";
  ui.writingForm.type.value = entry.data.type || "";
  ui.writingForm.subtype.value = entry.data.subtype || "";
  ui.writingForm.description.value = entry.data.description || "";
  ui.writingForm.tags.value = (entry.data.tags || []).join(", ");
  ui.writingForm.date.value = entry.data.date || today;
  ui.writingForm.publication.value = entry.data.publication || "";
  setMarkdownEditorValue("writing", entry.body || "");
  updateWritingFormatUI();
  setEditorTitle("writing", `Editing: ${entry.data.title || entry.pathKey}`);
}

function loadProject(pathKey) {
  const entry = findEntry(state.projects, pathKey);
  if (!entry) return;
  setActiveSection("projects");
  ui.projectForm.imageFile.value = "";
  ui.projectForm.pathKey.value = entry.pathKey;
  ui.projectForm.title.value = entry.data.title || "";
  ui.projectForm.category.value = entry.data.category || "未分类";
  ui.projectForm.subcategory.value = entry.data.subcategory || "";
  ui.projectForm.description.value = entry.data.description || "";
  ui.projectForm.status.value = entry.data.status || "In progress";
  ui.projectForm.link.value = entry.data.link || "";
  ui.projectForm.tags.value = (entry.data.tags || []).join(", ");
  ui.projectForm.date.value = entry.data.date || today;
  ui.projectForm.existingImagePath.value = entry.data.imagePath || "";
  ui.projectForm.imageAlt.value = entry.data.imageAlt || "";
  setMarkdownEditorValue("project", entry.body || "");
  if (ui.projectImageMeta) {
    ui.projectImageMeta.textContent = entry.data.imagePath
      ? `当前图片：${entry.data.imagePath}`
      : "当前未设置项目图片。";
  }
  setEditorTitle("project", `Editing: ${entry.data.title || entry.pathKey}`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || payload.result?.stderr || "Request failed");
  }
  return payload;
}

async function loadState() {
  const payload = await request("/state", { method: "GET" });
  applyState(payload.state);
  setStatus(`已连接：${payload.state.root}`, "ok");
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.split(",").at(-1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function filesToPayload(fileList) {
  const files = [...(fileList || [])];
  return Promise.all(
    files.map(async (file) => ({
      fileName: file.name,
      base64: await toBase64(file)
    }))
  );
}

async function saveHome() {
  const form = ui.homeForm;
  const imageFile = form.homeImageFile.files?.[0];
  const payload = await request("/save/home", {
    method: "POST",
    body: JSON.stringify({
      author: form.author.value.trim(),
      email: form.email.value.trim(),
      location: form.location.value.trim(),
      homeQuote: form.homeQuote.value.trim(),
      homeQuoteSource: form.homeQuoteSource.value.trim(),
      existingImagePath: form.existingImagePath.value.trim(),
      homeImageAlt: form.homeImageAlt.value.trim(),
      homeImageFileName: imageFile?.name || "",
      homeImageBase64: imageFile ? await toBase64(imageFile) : ""
    })
  });
  applyState(payload.state);
  form.homeImageFile.value = "";
}

async function saveAbout() {
  const form = ui.aboutForm;
  const payload = await request("/save/about", {
    method: "POST",
    body: JSON.stringify({
      aboutName: form.aboutName.value.trim(),
      aboutIntro: form.aboutIntro.value.trim(),
      aboutProfile: form.aboutProfile.value.trim(),
      aboutResearch: form.aboutResearch.value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      aboutExperience: form.aboutExperience.value.trim(),
      aboutWriting: form.aboutWriting.value.trim(),
      aboutContact: form.aboutContact.value.trim()
    })
  });
  applyState(payload.state);
}

async function saveWorkflow() {
  const form = ui.workflowForm;
  const payload = await request("/save/workflow", {
    method: "POST",
    body: JSON.stringify({
      buildCommand: form.buildCommand.value.trim(),
      publishCommand: form.publishCommand.value.trim(),
      publishNote: form.publishNote.value.trim()
    })
  });
  applyState(payload.state);
}

async function createTopic() {
  const form = ui.noteTopicForm;
  const payload = await request("/notes/topic", {
    method: "POST",
    body: JSON.stringify({
      topicName: form.topicName.value.trim()
    })
  });
  form.reset();
  applyState(payload.state);
}

async function importNote() {
  const form = ui.noteImportForm;
  const file = form.file.files?.[0];
  if (!file) throw new Error("请选择 Markdown 文件。");
  const payload = await request("/notes/import", {
    method: "POST",
    body: JSON.stringify({
      topic: form.topic.value.trim(),
      subtopic: form.subtopic.value.trim(),
      title: file.name.replace(/\.md$/i, ""),
      fileName: file.name,
      content: await file.text(),
      images: await filesToPayload(form.images.files)
    })
  });
  form.reset();
  applyState(payload.state);
  const saved = focusSavedEntry(payload.state.notes, payload.savedPathKey, file.name.replace(/\.md$/i, ""));
  if (saved) {
    loadNote(saved.pathKey);
  }
}

async function saveNote() {
  const form = ui.noteForm;
  const payload = await request("/notes/save", {
    method: "POST",
    body: JSON.stringify({
      pathKey: form.pathKey.value || "",
      title: form.title.value.trim(),
      topic: form.topic.value.trim(),
      subtopic: form.subtopic.value.trim(),
      description: form.description.value.trim(),
      tags: splitTags(form.tags.value),
      date: form.date.value || today,
      uploadDate: form.uploadDate.value || today,
      body: form.body.value,
      images: await filesToPayload(form.images.files)
    })
  });
  applyState(payload.state);
  form.images.value = "";
  const saved = focusSavedEntry(payload.state.notes, payload.savedPathKey, form.title.value.trim());
  if (saved) {
    loadNote(saved.pathKey);
  }
}

async function createWritingType() {
  const form = ui.writingTypeForm;
  const payload = await request("/writing/type", {
    method: "POST",
    body: JSON.stringify({
      typeName: form.typeName.value.trim()
    })
  });
  form.reset();
  applyState(payload.state);
}

async function importWriting() {
  const form = ui.writingImportForm;
  const file = form.file.files?.[0];
  if (!file) throw new Error("请选择 Markdown 文件。");
  const payload = await request("/writing/import", {
    method: "POST",
    body: JSON.stringify({
      type: form.type.value.trim(),
      subtype: form.subtype.value.trim(),
      title: file.name.replace(/\.md$/i, ""),
      fileName: file.name,
      content: await file.text(),
      images: await filesToPayload(form.images.files)
    })
  });
  form.reset();
  applyState(payload.state);
  const saved = focusSavedEntry(payload.state.writings, payload.savedPathKey, file.name.replace(/\.md$/i, ""));
  if (saved) {
    loadWriting(saved.pathKey);
  }
}

async function saveWriting() {
  const form = ui.writingForm;
  const file = form.file.files?.[0];
  const markdownPayload = await getMarkdownEditorPayload("writing");
  const payload = await request("/writing/save", {
    method: "POST",
    body: JSON.stringify({
      pathKey: form.pathKey.value || "",
      existingFilePath: form.existingFilePath.value || "",
      format: form.format.value,
      title: form.title.value.trim(),
      type: form.type.value.trim(),
      subtype: form.subtype.value.trim(),
      description: form.description.value.trim(),
      tags: splitTags(form.tags.value),
      date: form.date.value || today,
      publication: form.publication.value.trim(),
      body: markdownPayload.body,
      fileName: file?.name || "",
      fileBase64: file ? await toBase64(file) : "",
      images: form.format.value === "markdown" ? markdownPayload.images : []
    })
  });
  applyState(payload.state);
  form.file.value = "";
  const saved = focusSavedEntry(payload.state.writings, payload.savedPathKey, form.title.value.trim());
  if (saved) {
    loadWriting(saved.pathKey);
  }
}

async function saveProject() {
  const form = ui.projectForm;
  const imageFile = form.imageFile.files?.[0];
  const markdownPayload = await getMarkdownEditorPayload("project");
  const payload = await request("/projects/save", {
    method: "POST",
    body: JSON.stringify({
      pathKey: form.pathKey.value || "",
      title: form.title.value.trim(),
      category: form.category.value.trim(),
      subcategory: form.subcategory.value.trim(),
      description: form.description.value.trim(),
      status: form.status.value.trim(),
      link: form.link.value.trim(),
      tags: splitTags(form.tags.value),
      date: form.date.value || today,
      body: markdownPayload.body,
      images: markdownPayload.images,
      existingImagePath: form.existingImagePath.value || "",
      imageAlt: form.imageAlt.value.trim(),
      imageFileName: imageFile?.name || "",
      imageBase64: imageFile ? await toBase64(imageFile) : ""
    })
  });
  applyState(payload.state);
  form.imageFile.value = "";
  const saved = focusSavedEntry(payload.state.projects, payload.savedPathKey, form.title.value.trim());
  if (saved) {
    loadProject(saved.pathKey);
  }
}

async function deleteAction(pathname, body, successMessage, afterReset) {
  const confirmed = window.confirm("确认执行删除？");
  if (!confirmed) return;
  const payload = await request(pathname, {
    method: "POST",
    body: JSON.stringify(body)
  });
  applyState(payload.state);
  if (afterReset) afterReset();
  setStatus(successMessage, "ok");
}

async function runWorkflow(kind) {
  const payload = await request(`/workflow/${kind}`, {
    method: "POST",
    body: JSON.stringify({})
  });
  if (payload.state) {
    applyState(payload.state);
  }
  setLog(
    [
      `command: ${payload.result.command || state.site.workflow?.[kind === "build" ? "buildCommand" : "publishCommand"] || ""}`,
      `exit code: ${payload.result.code}`,
      "",
      payload.result.stdout || "",
      payload.result.stderr || ""
    ].join("\n")
  );
  setStatus(kind === "build" ? "Build 已执行。" : "Publish 已执行。", "ok");
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [data-entry-type]");
  if (!target) return;

  try {
    if (target.dataset.entryType === "note") return loadNote(target.dataset.path);
    if (target.dataset.entryType === "writing") return loadWriting(target.dataset.path);
    if (target.dataset.entryType === "project") return loadProject(target.dataset.path);

    switch (target.dataset.action) {
      case "new-note":
        resetNoteForm();
        return setActiveSection("notes");
      case "new-writing":
        resetWritingForm();
        return setActiveSection("writing");
      case "new-project":
        resetProjectForm();
        return setActiveSection("projects");
      case "delete-topic":
        await deleteAction("/notes/topic/delete", { topicName: target.dataset.name }, "Topic 已删除。");
        return;
      case "delete-writing-type":
        await deleteAction("/writing/type/delete", { typeName: target.dataset.name }, "Writing 类型已删除。");
        return;
      case "delete-note":
        if (!target.dataset.path && !ui.noteForm.pathKey.value) throw new Error("请先选择要删除的 note。");
        await deleteAction(
          "/entry/delete",
          { kind: "note", pathKey: target.dataset.path || ui.noteForm.pathKey.value },
          "Note 已删除。",
          resetNoteForm
        );
        return;
      case "delete-writing":
        if (!target.dataset.path && !ui.writingForm.pathKey.value) throw new Error("请先选择要删除的 writing 条目。");
        await deleteAction(
          "/entry/delete",
          { kind: "writing", pathKey: target.dataset.path || ui.writingForm.pathKey.value },
          "Writing 条目已删除。",
          resetWritingForm
        );
        return;
      case "delete-project":
        if (!target.dataset.path && !ui.projectForm.pathKey.value) throw new Error("请先选择要删除的 project。");
        await deleteAction(
          "/entry/delete",
          { kind: "project", pathKey: target.dataset.path || ui.projectForm.pathKey.value },
          "Project 已删除。",
          resetProjectForm
        );
        return;
      case "run-build":
        setActiveSection("workflow");
        setStatus("正在执行 Build...", "muted");
        await runWorkflow("build");
        return;
      case "run-publish":
        setActiveSection("workflow");
        setStatus("正在执行 Publish...", "muted");
        await runWorkflow("publish");
        return;
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
});

markdownEditors.writing = initMarkdownEditor("writing");
markdownEditors.project = initMarkdownEditor("project");

ui.writingForm.format.addEventListener("change", updateWritingFormatUI);

ui.homeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveHome();
    setStatus("Home 已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.aboutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveAbout();
    setStatus("About 已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.noteTopicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createTopic();
    setStatus("Topic 已创建。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.noteImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importNote();
    setStatus("Markdown note 已导入。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveNote();
    setStatus("Note 已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.writingTypeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createWritingType();
    setStatus("Writing 类型已创建。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.writingImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importWriting();
    setStatus("Markdown writing 已导入。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.writingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveWriting();
    setStatus("Writing 条目已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveProject();
    setStatus("Project 已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

ui.workflowForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveWorkflow();
    setStatus("Workflow 命令已保存。", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

resetNoteForm();
resetWritingForm();
resetProjectForm();
updateWritingFormatUI();
setLog("等待执行 Build 或 Publish。");
setActiveSection(getInitialSection());

loadState().catch((error) => {
  setStatus(error.message, "error");
});
