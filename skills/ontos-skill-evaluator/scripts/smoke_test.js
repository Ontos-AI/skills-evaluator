#!/usr/bin/env node
/**
 * Ontos Skill Evaluator - Smoke Test
 * ===================================
 * Tests if a Skill can be successfully invoked by an AI model.
 * Supports multiple LLM providers: DeepSeek, Qwen, Claude, OpenAI, Ollama.
 * 
 * Usage:
 *     node smoke_test.js <skill_path>
 *     node smoke_test.js <skill_path> --provider deepseek
 *     node smoke_test.js <skill_path> --provider claude --judge-mode llm
 *     node smoke_test.js <skill_path> --format json|md|html
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// =============================================================================
// Configuration
// =============================================================================

const os = require('os');

// Load .env files (zero dependencies - simple parser)
function loadEnvFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return;
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.slice(0, eqIdx).trim();
                const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) {  // Don't override existing env vars
                    process.env[key] = value;
                }
            }
        }
    } catch (e) {
        // Silently ignore
    }
}

// Load env files (priority: existing env > ~/.ontos/.env > project .env)
loadEnvFile(path.join(os.homedir(), '.ontos', '.env'));
loadEnvFile(path.join(__dirname, '.env'));

const CONFIG_PATH = path.join(__dirname, 'smoke_test_config.json');
const DEFAULT_CONFIG = {
    default_provider: 'deepseek',
    test_count: 5,
    judge_mode: 'hybrid',
    timeout_ms: 30000
};

function loadConfig() {
    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } catch (e) {
        console.warn('Warning: Could not load config, using defaults');
        return DEFAULT_CONFIG;
    }
}

// =============================================================================
// LLM Provider Router
// =============================================================================

class LLMProvider {
    constructor(config, providerName) {
        this.config = config;
        this.providerName = providerName;
        this.providerConfig = config.providers[providerName];

        if (!this.providerConfig) {
            throw new Error(`Unknown provider: ${providerName}`);
        }

        this.apiKey = this.providerConfig.env_key
            ? process.env[this.providerConfig.env_key]
            : null;

        // Don't throw here - let the caller handle missing API key
    }

    hasApiKey() {
        return !!this.apiKey;
    }

    getMissingKeyMessage() {
        return `Missing API key: ${this.providerConfig.env_key}`;
    }

    async chat(systemPrompt, userMessage) {
        if (this.providerConfig.is_anthropic) {
            return this._callAnthropic(systemPrompt, userMessage);
        }
        return this._callOpenAICompatible(systemPrompt, userMessage);
    }

    async _callOpenAICompatible(systemPrompt, userMessage) {
        const url = new URL(this.providerConfig.base_url + '/chat/completions');
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const body = JSON.stringify({
            model: this.providerConfig.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            max_tokens: 1024,
            temperature: 0.7
        });

        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return new Promise((resolve, reject) => {
            const req = httpModule.request({
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers,
                timeout: this.config.timeout_ms
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.error) {
                            reject(new Error(json.error.message || JSON.stringify(json.error)));
                        } else {
                            resolve(json.choices[0].message.content);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(body);
            req.end();
        });
    }

    async _callAnthropic(systemPrompt, userMessage) {
        const url = new URL('https://api.anthropic.com/v1/messages');

        const body = JSON.stringify({
            model: this.providerConfig.model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        });

        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
        };

        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers,
                timeout: this.config.timeout_ms
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.error) {
                            reject(new Error(json.error.message || JSON.stringify(json.error)));
                        } else {
                            resolve(json.content[0].text);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(body);
            req.end();
        });
    }
}

// =============================================================================
// Skill Parser
// =============================================================================

// Keywords to look for when extracting hints from body
const HINT_KEYWORDS = [
    'trigger',      // "Trigger Phrases:", "triggers:"
    'use when',     // "Use when the user asks..."
    'usage',        // "Usage:"
    'command',      // "Commands:"
    'invoke',       // "Invoke by saying..."
    'activate',     // "Activate with..."
    'ask',          // "Ask me to..."
    'try',          // "Try saying..."
    'say',          // "Say something like..."
];

function parseSkill(skillPath) {
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
        return { error: 'NO_SKILL_MD', message: `SKILL.md not found in ${skillPath}` };
    }

    const content = fs.readFileSync(skillMd, 'utf-8');

    // Handle duplicate frontmatter (some skills have ---...---...---...---)
    // Find all frontmatter blocks and use the most complete one
    const frontmatterPattern = /^---\n([\s\S]*?)\n---/gm;
    const matches = [...content.matchAll(frontmatterPattern)];

    if (matches.length === 0) {
        return { error: 'NO_FRONTMATTER', message: 'Invalid SKILL.md: Missing YAML frontmatter' };
    }

    // Parse all frontmatter blocks and pick the one with the longest description
    let bestFrontmatter = {};
    let bestDescLength = 0;

    for (const match of matches) {
        const frontmatterText = match[1].trim();
        const fm = {};

        for (const line of frontmatterText.split('\n')) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.slice(0, colonIndex).trim();
                let value = line.slice(colonIndex + 1).trim();
                value = value.replace(/^["']|["']$/g, '');
                if (value && !value.startsWith('-')) {  // Skip array items
                    fm[key] = value;
                }
            }
        }

        const descLen = (fm.description || '').length;
        if (descLen > bestDescLength) {
            bestDescLength = descLen;
            bestFrontmatter = fm;
        }
    }

    // Validate required fields
    const name = bestFrontmatter.name || path.basename(skillPath);
    const description = bestFrontmatter.description || '';

    if (!description || description.length < 10) {
        return {
            error: 'MISSING_DESCRIPTION',
            message: 'Skill must have a meaningful description (>=10 chars)',
            name
        };
    }

    // Extract body (everything after the last frontmatter block)
    const lastMatch = matches[matches.length - 1];
    const bodyStart = lastMatch.index + lastMatch[0].length;
    const body = content.slice(bodyStart).trim();

    // Extract hints using keywords
    const hints = extractHints(body);

    return {
        name,
        description,
        body,
        fullContent: content,
        hints,
        error: null
    };
}

function extractHints(body) {
    const lines = body.split('\n');
    const hints = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        for (const keyword of HINT_KEYWORDS) {
            if (lowerLine.includes(keyword)) {
                // Clean the line (remove markdown formatting)
                let cleanLine = line
                    .replace(/^[\s*#\-\d.]+/, '')  // Remove leading *, #, -, numbers
                    .replace(/\*\*/g, '')          // Remove bold
                    .replace(/`/g, '')             // Remove code ticks
                    .trim();

                // If line contains a colon, take what's after it
                const colonIdx = cleanLine.indexOf(':');
                if (colonIdx > 0 && colonIdx < 20) {
                    cleanLine = cleanLine.slice(colonIdx + 1).trim();
                }

                // Extract quoted content if present
                const quotedMatch = cleanLine.match(/"([^"]+)"/);
                if (quotedMatch) {
                    cleanLine = quotedMatch[1];
                }

                // Validate length
                if (cleanLine.length >= 10 && cleanLine.length <= 200) {
                    hints.push({
                        keyword,
                        line: i + 1,
                        text: cleanLine
                    });
                }
                break;  // One keyword per line is enough
            }
        }
    }

    // Deduplicate and limit
    const seen = new Set();
    const uniqueHints = hints.filter(h => {
        if (seen.has(h.text)) return false;
        seen.add(h.text);
        return true;
    });

    return uniqueHints.slice(0, 10);  // Max 10 hints
}

// =============================================================================
// Prompt Generator
// =============================================================================

function generateTestPrompts(skill, config, count = 5) {
    const prompts = [];

    // Use description directly
    const desc = (skill.description || '').toLowerCase().replace(/[.!?,]+$/, '').trim();

    // Templates using description
    const templates = [
        `Help me: ${desc}`,
        `I need to: ${desc}`,
        `${desc}`,
        `How do I ${desc}?`,
    ];

    for (let i = 0; i < Math.min(count - 1, templates.length); i++) {
        prompts.push(templates[i]);
    }

    // Add name-based request
    if (prompts.length < count) {
        prompts.push(`Tell me about ${skill.name}`);
    }

    return prompts.slice(0, count);
}


// =============================================================================
// Response Judgment
// =============================================================================

function judgeByRules(response, skill) {
    const lowerResponse = response.toLowerCase();
    const lowerDesc = skill.description.toLowerCase();

    // Extract keywords from skill
    const keywords = [];

    // From name
    const nameWords = skill.name.split(/[-_]/).filter(w => w.length > 3);
    keywords.push(...nameWords);

    // From description (nouns and verbs)
    const descWords = lowerDesc.match(/\b[a-z]{4,}\b/g) || [];
    keywords.push(...descWords.slice(0, 5));

    // Check if response contains keywords
    const matchedKeywords = keywords.filter(kw =>
        lowerResponse.includes(kw.toLowerCase())
    );

    const matchRatio = keywords.length > 0
        ? matchedKeywords.length / keywords.length
        : 0;

    // Check for explicit skill mention
    const mentionsSkill = lowerResponse.includes(skill.name.toLowerCase());

    // Check for action-oriented language
    const hasAction = /\b(will|can|let me|here's|i'll)\b/i.test(response);

    // Calculate confidence
    let confidence = 0;
    if (mentionsSkill) confidence += 0.4;
    if (matchRatio > 0.3) confidence += 0.3;
    if (hasAction) confidence += 0.2;
    if (response.length > 100) confidence += 0.1;

    return {
        verdict: confidence >= 0.5 ? 'YES' : (confidence >= 0.3 ? 'PARTIAL' : 'NO'),
        confidence: Math.min(1, confidence),
        matchedKeywords,
        method: 'rule'
    };
}

async function judgeByLLM(response, skill, prompt, llm) {
    const judgePrompt = `You are evaluating if an AI assistant successfully used a specific skill.

SKILL NAME: ${skill.name}
SKILL DESCRIPTION: ${skill.description}

USER REQUEST: ${prompt}

ASSISTANT RESPONSE:
${response.slice(0, 1000)}

Did the assistant use the skill to respond? Answer with ONE word:
- YES: The response clearly follows the skill's purpose
- PARTIAL: The response partially addresses the skill's purpose
- NO: The response did not use the skill

Answer:`;

    try {
        const result = await llm.chat(
            "You are a precise evaluator. Answer with only YES, PARTIAL, or NO.",
            judgePrompt
        );

        const verdict = result.trim().toUpperCase();
        if (['YES', 'PARTIAL', 'NO'].includes(verdict)) {
            return { verdict, confidence: 0.9, method: 'llm' };
        }
        return { verdict: 'NO', confidence: 0.5, method: 'llm', error: 'Invalid LLM response' };
    } catch (e) {
        return { verdict: 'UNKNOWN', confidence: 0, method: 'llm', error: e.message };
    }
}

async function judgeHybrid(response, skill, prompt, llm, judgeMode) {
    // Always run rule-based judgment
    const ruleResult = judgeByRules(response, skill);

    if (judgeMode === 'rule') {
        return ruleResult;
    }

    if (judgeMode === 'llm') {
        return await judgeByLLM(response, skill, prompt, llm);
    }

    // Hybrid mode: use LLM if rule-based is uncertain
    if (ruleResult.verdict === 'PARTIAL' || ruleResult.confidence < 0.7) {
        try {
            const llmResult = await judgeByLLM(response, skill, prompt, llm);
            // Combine results
            if (llmResult.verdict === 'YES' || ruleResult.verdict === 'YES') {
                return { ...llmResult, ruleResult };
            }
            return { ...llmResult, ruleResult };
        } catch (e) {
            // Fall back to rule-based if LLM fails
            return { ...ruleResult, llmError: e.message };
        }
    }

    return ruleResult;
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function runSmokeTest(skillPath, options = {}) {
    const config = loadConfig();
    const providerName = options.provider || config.default_provider;
    const judgeMode = options.judgeMode || config.judge_mode;
    const testCount = options.testCount || config.test_count;

    console.log(`\n🧪 Smoke Test: ${path.basename(skillPath)}`);
    console.log(`   Provider: ${providerName}`);
    console.log(`   Judge Mode: ${judgeMode}`);
    console.log(`   Test Count: ${testCount}\n`);

    // Initialize
    const llm = new LLMProvider(config, providerName);
    const skill = parseSkill(skillPath);
    const prompts = generateTestPrompts(skill, config, testCount);

    // Build system prompt with skill
    const systemPrompt = `You are a helpful AI assistant. You have access to the following skill:

<skill name="${skill.name}">
${skill.fullContent}
</skill>

When the user's request matches this skill's purpose, use the skill's instructions to respond.
If the request doesn't match, respond normally without using the skill.`;

    // Run tests
    const results = [];
    let passCount = 0;

    for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        const testNum = i + 1;

        process.stdout.write(`   Test ${testNum}/${prompts.length}: "${prompt.slice(0, 40)}..." `);

        const startTime = Date.now();

        try {
            const response = await llm.chat(systemPrompt, prompt);
            const latency = Date.now() - startTime;

            const judgment = await judgeHybrid(response, skill, prompt, llm, judgeMode);

            const passed = judgment.verdict === 'YES';
            if (passed) passCount++;

            console.log(passed ? '✅' : (judgment.verdict === 'PARTIAL' ? '⚠️' : '❌'));

            results.push({
                prompt,
                response_preview: response.slice(0, 200),
                verdict: judgment.verdict,
                confidence: judgment.confidence,
                method: judgment.method,
                latency_ms: latency
            });
        } catch (e) {
            console.log('💥 Error');
            results.push({
                prompt,
                error: e.message,
                verdict: 'ERROR',
                latency_ms: Date.now() - startTime
            });
        }
    }

    const callSuccessRate = passCount / prompts.length;

    console.log(`\n📊 Results: ${passCount}/${prompts.length} passed (${(callSuccessRate * 100).toFixed(0)}%)\n`);

    return {
        skill_id: skill.name,
        skill_path: skillPath,
        tested_at: new Date().toISOString(),
        provider: providerName,
        judge_mode: judgeMode,
        test_count: prompts.length,
        pass_count: passCount,
        call_success_rate: Math.round(callSuccessRate * 100) / 100,
        tests: results,
        summary: `${passCount}/${prompts.length} prompts successfully triggered the skill`
    };
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        skillPath: null,
        provider: null,
        judgeMode: null,
        format: 'json',
        output: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--provider' || arg === '-p') {
            options.provider = args[++i];
        } else if (arg === '--judge-mode' || arg === '-j') {
            options.judgeMode = args[++i];
        } else if (arg === '--format' || arg === '-f') {
            options.format = args[++i];
        } else if (arg === '--output' || arg === '-o') {
            options.output = args[++i];
        } else if (arg === '--extract-only' || arg === '-e') {
            options.extractOnly = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Ontos Skill Evaluator - Smoke Test
===================================

Usage:
  node smoke_test.js <skill_path> [options]

Options:
  --provider, -p      LLM provider (deepseek|qwen|claude|openai|ollama)
  --judge-mode, -j    Judgment mode (rule|llm|hybrid)
  --format, -f        Output format (json|md)
  --output, -o        Output file path
  --extract-only, -e  Only extract skill info and prompts, don't run LLM test
  --help, -h          Show this help

Environment Variables:
  DEEPSEEK_API_KEY    API key for DeepSeek
  QWEN_API_KEY        API key for Qwen (Aliyun DashScope)
  ANTHROPIC_API_KEY   API key for Claude
  OPENAI_API_KEY      API key for OpenAI

Examples:
  node smoke_test.js ./my-skill --extract-only       # Just see extraction
  node smoke_test.js ./my-skill                      # Full test with DeepSeek
  node smoke_test.js ./my-skill --provider qwen
  node smoke_test.js ./my-skill --provider claude --judge-mode llm
`);
            process.exit(0);
        } else if (!arg.startsWith('-')) {
            options.skillPath = arg;
        }
    }

    if (!options.skillPath) {
        console.error('Error: Please provide a skill path');
        process.exit(1);
    }

    return options;
}

function formatMarkdown(report) {
    const badgeEmoji = report.call_success_rate >= 0.8 ? '✅' :
        report.call_success_rate >= 0.5 ? '⚠️' : '❌';

    let lines = [
        `# Smoke Test Report: ${report.skill_id}`,
        '',
        `**Status**: ${badgeEmoji} ${(report.call_success_rate * 100).toFixed(0)}% Success Rate`,
        `**Provider**: ${report.provider}`,
        `**Judge Mode**: ${report.judge_mode}`,
        `**Tested**: ${report.tested_at}`,
        '',
        '## Test Results',
        '',
        '| # | Prompt | Verdict | Latency |',
        '|---|--------|---------|---------|'
    ];

    report.tests.forEach((test, i) => {
        const prompt = test.prompt.length > 30 ? test.prompt.slice(0, 30) + '...' : test.prompt;
        const verdict = test.verdict === 'YES' ? '✅ YES' :
            test.verdict === 'PARTIAL' ? '⚠️ PARTIAL' :
                test.verdict === 'ERROR' ? '💥 ERROR' : '❌ NO';
        lines.push(`| ${i + 1} | ${prompt} | ${verdict} | ${test.latency_ms}ms |`);
    });

    lines.push('');
    lines.push(`## Summary`);
    lines.push('');
    lines.push(report.summary);

    return lines.join('\n');
}

