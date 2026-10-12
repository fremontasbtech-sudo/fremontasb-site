// Vercel serverless function: GET /api/sheet?tab=Spirit%20Points → CSV
// The Events spreadsheet is private, so its PUBLIC tabs (Spirit Points, Events, Sports) are read
// through the Apps Script (runs as the sheet owner; it refuses every other tab) and cached at
// Vercel's edge: fresh for 60 s, then served stale for 5 more minutes while one background request
// refreshes it, so visitors rarely wait on Apps Script and a sheet edit shows within a few minutes.
// stale-if-error keeps the last good copy for a day whenever a refresh fails (502 below).
import { homecomingNominationsApi } from '../src/data/sources.js'
import { publicTabUrl, PUBLIC_TABS } from './_sheet.js'

// The first header of each tab. A body without it in its first row (an empty tab in the middle
// of a SportsSync rebuild, an error page, the wrong tab) is a failure, not data. If a header is
// renamed in the sheet, change it here too, or this tab stops refreshing.
const FIRST_HEADER = { Events: 'name', Sports: 'push', 'Spirit Points': 'class/event' }

function looksLikeTab(tab, text) {
  const lines = text.split(/\r?\n/).filter((l) => l.replace(/[",\s]/g, '') !== '')
  if (lines.length < 2) return false // a header alone (or '""') is an empty read
  const head = lines[0].split(',').map((c) => c.replace(/"/g, '').trim().toLowerCase())
  return head.includes(FIRST_HEADER[tab])
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*') // the Firebird Hub app may read it too
  res.setHeader('Access-Control-Expose-Headers', 'Age, X-Vercel-Cache') // so the app can tell a stale copy
  const tab = String((req.query && req.query.tab) || '')
  if (!PUBLIC_TABS.includes(tab) || !homecomingNominationsApi) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(404).send('unknown tab')
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)
  try {
    const r = await fetch(publicTabUrl(tab), { redirect: 'follow', signal: ctrl.signal })
    const text = await r.text()
    if (!r.ok || !text.trim() || text.trim().startsWith('<')) throw new Error('sheet unavailable')
    if (!looksLikeTab(tab, text)) {
      console.error(`[sheet] ${tab}: unexpected body, not cached. First line: ${text.split(/\r?\n/)[0].slice(0, 120)}`)
      throw new Error('unexpected body')
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300, stale-if-error=86400')
    return res.status(200).send(text)
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store') // never cache a failure
    return res.status(502).send('')
  } finally {
    clearTimeout(timer)
  }
}
