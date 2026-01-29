# Ontos Skill Evaluator - 实施计划

> **Document Version**: v2.1  
> **Created**: 2026-01-29  
> **Updated**: 2026-01-29  
> **Status**: Phase 3.1 Complete

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Ontos Skill Evaluator                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Static Analysis (规则引擎, 零依赖)                              │
│  ├── Structure / Naming / Triggers / Actionability / Tool Refs / Examples │
│  └── Token Efficiency / Anti-Patterns                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Smoke Test (需要 LLM API)                                       │
│  ├── 唤起成功率测试 (Agent as Tester)                                    │
│  └── 工具调用闭环验证                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Benchmark Matching (需要向量数据库)                             │
│  ├── 任务语义检索 (OSWorld / WebArena / SWE-bench)                       │
│  └── 动态评估集组合                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Phase 1: Quick Wins (静态增强) — ✅ COMPLETED

> **目标**: 增强仪式感与易用性，提升开发者体验

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1.1 | `is_passed` + `pass_threshold` | ✅ Done | CI/CD 可直接判断通过/失败 |
| 1.2 | `badge_markdown` + `badge_html` | ✅ Done | README 勋章自动生成 |
| 1.3 | `token_warnings` | ✅ Done | Token 效率检查 (description/body/chars) |

---

## 🔧 Phase 2: Audit Depth (静态深化)

> **目标**: 对标竞品，补齐评估维度短板

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 2.1 | Naming 规范检测 | ⬜ TODO | max 64 chars, lowercase, no reserved words |
| 2.2 | Anti-Pattern Detector | ⬜ TODO | Windows path, magic numbers, time-sensitive |
| 2.3 | 嵌套引用深度检测 | ⬜ TODO | references/ 深度 <= 1 |
| 2.4 | 触发词覆盖率分析 | ⬜ TODO | 最佳实践: 3-5 个触发场景 |
| 2.5 | 环境变量引用检测 | ⬜ TODO | 检查 scripts/ 中的 env 引用 |

---

## 🧪 Phase 3: Smoke Test (动态验证) — ✅ PHASE 3.1 COMPLETE

> **目标**: 从"能看"到"能动"，验证基本通路是否畅通
> **依赖**: DeepSeek / Qwen / OpenAI / Claude API

### 3.1 唤起成功率测试 (Call Success Rate) — ✅ COMPLETED

| # | 子任务 | 状态 | 说明 |
|---|--------|------|------|
| 3.1.1 | Prompt 生成器 | ✅ Done | 基于 description 生成 5 个测试 prompt |
| 3.1.2 | Agent Tester | ✅ Done | 支持 DeepSeek/Qwen/OpenAI/Claude/Ollama |
| 3.1.3 | 唤起率计算 | ✅ Done | 输出 `call_success_rate` 百分比 |
| 3.1.4 | 混合判断引擎 | ✅ Done | Rule-based + LLM-judge 双模式 |
| 3.1.5 | 统一入口 eval.js | ✅ Done | 渐进式 L1→L2 测试流程 |
| 3.1.6 | HTML+JSON 报告 | ✅ Done | 自动保存到 test-reports/ |
| 3.1.7 | 交互式 setup.js | ✅ Done | API Key 配置向导 |

### 3.2 工具调用闭环验证 — ⬜ TODO (Phase 3.2)

| # | 子任务 | 状态 | 说明 |
|---|--------|------|------|
| 3.2.1 | Script 执行检测 | ⬜ TODO | 如果声明了 scripts/，验证能否无报错执行 |
| 3.2.2 | 输出格式校验 | ⬜ TODO | 检查输出是否符合预期格式 (JSON/Markdown) |

### 3.3 统一入口命令 (NEW)

```bash
# 推荐用法：渐进式测试
node eval.js ./skill                  # L1 → 询问 → L2
node eval.js ./skill --quick          # 仅 L1
node eval.js ./skill --full           # L1+L2 自动运行
node eval.js ./skill --ci             # CI 模式 (非交互 + JSON)

# API Key 配置
node setup.js                         # 交互式配置向导
```

---

## 🎯 Phase 4: Benchmark Matching (任务对齐) — NEW

> **目标**: 将 Skill 与真实世界 Benchmark 任务语义匹配
> **依赖**: 向量数据库 (可选轻量方案: 本地 JSON + 余弦相似度)

### 4.1 任务索引库构建

