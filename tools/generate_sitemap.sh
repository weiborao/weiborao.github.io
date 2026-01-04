#!/bin/bash

# ==========================================
# 站点配置
# ==========================================
BASE_URL="https://weiborao.link"
# 获取当前时间（符合 ISO 8601 格式）
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S+08:00)
# 输出路径
OUTPUT_FILE="./public/sitemap.xml"

echo "开始生成包含首页的定制化 Sitemap..."

# 1. 写入 XML 头部并添加【首页】
cat <<EOF > $OUTPUT_FILE
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${TIMESTAMP}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/works/</loc>
    <lastmod>${TIMESTAMP}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
EOF

# 2. 定义其他核心技术页面及优先级 (文件名:优先级)
# 优先级根据内容深度从 0.9 到 0.7 降序排列
pages=(
  "ebpf.html:0.9"
  "cilium.html:0.9"
  "tetragon.html:0.9"
  "sec8b.html:0.8"
  "isev2.html:0.8"
  "sna.html:0.8"
  "ebpfv3.html:0.7"
  "isestory.html:0.7"
  "My-GenAI-works-md.html:0.9"
  "BRKSEC-2169-ebpf-md.html:0.8"
  "tetragon-md.html:0.8"
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

echo "✅ 包含首页的 Sitemap.xml 已生成成功！"
