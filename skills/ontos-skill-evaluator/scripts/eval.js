#!/usr/bin/env node
/**
 * Ontos Skill Evaluator - Unified Entry Point
 * ============================================
 * Progressive evaluation: L1 (Quick) → L2 (Smoke) → L3 (Deep, coming soon)
 * 
 * Usage:
 *     node eval.js <skill_path>              # Interactive, auto-progression
 *     node eval.js <skill_path> --quick      # L1 only
 *     node eval.js <skill_path> --smoke      # L2 only
 *     node eval.js <skill_path> --full       # L1 + L2, no prompts
 *     node eval.js <skill_path> --ci         # CI mode, JSON output, exit code
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SCRIPTS_DIR = __dirname;

// =============================================================================
// Helpers
// =============================================================================

function runScript(scriptName, args, silent = false) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);
        const child = spawn('node', [scriptPath, ...args], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: process.cwd()
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', data => {
            const text = data.toString();
            stdout += text;
            if (!silent) process.stdout.write(text);
        });

        child.stderr.on('data', data => {
            const text = data.toString();
            stderr += text;
            if (!silent) process.stderr.write(text);
        });

        child.on('close', code => {
            resolve({ code, stdout, stderr });
        });

        child.on('error', reject);
    });
}

function question(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(prompt, answer => {
            rl.close();
            resolve(answer);
        });
    });
}

function extractJSON(output) {
    try {
        const matches = output.match(/\{[\s\S]*\}/g);
        if (matches) {
            for (let i = matches.length - 1; i >= 0; i--) {
                try {
                    return JSON.parse(matches[i]);
                } catch (e) {
                    continue;
                }
            }
        }
    } catch (e) { }
    return null;
}

// =============================================================================
// Main Levels
// =============================================================================

async function runL1(skillPath, options) {
    console.log('\n' + '═'.repeat(60));
    console.log('📋 Level 1: Quick Eval (Static Analysis)');
    console.log('═'.repeat(60) + '\n');

    const result = await runScript('quick_eval.js', [skillPath]);
    const jsonData = extractJSON(result.stdout);

    return {
        level: 1,
        name: 'Quick Eval',
        passed: result.code === 0 && (jsonData?.scores?.overall || 0) >= 0.5,
        score: jsonData?.scores?.overall || 0,
        badge: jsonData?.badge || 'unknown',
        exitCode: result.code,
        rawData: jsonData
    };
}

async function runL2(skillPath, options) {
    console.log('\n' + '═'.repeat(60));
    console.log('🧪 Level 2: Smoke Test (LLM Invocation)');
    console.log('═'.repeat(60) + '\n');

    const args = [skillPath];
    if (options.provider) args.push('--provider', options.provider);

    const result = await runScript('smoke_test.js', args);
    const jsonData = extractJSON(result.stdout);

    return {
        level: 2,
        name: 'Smoke Test',
        passed: result.code === 0 && (jsonData?.call_success_rate || 0) >= 0.6,
        passRate: jsonData?.call_success_rate || 0,
        passCount: jsonData?.pass_count || 0,
        testCount: jsonData?.test_count || 0,
        exitCode: result.code,
        rawData: jsonData
    };
}

// =============================================================================
// Report Generation
// =============================================================================

function generateCombinedJSON(skillPath, l1Result, l2Result) {
    const report = {
        skill_path: skillPath,
        evaluated_at: new Date().toISOString(),
        levels: {}
    };

    if (l1Result) {
        report.levels.quick_eval = l1Result.rawData;
    }

    if (l2Result) {
        report.levels.smoke_test = l2Result.rawData;
    }

    report.summary = {
        all_passed: [l1Result, l2Result].filter(Boolean).every(r => r.passed),
        l1_score: l1Result?.score || null,
        l1_badge: l1Result?.badge || null,
        l2_pass_rate: l2Result?.passRate || null
    };

    return report;
}

async function generateHTML(skillPath, l1Result, l2Result) {
    // Get base HTML from quick_eval.js
    const result = await runScript('quick_eval.js', [skillPath, '--format', 'html'], true);
    let html = result.stdout;

    // If we have smoke test results, inject them before </div></body>
    if (l2Result?.rawData) {
        const smokeTestCard = generateSmokeTestCard(l2Result.rawData);
        // Insert before the meta footer and closing tags
        html = html.replace(
            /(<div class="meta">)/,
            smokeTestCard + '\n        $1'
        );
    }

    return html;
}

function generateSmokeTestCard(l2Data) {
    const passRate = ((l2Data.call_success_rate || 0) * 100).toFixed(0);
    const statusClass = l2Data.call_success_rate >= 0.6 ? 'badge-gold' : 'badge-fail';
    const statusText = l2Data.call_success_rate >= 0.6 ? '✅ Passed' : '❌ Failed';

    let testsHtml = '';
    if (l2Data.tests?.length) {
        for (const test of l2Data.tests) {
            const icon = test.verdict === 'YES' ? '✓' : '✗';
            const iconClass = test.verdict === 'YES' ? 'issue-info' : 'issue-error';
            const promptPreview = test.prompt.substring(0, 60) + (test.prompt.length > 60 ? '...' : '');
            testsHtml += `
            <div class="issue-item ${iconClass}">
                <span class="issue-icon">${icon}</span>
                <div class="issue-content">
                    <div>${promptPreview}</div>
                    <div class="issue-code">${test.latency_ms}ms · ${test.method}</div>
                </div>
            </div>`;
        }
    }

    return `
        <div class="card">
            <div class="card-title">🧪 Level 2: Smoke Test</div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <span class="badge ${statusClass}">${statusText} ${l2Data.pass_count}/${l2Data.test_count}</span>
                <span style="color: rgba(13, 15, 15, 0.5); font-size: 0.85rem;">
                    Provider: ${l2Data.provider || 'N/A'} · ${passRate}% success rate
                </span>
            </div>
            <ul class="issues-list">
                ${testsHtml}
            </ul>
        </div>`;
}

// =============================================================================
// Pipeline
// =============================================================================

async function runPipeline(skillPath, options) {
    let l1Result = null;
    let l2Result = null;
    let shouldContinue = true;

    // L1: Quick Eval
    if (options.runL1 && shouldContinue) {
        l1Result = await runL1(skillPath, options);

        if (!l1Result.passed) {
            console.log('\n⚠️  Level 1 failed. Fix issues before proceeding.\n');
            shouldContinue = false;
        } else if (options.runL2 && !options.ciMode && !options.fullMode) {
            console.log(`\n✅ Level 1 passed! Score: ${(l1Result.score * 100).toFixed(0)}% (${l1Result.badge})`);
            const answer = await question('\n👆 Continue to Level 2 (Smoke Test)? (y/n, default: y): ');
            shouldContinue = answer.toLowerCase() !== 'n';
        }
    }

    // L2: Smoke Test
    if (options.runL2 && shouldContinue) {
        l2Result = await runL2(skillPath, options);

        if (l2Result.passed) {
            console.log(`\n✅ Level 2 passed! ${l2Result.passCount}/${l2Result.testCount} prompts triggered successfully.\n`);
        } else {
            console.log('\n⚠️  Level 2 failed. Some prompts did not trigger the skill.\n');
        }
    }

    // Generate and save reports
    const results = [l1Result, l2Result].filter(Boolean);
    const skillName = l1Result?.rawData?.skill_id || path.basename(skillPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Determine output directory
    const outputDir = fs.existsSync(path.join(process.cwd(), 'test-reports'))
        ? path.join(process.cwd(), 'test-reports')
        : process.cwd();

    const jsonPath = path.join(outputDir, `${skillName}_${timestamp}.json`);
    const htmlPath = path.join(outputDir, `${skillName}_${timestamp}.html`);

    // Generate reports
    const jsonReport = generateCombinedJSON(skillPath, l1Result, l2Result);
    const htmlReport = await generateHTML(skillPath, l1Result, l2Result);

    // Save reports
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    fs.writeFileSync(htmlPath, htmlReport);

    // Summary
    console.log('═'.repeat(60));
    console.log('📊 Evaluation Summary');
    console.log('═'.repeat(60));
    for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        console.log(`  ${icon} Level ${r.level}: ${r.name}`);
    }
    console.log('═'.repeat(60));
    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}\n`);

    if (results.every(r => r.passed)) {
        console.log('🎉 All levels passed! Your skill is ready.\n');
    }

    const anyFailed = results.some(r => !r.passed);
    return anyFailed ? 1 : 0;
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        skillPath: null,
        runL1: true,
        runL2: true,
        fullMode: false,
        ciMode: false,
        provider: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--quick' || arg === '-q') {
            options.runL2 = false;
        } else if (arg === '--smoke' || arg === '-s') {
            options.runL1 = false;
        } else if (arg === '--full' || arg === '-f') {
            options.fullMode = true;
        } else if (arg === '--ci') {
            options.ciMode = true;
            options.fullMode = true;
        } else if (arg === '--provider' || arg === '-p') {
            options.provider = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Ontos Skill Evaluator
=====================

Usage:
  node eval.js <skill_path> [options]

Levels:
  Level 1 (Quick Eval)  - Static analysis, no LLM required
  Level 2 (Smoke Test)  - LLM invocation test, requires API key

Options:
  --quick, -q     Run Level 1 only
  --smoke, -s     Run Level 2 only (skip Level 1)
  --full, -f      Run all levels without prompts
  --ci            CI mode: non-interactive, JSON output
  --provider, -p  LLM provider for smoke test (deepseek|qwen|claude|openai)
  --help, -h      Show this help

Examples:
  node eval.js ./my-skill              # Interactive progression
  node eval.js ./my-skill --quick      # Static analysis only
  node eval.js ./my-skill --full       # Full evaluation, no prompts
  node eval.js ./my-skill --ci         # CI/CD integration

Reports:
  HTML and JSON reports are saved automatically to test-reports/

First time? Run: node scripts/setup.js
`);
            process.exit(0);
        } else if (!arg.startsWith('-')) {
            options.skillPath = arg;
        }
    }

    if (!options.skillPath) {
        console.error('Error: Please provide a skill path');
        console.error('Usage: node eval.js <skill_path>');
        process.exit(1);
    }

    return options;
}

async function main() {
    const options = parseArgs();

    console.log('\n🔍 Ontos Skill Evaluator');
    console.log(`   Skill: ${options.skillPath}\n`);

    const exitCode = await runPipeline(options.skillPath, options);
    process.exit(exitCode);
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
