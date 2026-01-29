import { NextResponse } from 'next/server';

// =============================================================================
// Skill Parser
// =============================================================================

function parseSkillContent(content) {
    const lines = content.split('\n');
    let inFrontmatter = false;
    let frontmatterCount = 0;
    const frontmatter = {};
    const bodyLines = [];

    for (const line of lines) {
        if (line.trim() === '---') {
            frontmatterCount++;
            inFrontmatter = frontmatterCount === 1;
            continue;
        }

        if (inFrontmatter && frontmatterCount === 1) {
            const match = line.match(/^(\w+):\s*["']?(.+?)["']?\s*$/);
            if (match) {
                frontmatter[match[1]] = match[2];
            }
        } else if (frontmatterCount >= 2) {
            bodyLines.push(line);
        }
    }

    return {
        name: frontmatter.name || 'unknown',
        description: frontmatter.description || '',
        body: bodyLines.join('\n'),
        raw: content
    };
}

// =============================================================================
// L1: Quick Eval
// =============================================================================

function evaluateSkill(skill) {
    const issues = [];
    const scores = {
        structure: 1.0,
        triggers: 0.5,
        actionability: 0.5,
        tool_refs: 0.5,
        examples: 0.5
    };

    if (!skill.name || skill.name === 'unknown') {
        issues.push({ severity: 'error', code: 'NO_NAME', message: 'Missing skill name in frontmatter' });
        scores.structure -= 0.3;
    }

    if (!skill.description) {
        issues.push({ severity: 'error', code: 'NO_DESCRIPTION', message: 'Missing description' });
        scores.structure -= 0.3;
    } else if (skill.description.length < 50) {
        issues.push({ severity: 'warning', code: 'SHORT_DESCRIPTION', message: `Description is only ${skill.description.length} chars` });
        scores.triggers -= 0.1;
    }

    const triggerPatterns = ['use when', 'use this', 'helpful for', 'designed to'];
    const hasUseWhen = triggerPatterns.some(p => skill.description.toLowerCase().includes(p));
    if (hasUseWhen) scores.triggers += 0.3;

    const imperativeVerbs = ['run', 'execute', 'create', 'generate', 'fetch', 'check', 'build'];
    const bodyLower = skill.body.toLowerCase();
    const imperativeCount = imperativeVerbs.filter(v => bodyLower.includes(v)).length;
    scores.actionability = Math.min(1, 0.3 + imperativeCount * 0.1);

    if (skill.body.includes('```')) scores.tool_refs += 0.2;
    if (skill.body.includes('scripts/')) scores.tool_refs += 0.3;

    const hasExamples = skill.body.toLowerCase().includes('example') || skill.body.includes('```');
    if (hasExamples) scores.examples = 0.8;

    scores.overall = (
        scores.structure * 0.2 +
        scores.triggers * 0.25 +
        scores.actionability * 0.2 +
        scores.tool_refs * 0.15 +
        scores.examples * 0.2
    );

    for (const key of Object.keys(scores)) {
        scores[key] = Math.max(0, Math.min(1, scores[key]));
    }

    let badge = 'fail';
    if (scores.overall >= 0.85) badge = 'gold';
    else if (scores.overall >= 0.7) badge = 'silver';
    else if (scores.overall >= 0.5) badge = 'bronze';

    return {
        skill_id: skill.name,
        evaluated_at: new Date().toISOString(),
        tier: 'quick',
        is_passed: scores.overall >= 0.7,
        pass_threshold: 0.7,
        badge,
        scores,
        issues,
        recommendations: issues.slice(0, 3).map(i => i.message)
    };
}

// =============================================================================
// L2: Smoke Test
// =============================================================================

const PROVIDER_CONFIG = {
    deepseek: {
        baseUrl: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
    },
    qwen: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        model: 'qwen-plus'
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini'
    },
    claude: {
        baseUrl: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-haiku-20240307'
    }
};

async function callLLM(provider, apiKey, systemPrompt, userPrompt) {
    const config = PROVIDER_CONFIG[provider];
    if (!config) throw new Error(`Unknown provider: ${provider}`);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    let body;
    if (provider === 'claude') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        delete headers['Authorization'];
        body = JSON.stringify({
            model: config.model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        });
    } else {
        body = JSON.stringify({
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 1024
        });
    }

    const response = await fetch(config.baseUrl, { method: 'POST', headers, body });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error.slice(0, 200)}`);
    }

    const data = await response.json();

    if (provider === 'claude') {
        return data.content?.[0]?.text || '';
    }
    return data.choices?.[0]?.message?.content || '';
}

function generateTestPrompts(skill) {
    const desc = (skill.description || '').toLowerCase().replace(/[.!?,]+$/, '').trim();
    return [
        `Help me: ${desc}`,
        `I need to: ${desc}`,
        desc,
        `How do I ${desc}?`,
        `Tell me about ${skill.name}`
    ].slice(0, 5);
}

function judgeResponse(response, skill) {
    const text = response.toLowerCase();
    const skillName = skill.name.toLowerCase();
    const keywords = skill.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);

    // Rule-based judgment
    const hasSkillName = text.includes(skillName);
    const keywordMatches = keywords.filter(k => text.includes(k)).length;
    const keywordRatio = keywords.length > 0 ? keywordMatches / keywords.length : 0;

    const confidence = (hasSkillName ? 0.5 : 0) + (keywordRatio * 0.5);
    const verdict = confidence >= 0.3 ? 'YES' : 'NO';

    return { verdict, confidence, method: 'rule' };
}

async function runSmokeTest(skill, provider, apiKey) {
    const prompts = generateTestPrompts(skill);
    const results = [];

    const systemPrompt = `You are a helpful assistant with access to various skills. 
