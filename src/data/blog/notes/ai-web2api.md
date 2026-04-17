---
author: Posase
pubDatetime: 2026-04-16T00:00:00Z
title: "AI 网页端转 API 与 OpenAI 兼容平台整理"
draft: false
tags:
  - 开发工具
  - 学习笔记
description: "整理常见 xx2api 项目，以及可直接接入 2API、One-API 的 OpenAI 兼容平台，方便按需选择更稳妥的 AI 接入方案"
---

<!-- [建议补充] 内容涉及逆向工程项目，部分项目可能已失效，建议定期更新 -->

这篇文章把两类常见方案放在一起整理：一类是把 AI 网页端转成标准 OpenAI 兼容接口的 xx2api 项目，另一类是本身就支持 OpenAI 格式、可以直接接入 2API、One-API 等聚合面板的平台。前者更适合研究和折腾，后者通常更适合作为日常使用方案。

> **注意：本文内容具有时效性，AI 平台会频繁更新反爬机制，项目可用性随时可能变化。**

> **风险提示**：所有非官方逆向工程项目均可能违反对应 AI 平台的用户协议，存在账号封禁风险。中转服务可能存在数据泄露隐患，禁止传输敏感信息。仅用于个人学习研究。

## 已整理的 xx2api 项目

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

## 其他值得关注的同类项目

上面列的是我已经整理过的项目，下面只补充一些更有代表性的方向，避免和后文平台列表重复过多。

| 项目名 | 对应平台 | 核心特点 |
|--------|---------|---------|
| `gemini2api` | Google Gemini | 免费额度相对友好，适合多模态场景 |
| `kimi2api` | 月之暗面 Kimi | 长文本处理能力强 |
| `tongyi2api` | 阿里通义千问 | 国内模型，适合中文场景 |
| `doubao2api` | 字节跳动豆包 | 国内直连友好，多模态能力较全 |
| `poe2api` | Quora Poe | 聚合多个主流模型 |
| `phind2api` | Phind AI | 面向开发者的代码搜索场景 |
| `chatpdf2api` | ChatPDF | PDF 文档问答 |
| `feishu2api` | 飞书 AI 助手 | 企业协同与办公场景 |

## 配套工具

| 工具 | 用途 | 核心作用 |
|------|------|---------|
| `claude-app-patch` / `cursor-app-patch` | 客户端补丁 | 绕过官方 API 限制，直接用网页端 token 调用 |
| `CLIProxyAPI` | 命令行 API 代理 | 统一管理多 AI API 中转，支持多账号轮询、负载均衡 |
| `tmp_mail` | 临时邮箱 | 注册 AI 平台账号时接收验证码 |
| `NVIDIAAccount` | NVIDIA 账号管理 | 管理 NVIDIA AI 服务的 token |

## xx2api 的通用原理

大多数 xx2api 项目本质上都是 **浏览器自动化 + 反向代理**：

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

## 可直接接入的 OpenAI 兼容平台

如果你的目标不是折腾逆向项目，而是尽快接入 2API、One-API 这类聚合面板，那么更省事的路线通常是直接选择 **自带免费额度、同时兼容 OpenAI 格式** 的官方或聚合服务。下面按使用场景简单归类。

### 自带联网搜索的平台

| 平台 | 免费额度 | 接入方式 | 核心特点 |
|---|---|---|---|
| Perplexity | 网页版可免费使用；API 新用户通常有试用额度 | OpenAI 兼容，可接入 2API / One-API | 实时联网、引用标注、多模态 |
| Phind | 网页版可免费使用；API 通常提供试用 | OpenAI 兼容，可接入聚合平台 | 面向开发者，代码与技术搜索能力强 |
| 302.AI | 新用户一般会赠送免费额度 | 完全兼容 OpenAI，国内直连较友好 | 支持 `-web-search` 联网，多模型切换方便 |

### 全模型聚合平台

| 平台 | 免费额度 | 接入方式 | 核心特点 |
|---|---|---|---|
| OpenRouter | 未充值账号可用 `:free` 免费模型；充值后免费调用配额更高 | 100% OpenAI 兼容 | 模型覆盖面广，适合统一测试多模型 |
| Together.ai | 新用户通常有试用额度 | OpenAI 兼容 | 可快速体验开源模型与部分商业模型 |
| NVIDIA Build | 提供大量免费端点，部分模型带免费 credits | OpenAI 兼容，`base_url` 为 `https://integrate.api.nvidia.com/v1` | 免费模型多，适合做低成本实验 |

### 国内直连友好平台

