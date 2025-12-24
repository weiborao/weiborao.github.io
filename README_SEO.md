这是一份为您精心编写的 `README_SEO.md`。它记录了我们今天完成的所有核心架构改动、自动化流程以及维护逻辑。

---

# 🚀 Weibo Rao 技术实验室：SEO 与自动化维护指南 (2025 版)

本文件详细记录了 `weiborao.link` 项目在 2025-12-24 完成的 SEO 架构升级与自动化工作流优化。

---

## 核心架构概览

本项目采用 **Hexo** 驱动，并针对“专家级技术内容”进行了深度 SEO 定制。

### 1. 分支策略 (Branching Strategy)

* **`main` 分支**：**源码办公室**。存放所有 `.md` 文章、主题配置、脚本工具（`/tools`）及开发环境。
* **`master` 分支**：**线上展厅**。存放由 Hexo 生成的静态 HTML 文件，是 Google 爬虫抓取的目标。

---

## 🛠 自动化工作流 (Workflow)

我们通过修改 `package.json` 整合了一个自动化的“生成 + 增强 + 部署”流程。

### 快捷指令

在终端输入以下指令即可完成发布：

```bash
npm run deploy

```

### 内部逻辑拆解

该指令会自动依次执行以下步骤：

1. **`hexo clean`** (可选)：清理旧缓存。
2. **`hexo generate`**：构建静态页面。
3. **`bash ./tools/generate_sitemap.sh`**：**[核心 SEO 增强]** 在 `public/` 目录中动态生成带最新时间戳的 `sitemap.xml`。
4. **`hexo deploy`**：将 `public/` 的内容推送到远程 `master` 分支。

---

## 📈 SEO 专家级配置

### 1. 结构化数据与元数据

针对 eBPF、Cilium、Tetragon、Cisco ISE 等 9 个核心页面，我们统一配置了符合 **Google E-E-A-T** 标准的元数据：

* **`dateModified`**：每次部署自动更新为最新时间。
* **`proficiencyLevel`**: 设置为 `Expert`，精准吸引资深技术受众。
* **JSON-LD**: 采用 `TechArticle` 架构，提升在搜索结果中的展示丰富度。

### 2. 动态 Sitemap

脚本位置：`./tools/generate_sitemap.sh`

* **作用**：确保 Sitemap 中的 `<lastmod>` 与 HTML 页面内的时间戳严格同步。
* **优先级管理**：
* `/works/` (1.0)
* `ebpf.html`, `cilium.html`, `tetragon.html` (0.9)
* `sec8b.html`, `isev2.html`, `sna.html` (0.8)



---

## 🧹 仓库清理与维护

### 忽略噪音文件

为了保持 `main` 分支干净，以下文件已加入 `.gitignore`，**不应**提交到源码仓库：

* `.DS_Store` (macOS 系统文件)
* `.deploy_git/` (Hexo 部署临时目录)
* `public/` (生成的静态网页)
* `db.json` (Hexo 本地缓存)

### 更新流程建议

每当你写完新文章或更新白皮书后，建议的操作序列：

1. **发布**：`npm run deploy`
2. **备份源码**：
```bash
git add .
git commit -m "feat: 更新 eBPF 相关白皮书内容"
git push origin main

```



---

## 🔍 故障排查 (FAQ)

* **Q: 运行 `npm run deploy` 提示权限不足？**
* A: 运行 `chmod +x ./tools/generate_sitemap.sh` 赋予脚本执行权限。


