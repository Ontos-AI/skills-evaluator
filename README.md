# Ontos Skill Evaluator

<p align="center">
  <strong>🔍 Meta-skill for evaluating Claude Skills quality</strong>
</p>

<p align="center">
  <a href="https://skills.sh/ontos-ai/skills-evaluator">
    <img src="https://img.shields.io/badge/skills.sh-ontos--skill--evaluator-mint?style=for-the-badge" alt="skills.sh">
  </a>
  <a href="https://github.com/Ontos-AI/skills-evaluator/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License">
  </a>
</p>

---

## ✨ Features

- **Progressive Evaluation**: L1 (Static) → L2 (Smoke Test) → L3 (Deep, coming soon)
- **Unified Entry Point**: One command `eval.js` with interactive prompts
- **Multi-Provider Smoke Test**: DeepSeek, Qwen, OpenAI, Claude, Ollama
- **Beautiful HTML Reports**: ECharts radar visualization with elegant styling
- **Web UI**: Browser-based evaluation at [eval.skills.sh](https://eval.skills.sh)
- **Badge System**: 🥇 Gold / 🥈 Silver / 🥉 Bronze / ❌ Fail

## 📦 Installation

```bash
npx skills add ontos-ai/skills-evaluator
```

## 🚀 Quick Start

### 1. Setup API Key (Optional, for Smoke Test)

```bash
node scripts/setup.js
```

### 2. Evaluate a Skill

```bash
# Interactive (recommended) - automatically prompts for L2
node scripts/eval.js ./my-skill

# Quick static analysis only
node scripts/eval.js ./my-skill --quick

# Full evaluation without prompts
node scripts/eval.js ./my-skill --full

# CI mode with JSON output
node scripts/eval.js ./my-skill --ci
```

### 3. View Reports

Reports are automatically saved to `test-reports/`:
- `skill_name_timestamp.html` - Visual report with radar chart
- `skill_name_timestamp.json` - Machine-readable data

## 🧪 Evaluation Levels

| Level | Name | Requires | What it tests |
|-------|------|----------|---------------|
| **L1** | Quick Eval | Nothing | Structure, triggers, actionability, examples |
| **L2** | Smoke Test | API Key | Can LLM actually trigger this skill? |
| **L3** | Deep Eval | Coming | Benchmark matching, execution test |

## 📊 Evaluation Dimensions (L1)

| Dimension | Weight | What it checks |
|-----------|--------|----------------|
| **Structure** | 20% | YAML frontmatter, required fields, directory layout |
| **Triggers** | 15% | Usage context, trigger phrases, description quality |
| **Actionability** | 25% | Procedural steps, code blocks, imperative language |
| **Tool References** | 20% | Script links, MCP tools, command examples |
| **Examples** | 20% | Real examples, output format, no placeholders |

## 🏆 Badge Levels

| Badge | Score Range | Meaning |
|-------|-------------|---------|
| 🥇 Gold | ≥0.85 | Production ready |
| 🥈 Silver | 0.70-0.84 | Good with minor issues |
| 🥉 Bronze | 0.50-0.69 | Needs improvement |
| ❌ Fail | <0.50 | Critical issues |

## 🌐 Web UI

Try the online evaluator (no installation required):

```
https://eval.skills.sh
```

Or run locally:

```bash
cd web && npm install && npm run dev
# Open http://localhost:3000
```

## 📄 Sample Output

```json
{
  "skill_id": "my-awesome-skill",
  "badge": "silver",
  "scores": {
    "overall": 0.72,
    "structure": 0.80,
    "triggers": 0.60,
    "actionability": 0.75,
    "tool_refs": 0.70,
    "examples": 0.75
  },
  "issues": [...],
  "recommendations": [...]
}
```

## 🛠️ Advanced Usage

### Individual Scripts

```bash
# Static analysis only
node scripts/quick_eval.js ./my-skill --format html

# Smoke test only
node scripts/smoke_test.js ./my-skill --provider qwen

# Preview prompts without LLM
node scripts/smoke_test.js ./my-skill --extract-only
```

### Batch Evaluation

```bash
node scripts/quick_eval.js ./skills-directory --batch
```

## 🔗 Links

- [skills.sh](https://skills.sh/ontos-ai/skills-evaluator)
- [Ontos AI GitHub](https://github.com/Ontos-AI)

## 📜 License

MIT © [Ontos AI](https://github.com/Ontos-AI)
