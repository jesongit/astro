---
author: Posase
pubDatetime: 2026-04-16T00:00:00Z
title: "AI 网页端转 API 工具整理"
draft: false
tags:
  - 开发工具
  - 学习笔记
description: "各类 AI 网页端转 API（xx2api）项目整理，涵盖 ChatGPT、Claude、Gemini 等主流平台的逆向 API 方案"
---

<!-- [建议补充] 内容涉及逆向工程项目，部分项目可能已失效，建议定期更新 -->

各类将 AI 平台网页端转为标准 OpenAI 兼容 API 的开源项目整理，方便按需选型。

> **注意：本文内容具有时效性，AI 平台会频繁更新反爬机制，项目可用性随时可能变化。**

> **风险提示**：所有非官方逆向工程项目均可能违反对应 AI 平台的用户协议，存在账号封禁风险。中转服务可能存在数据泄露隐患，禁止传输敏感信息。仅用于个人学习研究。

## 已整理 xx2api 项目全表

| 文件夹名 | 对应平台 | 项目别名 | 核心功能 | 支持模型 | 适用场景 |
|----------|---------|---------|----------|---------|---------|
| `ch2api` | OpenAI ChatGPT | chat2api | 将 ChatGPT 网页端转为 OpenAI 兼容 API | GPT-3.5-turbo、GPT-4o、GPT-4o mini | Cherry Studio、Cursor 等客户端调用 |
| `ax2api` | Anthropic Claude | claude2api | 将 Claude 网页端转为 OpenAI 兼容 API | Claude 3.5 Sonnet、Claude 3 Opus/Sonnet/Haiku | 长文本处理、代码生成 |
| `bo2api` | Microsoft Bing Copilot | bing2api | 将必应 Copilot 网页端转为 API | GPT-4、GPT-4o、DALL-E 3 | 免费调用 GPT-4，国内可直连 |
| `du2api` | DuckDuckGo AI Chat | duck2api | 将 DuckDuckGo 免费 AI 聊天转为 API | Claude 3 Haiku、Llama 3、GPT-4o mini | 零成本、无需注册 |
| `yo2api` | You.com AI | you2api | 将 You.com 网页端 AI 对话转为 API | Claude 3、GPT-4、Gemini Advanced | 带联网搜索的 AI 对话 |
| `no2api` | Notion AI | notion2api | 将 Notion 内置 AI 功能转为 API | Notion AI 自研模型 | 文档批量总结、写作 |
| `rel2api` | Perplexity AI | perplexity2api | 将 Perplexity 网页端 AI 搜索转为 API | GPT-4o、Claude 3.5 Sonnet、Llama 3 | 实时联网搜索、学术检索 |
| `st2api` | Stack Overflow AI | stack2api | 将 Stack Overflow AI 代码助手转为 API | CodeLlama、StarCoder 2 | 代码生成、调试 |
| `tp2api` | 腾讯混元大模型 | tencent2api | 将腾讯混元网页端转为 API | 腾讯混元 3.0 | 中文场景、国内合规 |
| `air2api` | AirChat AI | airchat2api | 将 AirChat/Airtable AI 转为 API | 对应平台自研模型 | 小众 AI 服务集成 |

## 其他同类热门项目

### 主流大模型平台

| 项目名 | 对应平台 | 核心特点 |
|--------|---------|---------|
| `gemini2api` | Google Gemini | 免费 Gemini 1.5 Pro/Ultra，免费额度高 |
| `doubao2api` | 字节跳动豆包 | 中文优化好，国内可直连 |
| `ernie2api` | 百度文心一言 | 国内合规，适合企业级场景 |
| `tongyi2api` | 阿里通义千问 | 支持通义千问 3.0、通义万相 |
| `kimi2api` | 月之暗面 Kimi | 长文本处理能力强，免费额度高 |
| `glm2api` | 智谱清言 | 支持 GLM-4，国内开源大模型代表 |
| `cohere2api` | Cohere AI | 企业级大模型，适合 RAG 场景 |
| `mistral2api` | Mistral AI | 欧洲开源大模型，隐私性好 |

### 特色场景

| 项目名 | 对应平台 | 核心特点 |
|--------|---------|---------|
| `poe2api` | Quora Poe | 聚合 ChatGPT、Claude、Gemini 多模型 |
| `characterai2api` | Character.AI | AI 角色对话场景 |
| `phind2api` | Phind AI | 代码 AI 搜索引擎，专为开发者设计 |
| `chatpdf2api` | ChatPDF | PDF 文档问答场景 |
| `wpsai2api` | WPS AI | 国内办公 AI 场景 |
| `feishu2api` | 飞书 AI 助手 | 企业办公协同场景 |

## 配套工具

| 工具 | 用途 | 核心作用 |
|------|------|---------|
| `claude-app-patch` / `cursor-app-patch` | 客户端补丁 | 绕过官方 API 限制，直接用网页端 token 调用 |
| `CLIProxyAPI` | 命令行 API 代理 | 统一管理多 AI API 中转，支持多账号轮询、负载均衡 |
| `tmp_mail` | 临时邮箱 | 注册 AI 平台账号时接收验证码 |
| `NVIDIAAccount` | NVIDIA 账号管理 | 管理 NVIDIA AI 服务的 token |

## 通用原理

所有 xx2api 项目本质上都是**浏览器自动化 + 反向代理**：

1. 模拟浏览器登录 AI 平台网页端，获取 `access_token` / `refresh_token`
2. 拦截网页端的原生 API 请求，将 OpenAI 格式请求转发给 AI 平台
3. 将 AI 平台的响应转换为标准 OpenAI 格式

### 典型部署流程

以 chat2api 为例：

```bash
# 1. 克隆项目
git clone https://github.com/chat2api/chat2api.git
cd chat2api

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置 token（从 chat.openai.com 的 Cookie 中提取）
echo "YOUR_OPENAI_TOKEN" > token.txt

# 4. 启动服务
python main.py

# 5. 客户端配置
# API 地址：http://localhost:3000/v1/chat/completions
# API Key：任意值（或项目配置的密钥）
```

## 选型建议

1. **按需求选型**：优先选择免费额度高、国内可直连的项目（如 duck2api、bing2api、kimi2api）
2. **多账号轮询**：通过 CLIProxyAPI 统一管理多账号，避免单账号限流
3. **定期更新**：AI 平台会频繁更新反爬机制，需定期同步项目最新版本
4. **合规使用**：仅用于个人学习研究，禁止用于商业用途或违规场景
