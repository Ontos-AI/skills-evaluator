#!/usr/bin/env node
/**
 * Ontos Skill Evaluator - Quick Eval Engine (Node.js)
 * ====================================================
 * Evaluates Claude Skills for quality, structure, and effectiveness.
 * Zero external dependencies - works with npx skills add.
 * 
 * Usage:
 *     node quick_eval.js <skill_path>
 *     node quick_eval.js <skill_path> --format md
 *     node quick_eval.js <skill_path> --format html
 *     node quick_eval.js <skills_dir> --batch
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Data Models
// =============================================================================

function createIssue(severity, code, message, line = null, suggestion = null) {
    return { severity, code, message, line, suggestion };
}

function createScores() {
    return {
        structure: 0,
        triggers: 0,
        actionability: 0,
        tool_refs: 0,
        examples: 0,
        get overall() {
            return (
                this.structure * 0.20 +
                this.triggers * 0.15 +
                this.actionability * 0.25 +
                this.tool_refs * 0.20 +
                this.examples * 0.20
            );
        }
    };
}

function createReport(skillId, skillPath) {
    return {
        skill_id: skillId,
        skill_path: skillPath,
        evaluated_at: new Date().toISOString(),
        tier: 'quick',
        scores: createScores(),
        issues: [],
        recommendations: [],
        badge: 'fail'
    };
}

// =============================================================================
// YAML Frontmatter Parser
// =============================================================================

function parseFrontmatter(content) {
    const issues = [];

    if (!content.startsWith('---')) {
        issues.push(createIssue('error', 'NO_FRONTMATTER', 'SKILL.md must start with YAML frontmatter (---)'));
        return { frontmatter: null, body: content, issues };
    }

    const parts = content.split('---');
    if (parts.length < 3) {
        issues.push(createIssue('error', 'MALFORMED_FRONTMATTER', 'Missing closing --- for frontmatter'));
        return { frontmatter: null, body: content, issues };
    }

    const frontmatterText = parts[1].trim();
    const body = parts.slice(2).join('---').trim();

    // Check for duplicate frontmatter
    if (body.startsWith('---')) {
        issues.push(createIssue('error', 'DUPLICATE_FRONTMATTER',
            'Duplicate YAML frontmatter block detected',
            null, 'Remove the duplicate --- block'));
    }

    // Simple YAML parsing
    const frontmatter = {};
    for (const line of frontmatterText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmed.slice(0, colonIndex).trim();
            let value = trimmed.slice(colonIndex + 1).trim();
            value = value.replace(/^["']|["']$/g, '');
            frontmatter[key] = value;
        }
    }

    return { frontmatter, body, issues };
}

// =============================================================================
// Evaluation Checks
// =============================================================================

function checkStructure(skillPath, frontmatter, body, issues) {
    let score = 1.0;
    const deductions = [];

    const skillMd = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
        issues.push(createIssue('error', 'NO_SKILL_MD', `SKILL.md not found in ${skillPath}`));
        return 0;
    }

    if (!frontmatter) return 0;

    if (!frontmatter.name) {
        issues.push(createIssue('error', 'MISSING_NAME', "Frontmatter missing required 'name' field"));
        deductions.push(0.3);
    }

    if (!frontmatter.description) {
        issues.push(createIssue('error', 'MISSING_DESCRIPTION', "Frontmatter missing required 'description' field"));
        deductions.push(0.3);
    }

    const allowedFields = new Set(['name', 'description', 'license', 'tags']);
    for (const key of Object.keys(frontmatter)) {
        if (!allowedFields.has(key)) {
            issues.push(createIssue('warning', 'EXTRA_FIELD',
                `Frontmatter contains non-standard field: '${key}'`,
                null, `Remove '${key}' or move to body`));
            deductions.push(0.05);
        }
    }

    const expectedDirs = ['scripts', 'references', 'assets'];
    const existingResources = expectedDirs.filter(d => fs.existsSync(path.join(skillPath, d)));

    if (existingResources.length === 0) {
        issues.push(createIssue('info', 'NO_RESOURCES',
            'No scripts/, references/, or assets/ directories found',
            null, 'Consider adding bundled resources if applicable'));
    }

    return Math.max(0, score - deductions.reduce((a, b) => a + b, 0));
}

function checkTriggers(frontmatter, body, issues) {
    let score = 0;
    if (!frontmatter) return 0;

    const description = frontmatter.description || '';

    const usageKeywords = ['use when', 'use for', 'triggers', 'invoke', 'activate', 'call this'];
    const hasUsageContext = usageKeywords.some(kw => description.toLowerCase().includes(kw));

    if (hasUsageContext) {
        score += 0.4;
    } else {
        issues.push(createIssue('warning', 'NO_USAGE_CONTEXT',
            "Description lacks clear usage context (e.g., 'Use when...')",
            null, "Add 'Use when...' clause to description"));
    }

    if (description.length < 50) {
        issues.push(createIssue('warning', 'SHORT_DESCRIPTION',
            `Description is only ${description.length} chars, may be too vague`,
            null, 'Expand description to at least 50 characters'));
    } else {
        score += 0.2;
    }

    const triggerPatterns = [
        /##?\s*(trigger|usage|invoke|activate)/i,
        /\*.*trigger.*\*/i,
        /"[^"]*"/
    ];

    const hasTriggerSection = triggerPatterns.some(p => p.test(body));
    if (hasTriggerSection) {
        score += 0.4;
    } else {
        issues.push(createIssue('info', 'NO_TRIGGER_EXAMPLES',
            'No explicit trigger phrase examples found in body',
            null, 'Add example trigger phrases like \'"analyze this data"\''));
    }

    return Math.min(1, score);
}

