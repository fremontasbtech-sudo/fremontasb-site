// Shared LLM title cleaner used by /api/announcements, /api/flickr, /api/youtube and /api/clubs.
// Reads whichever key is set as a Vercel env var: ANTHROPIC_API_KEY, OPENAI_API_KEY, or a Gemini
// key (auto-detected, Anthropic > OpenAI > Gemini). For Gemini, SITE_GEMINI_API_KEY wins over
// GEMINI_API_KEY, so the website can run on its own Google project and never spend the quota that
// Ask Felipe (the Firebird Hub app) needs. Given a list of texts and an instruction, returns one
// cleaned value per text (same order), or null when nothing could be produced. It NEVER throws:
// callers keep their heuristic fallback, so the feed always renders.
//
// Quota savers (2026-11-18, after the free Gemini quota ran out):
//  1. Every cleaned value is stored in the Vercel Runtime Cache (shared by all instances in the
//     region) for 7 days, keyed by a hash of the instruction plus the input text. A title is
//     computed once, not once per cold start. Only the texts the cache misses go to the LLM.
//     Outside Vercel (or if the package is missing) a per-instance Map does the same job.
//     Callers pass validate(value) so a value they would reject (too long, an unknown category)
//     is never kept and is asked for again next time. getCache() is given a SHA-256 key hash
//     (its default is a 32-bit hash), and each value carries its full key, so a hit for another
//     key is a miss.
//  2. When Gemini says the quota is used up (HTTP 429), that is remembered in the same shared
//     cache until the next midnight Pacific (when Google resets the free daily quota), and every
//     call skips the LLM until then. A per-minute limit is remembered for its retry delay. The
//     other models are NOT tried after a 429: they draw on the same project, which Felipe may share.
// The returned array carries `fromCache` (one boolean per item) so callers can report 'cache'.

import { createHash } from 'node:crypto'

const TTL_SECONDS = 7 * 24 * 3600
const CACHE_TAG = 'site-llm-titles'
const QUOTA_TAG = 'site-llm-quota'

let lastError = ''
export function llmError() { return lastError }

// Where a batch of cleaned values came from, for the diagnostic fields the /api routes return:
// 'llm' when every value came from the LLM (a call made now), 'cache' when every value came from
// earlier LLM calls (this instance's memory or the shared Runtime Cache), 'mixed' when some fell
// back to the heuristic and 'heuristic' when all of them did. Pass counts: { fresh, cached, fallback }.
export function llmSource({ fresh = 0, cached = 0, fallback = 0 } = {}) {
  if (fallback) return fresh || cached ? 'mixed' : 'heuristic'
  return !fresh && cached ? 'cache' : 'llm'
}

// True when item j of an llmTitles() result came from the shared cache rather than a call made now.
export function fromCache(arr, j) { return !!(arr && arr.fromCache && arr.fromCache[j]) }

// ── Shared cache (Vercel Runtime Cache, or a per-instance Map) ───────────────────────────────
const memory = new Map() // key -> { value, expires }
const memoryCache = {
  async get(k) { const e = memory.get(k); if (!e) return null; if (e.expires < Date.now()) { memory.delete(k); return null } return e.value },
  async set(k, value, opts = {}) { memory.set(k, { value, expires: Date.now() + (opts.ttl || TTL_SECONDS) * 1000 }) },
}
let cachePromise = null
function sharedCache() {
  if (!cachePromise) {
    cachePromise = import('@vercel/functions')
      .then((m) => (typeof m.getCache === 'function'
        ? m.getCache({ namespace: 'fremontasb-llm', keyHashFunction: (k) => createHash('sha256').update(String(k)).digest('hex') })
        : memoryCache))
      .catch(() => memoryCache)
  }
  return cachePromise
}
// Never let a slow or broken cache hold up a page: every call is bounded and errors read as a miss.
function bounded(p, ms, fallback) {
  let t
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise((res) => { t = setTimeout(() => res(fallback), ms) }),
  ]).finally(() => clearTimeout(t))
}
// Values are stored as { k: <full key>, v: <value> }; anything else (or another key's entry) is a miss.
async function cacheGet(key) {
  try {
    const c = await sharedCache()
    const e = await bounded(c.get(key), 1500, null)
    return e && typeof e === 'object' && e.k === key ? e.v : null
  } catch { return null }
}
async function cacheSet(key, value, ttl, tag) {
  try { const c = await sharedCache(); await bounded(c.set(key, { k: key, v: value }, { ttl, tags: [tag], name: '' }), 1500, null) } catch { /* ignore */ }
}

