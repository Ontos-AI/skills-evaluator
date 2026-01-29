---
name: github-trending-today
description: 从 GitHub 搜索今天的热门仓库并汇总成表格。
---
---
name: github-trending-today
description: 从 GitHub 搜索今天的热门仓库并汇总成表格。
license: MIT
---

# GitHub 今日热门仓库汇总

此技能用于获取 GitHub 上今日的热门仓库，并将它们整理成易于阅读的表格格式。

## 核心功能

1.  **获取热门仓库**: 自动从 GitHub Trending 页面抓取今日热门仓库数据。
2.  **数据提取**: 提取仓库的名称、描述、星标数、fork 数、主要语言和 URL 等关键信息。
3.  **格式化输出**: 将提取的数据整理成表格形式，方便用户查看和分析。

## 使用方法

**触发**: "获取今天的 GitHub 热门仓库" 或 "GitHub 今日热门" 或 "给我今天的 GitHub Trending 列表"

### 示例输出

| 仓库名称 | 描述 | 星标数 | Fork数 | 语言 | URL |
| :------- | :--- | :----- | :----- | :--- | :-- |
| `deepseek-ai/DeepSeek-OCR-2` | | 526 | 23 | Python | `https://github.com/deepseek-ai/DeepSeek-OCR-2` |
| `renovatebot/renovate` | Home of the Renovate CLI: Cross-platform Dependency Automation by Mend.io | 20667 | 2918 | TypeScript | `https://github.com/renovatebot/renovate` |
| `lowlighter/metrics` | 📊 An infographics generator with 30+ plugins and 300+ options to display stats about your GitHub account and render them as SVG, Markdown, PDF or JSON! | 16059 | 2113 | JavaScript | `https://github.com/lowlighter/metrics` |
| `ImranR98/Obtainium` | Get Android app updates straight from the source. | 14818 | 381 | Dart | `https://github.com/ImranR98/Obtainium` |
| `release-it/release-it` | 🚀 Automate versioning and package publishing | 8807 | 551 | JavaScript | `https://github.com/release-it/release-it` |
| `kangvcar/InfoSpider` | INFO-SPIDER 是一个集众多数据源于一身的爬虫工具箱🧰，旨在安全快捷的帮助用户拿回自己的数据，工具代码开源，流程透明。支持数据源包括GitHub、QQ邮箱、网易邮箱、阿里邮箱、新浪邮箱、Hotmail邮箱、Outlook邮箱、京东、淘宝、支付宝、中国移动、中国联通、中国电信、知乎、哔哩哔哩、网易云音乐、QQ好友、QQ群、生成朋友圈相册、浏览器浏览历史、12306、博客园、CSDN博客、开源中国博客、简书。 | 8171 | 1491 | Python | `https://github.com/kangvcar/InfoSpider` |

## 实现细节

该技能将利用 `github` 工具或直接访问 GitHub Trending 页面来获取数据。数据获取后，会进行解析和结构化，最终以 Markdown 表格的形式呈现给用户。
