---
title: Hexo 安装设置遇到的问题及解决办法
date: 2021-02-07 23:36:19
tags: 
- hexo
description: 记录在Hexo安装过程中遇到的Hexo与Node.js版本兼容性的问题，使用nvm安装低版本的node.js解决问题，参考成百川的解决办法。
---

# 遇到的问题

正常按照**brew install node** 以及 **npm install -g hexo-cli** 安装完以后，运行**hexo deploy**报错，如下：

```bash
➜  blog hexo d
INFO  Validating config
INFO  Deploying: git
INFO  Clearing .deploy_git folder...
INFO  Copying files from public folder...
FATAL {
  err: TypeError [ERR_INVALID_ARG_TYPE]: The "mode" argument must be integer. Received an instance of Object
      at copyFile (node:fs:2019:10)
      at tryCatcher (/Users/werao/blog/node_modules/bluebird/js/release/util.js:16:23)
      at ret (eval at makeNodePromisifiedEval (/usr/local/lib/node_modules/hexo-cli/node_modules/bluebird/js/release/promisify.js:184:12), <anonymous>:13:39)
```

网上查找了一下，报错的原因是Hexo与Node.js的兼容性问题。

# 解决办法

非常幸运，找到一篇文章：[重装Hexo遇到的坑](http://franktianyirenjian.github.io/2020/04/28/%E9%87%8D%E8%A3%85Hexo%E9%81%87%E5%88%B0%E7%9A%84%E5%9D%91/) 作者 成百川。

简要记录步骤如下：

1. 卸载**node**
   **brew uninstall node**

2. 安装**nvm**
   **brew install nvm**
记得按提示修改**~/.zshrc**文件，否则下次启动会找不到**nvm**。
   
3. 使用**nvm**安装低于14.0版本的node.js--如果后续版本升级，还可以使用nvm安装新版本。
   **nvm install v13.14.0**

   ```bash
   Now using node v13.14.0 (npm v6.14.4)
   Creating default alias: default -> v13.14.0
   ```

4. 重新运行**hexo deploy -g** 发布本文。

鸣谢**成百川**。