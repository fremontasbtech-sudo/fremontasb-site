// Vercel serverless function: GET /api/nominations-config → { open, mode, cycle, deadline }
// The Homecoming nominations Config tab, read from the Apps Script (?view=config) and cached at
// Vercel's edge. Apps Script can take 10-30 s on a cold start; without this cache every visitor
// (e.g. everyone scanning the QR code) would stare at "Loading…" that long. Fresh for 60 s, then
// served stale for up to a day while one background request refreshes it, so a Config-cell
// change shows up within about a minute and nobody ever waits on Apps Script.
import { homecomingNominationsApi, homecomingNominationsClosesAt } from '../src/data/sources.js'

const CLOSES_AT = Date.parse(homecomingNominationsClosesAt)

export default async function handler(req, res) {
  if (!homecomingNominationsApi) return res.status(200).json({ open: false })
  if (Number.isFinite(CLOSES_AT) && Date.now() >= CLOSES_AT) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')
    return res.status(200).json({ open: false, mode: 'live', cycle: '', deadline: '', closesAt: homecomingNominationsClosesAt })
  }
  const url = `${homecomingNominationsApi}${homecomingNominationsApi.includes('?') ? '&' : '?'}view=config`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal })
    const d = await r.json()
    if (!d || typeof d.open === 'undefined') throw new Error('bad config')
    // Past the hard deadline the answer is "closed" whatever the sheet says. Near the deadline the
    // edge cache is kept short so nobody is served a stale "open".
    const past = Number.isFinite(CLOSES_AT) && Date.now() >= CLOSES_AT
    // On closing day, keep the edge copy short so a Config change (the emergency switch) shows fast.
    const closingDay = Number.isFinite(CLOSES_AT) && !past && CLOSES_AT - Date.now() < 24 * 60 * 60 * 1000
    const soon = Number.isFinite(CLOSES_AT) && !past && CLOSES_AT - Date.now() < 10 * 60 * 1000
    res.setHeader('Cache-Control', soon ? 'no-store' : closingDay ? 's-maxage=10, stale-while-revalidate=60' : 's-maxage=60, stale-while-revalidate=86400')
    return res.status(200).json({ open: past ? false : d.open, mode: d.mode, cycle: d.cycle || '', deadline: d.deadline || '', closesAt: homecomingNominationsClosesAt })
  } catch (err) {
    // Never cache a failure; the client keeps its own cached copy and retries.
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({ error: String((err && err.message) || err) })
  } finally {
    clearTimeout(timer)
  }
}
