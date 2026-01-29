#!/usr/bin/env python3
"""
Skill Evaluator - Quick Eval Engine
====================================
Evaluates Claude Skills for quality, structure, and effectiveness.

Usage:
    python quick_eval.py <skill_path>
    python quick_eval.py <skill_path> --format md
    python quick_eval.py <skills_dir> --batch
    python quick_eval.py <skill_path> --verbose
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class Issue:
    severity: str  # "error" | "warning" | "info"
    code: str
    message: str
    line: Optional[int] = None
    suggestion: Optional[str] = None


@dataclass
class Scores:
    structure: float = 0.0
    triggers: float = 0.0
    actionability: float = 0.0
    tool_refs: float = 0.0
    examples: float = 0.0

    @property
    def overall(self) -> float:
        """Weighted average: structure 20%, triggers 15%, actionability 25%, tool_refs 20%, examples 20%"""
        return (
            self.structure * 0.20 +
            self.triggers * 0.15 +
            self.actionability * 0.25 +
            self.tool_refs * 0.20 +
            self.examples * 0.20
        )


@dataclass
class EvaluationReport:
    skill_id: str
    skill_path: str
    evaluated_at: str
    tier: str = "quick"
    scores: Scores = field(default_factory=Scores)
    issues: list = field(default_factory=list)
    recommendations: list = field(default_factory=list)
    badge: str = "fail"

    def to_dict(self) -> dict:
        return {
            "skill_id": self.skill_id,
            "skill_path": self.skill_path,
            "evaluated_at": self.evaluated_at,
            "tier": self.tier,
            "scores": {
                "overall": round(self.scores.overall, 2),
                "structure": round(self.scores.structure, 2),
                "triggers": round(self.scores.triggers, 2),
                "actionability": round(self.scores.actionability, 2),
                "tool_refs": round(self.scores.tool_refs, 2),
                "examples": round(self.scores.examples, 2),
            },
            "issues": [asdict(i) if isinstance(i, Issue) else i for i in self.issues],
            "recommendations": self.recommendations,
            "badge": self.badge,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)

    def to_markdown(self) -> str:
        badge_emoji = {"gold": "🥇", "silver": "🥈", "bronze": "🥉", "fail": "❌"}
        lines = [
            f"# Skill Evaluation Report: {self.skill_id}",
            "",
            f"**Badge**: {badge_emoji.get(self.badge, '')} {self.badge.upper()}",
            f"**Overall Score**: {self.scores.overall:.2f}",
            f"**Evaluated**: {self.evaluated_at}",
            "",
            "## Scores",
            "",
            "| Dimension | Score | Weight |",
            "|-----------|-------|--------|",
            f"| Structure | {self.scores.structure:.2f} | 20% |",
            f"| Triggers | {self.scores.triggers:.2f} | 15% |",
            f"| Actionability | {self.scores.actionability:.2f} | 25% |",
            f"| Tool References | {self.scores.tool_refs:.2f} | 20% |",
            f"| Examples | {self.scores.examples:.2f} | 20% |",
            "",
        ]

        if self.issues:
            lines.append("## Issues")
            lines.append("")
            for issue in self.issues:
                i = issue if isinstance(issue, dict) else asdict(issue)
                severity_icon = {"error": "🔴", "warning": "🟡", "info": "🔵"}.get(i["severity"], "")
                line_info = f" (line {i['line']})" if i.get("line") else ""
                lines.append(f"- {severity_icon} **{i['code']}**{line_info}: {i['message']}")
                if i.get("suggestion"):
                    lines.append(f"  - 💡 {i['suggestion']}")
            lines.append("")

        if self.recommendations:
            lines.append("## Recommendations")
            lines.append("")
            for idx, rec in enumerate(self.recommendations, 1):
                lines.append(f"{idx}. {rec}")
            lines.append("")

        return "\n".join(lines)


# =============================================================================
# YAML Frontmatter Parser (minimal, no external deps)
# =============================================================================

def parse_frontmatter(content: str) -> tuple[dict | None, str, list[Issue]]:
    """Parse YAML frontmatter from SKILL.md content."""
    issues = []
    
    # Check for frontmatter delimiters
    if not content.startswith("---"):
        issues.append(Issue("error", "NO_FRONTMATTER", "SKILL.md must start with YAML frontmatter (---)"))
        return None, content, issues

    # Find closing delimiter
    parts = content.split("---", 2)
    if len(parts) < 3:
        issues.append(Issue("error", "MALFORMED_FRONTMATTER", "Missing closing --- for frontmatter"))
        return None, content, issues

    frontmatter_text = parts[1].strip()
    body = parts[2].strip() if len(parts) > 2 else ""

    # Check for duplicate frontmatter (common error)
    if body.startswith("---"):
        issues.append(Issue("error", "DUPLICATE_FRONTMATTER", 
                           "Duplicate YAML frontmatter block detected",
                           suggestion="Remove the duplicate --- block"))

    # Simple YAML parsing (key: value)
    frontmatter = {}
    for line_num, line in enumerate(frontmatter_text.split("\n"), start=2):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            frontmatter[key] = value

    return frontmatter, body, issues


# =============================================================================
# Evaluation Checks
# =============================================================================

def check_structure(skill_path: Path, frontmatter: dict | None, body: str, issues: list[Issue]) -> float:
    """Check structural integrity. Returns score 0-1."""
    score = 1.0
    deductions = []

    # Check SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        issues.append(Issue("error", "NO_SKILL_MD", f"SKILL.md not found in {skill_path}"))
        return 0.0

    # Check frontmatter
    if frontmatter is None:
        return 0.0  # Already logged as error

    # Required fields
    if "name" not in frontmatter:
        issues.append(Issue("error", "MISSING_NAME", "Frontmatter missing required 'name' field"))
        deductions.append(0.3)
    
    if "description" not in frontmatter:
        issues.append(Issue("error", "MISSING_DESCRIPTION", "Frontmatter missing required 'description' field"))
        deductions.append(0.3)

    # Check for illegal fields
    allowed_fields = {"name", "description", "license", "tags"}
    for key in frontmatter:
        if key not in allowed_fields:
            issues.append(Issue("warning", "EXTRA_FIELD", 
                               f"Frontmatter contains non-standard field: '{key}'",
                               suggestion=f"Remove '{key}' or move to body"))
            deductions.append(0.05)

    # Check directory structure
    expected_dirs = ["scripts", "references", "assets"]
    existing_resources = []
    for d in expected_dirs:
        if (skill_path / d).exists():
            existing_resources.append(d)
    
    # Not having subdirs is fine, just informational
    if not existing_resources:
        issues.append(Issue("info", "NO_RESOURCES", 
                           "No scripts/, references/, or assets/ directories found",
                           suggestion="Consider adding bundled resources if applicable"))

    return max(0.0, score - sum(deductions))


def check_triggers(frontmatter: dict | None, body: str, issues: list[Issue]) -> float:
    """Check trigger quality. Returns score 0-1."""
    score = 0.0

    if frontmatter is None:
        return 0.0

    description = frontmatter.get("description", "")
    
    # Check description has usage context
    usage_keywords = ["use when", "use for", "triggers", "invoke", "activate", "call this"]
    has_usage_context = any(kw in description.lower() for kw in usage_keywords)
    
    if has_usage_context:
        score += 0.4
    else:
        issues.append(Issue("warning", "NO_USAGE_CONTEXT",
                           "Description lacks clear usage context (e.g., 'Use when...')",
                           suggestion="Add 'Use when...' clause to description"))

    # Check description length (too short = vague)
    if len(description) < 50:
        issues.append(Issue("warning", "SHORT_DESCRIPTION",
                           f"Description is only {len(description)} chars, may be too vague",
                           suggestion="Expand description to at least 50 characters"))
    else:
        score += 0.2

    # Check for explicit trigger phrases in body
    trigger_patterns = [
        r"##?\s*(trigger|usage|invoke|activate)",
        r"\*.*trigger.*\*",
        r'"[^"]*"',  # Quoted phrases often are triggers
    ]
    
    has_trigger_section = False
    for pattern in trigger_patterns:
        if re.search(pattern, body, re.IGNORECASE):
            has_trigger_section = True
            break

    if has_trigger_section:
        score += 0.4
    else:
        issues.append(Issue("info", "NO_TRIGGER_EXAMPLES",
                           "No explicit trigger phrase examples found in body",
                           suggestion="Add example trigger phrases like '\"analyze this data\"'"))

    return min(1.0, score)


def check_actionability(body: str, issues: list[Issue]) -> float:
    """Check if instructions are actionable. Returns score 0-1."""
    score = 0.0

    # Check for numbered/bulleted steps
    step_patterns = [
        r"^\d+\.\s+",        # 1. Step
        r"^-\s+",            # - Step
        r"^\*\s+",           # * Step
        r"^#{1,3}\s+Step",   # ## Step
    ]
    
    has_steps = False
    for pattern in step_patterns:
        if re.search(pattern, body, re.MULTILINE):
            has_steps = True
            break

    if has_steps:
        score += 0.35
    else:
        issues.append(Issue("warning", "NO_STEPS",
                           "No numbered or bulleted procedural steps found",
                           suggestion="Add step-by-step instructions"))

    # Check for code blocks (concrete examples)
    code_blocks = re.findall(r"```[\s\S]*?```", body)
    if code_blocks:
        score += 0.25
    else:
        issues.append(Issue("info", "NO_CODE_BLOCKS",
                           "No code blocks found",
                           suggestion="Add code examples for concrete guidance"))

    # Check for vague language
    vague_phrases = [
        "as needed", "if necessary", "when appropriate", 
        "as applicable", "etc.", "and so on", "various"
    ]
    vague_count = sum(1 for phrase in vague_phrases if phrase in body.lower())
    
    if vague_count > 3:
        issues.append(Issue("warning", "VAGUE_LANGUAGE",
                           f"Found {vague_count} vague phrases that reduce clarity",
                           suggestion="Replace vague language with specific guidance"))
        score -= 0.1 * min(vague_count, 3)
    else:
        score += 0.2

    # Check for imperative verbs (good instructions use them)
    imperative_verbs = ["run", "execute", "create", "add", "remove", "update", "check", "verify", "use"]
    imperative_count = sum(1 for verb in imperative_verbs if re.search(rf"\b{verb}\b", body, re.IGNORECASE))
    
    if imperative_count >= 3:
        score += 0.2
    elif imperative_count == 0:
        issues.append(Issue("info", "FEW_IMPERATIVES",
                           "Few imperative verbs found (run, create, check, etc.)",
                           suggestion="Use more action-oriented language"))

    return max(0.0, min(1.0, score))


def check_tool_refs(skill_path: Path, body: str, issues: list[Issue]) -> float:
    """Check tool/resource integration. Returns score 0-1."""
    score = 0.0

    # Check for script references
    script_refs = re.findall(r"scripts?/[\w\-\.]+", body)
    scripts_dir = skill_path / "scripts"
    
    if scripts_dir.exists() and list(scripts_dir.glob("*")):
        score += 0.3
        # Verify referenced scripts exist
        for ref in script_refs:
            ref_path = skill_path / ref
            if not ref_path.exists():
                issues.append(Issue("error", "BROKEN_SCRIPT_REF",
                                   f"Referenced script not found: {ref}",
                                   suggestion=f"Create {ref} or fix the reference"))
    elif script_refs:
        issues.append(Issue("error", "SCRIPTS_DIR_MISSING",
                           f"Script references found but scripts/ directory missing"))

    # Check for reference doc links
    ref_patterns = [r"references?/[\w\-\.]+", r"\[.*\]\(.*\.md\)"]
    has_doc_refs = any(re.search(p, body) for p in ref_patterns)
    
    if has_doc_refs:
        score += 0.3
    
    # Check for MCP / tool mentions
    tool_keywords = ["mcp", "tool", "api", "endpoint", "function", "command"]
    tool_mentions = sum(1 for kw in tool_keywords if kw in body.lower())
    
    if tool_mentions >= 2:
        score += 0.2
    
    # Check for command examples
    if re.search(r"```(?:bash|shell|sh|zsh)", body):
        score += 0.2

    # If no tool integration at all, it's okay for simple skills
    if score == 0:
        issues.append(Issue("info", "NO_TOOL_REFS",
                           "No tool, script, or API references found",
                           suggestion="Consider adding bundled scripts or tool guidance"))
        score = 0.5  # Neutral score for simple skills

    return min(1.0, score)


def check_examples(body: str, issues: list[Issue]) -> float:
    """Check example quality. Returns score 0-1."""
    score = 0.0

    # Check for placeholder text
    placeholder_patterns = [
        r"\[placeholder\]", r"\[todo\]", r"\[tbd\]", r"\[fill in\]",
        r"xxx", r"FIXME", r"TODO", r"<your.*>", r"\.\.\."
    ]
    
    placeholder_count = 0
    for pattern in placeholder_patterns:
        matches = re.findall(pattern, body, re.IGNORECASE)
        placeholder_count += len(matches)

    if placeholder_count == 0:
        score += 0.4
    elif placeholder_count <= 2:
        issues.append(Issue("warning", "PLACEHOLDERS_FOUND",
                           f"Found {placeholder_count} placeholder(s)",
                           suggestion="Replace placeholders with real examples"))
        score += 0.2
    else:
        issues.append(Issue("error", "MANY_PLACEHOLDERS",
                           f"Found {placeholder_count} placeholders - skill may be incomplete"))

    # Check for example sections
    example_patterns = [r"##?\s*example", r"##?\s*sample", r"##?\s*demo"]
    has_example_section = any(re.search(p, body, re.IGNORECASE) for p in example_patterns)
    
    if has_example_section:
        score += 0.3
    else:
        issues.append(Issue("info", "NO_EXAMPLE_SECTION",
                           "No dedicated Examples section found"))

    # Check for output format examples
    output_patterns = [r"##?\s*output", r"```json", r"```yaml", r"\|.*\|.*\|"]
    has_output_format = any(re.search(p, body) for p in output_patterns)
    
    if has_output_format:
        score += 0.3
    else:
        issues.append(Issue("info", "NO_OUTPUT_FORMAT",
                           "No clear output format specification",
                           suggestion="Add example output to show expected results"))

    return min(1.0, score)


# =============================================================================
# Main Evaluation
# =============================================================================

def evaluate_skill(skill_path: Path, verbose: bool = False) -> EvaluationReport:
    """Run Quick Eval on a skill and return report."""
    skill_path = Path(skill_path).resolve()
    
    # Initialize report
    report = EvaluationReport(
        skill_id=skill_path.name,
        skill_path=str(skill_path),
        evaluated_at=datetime.utcnow().isoformat() + "Z",
    )

    # Read SKILL.md
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        report.issues.append(Issue("error", "NO_SKILL_MD", f"SKILL.md not found in {skill_path}"))
        report.badge = "fail"
        return report

    content = skill_md.read_text(encoding="utf-8")
    frontmatter, body, parse_issues = parse_frontmatter(content)
    report.issues.extend(parse_issues)

    # Run checks
    report.scores.structure = check_structure(skill_path, frontmatter, body, report.issues)
    report.scores.triggers = check_triggers(frontmatter, body, report.issues)
    report.scores.actionability = check_actionability(body, report.issues)
    report.scores.tool_refs = check_tool_refs(skill_path, body, report.issues)
    report.scores.examples = check_examples(body, report.issues)

    # Determine badge
    overall = report.scores.overall
    if overall >= 0.85:
        report.badge = "gold"
    elif overall >= 0.70:
        report.badge = "silver"
    elif overall >= 0.50:
        report.badge = "bronze"
    else:
        report.badge = "fail"

    # Generate recommendations (prioritized by issue severity)
    error_codes = [i.code for i in report.issues if isinstance(i, Issue) and i.severity == "error"]
    warning_codes = [i.code for i in report.issues if isinstance(i, Issue) and i.severity == "warning"]

    if "DUPLICATE_FRONTMATTER" in error_codes:
        report.recommendations.append("Remove duplicate YAML frontmatter block (critical)")
    if "MISSING_NAME" in error_codes or "MISSING_DESCRIPTION" in error_codes:
        report.recommendations.append("Add required 'name' and 'description' fields to frontmatter")
    if "NO_USAGE_CONTEXT" in warning_codes:
        report.recommendations.append("Add 'Use when...' clause to description for better triggering")
    if "NO_STEPS" in warning_codes:
        report.recommendations.append("Add numbered procedural steps for better actionability")
    if "MANY_PLACEHOLDERS" in error_codes or "PLACEHOLDERS_FOUND" in warning_codes:
        report.recommendations.append("Replace placeholder text with real examples")

    return report


def evaluate_batch(skills_dir: Path, verbose: bool = False) -> list[EvaluationReport]:
    """Evaluate all skills in a directory."""
    reports = []
    for skill_path in skills_dir.iterdir():
        if skill_path.is_dir() and (skill_path / "SKILL.md").exists():
            report = evaluate_skill(skill_path, verbose)
            reports.append(report)
    return reports


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Skill Evaluator - Quick Eval Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python quick_eval.py ../output/skills/ai-agent-trend-analysis
  python quick_eval.py ../output/skills --batch
  python quick_eval.py ../output/skills/skill-creator --format md
  python quick_eval.py ../output/skills/skill-creator --format html
        """
    )
    parser.add_argument("path", help="Path to skill directory or parent directory for batch")
    parser.add_argument("--batch", action="store_true", help="Evaluate all skills in directory")
    parser.add_argument("--format", choices=["json", "md", "html"], default="json", help="Output format")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all checks")
    parser.add_argument("--output", "-o", help="Output file path (default: stdout)")

    args = parser.parse_args()
    path = Path(args.path).resolve()

    if not path.exists():
        print(f"Error: Path not found: {path}", file=sys.stderr)
        sys.exit(1)

    # Import visualize for HTML output
    try:
        from visualize import generate_html_report
    except ImportError:
        # Fallback for when run as module
        import importlib.util
        spec = importlib.util.spec_from_file_location("visualize", Path(__file__).parent / "visualize.py")
        visualize = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(visualize)
        generate_html_report = visualize.generate_html_report

    if args.batch:
        reports = evaluate_batch(path, args.verbose)
        if args.format == "json":
            output = json.dumps([r.to_dict() for r in reports], indent=2, ensure_ascii=False)
        elif args.format == "html":
            # For batch, generate combined HTML or multiple files
            output = "\n<!-- BATCH SEPARATOR -->\n".join(
                generate_html_report(r.to_dict()) for r in reports
            )
        else:
            output = "\n\n---\n\n".join(r.to_markdown() for r in reports)
    else:
        report = evaluate_skill(path, args.verbose)
        if args.format == "json":
            output = report.to_json()
        elif args.format == "html":
            output = generate_html_report(report.to_dict())
        else:
            output = report.to_markdown()

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    elif args.format == "html" and not args.batch:
        output_path = path.parent / f"{report.skill_id}_report.html"
    else:
        output_path = None

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output, encoding="utf-8")
        print(f"Report written to: {output_path}")
    else:
        print(output)

    # Exit with error code if any skill failed
    if args.batch:
        if any(r.badge == "fail" for r in reports):
            sys.exit(1)
    else:
        if report.badge == "fail":
            sys.exit(1)


if __name__ == "__main__":
    main()
