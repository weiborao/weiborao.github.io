#!/bin/bash

# 设置基础 URL
BASE_URL="https://weiborao.link"
# 获取当前时间戳（ISO 8601 格式）
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S+08:00)

# 开始写入 XML
cat <<EOF > ./public/sitemap.xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/works/</loc>
    <lastmod>${TIMESTAMP}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
EOF

# 定义页面列表和对应的优先级
# 格式: "文件名:优先级"
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

# 循环写入页面
for item in "${pages[@]}"; do
  page=$(echo $item | cut -d':' -f1)
  priority=$(echo $item | cut -d':' -f2)
  cat <<EOF >> ./public/sitemap.xml
  <url>
    <loc>${BASE_URL}/${page}</loc>
    <lastmod>${TIMESTAMP}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>
EOF
done

# 结束写入
echo "</urlset>" >> ./public/sitemap.xml

echo "✅ 定制化 Sitemap.xml 已生成在 ./public 目录！"