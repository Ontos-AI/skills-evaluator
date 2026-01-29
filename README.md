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

- **5-Dimension Evaluation**: Structure, Triggers, Actionability, Tool References, Examples
- **Beautiful HTML Reports**: ECharts radar visualization with elegant styling
- **Zero Dependencies**: Works directly with `npx skills add`
- **Dual Language Support**: Node.js for distribution, Python for local development
- **Badge System**: 🥇 Gold / 🥈 Silver / 🥉 Bronze / ❌ Fail

## 📦 Installation

```bash
npx skills add ontos-ai/skills-evaluator
```

## 🚀 Usage

### Evaluate a Single Skill

```bash
# JSON output (default)
node scripts/quick_eval.js ./my-skill

# Markdown report
node scripts/quick_eval.js ./my-skill --format md

# HTML report with radar chart
node scripts/quick_eval.js ./my-skill --format html -o report.html
```

### Batch Evaluation

```bash
node scripts/quick_eval.js ./skills-directory --batch
```

### Python (Local Development)

```bash
python scripts/quick_eval.py ./my-skill --format html
```

## 📊 Evaluation Dimensions

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

## 🔗 Links

- [skills.sh](https://skills.sh/ontos-ai/skills-evaluator)
- [Ontos AI GitHub](https://github.com/Ontos-AI)

## 📜 License

MIT © [Ontos AI](https://github.com/Ontos-AI)