function checkActionability(body, issues) {
    let score = 0;

    const stepPatterns = [
        /^\d+\.\s+/m,
        /^-\s+/m,
        /^\*\s+/m,
        /^#{1,3}\s+Step/m
    ];

    const hasSteps = stepPatterns.some(p => p.test(body));
    if (hasSteps) {
        score += 0.35;
    } else {
        issues.push(createIssue('warning', 'NO_STEPS',
            'No numbered or bulleted procedural steps found',
            null, 'Add step-by-step instructions'));
    }

    const codeBlocks = body.match(/```[\s\S]*?```/g);
    if (codeBlocks && codeBlocks.length > 0) {
        score += 0.25;
    } else {
        issues.push(createIssue('info', 'NO_CODE_BLOCKS',
            'No code blocks found',
            null, 'Add code examples for concrete guidance'));
    }

    const vaguePhrases = ['as needed', 'if necessary', 'when appropriate', 'as applicable', 'etc.', 'and so on', 'various'];
    const vagueCount = vaguePhrases.filter(phrase => body.toLowerCase().includes(phrase)).length;

    if (vagueCount > 3) {
        issues.push(createIssue('warning', 'VAGUE_LANGUAGE',
            `Found ${vagueCount} vague phrases that reduce clarity`,
            null, 'Replace vague language with specific guidance'));
        score -= 0.1 * Math.min(vagueCount, 3);
    } else {
        score += 0.2;
    }

    const imperativeVerbs = ['run', 'execute', 'create', 'add', 'remove', 'update', 'check', 'verify', 'use'];
    const imperativeCount = imperativeVerbs.filter(verb =>
        new RegExp(`\\b${verb}\\b`, 'i').test(body)
    ).length;

    if (imperativeCount >= 3) {
        score += 0.2;
    } else if (imperativeCount === 0) {
        issues.push(createIssue('info', 'FEW_IMPERATIVES',
            'Few imperative verbs found (run, create, check, etc.)',
            null, 'Use more action-oriented language'));
    }

    return Math.max(0, Math.min(1, score));
}

