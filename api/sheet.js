// Vercel serverless function: GET /api/sheet?tab=Spirit%20Points → CSV
// The Events spreadsheet is private, so its PUBLIC tabs (Spirit Points, Events, Sports) are read
// through the Apps Script (runs as the sheet owner; it refuses every other tab) and cached at
// Vercel's edge: fresh for 60 s, then served stale for up to a day while one background request
// refreshes it, so visitors never wait on Apps Script and a sheet edit shows within about a minute.
import { homecomingNominationsApi } from '../src/data/sources.js'
import { publicTabUrl, PUBLIC_TABS } from './_sheet.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*') // the Firebird Hub app may read it too
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
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400')
    return res.status(200).send(text)
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store') // never cache a failure
    return res.status(502).send('')
  } finally {
    clearTimeout(timer)
  }
}
