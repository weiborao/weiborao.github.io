import os

# ================= 配置区 =================
# 你的 HTML 文件所在的目录，'.' 代表当前目录
HTML_DIR = '.' 

# 现代化的终极 Favicon 代码块
FAVICON_CODE = """
    <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
"""
# ==========================================

def process_html_files(directory):
    success_count = 0
    skip_count = 0
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                
                # 强制使用 utf-8 保护原有的中文 SEO Meta 标签
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 检查是否已经存在该方案的核心特征（比如 svg 标签），防止重复运行
                if 'href="/favicon.svg"' in content:
                    print(f"⏩ [跳过] {file} 已经包含最新版 Favicon 代码。")
                    skip_count += 1
                    continue
                
                if '</head>' in content:
                    new_content = content.replace('</head>', f'{FAVICON_CODE}</head>')
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    print(f"✅ [成功] 已更新 {file}")
                    success_count += 1
                else:
                    print(f"❌ [警告] 在 {file} 中未找到 </head> 标签，跳过修改。")

    print("-" * 30)
    print(f"🎉 任务完成！共更新 {success_count} 个文件，跳过 {skip_count} 个文件。")

if __name__ == '__main__':
    print("🚀 开始批量注入终极版 Favicon 代码...\n")
    process_html_files(HTML_DIR)