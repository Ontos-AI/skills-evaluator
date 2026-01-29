#!/usr/bin/env python3
"""
Skill Evaluator - Visual Report Generator
==========================================
Generates elegant, tech-style HTML reports with ECharts radar visualization.
Designed to match the Anything Skills frontend color scheme.

Usage:
    python visualize.py <evaluation_report.json>
    python visualize.py <evaluation_report.json> --output report.html
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Union


# Elegant Light Theme matching Anything Skills frontend
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skill Evaluation - {skill_id}</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --a2s-ink: #0d0f0f;
            --a2s-ash: #f2efe9;
            --a2s-mint: #b7f0dc;
            --a2s-coral: #f7a38f;
            --a2s-cobalt: #1d2a52;
            --a2s-sand: #f9f5ef;
        }}
        
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        
        body {{
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: linear-gradient(180deg, #f9f5ef 0%, #f1ebe1 70%, #f5efe6 100%);
            min-height: 100vh;
            color: var(--a2s-ink);
            padding: 32px 24px;
        }}
        
        .container {{
            max-width: 800px;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 32px;
        }}
        
        .header h1 {{
            font-family: 'Fraunces', serif;
            font-size: 2rem;
            font-weight: 600;
            color: var(--a2s-ink);
            margin-bottom: 8px;
        }}
        
        .score-display {{
            font-family: 'Fraunces', serif;
            font-size: 3.5rem;
            font-weight: 700;
            color: var(--a2s-cobalt);
        }}
        
        .badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 20px;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-top: 12px;
        }}
        
        .badge-gold {{ background: linear-gradient(135deg, #ffd700, #f4c430); color: var(--a2s-ink); }}
        .badge-silver {{ background: linear-gradient(135deg, #c0c0c0, #a8a8a8); color: var(--a2s-ink); }}
        .badge-bronze {{ background: linear-gradient(135deg, var(--a2s-coral), #e8957e); color: #fff; }}
        .badge-fail {{ background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }}
        
        .card {{
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(13, 15, 15, 0.08);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 18px 40px rgba(13, 15, 15, 0.06);
        }}
        
        .card-title {{
            font-family: 'Fraunces', serif;
            font-size: 1.15rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        .radar-container {{
            width: 100%;
            height: 320px;
        }}
        
        .scores-grid {{
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 12px;
        }}
        
        @media (max-width: 600px) {{
            .scores-grid {{ grid-template-columns: repeat(2, 1fr); }}
        }}
        
        .score-item {{
            text-align: center;
            padding: 16px 12px;
            background: rgba(183, 240, 220, 0.2);
            border-radius: 16px;
            border: 1px solid rgba(183, 240, 220, 0.4);
        }}
        
        .score-item .value {{
            font-family: 'Fraunces', serif;
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--a2s-cobalt);
        }}
        
        .score-item .label {{
            font-size: 0.72rem;
            color: rgba(13, 15, 15, 0.6);
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }}
        
        .issues-list {{
            list-style: none;
        }}
        
        .issue-item {{
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            margin-bottom: 10px;
            background: var(--a2s-sand);
            border-radius: 12px;
            border-left: 3px solid;
        }}
        
        .issue-error {{ border-color: var(--a2s-coral); background: rgba(247, 163, 143, 0.1); }}
        .issue-warning {{ border-color: #f59e0b; background: rgba(245, 158, 11, 0.08); }}
        .issue-info {{ border-color: var(--a2s-cobalt); background: rgba(29, 42, 82, 0.05); }}
        
        .issue-icon {{ font-size: 1.1rem; }}
        .issue-content {{ flex: 1; }}
        
        .issue-code {{
            font-family: monospace;
            font-size: 0.75rem;
            color: rgba(13, 15, 15, 0.5);
            margin-top: 4px;
        }}
        
        .issue-suggestion {{
            font-size: 0.82rem;
            color: #059669;
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(183, 240, 220, 0.3);
            border-radius: 8px;
        }}
        
        .recommendations {{
            list-style: none;
            counter-reset: rec;
        }}
        
        .recommendations li {{
            counter-increment: rec;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid rgba(13, 15, 15, 0.06);
        }}
        
        .recommendations li:last-child {{ border-bottom: none; }}
        
        .recommendations li::before {{
            content: counter(rec);
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 26px;
            height: 26px;
            background: var(--a2s-cobalt);
            border-radius: 999px;
            font-weight: 600;
            font-size: 0.8rem;
            color: #fff;
        }}
        
        .meta {{
            font-size: 0.75rem;
            color: rgba(13, 15, 15, 0.5);
            text-align: center;
            margin-top: 32px;
        }}
        
        .meta code {{
            background: rgba(13, 15, 15, 0.06);
            padding: 2px 8px;
            border-radius: 6px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 {skill_id}</h1>
            <div class="score-display">{overall_score}</div>
            <div class="badge badge-{badge}">{badge_emoji} {badge_upper}</div>
        </div>
        
        <div class="card">
            <div class="card-title">📊 Dimension Scores</div>
            <div id="radar" class="radar-container"></div>
        </div>
        
        <div class="card">
            <div class="card-title">📈 Score Breakdown</div>
            <div class="scores-grid">
                <div class="score-item">
                    <div class="value">{structure_score}</div>
                    <div class="label">Structure</div>
                </div>
                <div class="score-item">
                    <div class="value">{triggers_score}</div>
                    <div class="label">Triggers</div>
                </div>
                <div class="score-item">
                    <div class="value">{actionability_score}</div>
                    <div class="label">Actionability</div>
                </div>
                <div class="score-item">
                    <div class="value">{tool_refs_score}</div>
                    <div class="label">Tool Refs</div>
                </div>
                <div class="score-item">
                    <div class="value">{examples_score}</div>
                    <div class="label">Examples</div>
                </div>
            </div>
        </div>
        
        {issues_section}
        
        {recommendations_section}
        
        <div class="meta">
            Evaluated at <code>{evaluated_at}</code> · Tier: <code>{tier}</code>
        </div>
    </div>
    
    <script>
        const chart = echarts.init(document.getElementById('radar'));
        const option = {{
            backgroundColor: 'transparent',
            radar: {{
                indicator: [
                    {{ name: 'Structure', max: 1 }},
                    {{ name: 'Triggers', max: 1 }},
                    {{ name: 'Actionability', max: 1 }},
                    {{ name: 'Tool Refs', max: 1 }},
                    {{ name: 'Examples', max: 1 }}
                ],
                shape: 'polygon',
                splitNumber: 4,
                radius: '70%',
                axisName: {{
                    color: 'rgba(13, 15, 15, 0.6)',
                    fontSize: 11,
                    fontFamily: 'Plus Jakarta Sans'
                }},
                splitArea: {{
                    areaStyle: {{
                        color: ['rgba(183, 240, 220, 0.05)', 'rgba(183, 240, 220, 0.1)', 
                                'rgba(183, 240, 220, 0.15)', 'rgba(183, 240, 220, 0.2)']
                    }}
                }},
                axisLine: {{
                    lineStyle: {{ color: 'rgba(13, 15, 15, 0.08)' }}
                }},
                splitLine: {{
                    lineStyle: {{ color: 'rgba(13, 15, 15, 0.08)' }}
                }}
            }},
            series: [{{
                type: 'radar',
                data: [{{
                    value: [{structure_raw}, {triggers_raw}, {actionability_raw}, {tool_refs_raw}, {examples_raw}],
                    name: 'Scores',
                    areaStyle: {{
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {{ offset: 0, color: 'rgba(29, 42, 82, 0.4)' }},
                            {{ offset: 1, color: 'rgba(183, 240, 220, 0.3)' }}
                        ])
                    }},
                    lineStyle: {{
                        color: '#1d2a52',
                        width: 2
                    }},
                    itemStyle: {{
                        color: '#1d2a52'
                    }}
                }}]
            }}]
        }};
        chart.setOption(option);
        window.addEventListener('resize', () => chart.resize());
    </script>
</body>
</html>'''


def generate_html_report(report: dict) -> str:
    """Generate HTML report from evaluation data."""
    scores = report.get("scores", {})
    issues = report.get("issues", [])
    recommendations = report.get("recommendations", [])
    badge = report.get("badge", "fail")
    
    badge_emoji = {"gold": "🥇", "silver": "🥈", "bronze": "🥉", "fail": "❌"}.get(badge, "")
    
    # Issues section
    issues_html = ""
    if issues:
        items = []
        for issue in issues:
            severity = issue.get("severity", "info")
            icon = {"error": "🔴", "warning": "🟡", "info": "🔵"}.get(severity, "")
            suggestion = ""
            if issue.get("suggestion"):
                suggestion = f'<div class="issue-suggestion">💡 {issue["suggestion"]}</div>'
            items.append(f'''
                <li class="issue-item issue-{severity}">
                    <span class="issue-icon">{icon}</span>
                    <div class="issue-content">
                        <div>{issue.get("message", "")}</div>
                        <div class="issue-code">{issue.get("code", "")}</div>
                        {suggestion}
                    </div>
                </li>
            ''')
        issues_html = f'''
        <div class="card">
            <div class="card-title">⚠️ Issues ({len(issues)})</div>
            <ul class="issues-list">{"".join(items)}</ul>
        </div>
        '''
    
    # Recommendations section
    rec_html = ""
    if recommendations:
        items = [f"<li>{rec}</li>" for rec in recommendations]
        rec_html = f'''
        <div class="card">
            <div class="card-title">💡 Recommendations</div>
            <ol class="recommendations">{"".join(items)}</ol>
        </div>
        '''
    
    return HTML_TEMPLATE.format(
        skill_id=report.get("skill_id", "Unknown"),
        overall_score=f"{scores.get('overall', 0):.2f}",
        badge=badge,
        badge_emoji=badge_emoji,
        badge_upper=badge.upper(),
        structure_score=f"{scores.get('structure', 0):.2f}",
        triggers_score=f"{scores.get('triggers', 0):.2f}",
        actionability_score=f"{scores.get('actionability', 0):.2f}",
        tool_refs_score=f"{scores.get('tool_refs', 0):.2f}",
        examples_score=f"{scores.get('examples', 0):.2f}",
        structure_raw=scores.get('structure', 0),
        triggers_raw=scores.get('triggers', 0),
        actionability_raw=scores.get('actionability', 0),
        tool_refs_raw=scores.get('tool_refs', 0),
        examples_raw=scores.get('examples', 0),
        issues_section=issues_html,
        recommendations_section=rec_html,
        evaluated_at=report.get("evaluated_at", ""),
        tier=report.get("tier", "quick"),
    )


def generate_modal_html(report: dict) -> str:
    """Generate inline modal HTML for embedding in frontend."""
    scores = report.get("scores", {})
    issues = report.get("issues", [])
    badge = report.get("badge", "fail")
    
    badge_emoji = {"gold": "🥇", "silver": "🥈", "bronze": "🥉", "fail": "❌"}.get(badge, "")
    badge_text = {"gold": "GOLD", "silver": "SILVER", "bronze": "BRONZE", "fail": "NEEDS WORK"}.get(badge, "")
    
    # Issues summary
    issues_html = ""
    if issues:
        items = []
        for issue in issues[:5]:  # Limit to 5 issues in modal
            severity = issue.get("severity", "info")
            icon = {"error": "🔴", "warning": "🟡", "info": "🔵"}.get(severity, "")
            items.append(f'<div class="eval-issue">{icon} {issue.get("message", "")}</div>')
        issues_html = "".join(items)
        if len(issues) > 5:
            issues_html += f'<div class="eval-issue-more">+{len(issues) - 5} more issues</div>'
    
    return {
        "badge": badge,
        "badge_emoji": badge_emoji,
        "badge_text": badge_text,
        "overall_score": round(scores.get("overall", 0), 2),
        "scores": {
            "structure": round(scores.get("structure", 0), 2),
            "triggers": round(scores.get("triggers", 0), 2),
            "actionability": round(scores.get("actionability", 0), 2),
            "tool_refs": round(scores.get("tool_refs", 0), 2),
            "examples": round(scores.get("examples", 0), 2),
        },
        "issues_count": len(issues),
        "issues_html": issues_html,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate visual HTML report from evaluation JSON")
    parser.add_argument("input", help="Path to evaluation_report.json or - for stdin")
    parser.add_argument("--output", "-o", help="Output HTML file path")
    args = parser.parse_args()
    
    if args.input == "-":
        data = json.load(sys.stdin)
    else:
        data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    
    html = generate_html_report(data)
    
    if args.output:
        Path(args.output).write_text(html, encoding="utf-8")
        print(f"Report saved to: {args.output}")
    else:
        # Default output path
        skill_id = data.get("skill_id", "skill")
        output_path = f"{skill_id}_report.html"
        Path(output_path).write_text(html, encoding="utf-8")
        print(f"Report saved to: {output_path}")


if __name__ == "__main__":
    main()
