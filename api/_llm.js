// Shared LLM title cleaner used by BOTH /api/announcements and /api/flickr.
// Reads whichever key is set as a Vercel env var — ANTHROPIC_API_KEY, OPENAI_API_KEY,
// or GEMINI_API_KEY (auto-detected, Anthropic > OpenAI > Gemini). Given a list of texts
// and an instruction, returns one cleaned title per text (same order) via ONE batched
// call, or null when there's no key or anything fails. It NEVER throws — callers keep
// their heuristic fallback, so the feed always renders.

let lastError = ''
export function llmError() { return lastError }

export async function llmTitles(texts, instruction) {
  const AK = process.env.ANTHROPIC_API_KEY, OK = process.env.OPENAI_API_KEY, GK = process.env.GEMINI_API_KEY
  if (!texts.length || (!AK && !OK && !GK)) return null
  const payload = JSON.stringify(texts)
  try {
    let content
    if (AK) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AK, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 1024,
          messages: [{ role: 'user', content: instruction + '\n\nItems:\n' + payload }] }),
      })
      if (!r.ok) throw new Error('anthropic ' + r.status)
      content = (await r.json()).content?.[0]?.text
    } else if (OK) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OK}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2,
          messages: [{ role: 'system', content: instruction }, { role: 'user', content: payload }] }),
      })
      if (!r.ok) throw new Error('openai ' + r.status)
      content = (await r.json()).choices?.[0]?.message?.content
    } else {
      // Stable aliases so this survives Google retiring specific versions.
      const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.0-flash']
      let ok = null, diag = []
      for (const model of models) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GK)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': GK },
          body: JSON.stringify({ contents: [{ parts: [{ text: instruction + '\n\nItems:\n' + payload }] }] }),
        })
        if (r.ok) { ok = r; break }
        diag.push(model + ':' + r.status + ' ' + (await r.text()).slice(0, 120))
      }
      if (!ok) throw new Error('gemini ' + diag.join(' | '))
      content = (await ok.json()).candidates?.[0]?.content?.parts?.[0]?.text
    }
    if (!content) return null
    const arr = JSON.parse((content.match(/\[[\s\S]*\]/) || [content])[0])
    if (!Array.isArray(arr) || arr.length !== texts.length) return null
    lastError = ''
    return arr.map((t) => String(t == null ? '' : t).replace(/^["'\s]+|["'\s.]+$/g, '').trim())
  } catch (e) { lastError = String(e && e.message || e).slice(0, 300); return null }
}
