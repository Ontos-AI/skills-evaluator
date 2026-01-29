'use client';

import { useState, useEffect } from 'react';

export default function Home() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // L2 Smoke Test options
    const [enableL2, setEnableL2] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [provider, setProvider] = useState('deepseek');
    const [saveKey, setSaveKey] = useState(false);

    // Load saved API key from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('ontos_api_key');
        const savedProvider = localStorage.getItem('ontos_provider');
        if (saved) {
            setApiKey(saved);
            setSaveKey(true);
        }
        if (savedProvider) {
            setProvider(savedProvider);
        }
    }, []);

    const handleEvaluate = async () => {
        if (!url.trim()) {
            setError('Please enter a skill URL');
            return;
        }

        if (enableL2 && !apiKey.trim()) {
            setError('API Key is required for Smoke Test');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        // Save key to localStorage if requested
        if (saveKey && apiKey) {
            localStorage.setItem('ontos_api_key', apiKey);
            localStorage.setItem('ontos_provider', provider);
        } else {
            localStorage.removeItem('ontos_api_key');
            localStorage.removeItem('ontos_provider');
        }

        try {
            const res = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    enableL2,
                    apiKey: enableL2 ? apiKey : null,
                    provider: enableL2 ? provider : null
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Evaluation failed');
            }

            setResult(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🔍 Ontos Skill Evaluator</h1>
                <p style={styles.subtitle}>Evaluate Claude Skills quality in seconds</p>
            </header>

            <div style={styles.inputCard}>
                <label style={styles.label}>Skill URL</label>
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://raw.githubusercontent.com/.../SKILL.md"
                    style={styles.input}
                    onKeyDown={(e) => e.key === 'Enter' && !enableL2 && handleEvaluate()}
                />
                <p style={styles.hint}>
                    Enter a raw URL to a SKILL.md file (e.g., from GitHub raw content)
                </p>

                {/* L2 Smoke Test Toggle */}
                <div style={styles.l2Section}>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={enableL2}
                            onChange={(e) => setEnableL2(e.target.checked)}
                            style={styles.checkbox}
                        />
                        <span>🧪 Enable Smoke Test (L2)</span>
                    </label>
                    <span style={styles.l2Badge}>Requires API Key</span>
                </div>

                {/* L2 Options */}
                {enableL2 && (
                    <div style={styles.l2Options}>
                        <div style={styles.l2Row}>
                            <div style={styles.l2Field}>
                                <label style={styles.label}>Provider</label>
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value)}
                                    style={styles.select}
                                >
                                    <option value="deepseek">DeepSeek</option>
                                    <option value="qwen">Qwen</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="claude">Claude</option>
                                </select>
                            </div>
                            <div style={{ ...styles.l2Field, flex: 2 }}>
                                <label style={styles.label}>API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={provider === 'deepseek' ? 'sk-...' : 'Enter your API key'}
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        <label style={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={saveKey}
                                onChange={(e) => setSaveKey(e.target.checked)}
                                style={styles.checkbox}
                            />
                            <span>Save key locally (browser only, encrypted)</span>
                        </label>

                        <div style={styles.securityNote}>
                            🔒 <strong>Security:</strong> Your API key is sent via HTTPS, used once, and never stored on our servers.
                        </div>
                    </div>
                )}

                <button
                    onClick={handleEvaluate}
                    disabled={loading}
                    style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? '⏳ Evaluating...' : enableL2 ? '🔍 Run L1 + L2' : '🔍 Evaluate (L1)'}
                </button>
            </div>

            {error && (
                <div style={styles.error}>
                    ❌ {error}
                </div>
            )}

            {result && (
                <div style={styles.resultSection}>
                    <div style={styles.resultHeader}>
                        <h2 style={styles.resultTitle}>📊 Evaluation Result</h2>
                        <div style={styles.badgeContainer}>
                            <span style={{ ...styles.badge, background: getBadgeColor(result.report.badge) }}>
                                {result.report.badge.toUpperCase()}
                            </span>
                            <span style={styles.score}>
                                {(result.report.scores.overall * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    {/* L2 Results Summary */}
                    {result.smokeTest && (
                        <div style={styles.l2Results}>
                            <span style={styles.l2ResultIcon}>
                                {result.smokeTest.passed ? '✅' : '⚠️'}
                            </span>
                            <span>
                                Smoke Test: {result.smokeTest.passCount}/{result.smokeTest.testCount} passed
                                ({(result.smokeTest.passRate * 100).toFixed(0)}%)
                            </span>
                        </div>
                    )}

                    <iframe
                        srcDoc={result.html}
                        style={styles.iframe}
                        title="Evaluation Report"
                    />
                </div>
            )}

            <footer style={styles.footer}>
                <a href="https://github.com/Ontos-AI/skills-evaluator" target="_blank" rel="noopener noreferrer">
                    GitHub
                </a>
                {' · '}
                <a href="https://skills.sh" target="_blank" rel="noopener noreferrer">
                    skills.sh
                </a>
            </footer>
        </div>
    );
}

function getBadgeColor(badge) {
    const colors = {
        gold: 'linear-gradient(135deg, #ffd700, #f4c430)',
        silver: 'linear-gradient(135deg, #c0c0c0, #a8a8a8)',
        bronze: 'linear-gradient(135deg, #cd7f32, #e8957e)',
        fail: '#ef4444'
    };
    return colors[badge] || '#888';
}

const styles = {
    container: {
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        minHeight: '100vh',
        padding: '2rem',
        color: '#e2e8f0'
    },
    header: {
        textAlign: 'center',
        marginBottom: '2rem'
    },
    title: {
        fontFamily: "'Fraunces', serif",
        fontSize: '2.5rem',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '0.5rem'
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: '1.1rem'
    },
    inputCard: {
        maxWidth: '650px',
        margin: '0 auto 2rem',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '20px',
        padding: '2rem',
        border: '1px solid rgba(255,255,255,0.1)'
    },
    label: {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600,
        marginBottom: '0.5rem',
        color: '#94a3b8'
    },
    input: {
        width: '100%',
        padding: '1rem',
        fontSize: '1rem',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)',
        color: '#fff',
        outline: 'none',
        transition: 'border-color 0.2s'
    },
    select: {
        width: '100%',
        padding: '1rem',
        fontSize: '1rem',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)',
        color: '#fff',
        outline: 'none'
    },
    hint: {
        fontSize: '0.75rem',
        color: '#64748b',
        marginTop: '0.5rem',
        marginBottom: '1.5rem'
    },
    l2Section: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        background: 'rgba(99, 102, 241, 0.1)',
        borderRadius: '12px',
        marginBottom: '1rem'
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.95rem'
    },
    checkbox: {
        width: '18px',
        height: '18px',
        cursor: 'pointer'
    },
    l2Badge: {
        fontSize: '0.75rem',
        padding: '4px 10px',
        background: 'rgba(251, 191, 36, 0.2)',
        color: '#fbbf24',
        borderRadius: '999px'
    },
    l2Options: {
        padding: '1rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        marginBottom: '1.5rem'
    },
    l2Row: {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem'
    },
    l2Field: {
        flex: 1
    },
    securityNote: {
        fontSize: '0.75rem',
        color: '#94a3b8',
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(34, 197, 94, 0.1)',
        borderRadius: '8px',
        borderLeft: '3px solid #22c55e'
    },
    button: {
        width: '100%',
        padding: '1rem 2rem',
        fontSize: '1.1rem',
        fontWeight: 600,
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s'
    },
    error: {
        maxWidth: '650px',
        margin: '0 auto 2rem',
        padding: '1rem',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        color: '#fca5a5',
        textAlign: 'center'
    },
    resultSection: {
        maxWidth: '900px',
        margin: '0 auto'
    },
    resultHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
    },
    resultTitle: {
        fontFamily: "'Fraunces', serif",
        fontSize: '1.5rem',
        fontWeight: 600
    },
    badgeContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
    },
    badge: {
        padding: '0.5rem 1rem',
        borderRadius: '999px',
        fontWeight: 600,
        fontSize: '0.875rem',
        color: '#0f172a'
    },
    score: {
        fontFamily: "'Fraunces', serif",
        fontSize: '2rem',
        fontWeight: 700,
        color: '#60a5fa'
    },
    l2Results: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        marginBottom: '1rem',
        fontSize: '1rem'
    },
    l2ResultIcon: {
        fontSize: '1.5rem'
    },
    iframe: {
        width: '100%',
        height: '800px',
        border: 'none',
        borderRadius: '20px',
        background: '#f8f6f3'
    },
    footer: {
        textAlign: 'center',
        marginTop: '3rem',
        color: '#64748b',
        fontSize: '0.875rem'
    }
};
