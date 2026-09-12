// Shared server-side helper: fetch a YouTube channel's public RSS feed (no API
// key, no secrets) and return the newest uploads as plain objects. Used by both
// api/youtube.js (Vercel serverless function, in production) and the dev middleware
// in vite.config.js. YouTube's RSS feed returns roughly the 15 most recent uploads.
//
// Titles are cleaned with the shared LLM (api/_llm.js — Gemini/Anthropic/OpenAI,
// whichever key is set): a raw upload title like
//   "Fremont TV | '26-'27: Episode 2 | 9/11 | Shraddha & Sahana"
// becomes a clean display title ("Fremont TV | '26-'27: Episode 2") with the hosts
// pulled out separately, so a brand-new episode looks curated without a media.json
// edit. Cached by raw title; no key / any failure falls back to the heuristic parse.

import { llmTitles, llmError } from './_llm.js'

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

async function fetchRawVideos(channelId) {
  if (!channelId) throw new Error('no channelId')
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FremontASB-site/1.0)' },
  })
  if (!res.ok) throw new Error(`feed ${res.status}`)
  const xml = await res.text()

  const videos = []
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1]
    if (!id) continue
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || ''
    videos.push({ youtubeId: id, title: decodeEntities(title), date: published.slice(0, 10) })
  }
  return videos
}

export async function fetchChannelVideos(channelId) {
  const videos = await fetchRawVideos(channelId)
  return applyEpisodeTitles(videos)
}

// ── LLM-cleaned display titles ────────────────────────────────────────────────
const titleCache = new Map()
const TITLE_INSTRUCTION = [
  "You write clean display titles for a high school ASB's YouTube videos, shown on the school website.",
  'Most are "FremontTV" episodes titled like "Fremont TV | <label> | <airdate> | <hosts>".',
  'For EACH raw title, return the show and episode label ONLY: keep the "Fremont TV | <label>" part',
  '(the season/episode name, e.g. "\'26-\'27: Episode 2" or "Episode 3: Homecoming") and REMOVE the airdate and the host names.',
  'For a non-episode video (a rally, a graduation, an event), return a tidy version of its title with any trailing',
  '"| date", "| names", or "By <names>" removed.',
  'Do not invent or translate text. Keep it faithful. No surrounding quotes and no trailing punctuation.',
  'Examples:',
  '"Fremont TV | \'26-\'27: Episode 2 | 9/11 | Shraddha & Sahana" -> "Fremont TV | \'26-\'27: Episode 2"',
  '"Fremont TV | Episode 3: Homecoming | October 17th | Saisha, Ella, & Yomna" -> "Fremont TV | Episode 3: Homecoming"',
  '"25-26 FremontTV | Episode 1 | 9/19 | Ryan & Ayush" -> "FremontTV | Episode 1"',
  '"Class of 2025 Graduation Student Speeches By Jaidyn Balsara &Zaynab Mohiuddeen" -> "Class of 2025 Graduation Student Speeches"',
  'Return ONLY a JSON array of strings, one per title, in the same order.',
].join(' ')

const kindCache = new Map()
const VALID_KINDS = new Set(['FremontTV', 'Rally', 'Event'])
const KIND_INSTRUCTION = [
  "Classify each of a high school ASB's YouTube video titles into exactly one category.",
  'The categories are: "FremontTV" (the ASB\'s recurring news-show episodes, usually titled "Fremont TV" / "FremontTV" / with "Episode"),',
  '"Rally" (a spirit or pep rally), or "Event" (anything else: graduations, senior videos, performances, one-off events).',
  'Return ONLY a JSON array of strings, one per title in the same order, each exactly one of: FremontTV, Rally, Event.',
].join(' ')

export async function applyEpisodeTitles(videos) {
  // Heuristic first: a clean title + hosts parsed from the channel's naming convention.
  // This is both the no-key fallback and where hosts always come from.
  for (const v of videos) { const p = parseEpisode(v.title); v.cleanTitle = p.title; v.hosts = p.hosts }

  // Then let the LLM produce the display title (cached by raw title, chunked so the
  // strict count-check in llmTitles stays reliable). LLM title wins when available.
  const need = [...new Set(videos.map((v) => v.title).filter((t) => t && !titleCache.has(t)))].slice(0, 60)
  let used = false
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20)
    const titles = await llmTitles(chunk, TITLE_INSTRUCTION)
    if (titles) { used = true; chunk.forEach((raw, j) => { if (titles[j]) titleCache.set(raw, titles[j]) }) }
  }
  for (const v of videos) { if (titleCache.has(v.title)) v.cleanTitle = titleCache.get(v.title) }

  // Kind (FremontTV / Rally / Event) — classified by the LLM so the "one FremontTV in Latest
  // News" rule catches future uploads whatever they're titled. Heuristic guess is the fallback.
  for (const v of videos) v.kind = guessKind(v.cleanTitle || v.title)
  const kneed = [...new Set(videos.map((v) => v.title).filter((t) => t && !kindCache.has(t)))].slice(0, 60)
  for (let i = 0; i < kneed.length; i += 20) {
    const chunk = kneed.slice(i, i + 20)
    const kinds = await llmTitles(chunk, KIND_INSTRUCTION)
    if (kinds) { used = true; chunk.forEach((raw, j) => { const k = String(kinds[j] || '').trim(); if (VALID_KINDS.has(k)) kindCache.set(raw, k) }) }
  }
  for (const v of videos) { if (kindCache.has(v.title)) v.kind = kindCache.get(v.title) }

  videos.titleSource = used ? 'llm' : 'heuristic'
  videos.titleError = used ? '' : llmError()
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
  if (t.includes('fremonttv') || t.includes('fremont tv') || t.includes('episode')) return 'FremontTV'
  return 'Event'
}
