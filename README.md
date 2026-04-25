# Pineappler

一个以静态站点方式维护的个人主页，用来承载个人介绍、Notes、Writing 与 Projects。

现在除了内容源目录和导入脚本之外，还提供了一个本地 `Studio` 页面，用来在浏览器里直接管理文本、内容文件、删除操作，以及本地 Build / Publish 工作流。

## 当前结构

- `Home`：格言与图片占位为主的门面页
- `About`：个人 profile / academic CV 的早期框架
- `Notes`：默认显示最新笔记，并按主题归档
- `Writing`：默认显示最新文章，并按类型归档，支持 Markdown 与 PDF
- `Projects`：默认显示最新项目，并在导航下拉中直接列出项目入口

## 技术选择

项目仍然使用 `Astro`。

- 站点本质是内容驱动，而不是复杂交互应用
- Markdown 内容、静态输出和页面组织都适合这个场景
- 维护成本低，后续接入部署、域名和 SEO 也足够顺滑

## 内容源与生成方式

当前内容采用“源目录 + 生成目录”的方式：

```text
content-source/
├── notes/
│   └── <topic>/
│       └── *.md
└── writing/
    └── <type>/
        └── *.md

public/
└── library/
    └── writing/
        └── <type>/
            └── *.pdf

src/content/
├── notes/      # 由脚本生成
├── writing/    # 由脚本生成
└── projects/   # 目前直接维护
```

- `content-source/notes` 是笔记源目录
- `content-source/writing` 是文章与 PDF 条目元数据源目录
- `public/library/writing` 存放实际 PDF 文件
- `src/content/notes` 和 `src/content/writing` 由脚本自动生成，不建议手动编辑

## 本地开发

安装依赖：

```bash
npm install
```

同步内容源到 `src/content`：

```bash
npm run sync:content
```

启动开发环境：

```bash
npm run dev
```

开发时可打开：

```text
http://localhost:4321/studio
```

`Studio` 适合做这些事：

- 按 section 分别编辑 `Home / About / Notes / Writing / Projects`
- 更新首页格言、作者信息与 About 文本
- 创建新的 note 主题，并编辑已有 notes
- 导入现成 Markdown note
- 新建或编辑 Markdown writing
- 导入或更新 PDF writing 条目
- 新建或编辑 projects
- 删除 note / writing / project 条目
- 删除 note 主题 / writing 类型
- 配置并执行 Build / Publish 命令

它现在不再要求你每次手动选择根目录。开发模式下会启动一个本地 Studio backend，直接以当前仓库作为工作区。

## Studio Backend

`npm run dev` 现在会同时启动：

- Astro 开发服务器
- 本地 Studio backend

Studio 前端会通过本地 backend 直接读写当前仓库中的：

- `content-source/site/site.json`
- `content-source/notes/**`
- `content-source/writing/**`
- `public/library/writing/**`
- `src/content/projects/**`

因此现在可以做到：

- 直接保存，不需要每次重新选根目录
- 删除条目、主题、类型
- 在 Studio 里直接触发 Build
- 在配置好发布命令后直接触发 Publish

`Publish` 命令默认是空的，需要你自己填写，例如：

- `wrangler pages deploy dist`
- `rsync -avz dist/ user@server:/var/www/site`
- 其他你自己的部署命令

构建静态产物：

```bash
npm run build
```

## Notes 工作流

### 方式 0：在 Studio 中操作

访问 `/studio` 后，可以：

- 新建 note 主题
- 直接写 note 正文并保存
- 导入现成 Markdown 文件到某个主题
- 修改首页 / About 文本
- 点击已有 note 条目后继续编辑
- 删除已有 note 条目
- 删除整个 note 主题

### 方式 1：手动维护源文件

把 Markdown 放进：

```text
content-source/notes/<topic>/*.md
```

推荐 frontmatter：

```yaml
title: 标题
description: 简介
date: 2026-04-25
uploadDate: 2026-04-25
topic: 游戏分析
tags:
  - 游戏研究
  - 阅读笔记
draft: false
```

然后运行：

```bash
npm run sync:content
```

### 方式 2：从任意位置导入 Markdown

```bash
npm run import:note -- --source "/absolute/or/relative/file.md" --topic "游戏分析"
```

可选参数：

- `--title`
- `--description`
- `--date`
- `--uploadDate`
- `--tags "标签1,标签2"`
- `--draft true`

导入脚本会把文件整理进 `content-source/notes/<topic>/`，并补齐基本 frontmatter。

## Writing 工作流

Writing 同时支持 Markdown 与 PDF。

### 方式 0：在 Studio 中操作

访问 `/studio` 后，可以：

- 直接写 Markdown 文章
- 导入 PDF
- 自动生成 PDF 对应的元数据条目
- 自动写入对应的 type 目录
- 点击已有 writing 条目后继续编辑
- 删除已有 writing 条目
- 删除整个 writing 类型

### 导入 Markdown

```bash
npm run import:writing -- --source "/path/to/file.md" --type "随笔"
```

### 导入 PDF

```bash
npm run import:writing -- --source "/path/to/file.pdf" --type "论文" --title "My Paper"
```

导入 PDF 时会做两件事：

1. 把 PDF 复制到 `public/library/writing/<type>/`
2. 在 `content-source/writing/<type>/` 下创建一个元数据 Markdown 条目

可选参数：

- `--description`
- `--date`
- `--tags "paper,pdf"`
- `--publication "Conference Paper"`
- `--abstract "摘要文字"`
- `--draft true`

### Writing 条目字段

推荐字段：

```yaml
title: 标题
description: 简介
date: 2026-04-25
type: 随笔
tags:
  - 写作
draft: false
format: markdown
```

PDF 条目额外支持：

```yaml
format: pdf
filePath: /library/writing/papers/example.pdf
publication: Conference Paper
```

## Projects 工作流

Projects 目前直接维护在：

```text
src/content/projects/*.md
```

推荐字段：

```yaml
title: 项目名
description: 简介
date: 2026-04-25
tags:
  - workflow
draft: false
status: In progress
featured: false
link: https://example.com
```

在 `/studio` 的 `Projects` section 中，也可以直接编辑或删除已有 project 条目。

## 分类与导航

- `Notes` 下拉来自所有 note 的 `topic`
- `Writing` 下拉来自所有 writing 的 `type`
- `Projects` 下拉直接列出当前项目条目

桌面端以 hover dropdown 为主，移动端通过右侧切换按钮展开。

如果下拉有样式调整需求，主要修改点在 [src/styles/global.css](/Users/paimon/pineappler/src/styles/global.css) 和 [src/components/Layout.astro](/Users/paimon/pineappler/src/components/Layout.astro)。

## 后续扩展建议

- 把 `About` 补成更完整的 CV / profile
- 在 `Writing` 中继续区分随笔、论文、书评等类型
- 为 `Notes` 增加更多主题目录
- 接入部署平台与自定义域名
- 增加 `sitemap`、`RSS`、SEO 元信息与 Open Graph