function checkToolRefs(skillPath, body, issues) {
    let score = 0;

    const scriptRefs = body.match(/scripts?\/[\w\-\.]+/g) || [];
    const scriptsDir = path.join(skillPath, 'scripts');

    if (fs.existsSync(scriptsDir)) {
        const scripts = fs.readdirSync(scriptsDir).filter(f => !f.startsWith('.'));
        if (scripts.length > 0) {
            score += 0.3;
            for (const ref of scriptRefs) {
                const refPath = path.join(skillPath, ref);
                if (!fs.existsSync(refPath)) {
                    issues.push(createIssue('error', 'BROKEN_SCRIPT_REF',
                        `Referenced script not found: ${ref}`,
                        null, `Create ${ref} or fix the reference`));
                }
            }
        }
    } else if (scriptRefs.length > 0) {
        issues.push(createIssue('error', 'SCRIPTS_DIR_MISSING',
            'Script references found but scripts/ directory missing'));
    }

    const refPatterns = [/references?\/[\w\-\.]+/, /\[.*\]\(.*\.md\)/];
    const hasDocRefs = refPatterns.some(p => p.test(body));
    if (hasDocRefs) score += 0.3;

    const toolKeywords = ['mcp', 'tool', 'api', 'endpoint', 'function', 'command'];
    const toolMentions = toolKeywords.filter(kw => body.toLowerCase().includes(kw)).length;
    if (toolMentions >= 2) score += 0.2;

    if (/```(?:bash|shell|sh|zsh)/.test(body)) score += 0.2;

    if (score === 0) {
        issues.push(createIssue('info', 'NO_TOOL_REFS',
            'No tool, script, or API references found',
            null, 'Consider adding bundled scripts or tool guidance'));
        score = 0.5;
    }

    return Math.min(1, score);
}

function checkExamples(body, issues) {
    let score = 0;

    const placeholderPatterns = [
        /\[placeholder\]/i, /\[todo\]/i, /\[tbd\]/i, /\[fill in\]/i,
        /xxx/i, /FIXME/, /TODO/, /<your.*>/, /\.\.\./
    ];

    let placeholderCount = 0;
    for (const pattern of placeholderPatterns) {
        const matches = body.match(new RegExp(pattern.source, 'gi'));
        if (matches) placeholderCount += matches.length;
    }

    if (placeholderCount === 0) {
        score += 0.4;
    } else if (placeholderCount <= 2) {
        issues.push(createIssue('warning', 'PLACEHOLDERS_FOUND',
            `Found ${placeholderCount} placeholder(s)`,
            null, 'Replace placeholders with real examples'));
        score += 0.2;
    } else {
        issues.push(createIssue('error', 'MANY_PLACEHOLDERS',
            `Found ${placeholderCount} placeholders - skill may be incomplete`));
    }

    const examplePatterns = [/##?\s*example/i, /##?\s*sample/i, /##?\s*demo/i];
    const hasExampleSection = examplePatterns.some(p => p.test(body));
    if (hasExampleSection) {
        score += 0.3;
    } else {
        issues.push(createIssue('info', 'NO_EXAMPLE_SECTION', 'No dedicated Examples section found'));
    }

    const outputPatterns = [/##?\s*output/i, /```json/, /```yaml/, /\|.*\|.*\|/];
    const hasOutputFormat = outputPatterns.some(p => p.test(body));
    if (hasOutputFormat) {
        score += 0.3;
    } else {
        issues.push(createIssue('info', 'NO_OUTPUT_FORMAT',
            'No clear output format specification',
            null, 'Add example output to show expected results'));
    }

    return Math.min(1, score);
}

// =============================================================================
// Main Evaluation
// =============================================================================

function evaluateSkill(skillPath) {
    skillPath = path.resolve(skillPath);
    const report = createReport(path.basename(skillPath), skillPath);

    const skillMd = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
        report.issues.push(createIssue('error', 'NO_SKILL_MD', `SKILL.md not found in ${skillPath}`));
        report.badge = 'fail';
        return report;
    }

    const content = fs.readFileSync(skillMd, 'utf-8');
    const { frontmatter, body, issues } = parseFrontmatter(content);
    report.issues.push(...issues);

    report.scores.structure = checkStructure(skillPath, frontmatter, body, report.issues);
    report.scores.triggers = checkTriggers(frontmatter, body, report.issues);
    report.scores.actionability = checkActionability(body, report.issues);
    report.scores.tool_refs = checkToolRefs(skillPath, body, report.issues);
    report.scores.examples = checkExamples(body, report.issues);

    const overall = report.scores.overall;
    if (overall >= 0.85) report.badge = 'gold';
    else if (overall >= 0.70) report.badge = 'silver';
    else if (overall >= 0.50) report.badge = 'bronze';
    else report.badge = 'fail';

    // Generate recommendations
    const errorCodes = report.issues.filter(i => i.severity === 'error').map(i => i.code);
    const warningCodes = report.issues.filter(i => i.severity === 'warning').map(i => i.code);

    if (errorCodes.includes('DUPLICATE_FRONTMATTER')) {
        report.recommendations.push('Remove duplicate YAML frontmatter block (critical)');
    }
    if (errorCodes.includes('MISSING_NAME') || errorCodes.includes('MISSING_DESCRIPTION')) {
        report.recommendations.push("Add required 'name' and 'description' fields to frontmatter");
    }
    if (warningCodes.includes('NO_USAGE_CONTEXT')) {
        report.recommendations.push("Add 'Use when...' clause to description for better triggering");
    }
    if (warningCodes.includes('NO_STEPS')) {
        report.recommendations.push('Add numbered procedural steps for better actionability');
    }
    if (errorCodes.includes('MANY_PLACEHOLDERS') || warningCodes.includes('PLACEHOLDERS_FOUND')) {
        report.recommendations.push('Replace placeholder text with real examples');
    }

    return report;
}

function evaluateBatch(skillsDir) {
    const reports = [];
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(skillsDir, entry.name);
            if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
                reports.push(evaluateSkill(skillPath));
            }
        }
    }

    return reports;
}

// =============================================================================
// Output Formatters
// =============================================================================

function toJson(report) {
    const scores = report.scores;
    return JSON.stringify({
        ...report,
        scores: {
            overall: Math.round(scores.overall * 100) / 100,
            structure: Math.round(scores.structure * 100) / 100,
            triggers: Math.round(scores.triggers * 100) / 100,
            actionability: Math.round(scores.actionability * 100) / 100,
            tool_refs: Math.round(scores.tool_refs * 100) / 100,
            examples: Math.round(scores.examples * 100) / 100
        }
    }, null, 2);
}

function toMarkdown(report) {
    const scores = report.scores;
    const badgeEmoji = { gold: '🥇', silver: '🥈', bronze: '🥉', fail: '❌' };

    let lines = [
        `# Skill Evaluation Report: ${report.skill_id}`,
        '',
        `**Badge**: ${badgeEmoji[report.badge] || ''} ${report.badge.toUpperCase()}`,
        `**Overall Score**: ${scores.overall.toFixed(2)}`,
        `**Evaluated**: ${report.evaluated_at}`,
        '',
        '## Scores',
        '',
        '| Dimension | Score | Weight |',
        '|-----------|-------|--------|',
        `| Structure | ${scores.structure.toFixed(2)} | 20% |`,
        `| Triggers | ${scores.triggers.toFixed(2)} | 15% |`,
        `| Actionability | ${scores.actionability.toFixed(2)} | 25% |`,
        `| Tool References | ${scores.tool_refs.toFixed(2)} | 20% |`,
        `| Examples | ${scores.examples.toFixed(2)} | 20% |`,
        ''
    ];

    if (report.issues.length > 0) {
        lines.push('## Issues', '');
        for (const issue of report.issues) {
            const severityIcon = { error: '🔴', warning: '🟡', info: '🔵' }[issue.severity] || '';
            const lineInfo = issue.line ? ` (line ${issue.line})` : '';
            lines.push(`- ${severityIcon} **${issue.code}**${lineInfo}: ${issue.message}`);
            if (issue.suggestion) {
                lines.push(`  - 💡 ${issue.suggestion}`);
            }
        }
        lines.push('');
    }

    if (report.recommendations.length > 0) {
        lines.push('## Recommendations', '');
        report.recommendations.forEach((rec, idx) => {
            lines.push(`${idx + 1}. ${rec}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}

function toHtml(report) {
    const scores = report.scores;
    const badgeEmoji = { gold: '🥇', silver: '🥈', bronze: '🥉', fail: '❌' };

    // Issues section
    let issuesHtml = '';
    if (report.issues.length > 0) {
        const items = report.issues.map(issue => {
            const icon = { error: '🔴', warning: '🟡', info: '🔵' }[issue.severity] || '';
            const suggestion = issue.suggestion
                ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>`
                : '';
            return `
                <li class="issue-item issue-${issue.severity}">
                    <span class="issue-icon">${icon}</span>
                    <div class="issue-content">
                        <div>${issue.message}</div>
                        <div class="issue-code">${issue.code}</div>
                        ${suggestion}
                    </div>
                </li>
            `;
        }).join('');

        issuesHtml = `
        <div class="card">
            <div class="card-title">⚠️ Issues (${report.issues.length})</div>
            <ul class="issues-list">${items}</ul>
        </div>
        `;
    }

    // Recommendations section
    let recHtml = '';
    if (report.recommendations.length > 0) {
        const items = report.recommendations.map(rec => `<li>${rec}</li>`).join('');
        recHtml = `
        <div class="card">
            <div class="card-title">💡 Recommendations</div>
            <ol class="recommendations">${items}</ol>
        </div>
        `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skill Evaluation - ${report.skill_id}</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --a2s-ink: #0d0f0f;
            --a2s-ash: #f2efe9;
            --a2s-mint: #b7f0dc;
            --a2s-coral: #f7a38f;
            --a2s-cobalt: #1d2a52;
            --a2s-sand: #f9f5ef;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: linear-gradient(180deg, #f9f5ef 0%, #f1ebe1 70%, #f5efe6 100%);
            min-height: 100vh;
            color: var(--a2s-ink);
            padding: 32px 24px;
        }
        
        .container { max-width: 800px; margin: 0 auto; }
        
        .header { text-align: center; margin-bottom: 32px; }
        
        .header h1 {
            font-family: 'Fraunces', serif;
            font-size: 2rem;
            font-weight: 600;
            color: var(--a2s-ink);
            margin-bottom: 8px;
        }
        
        .score-display {
            font-family: 'Fraunces', serif;
            font-size: 3.5rem;
            font-weight: 700;
            color: var(--a2s-cobalt);
        }
        
        .badge {
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
        }
        
        .badge-gold { background: linear-gradient(135deg, #ffd700, #f4c430); color: var(--a2s-ink); }
        .badge-silver { background: linear-gradient(135deg, #c0c0c0, #a8a8a8); color: var(--a2s-ink); }
        .badge-bronze { background: linear-gradient(135deg, var(--a2s-coral), #e8957e); color: #fff; }
        .badge-fail { background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }
        
        .card {
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(13, 15, 15, 0.08);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 18px 40px rgba(13, 15, 15, 0.06);
        }
        
        .card-title {
            font-family: 'Fraunces', serif;
            font-size: 1.15rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .radar-container { width: 100%; height: 320px; }
        
        .scores-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 12px;
        }
        
        @media (max-width: 600px) {
            .scores-grid { grid-template-columns: repeat(2, 1fr); }
        }
        
        .score-item {
            text-align: center;
            padding: 16px 12px;
            background: rgba(183, 240, 220, 0.2);
            border-radius: 16px;
            border: 1px solid rgba(183, 240, 220, 0.4);
        }
        
        .score-item .value {
            font-family: 'Fraunces', serif;
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--a2s-cobalt);
        }
        
        .score-item .label {
            font-size: 0.72rem;
            color: rgba(13, 15, 15, 0.6);
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        
        .issues-list { list-style: none; }
        
        .issue-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            margin-bottom: 10px;
            background: var(--a2s-sand);
            border-radius: 12px;
            border-left: 3px solid;
        }
        
        .issue-error { border-color: var(--a2s-coral); background: rgba(247, 163, 143, 0.1); }
        .issue-warning { border-color: #f59e0b; background: rgba(245, 158, 11, 0.08); }
        .issue-info { border-color: var(--a2s-cobalt); background: rgba(29, 42, 82, 0.05); }
        
        .issue-icon { font-size: 1.1rem; }
        .issue-content { flex: 1; }
        
        .issue-code {
            font-family: monospace;
            font-size: 0.75rem;
            color: rgba(13, 15, 15, 0.5);
            margin-top: 4px;
        }
        
        .issue-suggestion {
            font-size: 0.82rem;
            color: #059669;
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(183, 240, 220, 0.3);
            border-radius: 8px;
        }
        
        .recommendations { list-style: none; counter-reset: rec; }
        
        .recommendations li {
            counter-increment: rec;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid rgba(13, 15, 15, 0.06);
        }
        
        .recommendations li:last-child { border-bottom: none; }
        
        .recommendations li::before {
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
        }
        
        .meta {
            font-size: 0.75rem;
            color: rgba(13, 15, 15, 0.5);
            text-align: center;
            margin-top: 32px;
        }
        
        .meta code {
            background: rgba(13, 15, 15, 0.06);
            padding: 2px 8px;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 ${report.skill_id}</h1>
            <div class="score-display">${scores.overall.toFixed(2)}</div>
            <div class="badge badge-${report.badge}">${badgeEmoji[report.badge] || ''} ${report.badge.toUpperCase()}</div>
        </div>
        
        <div class="card">
            <div class="card-title">📊 Dimension Scores</div>
            <div id="radar" class="radar-container"></div>
        </div>
        
        <div class="card">
            <div class="card-title">📈 Score Breakdown</div>
            <div class="scores-grid">
                <div class="score-item">
                    <div class="value">${scores.structure.toFixed(2)}</div>
                    <div class="label">Structure</div>
                </div>
                <div class="score-item">
                    <div class="value">${scores.triggers.toFixed(2)}</div>
                    <div class="label">Triggers</div>
                </div>
                <div class="score-item">
                    <div class="value">${scores.actionability.toFixed(2)}</div>
                    <div class="label">Actionability</div>
                </div>
                <div class="score-item">
                    <div class="value">${scores.tool_refs.toFixed(2)}</div>
                    <div class="label">Tool Refs</div>
                </div>
                <div class="score-item">
                    <div class="value">${scores.examples.toFixed(2)}</div>
                    <div class="label">Examples</div>
                </div>
            </div>
        </div>
        
        ${issuesHtml}
        
        ${recHtml}
        
        <div class="meta">
            Evaluated at <code>${report.evaluated_at}</code> · Tier: <code>${report.tier}</code> · Powered by <a href="https://github.com/Ontos-AI/skills-evaluator">Ontos Skill Evaluator</a>
        </div>
    </div>
    
    <script>
        const chart = echarts.init(document.getElementById('radar'));
        const option = {
            backgroundColor: 'transparent',
            radar: {
                indicator: [
                    { name: 'Structure', max: 1 },
                    { name: 'Triggers', max: 1 },
                    { name: 'Actionability', max: 1 },
                    { name: 'Tool Refs', max: 1 },
                    { name: 'Examples', max: 1 }
                ],
                shape: 'polygon',
                splitNumber: 4,
                radius: '70%',
                axisName: {
                    color: 'rgba(13, 15, 15, 0.6)',
                    fontSize: 11,
                    fontFamily: 'Plus Jakarta Sans'
                },
                splitArea: {
                    areaStyle: {
                        color: ['rgba(183, 240, 220, 0.05)', 'rgba(183, 240, 220, 0.1)', 
                                'rgba(183, 240, 220, 0.15)', 'rgba(183, 240, 220, 0.2)']
                    }
                },
                axisLine: { lineStyle: { color: 'rgba(13, 15, 15, 0.08)' } },
                splitLine: { lineStyle: { color: 'rgba(13, 15, 15, 0.08)' } }
            },
            series: [{
                type: 'radar',
                data: [{
                    value: [${scores.structure}, ${scores.triggers}, ${scores.actionability}, ${scores.tool_refs}, ${scores.examples}],
                    name: 'Scores',
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(29, 42, 82, 0.4)' },
                            { offset: 1, color: 'rgba(183, 240, 220, 0.3)' }
                        ])
                    },
                    lineStyle: { color: '#1d2a52', width: 2 },
                    itemStyle: { color: '#1d2a52' }
                }]
            }]
        };
        chart.setOption(option);
        window.addEventListener('resize', () => chart.resize());
    </script>
</body>
</html>`;
}

// =============================================================================
// CLI
// =============================================================================

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Ontos Skill Evaluator - Quick Eval Engine

Usage:
    node quick_eval.js <skill_path>
    node quick_eval.js <skill_path> --format md
    node quick_eval.js <skill_path> --format html
    node quick_eval.js <skills_dir> --batch

Options:
    --format <type>    Output format: json (default), md, html
    --batch            Evaluate all skills in directory
    --output, -o       Output file path (default: stdout)
    --help, -h         Show this help
        `);
        process.exit(0);
    }

    const skillPath = args[0];
    const formatIdx = args.indexOf('--format');
    const format = formatIdx >= 0 ? args[formatIdx + 1] : 'json';
    const batch = args.includes('--batch');
    const outputIdx = args.findIndex(a => a === '--output' || a === '-o');
    const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

    if (!fs.existsSync(skillPath)) {
        console.error(`Error: Path not found: ${skillPath}`);
        process.exit(1);
    }

    let output;
    let reports;

    if (batch) {
        reports = evaluateBatch(skillPath);
        if (format === 'json') {
            output = JSON.stringify(reports.map(r => JSON.parse(toJson(r))), null, 2);
        } else if (format === 'html') {
            output = reports.map(r => toHtml(r)).join('\n<!-- BATCH SEPARATOR -->\n');
        } else {
            output = reports.map(r => toMarkdown(r)).join('\n\n---\n\n');
        }
    } else {
        const report = evaluateSkill(skillPath);
        reports = [report];
        if (format === 'json') {
            output = toJson(report);
        } else if (format === 'html') {
            output = toHtml(report);
        } else {
            output = toMarkdown(report);
        }
    }

    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, output, 'utf-8');
        console.log(`Report written to: ${outputPath}`);
    } else {
        console.log(output);
    }

    // Exit with error code if any skill failed
    if (reports.some(r => r.badge === 'fail')) {
        process.exit(1);
    }
}

main();
