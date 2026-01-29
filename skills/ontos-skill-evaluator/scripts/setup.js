#!/usr/bin/env node
/**
 * Ontos Skill Evaluator - Setup Script
 * =====================================
 * Interactive setup for configuring API keys.
 * Run this after installing the skill.
 * 
 * Usage:
 *     node setup.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const ONTOS_DIR = path.join(os.homedir(), '.ontos');
const ENV_FILE = path.join(ONTOS_DIR, '.env');

const PROVIDERS = [
    { name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', url: 'https://platform.deepseek.com/api_keys' },
    { name: 'Qwen (Aliyun)', envKey: 'QWEN_API_KEY', url: 'https://dashscope.console.aliyun.com/' },
    { name: 'OpenAI', envKey: 'OPENAI_API_KEY', url: 'https://platform.openai.com/api-keys' },
    { name: 'Claude (Anthropic)', envKey: 'ANTHROPIC_API_KEY', url: 'https://console.anthropic.com/settings/keys' },
];

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function question(rl, prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

function loadExistingEnv() {
    const env = {};
    try {
        if (fs.existsSync(ENV_FILE)) {
            const content = fs.readFileSync(ENV_FILE, 'utf-8');
            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    const value = trimmed.slice(eqIdx + 1).trim();
                    env[key] = value;
                }
            }
        }
    } catch (e) {
        // Ignore
    }
    return env;
}

function saveEnv(env) {
    // Ensure directory exists
    if (!fs.existsSync(ONTOS_DIR)) {
        fs.mkdirSync(ONTOS_DIR, { recursive: true });
    }

    // Build content
    const lines = ['# Ontos Skill Evaluator Configuration', ''];
    for (const [key, value] of Object.entries(env)) {
        if (value) {
            lines.push(`${key}=${value}`);
        }
    }

    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n');
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════╗
║     Ontos Skill Evaluator - Setup                    ║
╚══════════════════════════════════════════════════════╝
`);

    const rl = createInterface();
    const existingEnv = loadExistingEnv();

    console.log('This will configure your LLM API keys for smoke testing.\n');
    console.log('🔑 API keys will be saved to: ' + ENV_FILE + '\n');

    // Check existing keys
    const configuredProviders = PROVIDERS.filter(p => existingEnv[p.envKey]);
    if (configuredProviders.length > 0) {
        console.log('✅ Already configured:');
        for (const p of configuredProviders) {
            console.log(`   - ${p.name}`);
        }
        console.log('');
    }

    const proceed = await question(rl, 'Configure API keys now? (y/n, default: y): ');

    if (proceed.toLowerCase() === 'n') {
        console.log('\n⚠️  No API keys configured.');
        console.log('   Smoke tests will run in rule-only mode (no LLM judgment).');
        console.log('   Run this setup again anytime to add API keys.\n');
        rl.close();
        return;
    }

    console.log('\nSelect a provider to configure:\n');
    PROVIDERS.forEach((p, i) => {
        const status = existingEnv[p.envKey] ? ' ✅' : '';
        console.log(`  ${i + 1}. ${p.name}${status}`);
    });
    console.log('  0. Skip / Done\n');

    const choice = await question(rl, 'Enter number (1-4, or 0 to skip): ');
    const idx = parseInt(choice) - 1;

    if (idx >= 0 && idx < PROVIDERS.length) {
        const provider = PROVIDERS[idx];
        console.log(`\n📋 Get your ${provider.name} API key from:`);
        console.log(`   ${provider.url}\n`);

        const key = await question(rl, `Enter ${provider.name} API key (or press Enter to skip): `);

        if (key.trim()) {
            existingEnv[provider.envKey] = key.trim();
            saveEnv(existingEnv);
            console.log(`\n✅ ${provider.name} API key saved!\n`);
        } else {
            console.log('\n⚠️  Skipped.\n');
        }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Setup complete! Run smoke tests with:\n');
    console.log('  node smoke_test.js <skill-path>\n');
    console.log('To reconfigure, run: node setup.js');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    rl.close();
}

main().catch(e => {
    console.error('Setup error:', e.message);
    process.exit(1);
});
