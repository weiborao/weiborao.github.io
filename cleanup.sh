#!/bin/bash

# ==========================================
# Hexo 本地残留文件一键清理脚本 (2026 版)
# ==========================================

echo "🚀 开始清理本地残留文件..."

# 1. 清理 Hexo 生成的临时产物
echo "--- 正在清理 Hexo 缓存与生成目录..."
rm -rf public/          # 删除本地生成的静态网页
rm -rf .deploy_git/     # 删除旧版 hexo deploy 产生的缓存
rm -f db.json           # 删除本地生成记录缓存

# 2. 清理过时的配置文件与手动脚本
echo "--- 正在清理过时的工具与错误配置..."
rm -f deploy.xml        # 删除错误的 XML 配置文件
rm -f tools/generate_sitemap.sh  # 删除已被插件取代的手动脚本

# 3. 检查并清理冗余的 Umami 脚本 (保持唯一性)
# 建议只保留脚本名中带有 'global' 的版本
if [ -f "scripts/umami_global_injector.js" ] && [ -f "scripts/umami_injector.js" ]; then
    echo "--- 发现冗余脚本，正在保留全局版本..."
    rm -f scripts/umami_injector.js
fi

# 4. (可选) 清理依赖并重新安装，确保蓝图一致
# 如果你觉得本地环境混乱，可以取消下面两行的注释
# rm -rf node_modules/
# npm install

echo "✅ 清理完成！"
echo "现在的本地目录仅包含核心源码，随时可以推送到 GitHub Actions 进行云端构建。"