const sha = (s) => createHash('sha256').update(s).digest('hex')
const itemKey = (instruction, text) => 'title:v2:' + sha(instruction + '\u0000' + text)

// ── Gemini quota memory ──────────────────────────────────────────────────────────────────────
// Seconds until just after the next midnight in Pacific time (Google's daily quota reset).
// DST days are 23 or 25 hours long, so the wall-clock guess is checked and corrected by an hour.
function ptClock(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { h: Number(p.hour) % 24, m: Number(p.minute), s: Number(p.second) }
}
export function secondsUntilMidnightPT(now = Date.now()) {
  const c = ptClock(now)
  let secs = 86400 - (c.h * 3600 + c.m * 60 + c.s)
  const h = ptClock(now + secs * 1000).h
  if (h === 23) secs += 3600
  else if (h === 1) secs -= 3600
  return Math.max(60, secs + 60)
}

// Reads a Gemini 429 body. Returns { seconds, reason } for how long to stop calling, or null.
// A per-day quota (or a "you exceeded your current quota" message with no detail) lasts until
// midnight Pacific; a per-minute limit lasts its retry delay (default 60 s).
export function quotaBackoff(status, bodyText, now = Date.now()) {
  if (status !== 429) return null
  let j = null
  try { j = JSON.parse(bodyText) } catch { /* not JSON */ }
  const details = (j && j.error && Array.isArray(j.error.details)) ? j.error.details : []
  const ids = details.flatMap((d) => (Array.isArray(d.violations) ? d.violations : []).map((v) => String(v.quotaId || v.quotaMetric || ''))).join(' ')
  const retryRaw = details.find((d) => String(d['@type'] || '').includes('RetryInfo'))?.retryDelay
  const retry = Math.ceil(parseFloat(String(retryRaw || '')) || 0)
  const msg = String((j && j.error && j.error.message) || bodyText || '')
  // With no quota id, only Google's "exceeded your current quota" wording counts as daily; the
  // older "Resource has been exhausted (e.g. check quota)" is a short rate limit.
  const daily = /PerDay|per_day|daily/i.test(ids) || (!/PerMinute|per_minute/i.test(ids) && /exceeded your current quota/i.test(msg))
  if (daily) return { seconds: secondsUntilMidnightPT(now), reason: 'daily quota used up' }
  return { seconds: Math.min(600, Math.max(15, retry || 60)), reason: 'rate limited' }
}

const quotaMemory = new Map() // key fingerprint -> { until, reason }
const quotaKey = (fp) => 'gemini-quota:v2:' + fp
async function quotaBlocked(fp) {
  const now = Date.now()
  const local = quotaMemory.get(fp)
  if (local && local.until > now) return local
  const shared = await cacheGet(quotaKey(fp))
  if (shared && Number(shared.until) > now) { quotaMemory.set(fp, shared); return shared }
  return null
}
async function rememberQuota(fp, backoff) {
  const v = { until: Date.now() + backoff.seconds * 1000, reason: backoff.reason }
  quotaMemory.set(fp, v)
  await cacheSet(quotaKey(fp), v, backoff.seconds, QUOTA_TAG)
}
const ptTime = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date(ms))

// ── Providers ────────────────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ctrl.signal }) } finally { clearTimeout(t) }
}