* **Q: 为什么 Google 还没收录我的更新？**
* A: 请确认 `weiborao.link/sitemap.xml` 已经显示最新日期，并前往 [Google Search Console](https://search.google.com/search-console/) 手动点击“请求编入索引”。


* **Q: Hexo 报错 Script load failed？**
* A: 确保 Shell 脚本放在 `tools/` 而不是 `scripts/` 目录下，防止 Hexo 将其误认为 JS 插件加载。

为了确保你以后能够随时复原这套系统，我将今天所有的核心代码进行了完整汇总。你可以将这些内容保存为 `SEO_BACKUP.md` 或者直接放入你的 `README_SEO.md` 中。

---

## 📄 1. Sitemap 生成脚本 (`tools/generate_sitemap.sh`)

**存放位置**: `项目根目录/tools/generate_sitemap.sh`

**功能**: 自动遍历核心页面，生成符合 Google 标准的 `sitemap.xml`，并动态注入当前时间戳。

```bash
#!/bin/bash

# ==========================================
# 站点配置
# ==========================================
BASE_URL="https://weiborao.link"
# 获取当前时间（符合 ISO 8601 格式，如：2025-12-24T15:50:00+08:00）
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S+08:00)
# 输出路径
OUTPUT_FILE="./public/sitemap.xml"

echo "开始生成 Sitemap..."

# 1. 写入 XML 头部和首页
cat <<EOF > $OUTPUT_FILE
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/works/</loc>
    <lastmod>${TIMESTAMP}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
EOF

# 2. 定义核心页面及优先级 (文件名:优先级)
pages=(
  "ebpf.html:0.9"
  "cilium.html:0.9"
  "tetragon.html:0.9"
  "sec8b.html:0.8"
  "isev2.html:0.8"
  "sna.html:0.8"
  "ebpfv3.html:0.7"
  "isestory.html:0.7"
)

# 3. 循环写入列表中的页面
for item in "${pages[@]}"; do
  page=$(echo $item | cut -d':' -f1)
  priority=$(echo $item | cut -d':' -f2)
  
  cat <<EOF >> $OUTPUT_FILE
  <url>
    <loc>${BASE_URL}/${page}</loc>
    <lastmod>${TIMESTAMP}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>
EOF
done

# 4. 写入 XML 尾部
echo "</urlset>" >> $OUTPUT_FILE

echo "✅ 定制化 Sitemap.xml 已生成至 ./public 目录！"

```

---

## 🤖 2. GitHub Actions 配置文件 (`.github/workflows/deploy.yml`)

**存放位置**: `项目根目录/.github/workflows/deploy.yml`

**功能**: 每次你推送源码到 `main` 分支时，自动完成构建、运行 SEO 脚本并发布到 `master` 分支。

```yaml
name: Hexo Deploy with Custom SEO

on:
  push:
    branches:
      - main  # 源码所在的本地开发分支

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm install

      - name: Generate Static Files
        run: npx hexo generate

      - name: Run SEO Sitemap Script
        run: |
          chmod +x ./tools/generate_sitemap.sh
          ./tools/generate_sitemap.sh

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
          publish_branch: master # 部署到的目标展示分支
          user_name: 'github-actions[bot]'
          user_email: 'github-actions[bot]@users.noreply.github.com'

```

---

## 📦 3. 本地化脚本配置 (`package.json`)

**存放位置**: `项目根目录/package.json`

**功能**: 定义本地快捷指令，确保 `npm run deploy` 时自动触发 SEO 增强。

```json
{
  "scripts": {
    "build": "hexo generate && bash ./tools/generate_sitemap.sh",
    "clean": "hexo clean",
    "deploy": "npm run build && hexo deploy",
    "server": "hexo server"
  }
}

```

---

## 🛠️ 维护必看：初始化操作清单

1. **新建文件夹**: 确保根目录下有 `tools` 文件夹。
2. **放置脚本**: 将 `generate_sitemap.sh` 放入 `tools`。
3. **赋予权限**: 首次使用需在终端执行 `chmod +x ./tools/generate_sitemap.sh`。
4. **配置忽略**: 检查 `.gitignore` 是否已包含以下项，防止将临时文件错传到 `main` 分支：
```text
.DS_Store
db.json
node_modules/
public/
.deploy_git/

```



---

### 💡 专家提示：

这份记录涵盖了你目前的 **“本地+云端”双保险** 部署模式。

* 如果你在本地电脑，只需：`npm run deploy`
* 如果你在外地使用新电脑，只需：`git push origin main`（GitHub Actions 会替你完成剩下的一切）


---

**最后维护者**: Weibo Rao & Gemini (Thought Partner)
**最后更新日期**: 2025-12-24

---

