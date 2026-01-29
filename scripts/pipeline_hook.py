"""
Skill Evaluator - Pipeline Integration Hook
=============================================
Integrates skill evaluation into the anything-skills generation pipeline.

Usage:
    from skills.skill_evaluator.scripts.pipeline_hook import evaluate_generated_skill, SkillQualityGate

    # After generating a skill
    skill_path = Path("output/skills/my-new-skill")
    result = evaluate_generated_skill(skill_path)
    
    if result.passed:
        print(f"Skill passed with score {result.score}")
    else:
        print(f"Skill needs improvement: {result.issues}")
"""

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from quick_eval import evaluate_skill, EvaluationReport


@dataclass
class SkillQualityResult:
    """Result of skill quality evaluation."""
    passed: bool
    score: float
    badge: str
    issues: List[str]
    recommendations: List[str]
    report: EvaluationReport
    html_report_path: Optional[Path] = None


class SkillQualityGate:
    """
    Quality gate for evaluating generated skills.
    
    Usage:
        gate = SkillQualityGate(min_score=0.6, generate_report=True)
        result = gate.evaluate(skill_path)
    """
    
    def __init__(
        self, 
        min_score: float = 0.5,
        generate_report: bool = True,
        report_output_dir: Optional[Path] = None
    ):
        """
        Initialize quality gate.
        
        Args:
            min_score: Minimum overall score to pass (0.0-1.0)
            generate_report: Whether to generate HTML visual report
            report_output_dir: Where to save HTML reports (default: skill's parent dir)
        """
        self.min_score = min_score
        self.generate_report = generate_report
        self.report_output_dir = report_output_dir
    
    def evaluate(self, skill_path: Path) -> SkillQualityResult:
        """
        Evaluate a skill and return quality result.
        
        Args:
            skill_path: Path to skill directory containing SKILL.md
            
        Returns:
            SkillQualityResult with pass/fail status and details
        """
        skill_path = Path(skill_path).resolve()
        report = evaluate_skill(skill_path)
        
        # Determine pass/fail
        passed = report.scores.overall >= self.min_score
        
        # Extract issue messages
        issues = []
        for issue in report.issues:
            if hasattr(issue, 'message'):
                issues.append(f"[{issue.severity.upper()}] {issue.message}")
            elif isinstance(issue, dict):
                issues.append(f"[{issue['severity'].upper()}] {issue['message']}")
        
        result = SkillQualityResult(
            passed=passed,
            score=round(report.scores.overall, 2),
            badge=report.badge,
            issues=issues,
            recommendations=report.recommendations,
            report=report,
        )
        
        # Generate HTML report if requested
        if self.generate_report:
            try:
                from visualize import generate_html_report
                
                html_content = generate_html_report(report.to_dict())
                
                if self.report_output_dir:
                    output_dir = Path(self.report_output_dir)
                else:
                    output_dir = skill_path.parent
                
                output_dir.mkdir(parents=True, exist_ok=True)
                html_path = output_dir / f"{report.skill_id}_report.html"
                html_path.write_text(html_content, encoding="utf-8")
                result.html_report_path = html_path
                
            except Exception as e:
                # Don't fail evaluation just because report generation failed
                print(f"Warning: Failed to generate HTML report: {e}")
        
        return result


def evaluate_generated_skill(
    skill_path: Path,
    min_score: float = 0.5,
    generate_report: bool = True
) -> SkillQualityResult:
    """
    Convenience function to evaluate a generated skill.
    
    Args:
        skill_path: Path to skill directory
        min_score: Minimum score to pass (default: 0.5)
        generate_report: Whether to generate HTML report
        
    Returns:
        SkillQualityResult
    """
    gate = SkillQualityGate(
        min_score=min_score,
        generate_report=generate_report
    )
    return gate.evaluate(skill_path)


# Async wrapper for pipeline integration
async def async_evaluate_skill(skill_path: Path, min_score: float = 0.5) -> SkillQualityResult:
    """Async wrapper for skill evaluation (runs synchronously internally)."""
    return evaluate_generated_skill(skill_path, min_score)


if __name__ == "__main__":
    # Test the hook
    import sys
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        result = evaluate_generated_skill(path)
        print(f"Score: {result.score} | Badge: {result.badge} | Passed: {result.passed}")
        if result.html_report_path:
            print(f"Report: {result.html_report_path}")
        if not result.passed:
            print("Issues:")
            for issue in result.issues[:5]:
                print(f"  - {issue}")