async function main() {
    const options = parseArgs();
    const config = loadConfig();

    try {
        // Parse skill first
        const skill = parseSkill(options.skillPath);

        // Check for parsing errors
        if (skill.error) {
            console.error(`\n❌ Skill Parse Error: ${skill.error}`);
            console.error(`   ${skill.message}`);
            process.exit(1);
        }

        // Extract-only mode: just show parsed data and generated prompts
        if (options.extractOnly) {
            const prompts = generateTestPrompts(skill, config, config.test_count);

            const extractResult = {
                skill_path: options.skillPath,
                parsed: {
                    name: skill.name,
                    description: skill.description,
                    hints: skill.hints
                },
                generated_prompts: prompts
            };

            console.log(JSON.stringify(extractResult, null, 2));
            return;
        }

        // Check API key before running LLM test
        const providerName = options.provider || config.default_provider;
        const provider = new LLMProvider(config, providerName);

        if (!provider.hasApiKey()) {
            console.log(`\n⚠️  ${provider.getMissingKeyMessage()}`);
            console.log(`\nSmoke test requires an LLM to check if your skill triggers correctly.`);
            console.log(`\nTo configure your API key, run:`);
            console.log(`\n  node scripts/setup.js\n`);
            console.log(`Or set environment variable directly:`);
            console.log(`\n  export ${config.providers[providerName].env_key}=your-key\n`);
            console.log(`💡 Tip: Use --extract-only to preview test prompts without LLM\n`);
            process.exit(1);
        }

        // Full smoke test
        const report = await runSmokeTest(options.skillPath, options);

        let output;
        if (options.format === 'md') {
            output = formatMarkdown(report);
        } else {
            output = JSON.stringify(report, null, 2);
        }

        if (options.output) {
            fs.writeFileSync(options.output, output);
            console.log(`Report saved to: ${options.output}`);
        } else {
            console.log(output);
        }

        // Exit with error code if success rate is low
        if (report.call_success_rate < 0.5) {
            process.exit(1);
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
    }
}

main();