// One batched call for `texts`. Returns the cleaned array (same length) or throws.
async function callLLM(texts, instruction) {
  const AK = process.env.ANTHROPIC_API_KEY, OK = process.env.OPENAI_API_KEY
  const GK = process.env.SITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
  if (!AK && !OK && !GK) throw new Error('no LLM key set')
  const payload = JSON.stringify(texts)
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
    // The quota flag is per key (a short hash of it, never the key itself), so moving to a new
    // key in another project starts fresh at once.
    const fp = sha(GK).slice(0, 12)
    const blocked = await quotaBlocked(fp)
    if (blocked) throw new Error(`gemini skipped: ${blocked.reason} until ${ptTime(blocked.until)} PT`)
    // Stable aliases first so this survives Google retiring specific versions. An overloaded
    // model (5xx) is retried once after a short pause, then the next model is tried. A 429 stops
    // everything (see the header). Other 4xx (a retired model, say) move on to the next model.
    const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
    const body = JSON.stringify({
      contents: [{ parts: [{ text: instruction + '\n\nItems:\n' + payload }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    })
    let ok = null
    const diag = []
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
        const text = await r.text().catch(() => '')
        diag.push(model + ':' + r.status + ' ' + text.slice(0, 100))
        const backoff = quotaBackoff(r.status, text)
        if (backoff) {
          await rememberQuota(fp, backoff)
          diag.push(`stopped: ${backoff.reason}, no calls until ${ptTime(Date.now() + backoff.seconds * 1000)} PT`)
          break outer
        }
        if (r.status < 500 || attempt === 1) break
        await new Promise((res) => setTimeout(res, 900))
      }
    }
    if (!ok) throw new Error('gemini ' + diag.join(' | '))
    content = (await ok.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('')
  }
  if (!content) throw new Error('empty reply')
  const arr = JSON.parse((content.match(/\[[\s\S]*\]/) || [content])[0])
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error('reply had the wrong number of items')
  // No em dashes in anything shown on the site: "A — B" becomes "A, B".
  return arr.map((t) => String(t == null ? '' : t).replace(/\s*[—]\s*|\s+--\s+/g, ', ').replace(/^["'\s]+|["'\s.]+$/g, '').trim())
}

// validate(value) -> true when the caller will use that value; only those are kept in the cache.
export async function llmTitles(texts, instruction, validate) {
  if (!texts || !texts.length) return null
  try {
    const keys = texts.map((t) => itemKey(instruction, String(t)))
    const hits = await Promise.all(keys.map(cacheGet))
    const cachedFlags = hits.map((h) => typeof h === 'string' && h !== '')
    const miss = texts.map((_, i) => i).filter((i) => !cachedFlags[i])
    let fresh = null
    if (miss.length) {
      try {
        fresh = await callLLM(miss.map((i) => texts[i]), instruction)
        lastError = ''
        const keep = (v) => { if (!v) return false; try { return typeof validate !== 'function' || !!validate(v) } catch { return false } }
        await Promise.all(miss.map((i, k) => (keep(fresh[k]) ? cacheSet(keys[i], fresh[k], TTL_SECONDS, CACHE_TAG) : null)))
      } catch (e) { lastError = String(e && e.message || e).slice(0, 300) }
    }
    if (!fresh && !cachedFlags.some(Boolean)) return null
    const freshAt = new Map(miss.map((i, k) => [i, fresh ? fresh[k] : '']))
    const out = texts.map((_, i) => (cachedFlags[i] ? hits[i] : freshAt.get(i) || ''))
    out.fromCache = cachedFlags
    return out
  } catch (e) { lastError = String(e && e.message || e).slice(0, 300); return null }
}

// For tests only: swap the shared cache, and clear this instance's memory.
export const __test = {
  setCache(c) { cachePromise = Promise.resolve(c) },
  reset() { memory.clear(); quotaMemory.clear(); cachePromise = null; lastError = '' },
}