| 平台 | 免费额度 | 接入方式 | 核心特点 |
|---|---|---|---|
| DeepSeek | 网页版免费；API 定价低，部分阶段提供优惠或体验额度 | OpenAI 兼容，国内直连 | 中文与代码能力强，接入成本低 |
| Moonshot AI（Kimi） | 网页版有每日免费额度；API 常见新用户试用 | OpenAI 兼容 | 长文本、文件理解能力突出 |
| 字节豆包 | Lite 或基础模型通常带免费额度 | API 兼容 OpenAI，国内直连 | 多模态能力丰富，生态完善 |
| 通义千问 | 基础能力可免费体验；API 常见免费额度或低价套餐 | OpenAI 兼容 | 稳定、中文表现好，企业场景常见 |
| 文心一言 | 基础版可免费体验；API 常见试用套餐 | 兼容 OpenAI | 国内稳定，多模态能力持续完善 |

### 官方直连与试用渠道

| 平台 | 免费额度 | 接入方式 | 核心特点 |
|---|---|---|---|
| Google Gemini（AI Studio） | 提供长期可用的免费额度，Flash 系列较友好 | 提供 OpenAI 兼容接口 | 多模态能力强，适合图文与轻量任务 |
| Anthropic（Claude） | 部分渠道提供试用额度，例如云厂商集成平台 | 可通过 OpenAI 兼容层接入 | 长文本、代码与写作质量突出 |
| xAI（Grok） | 常见新用户试用或活动额度 | OpenAI 兼容 | 联网能力较强，适合信息检索类任务 |

## 免费友好度速览

| 平台 | 免费力度 | 接入难度 | 联网 | 国内直连 |
|---|---|---|---|---|
| DeepSeek | 很高 | 低 | ✅ | ✅ |
| OpenRouter | 较高 | 低 | ✅ | ✅ |
| NVIDIA Build | 较高 | 低 | ❌ | ✅ |
| Perplexity | 较高 | 低 | ✅ | ❌ |
| Phind | 较高 | 低 | ✅ | ❌ |
| 302.AI | 中等 | 低 | ✅ | ✅ |
| Gemini | 中等 | 中 | ✅ | ❌ |
| Kimi | 中等 | 低 | ✅ | ✅ |
| 豆包 | 中等 | 低 | ✅ | ✅ |

## 如何选择更合适的接入方案

如果你还没决定走哪条路线，可以直接按需求判断：

1. **想低成本长期用**：优先考虑 DeepSeek、OpenRouter。
2. **想要联网搜索**：优先考虑 Perplexity、Phind、302.AI。
3. **想同时测试多个模型**：优先考虑 OpenRouter、Together.ai。
4. **想要多模态能力**：优先考虑 Gemini、豆包。
5. **想处理长文本或大文件**：优先考虑 Claude、Kimi。

## 2API / One-API 接入示例

如果你已经有 2API、One-API 或类似聚合面板，通常只需要准备 3 个参数：`base_url`、`api_key`、`model`。大多数支持 OpenAI 格式的平台都可以按同一套方式接入。

### 常见配置思路

| 平台 | base_url 示例 | model 示例 | 说明 |
|---|---|---|---|
| DeepSeek | 平台提供的 OpenAI 兼容地址 | `deepseek-chat`、`deepseek-reasoner` | 适合作为默认主力模型 |
| OpenRouter | 平台提供的 OpenAI 兼容地址 | `openai/gpt-4o-mini`、`deepseek/deepseek-chat-v3:free` | 适合多模型切换与测试 |
| Perplexity | 平台提供的 OpenAI 兼容地址 | `sonar-small-online`、`sonar-pro` | 适合联网搜索场景 |
| Gemini | 平台提供的兼容地址 | 对应 Gemini 兼容模型名 | 适合多模态任务 |
| Kimi | 平台提供的兼容地址 | 对应 Moonshot 模型名 | 适合长文本与文件分析 |

### 通用请求示例

```bash
curl https://your-api.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {
        "role": "user",
        "content": "帮我总结一下这篇文章的重点"
      }
    ],
    "temperature": 0.7
  }'
```

### 在聚合面板里通常这样填

1. **接口地址**：填写供应商提供的 OpenAI 兼容 `base_url`。
2. **密钥**：填写对应平台签发的 `api_key`。
3. **模型名**：直接填该平台支持的模型标识。
4. **是否联网**：如果平台支持联网模型，通常通过模型名或额外参数开启。
5. **流式输出**：大多数平台都支持 SSE 流式响应，可按客户端需要开启。

## 最后的选型建议

1. **能用官方兼容接口时，优先别折腾逆向链路**：维护成本更低，稳定性也通常更好。
2. **把 xx2api 当作补充方案**：它更适合个人研究、临时测试，或者官方接口不方便时作为备用。
3. **定期确认额度与策略**：免费额度、模型清单、联网能力都可能随时间调整。
4. **不要上传敏感信息**：无论是逆向项目还是第三方聚合平台，都尽量避免传输账号、隐私数据与生产环境机密。
