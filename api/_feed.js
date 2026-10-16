// Shared server-side helper: fetch a YouTube channel's public RSS feed and its Videos page (no
// API key, no secrets) and return the newest uploads as plain objects. Used by both
// api/youtube.js (Vercel serverless function, in production) and the dev middleware
// in vite.config.js. YouTube's RSS feed returns roughly the 15 most recent uploads.
//
// Titles are cleaned with the shared LLM (api/_llm.js — Gemini/Anthropic/OpenAI,
// whichever key is set): a raw upload title like
//   "Fremont TV | '26-'27: Episode 2 | 9/11 | Shraddha & Sahana"
// becomes a clean display title ("Fremont TV | '26-'27: Episode 2") with the hosts
// pulled out separately, so a brand-new episode looks curated without a media.json
// edit. Cached by raw title; no key / any failure falls back to the heuristic parse.

import { llmTitles, llmError, llmSource } from './_llm.js'
import { withTimeout } from './_http.js'

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim()
}

// The upload's calendar day in Fremont (America/Los_Angeles), not UTC: an episode uploaded at
// 10:15 PM on Oct 7 is published 05:15 UTC Oct 8, and belongs on Oct 7.
function ptDay(iso) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return String(iso || '').slice(0, 10)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

async function fetchRawVideos(channelId) {
  if (!channelId) throw new Error('no channelId')
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const xml = await withTimeout(8000, async (signal) => {
    const res = await fetch(url, { signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FremontASB-site/1.0)' } })
    if (!res.ok) throw new Error(`feed ${res.status}`)
    return res.text()
  })

  const videos = []
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1]
    if (!id) continue
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || ''
    videos.push({ youtubeId: id, title: decodeEntities(title), date: ptDay(published) })
  }
  return videos
}

export async function fetchChannelVideos(channelId) {
  // The RSS feed is cached by YouTube for about 15 minutes and often lags a new upload by more,
  // so the channel's own Videos page (live, newest first) is read alongside it. Uploads the page
  // lists above the feed's newest video are added on top; the feed stays the source for
  // everything else (exact publish dates). Either source can fail without breaking the other.
  const [feed, page] = await Promise.allSettled([fetchRawVideos(channelId), fetchPageVideos(channelId)])
  const videos = feed.status === 'fulfilled' ? feed.value : []
  const fresh = page.status === 'fulfilled' ? page.value : []
  const known = new Set(videos.map((v) => v.youtubeId))
  const newer = []
  if (videos.length) {
    for (const v of fresh) { if (known.has(v.youtubeId)) break; newer.push(v) }
  } else {
    newer.push(...fresh)
  }
  if (!videos.length && !newer.length && feed.status === 'rejected') throw feed.reason
  return applyEpisodeTitles([...newer, ...videos])
}

