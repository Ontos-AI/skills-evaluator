---
name: ontos-skill-evaluator
description: "Meta-skill by Ontos AI for evaluating Claude Skills quality. Use when you need to assess a SKILL.md file quality, validate its structure, detect common issues, or generate an evaluation report with actionable recommendations."
license: MIT
metadata:
  author: ontos-ai
  version: "1.0.0"
---

# Ontos Skill Evaluator

A meta-skill by [Ontos AI](https://github.com/Ontos-AI) that evaluates other Claude Skills through systematic quality assessment.

## Installation

```bash
npx skills add ontos-ai/skills-evaluator
```

## Quick Start

### First Time Setup

After installation, configure your LLM API key (optional, for Level 2 testing):

```bash
node scripts/setup.js
```

### Evaluate a Skill

```bash
node scripts/eval.js <path-to-skill>
```

This runs **progressive evaluation**:
1. **Level 1 (Quick Eval)** - Static analysis, no LLM required
2. **Level 2 (Smoke Test)** - LLM invocation test (requires API key)

After Level 1 passes, you'll be prompted to continue to Level 2.

### Command Options

```bash
node scripts/eval.js ./my-skill              # Interactive (recommended)
node scripts/eval.js ./my-skill --quick      # Level 1 only
node scripts/eval.js ./my-skill --smoke      # Level 2 only
node scripts/eval.js ./my-skill --full       # All levels, no prompts
node scripts/eval.js ./my-skill --ci         # CI mode, JSON output
```

### Providers

For Level 2, supported LLM providers: DeepSeek (default), Qwen, OpenAI, Claude, Ollama

```bash
node scripts/eval.js ./my-skill --provider qwen
```

## Evaluation Dimensions

### 1. Structure (20%)

| Check | Description |
|-------|-------------|
| Valid YAML frontmatter | Parseable, no duplicates |
| Required fields | `name` and `description` present |
| No illegal fields | Only `name`, `description`, optional `license` |
| Directory structure | SKILL.md at root, proper subdirs |

### 2. Trigger Quality (15%)

| Check | Description |
|-------|-------------|
| Description triggers | Clear usage contexts in description |
| Trigger phrases | Explicit trigger examples in body |
| Diversity | Multiple trigger variations |

### 3. Actionability (25%)

| Check | Description |
|-------|-------------|
| Concrete steps | Numbered or bulleted procedures |
| Tool references | Mentions scripts, APIs, or MCP tools |
| No vague language | Avoids "as needed", "if necessary" without context |

### 4. Tool Integration (20%)

| Check | Description |
|-------|-------------|
| Script references | Links to `scripts/` files |
| Reference links | Links to `references/` docs |
| Asset usage | Proper paths to `assets/` |

### 5. Example Quality (20%)

| Check | Description |
|-------|-------------|
| Non-placeholder | Uses realistic data, not `[PLACEHOLDER]` |
| Relevance | Examples match skill purpose |
| Output format | Clear expected output shown |

## Output

Evaluation generates a JSON report:

```json
{
  "skill_id": "ai-agent-trend-analysis",
  "evaluated_at": "2026-01-28T21:00:00Z",
  "tier": "quick",
  "scores": {
    "overall": 0.72,
    "structure": 0.60,
    "triggers": 0.80,
    "actionability": 0.75,
    "tool_refs": 0.70,
    "examples": 0.75
  },
  "issues": [
    {"severity": "error", "code": "DUPLICATE_FRONTMATTER", "message": "..."},
    {"severity": "warning", "code": "VAGUE_INSTRUCTION", "line": 45, "message": "..."}
  ],
  "recommendations": ["Fix duplicate frontmatter", "Add concrete examples"],
  "badge": "silver"
}
```

### Badge Levels

| Badge | Score Range | Meaning |
|-------|-------------|---------|
| 🥇 Gold | ≥0.85 | Production ready |
| 🥈 Silver | 0.70-0.84 | Good with minor issues |
| 🥉 Bronze | 0.50-0.69 | Needs improvement |
| ❌ Fail | <0.50 | Critical issues |

## Advanced Usage

### Evaluate All Skills in Directory

```bash
python scripts/quick_eval.py ../output/skills --batch
```

### Output as Markdown Report

```bash
python scripts/quick_eval.py <path> --format md
```

### Verbose Mode (Show All Checks)

```bash
python scripts/quick_eval.py <path> --verbose
```

## Integration with Skill Generation

When used after `skill-creator`, this skill validates quality before distribution:

```
User Request → skill-creator → [New SKILL.md] → skill-evaluator → [Quality Report]
                                                          ↓
                                               Fix issues if score < 0.70
```

## Future: Tier 2 Deep Benchmark (Coming Soon)

Phase 2 will add optional deep testing:
- Semantic search for matching benchmark tasks
- Integration with OSWorld, SWE-Bench, AgentBench
- LLM-as-a-Judge evaluation

Invoke with `--deep` flag when available.
