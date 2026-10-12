// Shared LLM title cleaner used by BOTH /api/announcements and /api/flickr.
// Reads whichever key is set as a Vercel env var — ANTHROPIC_API_KEY, OPENAI_API_KEY,
// or GEMINI_API_KEY (auto-detected, Anthropic > OpenAI > Gemini). Given a list of texts
// and an instruction, returns one cleaned title per text (same order) via ONE batched
// call, or null when there's no key or anything fails. It NEVER throws — callers keep
// their heuristic fallback, so the feed always renders.

let lastError = ''

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ctrl.signal }) } finally { clearTimeout(t) }
}
export function llmError() { return lastError }

// Where a batch of cleaned values came from, for the diagnostic fields the /api routes return:
// 'llm' when every value came from the LLM (a call made now), 'cache' when every value came from
// earlier LLM calls on this instance, 'mixed' when some fell back to the heuristic and
// 'heuristic' when all of them did. Pass counts of values: { fresh, cached, fallback }.
export function llmSource({ fresh = 0, cached = 0, fallback = 0 } = {}) {
  if (fallback) return fresh || cached ? 'mixed' : 'heuristic'
  return !fresh && cached ? 'cache' : 'llm'
}

export async function llmTitles(texts, instruction) {
  const AK = process.env.ANTHROPIC_API_KEY, OK = process.env.OPENAI_API_KEY, GK = process.env.GEMINI_API_KEY
  if (!texts.length || (!AK && !OK && !GK)) return null
  const payload = JSON.stringify(texts)
  try {
    let content
    if (AK) {
      // Claude Haiku 5.5. Thinking is off (allowed at its default effort) because this is a short
      // formatting job; the reply's text block is found by type rather than position.
      const r = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AK, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 4096, thinking: { type: 'disabled' },
          messages: [{ role: 'user', content: instruction + '\n\nItems:\n' + payload }] }),
      }, 12000)
      if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + (await r.text()).slice(0, 100))
      const msg = await r.json()
      if (msg.stop_reason === 'refusal') throw new Error('anthropic refusal')
      content = (msg.content || []).find((b) => b.type === 'text')?.text
    } else if (OK) {
      const r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OK}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2,
          messages: [{ role: 'system', content: instruction }, { role: 'user', content: payload }] }),
      }, 12000)
      if (!r.ok) throw new Error('openai ' + r.status)
      content = (await r.json()).choices?.[0]?.message?.content
    } else {
      // Stable aliases first so this survives Google retiring specific versions. An overloaded
      // model (5xx) is retried once after a short pause; a model out of quota (429) is skipped;
      // either way the next model is tried, so one hiccup no longer drops the batch to the heuristic.
      const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
      const body = JSON.stringify({
        contents: [{ parts: [{ text: instruction + '\n\nItems:\n' + payload }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      })
      let ok = null, diag = []
      outer: for (const model of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          let r
          try {
            // The key goes only in the header, never in the URL (URLs end up in logs).
            r = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-goog-api-key': GK },
              body,
            }, 12000)
          } catch (e) { diag.push(model + ':timeout'); break }
          if (r.ok) { ok = r; break outer }
          diag.push(model + ':' + r.status + ' ' + (await r.text()).slice(0, 100))
          // 429 = this model's quota is used up: retrying it is pointless, move to the next model
          // (each model has its own free-tier quota). 5xx = overloaded: one retry after a pause.
          if (r.status < 500 || attempt === 1) break
          await new Promise((res) => setTimeout(res, 900))
        }
      }
      if (!ok) throw new Error('gemini ' + diag.join(' | '))
      content = (await ok.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('')
    }
    if (!content) return null
    const arr = JSON.parse((content.match(/\[[\s\S]*\]/) || [content])[0])
    if (!Array.isArray(arr) || arr.length !== texts.length) return null
    lastError = ''
    // No em dashes in anything shown on the site: "A — B" becomes "A, B".
    return arr.map((t) => String(t == null ? '' : t).replace(/\s*[\u2014]\s*|\s+--\s+/g, ', ').replace(/^["'\s]+|["'\s.]+$/g, '').trim())
  } catch (e) { lastError = String(e && e.message || e).slice(0, 300); return null }
}