// ── Channel Videos page (no key) ─────────────────────────────────────────────
// Reads the ytInitialData JSON embedded in youtube.com/channel/<id>/videos. Supports both the
// current lockupViewModel cards and the older videoRenderer cards. The page gives only a
// relative age ("31 minutes ago"), which is turned into a PT calendar day.
async function fetchPageVideos(channelId) {
  if (!channelId) return []
  const html = await withTimeout(7000, async (signal) => {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/videos`, {
      signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FremontASB-site/1.0)', 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!res.ok) throw new Error(`page ${res.status}`)
    return res.text()
  })
  const start = html.indexOf('var ytInitialData = ')
  if (start < 0) return []
  const from = start + 'var ytInitialData = '.length
  const end = html.indexOf(';</script>', from)
  if (end < 0) return []
  let data
  try { data = JSON.parse(html.slice(from, end)) } catch { return [] }

  const out = []
  const seen = new Set()
  const add = (id, title, age) => {
    if (!id || !title || seen.has(id)) return
    const date = ageToPtDay(age)
    if (!date) return // no age: an upcoming premiere or a live stream that hasn't aired
    seen.add(id)
    out.push({ youtubeId: id, title: decodeEntities(title), date })
  }
  const walk = (o) => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) { for (const x of o) walk(x); return }
    const l = o.lockupViewModel
    if (l && l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
      const meta = l.metadata && l.metadata.lockupMetadataViewModel
      const title = meta && meta.title && meta.title.content
      const rows = (meta && meta.metadata && meta.metadata.contentMetadataViewModel && meta.metadata.contentMetadataViewModel.metadataRows) || []
      let age = ''
      for (const r of rows) for (const part of r.metadataParts || []) {
        const t = part.accessibilityLabel || (part.text && part.text.content) || ''
        if (/\bago$/i.test(t.trim())) age = t
      }
      add(l.contentId, title, age)
      return
    }
    const v = o.videoRenderer
    if (v && v.videoId) {
      const title = (v.title && ((v.title.runs && v.title.runs[0] && v.title.runs[0].text) || v.title.simpleText)) || ''
      add(v.videoId, title, (v.publishedTimeText && v.publishedTimeText.simpleText) || '')
      return
    }
    for (const k in o) walk(o[k])
  }
  walk(data)
  return out
}

const AGE_UNITS = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }
function ageToPtDay(age) {
  const m = String(age || '').replace(/\u00a0/g, ' ').match(/(\d+)\s*(second|sec|minute|min|hour|hr|day|week|wk|month|mo|year|yr)s?\b.*ago/i)
  if (!m) return ''
  const u = m[2].toLowerCase()
  const unit = u.startsWith('sec') ? 'second' : u.startsWith('min') ? 'minute' : u.startsWith('h') ? 'hour'
    : u.startsWith('d') ? 'day' : u.startsWith('w') ? 'week' : u === 'mo' || u.startsWith('month') ? 'month' : 'year'
  return ptDay(new Date(Date.now() - Number(m[1]) * AGE_UNITS[unit]).toISOString())
}

// ── LLM-cleaned display titles ────────────────────────────────────────────────
const titleCache = new Map()
const TITLE_INSTRUCTION = [
  "You write clean display titles for a high school ASB's YouTube videos, shown on the school website.",
  'Most are "Fremont TV" episodes titled like "Fremont TV | <label> | <airdate> | <hosts>".',
  'For EACH raw title, return the show and episode label ONLY: keep the "Fremont TV | <label>" part',
  '(the season/episode name, e.g. "\'26-\'27: Episode 2" or "Episode 3: Homecoming") and REMOVE the airdate and the host names.',
  'For a non-episode video (a rally, a graduation, an event), return a tidy version of its title with any trailing',
  '"| date", "| names", or "By <names>" removed.',
  'Do not invent or translate text. Keep it faithful. No surrounding quotes and no trailing punctuation.',
  'Examples:',
  '"Fremont TV | \'26-\'27: Episode 2 | 9/11 | Shraddha & Sahana" -> "Fremont TV | \'26-\'27: Episode 2"',
  '"Fremont TV | Episode 3: Homecoming | October 17th | Saisha, Ella, & Yomna" -> "Fremont TV | Episode 3: Homecoming"',
  '"25-26 Fremont TV | Episode 1 | 9/19 | Ryan & Ayush" -> "Fremont TV | Episode 1"',
  '"Class of 2025 Graduation Student Speeches By Jaidyn Balsara &Zaynab Mohiuddeen" -> "Class of 2025 Graduation Student Speeches"',
  'Return ONLY a JSON array of strings, one per title, in the same order.',
].join(' ')

const kindCache = new Map()
const VALID_KINDS = new Set(['Fremont TV', 'Rally', 'Event'])
const KIND_INSTRUCTION = [
  "Classify each of a high school ASB's YouTube video titles into exactly one category.",
  'The categories are: "Fremont TV" (the ASB\'s recurring news-show episodes, usually titled "Fremont TV" / "Fremont TV" / with "Episode"),',
  '"Rally" (a spirit or pep rally), or "Event" (anything else: graduations, senior videos, performances, one-off events).',
  'Return ONLY a JSON array of strings, one per title in the same order, each exactly one of: Fremont TV, Rally, Event.',
].join(' ')

export async function applyEpisodeTitles(videos) {
  // Heuristic first: a clean title + hosts parsed from the channel's naming convention.
  // This is both the no-key fallback and where hosts always come from.
  for (const v of videos) { const p = parseEpisode(v.title); v.cleanTitle = p.title; v.hosts = p.hosts }

  // Then let the LLM produce the display title (cached by raw title, chunked so the
  // strict count-check in llmTitles stays reliable). LLM title wins when available.
  const raws = [...new Set(videos.map((v) => v.title).filter(Boolean))]
  const titlesCached = raws.filter((t) => titleCache.has(t)).length
  const kindsCached = raws.filter((t) => kindCache.has(t)).length
  const need = raws.filter((t) => !titleCache.has(t)).slice(0, 60)
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20)
    const titles = await llmTitles(chunk, TITLE_INSTRUCTION)
    if (titles) chunk.forEach((raw, j) => { if (titles[j]) titleCache.set(raw, titles[j]) })
  }
  for (const v of videos) { if (titleCache.has(v.title)) v.cleanTitle = titleCache.get(v.title) }

  // Kind (Fremont TV / Rally / Event) — classified by the LLM so the "one Fremont TV in Latest
  // News" rule catches future uploads whatever they're titled. Heuristic guess is the fallback.
  for (const v of videos) v.kind = guessKind(v.cleanTitle || v.title)
  const kneed = raws.filter((t) => !kindCache.has(t)).slice(0, 60)
  for (let i = 0; i < kneed.length; i += 20) {
    const chunk = kneed.slice(i, i + 20)
    const kinds = await llmTitles(chunk, KIND_INSTRUCTION)
    if (kinds) chunk.forEach((raw, j) => { const k = String(kinds[j] || '').trim(); if (VALID_KINDS.has(k)) kindCache.set(raw, k) })
  }
  for (const v of videos) { if (kindCache.has(v.title)) v.kind = kindCache.get(v.title) }

  // Feed-ordering rule, declared HERE (right where the LLM classifies the kind) so it's owned
  // by the API and true for every future upload, not a per-episode client tweak: Fremont TV is
  // the ASB's MORNING news show (airs 4th period), so in a newest-first feed it must sit BELOW
  // the same day's later games/events. The site's Latest News sort reads this flag.
  for (const v of videos) v.morningShow = v.kind === 'Fremont TV'

  // Diagnostics: count titles and kinds served from earlier calls, from this request's calls,
  // and from the heuristic, so a warm cache reads 'cache' rather than 'heuristic'.
  const fallback = raws.filter((t) => !titleCache.has(t)).length + raws.filter((t) => !kindCache.has(t)).length
  const cached = titlesCached + kindsCached
  videos.titleSource = llmSource({ fresh: raws.length * 2 - cached - fallback, cached, fallback })
  videos.titleFallbacks = fallback
  videos.titleError = fallback ? llmError() : ''
  return videos
}

// Heuristic fallback: "Fremont TV | <label> | <date> | <hosts>" → { title, hosts }.
function parseEpisode(raw) {
  const parts = String(raw || '').split('|').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const di = parts.findIndex((p, i) => i >= 1 && isDateish(p))
    if (di >= 1) {
      return {
        title: parts.slice(0, di).join(' | '),
        hosts: di < parts.length - 1 ? parts.slice(di + 1).join(', ') : '',
      }
    }
  }
  return { title: parts.join(' | '), hosts: '' }
}

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
function isDateish(p) {
  return /^\d{1,2}\/\d{1,2}/.test(p) || /\b\d{1,2}(st|nd|rd|th)\b/i.test(p) || MONTHS.test(p)
}

// Best-effort category when the LLM classifier is unavailable.
function guessKind(title) {
  const t = String(title).toLowerCase()
  if (t.includes('rally')) return 'Rally'
  if (t.includes('fremonttv') || t.includes('fremont tv') || t.includes('episode')) return 'Fremont TV'
  return 'Event'
}