| # | 子任务 | 状态 | 说明 |
|---|--------|------|------|
| 4.1.1 | 收集 OSWorld 任务描述 | ⬜ TODO | ~400 tasks |
| 4.1.2 | 收集 WebArena 任务描述 | ⬜ TODO | ~800 tasks |
| 4.1.3 | 收集 SWE-bench 任务描述 | ⬜ TODO | ~2000 tasks (代码编辑) |
| 4.1.4 | 生成任务嵌入向量 | ⬜ TODO | 使用 text-embedding-3-small |
| 4.1.5 | 构建本地索引文件 | ⬜ TODO | `benchmark_index.json` |

### 4.2 语义检索引擎

| # | 子任务 | 状态 | 说明 |
|---|--------|------|------|
| 4.2.1 | Skill 功能提取 | ⬜ TODO | 从 description + body 提取关键能力 |
| 4.2.2 | 任务匹配算法 | ⬜ TODO | Top-5 余弦相似度匹配 |
| 4.2.3 | 匹配结果展示 | ⬜ TODO | "你的 Skill 可以解决这 5 类问题" |

### 4.3 输出示例

```json
{
  "benchmark_matching": {
    "enabled": true,
    "matched_tasks": [
      {
        "source": "OSWorld",
        "task_id": "os_123",
        "description": "Create a new folder and move 3 PDFs into it",
        "similarity": 0.89
      },
      {
        "source": "WebArena",
        "task_id": "web_456",
        "description": "Search for flights and compare prices",
        "similarity": 0.76
      }
    ],
    "coverage_summary": "Your skill aligns with 12% of OSWorld tasks"
  }
}
```

---

## 🚀 Phase 5: Advanced Features (未来方向)

> **优先级**: Low — 仅作为长期规划

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 5.1 | Prompt 注入漏洞扫描 | ⬜ Backlog | 检测安全风险 |
| 5.2 | 跨模型一致性评分 | ⬜ Backlog | Sonnet vs Opus vs Haiku |
| 5.3 | 真实 Sandbox 执行 | ⬜ Backlog | Docker 容器化执行 OSWorld 任务 |

---

## 📁 文件修改清单

| Phase | File | Changes |
|-------|------|---------|
| 1 ✅ | `scripts/quick_eval.js` | is_passed, badge_markdown, token_warnings |
| 1 ✅ | `scripts/quick_eval.py` | 同步 Node.js |
| 2 | `scripts/quick_eval.js` | checkNaming, checkAntiPatterns |
| 2 | `scripts/quick_eval.js` | checkReferenceDepth, analyzeTriggerCoverage |
| 3.1 ✅ | `scripts/eval.js` | 统一入口, 渐进式 L1→L2 测试 |
| 3.1 ✅ | `scripts/smoke_test.js` | LLM 唤起测试, 多 Provider 支持 |
| 3.1 ✅ | `scripts/setup.js` | API Key 交互式配置 |
| 3.2 | `scripts/smoke_test.js` | Script 执行验证 |
| 4 | `data/benchmark_index.json` | 新建 (任务索引) |
| 4 | `scripts/benchmark_match.js` | 新建 (检索引擎) |

---

## 🧪 验证计划

### 自动化测试

```bash
# 运行批量评估测试
./test_evaluator.sh

# 生成 HTML 报告
./test_evaluator.sh --html

# 验证 JSON 输出格式
node quick_eval.js ./test-skills/skill-creator | jq '.is_passed, .badge_markdown'
```

### 手动验证

1. 检查 `is_passed` 是否与 `overall >= 0.70` 一致
2. 复制 `badge_markdown` 到 GitHub README 验证渲染效果
3. 用超长 SKILL.md 测试 `token_warnings` 是否触发

---

## 🗓️ Timeline

```
✅ Week 1: Phase 1 (is_passed + badge + token warnings) — DONE
✅ Week 2: Phase 3.1 (Smoke Test + Unified Entry) — DONE
⬜ Week 3: Phase 2.1-2.2 (Naming + Anti-Patterns)
⬜ Week 4: Phase 2.3-2.5 (Reference depth + Triggers + Env)
⬜ Month 2: Phase 3.2 (Script Execution) + Phase 4 (Benchmark Matching)
```

---

## 📝 Open Questions

1. ~~**Smoke Test API 选择**: 用 Claude API 还是允许 OpenAI/其他?~~ ✅ 已支持多 Provider
2. **Benchmark 数据来源**: 直接下载原始数据集 vs 只存任务描述?
3. **向量数据库**: 用轻量方案 (JSON + 本地计算) 还是接入 Pinecone/Weaviate?
4. ~~**成本控制**: Smoke Test 每次调用 API 的成本如何控制?~~ ✅ 已支持 DeepSeek (低成本)

---

*Generated by Antigravity Agent · Updated 2026-01-29*
