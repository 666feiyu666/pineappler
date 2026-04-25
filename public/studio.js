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
  writingForm: document.querySelector('[data-form="writing-editor"]'),
  projectForm: document.querySelector('[data-form="project-editor"]'),
  workflowForm: document.querySelector('[data-form="workflow-editor"]')
};

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
      meta.textContent = [entry.data.topic, entry.data.uploadDate || entry.data.date]
        .filter(Boolean)
        .join(" · ");
    } else if (kind === "writing") {
      meta.textContent = [entry.data.type, entry.data.format, entry.data.date]
        .filter(Boolean)
        .join(" · ");
    } else {
      meta.textContent = [entry.data.status, entry.data.date].filter(Boolean).join(" · ");
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

function resetNoteForm() {
  const form = ui.noteForm;
  form.reset();
  form.pathKey.value = "";
  form.date.value = today;
  form.uploadDate.value = today;
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
  updateWritingFormatUI();
  setEditorTitle("writing", "Writing editor");
}

function resetProjectForm() {
  const form = ui.projectForm;
  form.reset();
  form.pathKey.value = "";
  form.existingImagePath.value = "";
  form.date.value = today;
  form.status.value = "In progress";
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
  ui.writingForm.querySelectorAll(".studio-markdown-field").forEach((field) => {
    field.classList.toggle("is-hidden", isPdf);
  });
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

function loadNote(pathKey) {
  const entry = findEntry(state.notes, pathKey);
  if (!entry) return;
  setActiveSection("notes");
  ui.noteForm.images.value = "";
  ui.noteForm.pathKey.value = entry.pathKey;
  ui.noteForm.title.value = entry.data.title || "";
  ui.noteForm.topic.value = entry.data.topic || "";
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
  ui.writingForm.images.value = "";
  ui.writingForm.pathKey.value = entry.pathKey;
  ui.writingForm.existingFilePath.value = entry.data.filePath || "";
  ui.writingForm.format.value = entry.data.format || "markdown";
  ui.writingForm.title.value = entry.data.title || "";
  ui.writingForm.type.value = entry.data.type || "";
  ui.writingForm.description.value = entry.data.description || "";
  ui.writingForm.tags.value = (entry.data.tags || []).join(", ");
  ui.writingForm.date.value = entry.data.date || today;
  ui.writingForm.publication.value = entry.data.publication || "";
  ui.writingForm.body.value = entry.body || "";
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
  ui.projectForm.description.value = entry.data.description || "";
  ui.projectForm.status.value = entry.data.status || "In progress";
  ui.projectForm.link.value = entry.data.link || "";
  ui.projectForm.tags.value = (entry.data.tags || []).join(", ");
  ui.projectForm.date.value = entry.data.date || today;
  ui.projectForm.existingImagePath.value = entry.data.imagePath || "";
  ui.projectForm.imageAlt.value = entry.data.imageAlt || "";
  ui.projectForm.body.value = entry.body || "";
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
  return await Promise.all(
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
      title: file.name.replace(/\.md$/i, ""),
      content: await file.text(),
      images: await filesToPayload(form.images.files)
    })
  });
  form.reset();
  applyState(payload.state);
}

async function saveNote() {
  const form = ui.noteForm;
  const payload = await request("/notes/save", {
    method: "POST",
    body: JSON.stringify({
      pathKey: form.pathKey.value || "",
      title: form.title.value.trim(),
      topic: form.topic.value.trim(),
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
  const savedPath = form.pathKey.value || `content-source/notes/${slugify(form.topic.value.trim())}`;
  const match = payload.state.notes.find((entry) => entry.data.title === form.title.value.trim());
  if (match) loadNote(match.pathKey);
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

async function saveWriting() {
  const form = ui.writingForm;
  const file = form.file.files?.[0];
  const payload = await request("/writing/save", {
    method: "POST",
    body: JSON.stringify({
      pathKey: form.pathKey.value || "",
      existingFilePath: form.existingFilePath.value || "",
      format: form.format.value,
      title: form.title.value.trim(),
      type: form.type.value.trim(),
      description: form.description.value.trim(),
      tags: splitTags(form.tags.value),
      date: form.date.value || today,
      publication: form.publication.value.trim(),
      body: form.body.value,
      fileName: file?.name || "",
      fileBase64: file ? await toBase64(file) : "",
      images: await filesToPayload(form.images.files)
    })
  });
  applyState(payload.state);
  form.file.value = "";
  form.images.value = "";
  const match = payload.state.writings.find((entry) => entry.data.title === form.title.value.trim());
  if (match) loadWriting(match.pathKey);
}

async function saveProject() {
  const form = ui.projectForm;
  const imageFile = form.imageFile.files?.[0];
  const payload = await request("/projects/save", {
    method: "POST",
    body: JSON.stringify({
      pathKey: form.pathKey.value || "",
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      status: form.status.value.trim(),
      link: form.link.value.trim(),
      tags: splitTags(form.tags.value),
      date: form.date.value || today,
      body: form.body.value,
      existingImagePath: form.existingImagePath.value || "",
      imageAlt: form.imageAlt.value.trim(),
      imageFileName: imageFile?.name || "",
      imageBase64: imageFile ? await toBase64(imageFile) : ""
    })
  });
  applyState(payload.state);
  form.imageFile.value = "";
  const match = payload.state.projects.find((entry) => entry.data.title === form.title.value.trim());
  if (match) loadProject(match.pathKey);
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
        if (!ui.noteForm.pathKey.value) throw new Error("请先选择要删除的 note。");
        await deleteAction("/entry/delete", { kind: "note", pathKey: ui.noteForm.pathKey.value }, "Note 已删除。", resetNoteForm);
        return;
      case "delete-writing":
        if (!ui.writingForm.pathKey.value) throw new Error("请先选择要删除的 writing 条目。");
        await deleteAction("/entry/delete", { kind: "writing", pathKey: ui.writingForm.pathKey.value }, "Writing 条目已删除。", resetWritingForm);
        return;
      case "delete-project":
        if (!ui.projectForm.pathKey.value) throw new Error("请先选择要删除的 project。");
        await deleteAction("/entry/delete", { kind: "project", pathKey: ui.projectForm.pathKey.value }, "Project 已删除。", resetProjectForm);
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