One of your available skills is: "${skill.name}" - ${skill.description}
When a user's request matches this skill, acknowledge it and explain how you can help.`;

    for (const prompt of prompts) {
        const startTime = Date.now();
        try {
            const response = await callLLM(provider, apiKey, systemPrompt, prompt);
            const latencyMs = Date.now() - startTime;
            const judgment = judgeResponse(response, skill);

            results.push({
                prompt,
                response_preview: response.slice(0, 200),
                verdict: judgment.verdict,
                confidence: judgment.confidence,
                method: judgment.method,
                latency_ms: latencyMs
            });
        } catch (error) {
            results.push({
                prompt,
                error: error.message,
                verdict: 'ERROR',
                confidence: 0,
                method: 'error',
                latency_ms: Date.now() - startTime
            });
        }
    }

    const passCount = results.filter(r => r.verdict === 'YES').length;
    const passRate = passCount / results.length;

    return {
        skill_id: skill.name,
        tested_at: new Date().toISOString(),
        provider,
        test_count: results.length,
        pass_count: passCount,
        call_success_rate: passRate,
        tests: results,
        summary: `${passCount}/${results.length} prompts successfully triggered the skill`
    };
}

// =============================================================================
// HTML Generator
// =============================================================================

function generateHTML(report, smokeResult = null) {
    const { scores, badge, skill_id, issues, recommendations } = report;
    const badgeColors = { gold: '#ffd700', silver: '#c0c0c0', bronze: '#cd7f32', fail: '#ef4444' };
    const badgeColor = badgeColors[badge] || '#888';

    const issuesHtml = issues.map(i => {
        const cls = i.severity === 'error' ? 'issue-error' : i.severity === 'warning' ? 'issue-warning' : 'issue-info';
        return `<div class="issue-item ${cls}"><span class="issue-icon">${i.severity === 'error' ? '❌' : i.severity === 'warning' ? '⚠️' : 'ℹ️'}</span><div class="issue-content"><div>${i.message}</div><div class="issue-code">${i.code}</div></div></div>`;
    }).join('');

    const recHtml = recommendations.length ? `<div class="card"><div class="card-title">💡 Recommendations</div><ul class="recommendations">${recommendations.map(r => `<li>${r}</li>`).join('')}</ul></div>` : '';

    // Smoke test card
    let smokeHtml = '';
    if (smokeResult) {
        const passRate = (smokeResult.call_success_rate * 100).toFixed(0);
        const statusIcon = smokeResult.call_success_rate >= 0.6 ? '✅' : '⚠️';
        const testsHtml = smokeResult.tests.map(t => {
            const icon = t.verdict === 'YES' ? '✓' : t.verdict === 'ERROR' ? '⚠' : '✗';
            const iconClass = t.verdict === 'YES' ? 'issue-info' : 'issue-error';
            return `<div class="issue-item ${iconClass}"><span class="issue-icon">${icon}</span><div class="issue-content"><div>${t.prompt.slice(0, 60)}...</div><div class="issue-code">${t.latency_ms}ms · ${t.method}</div></div></div>`;
        }).join('');

        smokeHtml = `
        <div class="card">
            <div class="card-title">🧪 Level 2: Smoke Test</div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <span class="badge" style="background: ${smokeResult.call_success_rate >= 0.6 ? '#22c55e' : '#ef4444'}; color: white;">
                    ${statusIcon} ${smokeResult.pass_count}/${smokeResult.test_count} Passed
                </span>
                <span style="color: rgba(0,0,0,0.5); font-size: 0.85rem;">
                    Provider: ${smokeResult.provider} · ${passRate}% success rate
                </span>
            </div>
            <ul class="issues-list">${testsHtml}</ul>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skill Evaluation - ${skill_id}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        :root { --bg: #f8f6f3; --card: rgba(255,255,255,0.85); --ink: #0d0f0f; --cobalt: #1d2a52; --mint: #b7f0dc; --coral: #f7a38f; --sand: #f4f1ec; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 2rem; }
        .header h1 { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 600; margin-bottom: 0.5rem; }
        .score-display { font-family: 'Fraunces', serif; font-size: 3.5rem; font-weight: 700; color: var(--cobalt); }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 12px; background: ${badgeColor}; color: ${badge === 'fail' ? '#fff' : 'var(--ink)'}; }
        .card { background: var(--card); border: 1px solid rgba(0,0,0,0.08); border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: 0 18px 40px rgba(0,0,0,0.06); }
        .card-title { font-family: 'Fraunces', serif; font-size: 1.15rem; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .radar-container { width: 100%; height: 320px; }
        .scores-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .score-item { text-align: center; padding: 16px 12px; background: rgba(183,240,220,0.2); border-radius: 16px; border: 1px solid rgba(183,240,220,0.4); }
        .score-item .value { font-family: 'Fraunces', serif; font-size: 1.6rem; font-weight: 700; color: var(--cobalt); }
        .score-item .label { font-size: 0.72rem; color: rgba(0,0,0,0.6); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
        .issues-list { list-style: none; }
        .issue-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; margin-bottom: 10px; background: var(--sand); border-radius: 12px; border-left: 3px solid; }
        .issue-error { border-color: var(--coral); background: rgba(247,163,143,0.1); }
        .issue-warning { border-color: #f59e0b; background: rgba(245,158,11,0.08); }
        .issue-info { border-color: var(--cobalt); background: rgba(29,42,82,0.05); }
        .issue-icon { font-size: 1.1rem; }
        .issue-content { flex: 1; }
        .issue-code { font-family: monospace; font-size: 0.75rem; color: rgba(0,0,0,0.5); margin-top: 4px; }
        .recommendations { list-style: none; counter-reset: rec; }
        .recommendations li { counter-increment: rec; display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .recommendations li:last-child { border-bottom: none; }
        .recommendations li::before { content: counter(rec); display: flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; background: var(--cobalt); border-radius: 999px; font-weight: 600; color: #fff; font-size: 0.8rem; }
        .meta { text-align: center; padding-top: 2rem; color: rgba(0,0,0,0.4); font-size: 0.8rem; }
        .meta a { color: var(--cobalt); }
        @media (max-width: 600px) { .scores-grid { grid-template-columns: repeat(2, 1fr); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ${skill_id}</h1>
            <div class="score-display">${(scores.overall * 100).toFixed(0)}%</div>
            <span class="badge">${badge}</span>
        </div>
        
        <div class="card">
            <div class="card-title">📈 Dimension Scores</div>
            <div id="radar" class="radar-container"></div>
            <div class="scores-grid">
                <div class="score-item"><div class="value">${scores.structure.toFixed(2)}</div><div class="label">Structure</div></div>
                <div class="score-item"><div class="value">${scores.triggers.toFixed(2)}</div><div class="label">Triggers</div></div>
                <div class="score-item"><div class="value">${scores.actionability.toFixed(2)}</div><div class="label">Action</div></div>
                <div class="score-item"><div class="value">${scores.tool_refs.toFixed(2)}</div><div class="label">Tools</div></div>
                <div class="score-item"><div class="value">${scores.examples.toFixed(2)}</div><div class="label">Examples</div></div>
            </div>
        </div>
        
        ${smokeHtml}
        
        ${issues.length ? `<div class="card"><div class="card-title">🔍 Detailed Analysis</div><ul class="issues-list">${issuesHtml}</ul></div>` : ''}
        
        ${recHtml}
        
        <div class="meta">
            Evaluated at <code>${report.evaluated_at}</code> · Powered by <a href="https://github.com/Ontos-AI/skills-evaluator">Ontos Skill Evaluator</a>
        </div>
    </div>
    
    <script>
        const chart = echarts.init(document.getElementById('radar'));
        chart.setOption({
            backgroundColor: 'transparent',
            radar: {
                indicator: [
                    { name: 'Structure', max: 1 },
                    { name: 'Triggers', max: 1 },
                    { name: 'Actionability', max: 1 },
                    { name: 'Tool Refs', max: 1 },
                    { name: 'Examples', max: 1 }
                ],
                shape: 'polygon', splitNumber: 4, radius: '70%',
                axisName: { color: 'rgba(0,0,0,0.6)', fontSize: 11 },
                splitArea: { areaStyle: { color: ['rgba(183,240,220,0.05)', 'rgba(183,240,220,0.1)', 'rgba(183,240,220,0.15)', 'rgba(183,240,220,0.2)'] } },
                axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
                splitLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } }
            },
            series: [{
                type: 'radar',
                data: [{
                    value: [${scores.structure}, ${scores.triggers}, ${scores.actionability}, ${scores.tool_refs}, ${scores.examples}],
                    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(29,42,82,0.4)' }, { offset: 1, color: 'rgba(183,240,220,0.3)' }] } },
                    lineStyle: { color: '#1d2a52', width: 2 },
                    itemStyle: { color: '#1d2a52' }
                }]
            }]
        });
        window.addEventListener('resize', () => chart.resize());
    </script>
</body>
</html>`;
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request) {
    try {
        const { url, enableL2, apiKey, provider } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Fetch skill content
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch: ${response.status}` }, { status: 400 });
        }

        const content = await response.text();
        const skill = parseSkillContent(content);

        // L1: Quick Eval
        const report = evaluateSkill(skill);

        // L2: Smoke Test (if enabled)
        let smokeResult = null;
        if (enableL2 && apiKey && provider) {
            try {
                smokeResult = await runSmokeTest(skill, provider, apiKey);
            } catch (error) {
                return NextResponse.json({ error: `Smoke test failed: ${error.message}` }, { status: 500 });
            }
        }

        // Generate HTML
        const html = generateHTML(report, smokeResult);

        return NextResponse.json({
            success: true,
            report,
            smokeTest: smokeResult ? {
                passed: smokeResult.call_success_rate >= 0.6,
                passCount: smokeResult.pass_count,
                testCount: smokeResult.test_count,
                passRate: smokeResult.call_success_rate
            } : null,
            html
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
