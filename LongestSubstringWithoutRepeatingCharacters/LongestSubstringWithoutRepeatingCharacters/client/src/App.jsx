import React, { useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export function App() {
  const [text, setText] = useState('')
  const [hashtags, setHashtags] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canGenerate = useMemo(() => text.trim().length > 0 && !loading, [text, loading])

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setHashtags([])
    try {
      const resp = await fetch(`${API_BASE}/generate-hashtags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(data.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setHashtags(data.hashtags || [])
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      padding: 24,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    }}>
      <h1 style={{ marginTop: 0 }}>Unique Hashtag Generator</h1>
      <p style={{ color: '#555' }}>Paste your post below. We'll suggest hashtags from the longest unique substrings of each word.</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your social post here..."
        rows={8}
        style={{ width: '100%', padding: 12, fontSize: 16, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #ccc' }}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{
            background: canGenerate ? '#2563eb' : '#9aa7c7',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            cursor: canGenerate ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'Generating…' : 'Generate Hashtags'}
        </button>
        <button
          onClick={() => { setText(''); setHashtags([]); setError('') }}
          disabled={loading}
          style={{
            background: 'white',
            color: '#111',
            border: '1px solid #ccc',
            padding: '10px 16px',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Suggested Hashtags</h2>
        {hashtags.length === 0 ? (
          <p style={{ color: '#666' }}>No hashtags yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {hashtags.map((h) => (
              <span key={h} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 999, fontSize: 14 }}>{h}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


