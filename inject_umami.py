import os

# 定义要注入的代码块
UMAMI_SCRIPT = '<script defer src="https://cloud.umami.is/script.js" data-website-id="cc09374a-e38a-4069-ac46-5a72fb1ad7d5"></script>'

def inject_umami_to_html():
    source_dir = 'source'
    processed_count = 0
    skipped_count = 0

    # 遍历 source 目录及其子目录
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # 检查是否已经注入过，避免重复注入
                if 'cloud.umami.is/script.js' in content:
                    print(f"跳过（已存在）: {file_path}")
                    skipped_count += 1
                    continue

                # 查找 </head> 标签并进行替换
                if '</head>' in content:
                    # 使用 replace 插入到 </head> 之前
                    new_content = content.replace('</head>', f'{UMAMI_SCRIPT}\n</head>')
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    print(f"成功注入: {file_path}")
                    processed_count += 1
                else:
                    print(f"警告（未找到 </head>）: {file_path}")

    print(f"\n处理完成！成功: {processed_count}，跳过: {skipped_count}")

if __name__ == "__main__":
    inject_umami_to_html()
