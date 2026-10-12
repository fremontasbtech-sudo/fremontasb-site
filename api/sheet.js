// Vercel serverless function: GET /api/sheet?tab=Spirit%20Points → CSV
// The Events spreadsheet is private, so its PUBLIC tabs (Spirit Points, Events, Sports) are read
// through the Apps Script (runs as the sheet owner; it refuses every other tab) and cached at
// Vercel's edge: fresh for 60 s, then served stale for up to 10 more minutes while one background
// request refreshes it, so visitors rarely wait on Apps Script and a sheet edit shows within a
// minute or two. stale-if-error keeps the last good copy for a day whenever a refresh fails (502 below).
import { homecomingNominationsApi } from '../src/data/sources.js'
import { publicTabUrl, PUBLIC_TABS } from './_sheet.js'

// A real table has at least 2 non-blank lines. Fewer (a header alone, or the '""' an empty tab
// gives in the middle of a SportsSync rebuild) is a failed read, not data. Header names are not
// checked: the readers find their columns and class rows by name, so renaming a header or adding
// a title row in the sheet must not stop the tab from refreshing.
const hasRows = (text) => text.split(/\r?\n/).filter((l) => l.replace(/[",\s]/g, '') !== '').length >= 2

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
    if (!hasRows(text)) {
      console.error(`[sheet] ${tab}: fewer than 2 rows, not cached`)
      throw new Error('empty tab')
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600, stale-if-error=86400')
    return res.status(200).send(text)
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store') // never cache a failure
    return res.status(502).send('')
  } finally {
    clearTimeout(timer)
  }
}
