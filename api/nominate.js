// Vercel serverless function: POST /api/nominate
//
// The ONLY way a Homecoming Court nomination gets written. The browser sends the Google ID
// token it got from "Sign in with Google" plus the picks. We check the token WITH GOOGLE
// (signature, our client ID as audience, not expired, verified @student.fuhsd.org /
// @fuhsd.org email) and give clear errors, then forward the token to the nominations Apps
// Script. The email is never taken from the request body, so no one
// can nominate as someone else. The script re-checks the same token with Google before it
// writes (defense in depth), so there is no shared secret anywhere.
//
// Body: { credential: <Google ID token>, action: 'state' | 'submit', nominees?: [{first,last}] }
import { homecomingNominationsApi, googleClientId } from '../src/data/sources.js'

const CLIENT_ID = googleClientId
const ALLOWED = ['student.fuhsd.org', 'fuhsd.org']
const MAX = 4
const MAX_LEN = 60

const clean = (v) =>
  typeof v === 'string' ? v.replace(/[\t\n\r]/g, ' ').replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim() : ''

async function verify(credential) {
  if (typeof credential !== 'string' || credential.length < 100 || credential.length > 4096) return null
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
  if (!r.ok) return null
  const t = await r.json()
  const email = String(t.email || '').trim().toLowerCase()
  const domain = email.split('@')[1] || ''
  const fresh = Number(t.exp) * 1000 > Date.now()
  const issOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com'
  const verified = t.email_verified === true || t.email_verified === 'true'
  if (t.aud !== CLIENT_ID || !issOk || !fresh || !verified) return null
  return { email, allowed: ALLOWED.includes(domain) }
}

function validate(raw) {
  if (!Array.isArray(raw) || raw.length < 1) return { error: 'Please add at least one nominee (first and last name).' }
  if (raw.length > MAX) return { error: `You can nominate up to ${MAX} people.` }
  const seen = new Set()
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const first = clean(raw[i]?.first)
    const last = clean(raw[i]?.last)
    if (!first || !last) return { error: `Nominee ${i + 1} needs both a first and a last name.` }
    if (first.length > MAX_LEN || last.length > MAX_LEN) return { error: `Nominee ${i + 1}: names must be ${MAX_LEN} characters or fewer.` }
    const key = `${first} ${last}`.toLowerCase()
    if (seen.has(key)) return { error: `You listed ${first} ${last} more than once. Each nominee can only appear one time.` }
    seen.add(key)
    out.push({ first, last })
  }
  return { nominees: out }
}

async function callScript(payload) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)
  try {
    const r = await fetch(homecomingNominationsApi, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal,
    })
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method', message: 'POST only.' })
  if (!homecomingNominationsApi || !CLIENT_ID) {
    return res.status(503).json({ ok: false, error: 'not-configured', message: 'Nominations aren’t connected yet. Please tell ASB.' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  body = body || {}

  let who
  try { who = await verify(body.credential) } catch { who = undefined }
  if (who === undefined) return res.status(502).json({ ok: false, error: 'busy', message: 'Couldn’t reach Google to check your sign-in. Please try again.' })
  if (!who) return res.status(401).json({ ok: false, error: 'signin', message: 'Your sign-in expired. Please sign in again.' })
  if (!who.allowed) {
    return res.status(403).json({ ok: false, error: 'wrong-domain', email: who.email, message: 'That’s not a school account. Sign in with your @student.fuhsd.org account.' })
  }

  const action = body.action === 'submit' ? 'submit' : 'state'
  let nominees
  if (action === 'submit') {
    const v = validate(body.nominees)
    if (v.error) return res.status(400).json({ ok: false, error: 'invalid', message: v.error })
    nominees = v.nominees
  }

  try {
    const out = await callScript({ action, credential: body.credential, nominees })
    if (!out || typeof out !== 'object') throw new Error('bad reply')
    // Old script version (no token check yet) answers POSTs with 'use-page'.
    if (out.error === 'use-page') {
      return res.status(503).json({ ok: false, error: 'not-configured', message: 'Nominations aren’t connected yet. Please tell ASB.' })
    }
    if (out.error === 'signin' || out.error === 'wrong-domain') return res.status(401).json(out)
    if (action === 'state') return res.status(200).json({ ok: true, email: who.email, config: out.config, existing: out.existing || null })
    return res.status(200).json({ ...out, email: who.email })
  } catch {
    return res.status(502).json({ ok: false, error: 'busy', message: 'Couldn’t save right now. Please try again in a moment.' })
  }
}
