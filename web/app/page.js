'use client';

import { useState } from 'react';

export default function Home() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleEvaluate = async () => {
        if (!url.trim()) {
            setError('Please enter a skill URL');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() })
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
                    onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
                />
                <p style={styles.hint}>
                    Enter a raw URL to a SKILL.md file (e.g., from GitHub raw content)
                </p>

                <button
                    onClick={handleEvaluate}
                    disabled={loading}
                    style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? '⏳ Evaluating...' : '🔍 Evaluate'}
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
        maxWidth: '600px',
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
    hint: {
        fontSize: '0.75rem',
        color: '#64748b',
        marginTop: '0.5rem',
        marginBottom: '1.5rem'
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
        maxWidth: '600px',
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
