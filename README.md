# 🚀 Weiborao.link 站点维护与发布指南 (2026版)

本项目是基于 **Hexo** 框架构建的个人博客，采用 **GitHub Actions** 实现自动化部署，并集成了 **Umami** 统计与 **GenAI** 生成的独立作品页面。

## 📂 项目结构核心说明

* **`main` 分支**：**唯一的真理来源 (Source of Truth)**。存放所有源码（Markdown、配置文件、自定义脚本、AI HTML 页面）。
* **`source/`**：存放所有内容。
* `source/_posts/`：标准博客文章（Markdown）。
* `source/*.html`：GenAI 生成的独立页面（如 `tetragon.html`）。


* **`scripts/`**：存放自定义 Hexo 插件/脚本。
* `umami_global_injector.js`：负责全局注入统计代码。


* **`.github/workflows/deploy.yml`**：GitHub Actions 自动化部署的“指挥官”。

---

## 🛠 日常发布流程

遵循 **“本地编辑 -> Git 推送 -> 云端构建”** 的逻辑。

### 1. 本地创作与预览

```bash
hexo clean      # 清理缓存
hexo generate   # 生成静态文件 (检查本地是否有报错)
hexo server     # 本地预览 (访问 localhost:4000)

```

### 2. 一键发布到 GitHub Pages

只需将代码推送到 `main` 分支，GitHub Actions 会自动接管后续的构建与部署：

```bash
git add .
git commit -m "feat: 新增文章或修改作品集"
git push origin main

```

---

## 🧠 特殊页面处理 (GenAI 页面)

当你直接将 AI 生成的 HTML 文件放入 `source/` 目录时，需遵循以下规则：

1. **添加 Front-matter**：
在 HTML 文件最顶部添加以下内容，确保 Hexo 识别它但不对其应用主题模板：
```html
---
layout: false
---

```


2. **移除 `skip_render**`：
在 `_config.yml` 中，**不要**将这些页面放入 `skip_render` 列表。这样 `hexo-generator-sitemap` 插件才能扫描到它们并加入站点索引。
3. **响应式优化**：
对于宽屏显示不正常的页面，需在 CSS 中设置 `max-width: 1100px; margin: auto;` 进行容器约束。

---

## 📊 Umami 统计注入逻辑

为了解决 `layout: false` 页面会跳过主题注入器的问题，我们采用了 **全局注入脚本**：

* **脚本位置**：`scripts/umami_global_injector.js`
* **逻辑**：该脚本利用 `hexo.extend.injector` 接口，在所有生成的 HTML 文件的 `</head>` 标签前强制插入 Umami 脚本，无论该页面是否使用了主题布局。

---

## 🗺 自动化 Sitemap

不再使用手动编写的 `.sh` 脚本。

* **插件**：已安装 `hexo-generator-sitemap`。
* **生效方式**：只要文件在 `source/` 目录下且具备 Front-matter，构建时会自动更新 `sitemap.xml`。
* **验证地址**：`https://weiborao.link/sitemap.xml`

---

## 🧹 环境维护与清理

为了保持仓库纯净，避免 `.DS_Store`、`db.json` 和 `node_modules` 污染远程仓库：

1. **使用 `.gitignore**`：
确保根目录下有 `.gitignore` 文件，排除 `public/`、`node_modules/` 和系统缓存。
2. **清理残留命令**：
如果发现 `git diff` 中出现 `db.json` 或 `.DS_Store`，执行：
```bash
git rm --cached db.json
git rm --cached "**/.DS_Store"
git commit -m "chore: cleanup residue"
git push origin main

```



---

**最后提醒**：每次重新 `git clone` 项目后，请务必先运行 `npm install` 以恢复插件环境。

---