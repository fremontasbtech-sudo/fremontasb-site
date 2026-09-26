// Vercel serverless function: POST /api/contact
//
// The Contact page form. No sign-in (parents and staff use it too), so this checks the
// fields, quietly drops obvious bots, and forwards the message to the Apps Script, which
// appends one row to the private "Contact" tab of the Events spreadsheet. The script
// re-checks everything and rate-limits by email and IP.
//
// Body: { name, email, message, website (honeypot, must be empty), elapsed (ms the form was open) }
import { homecomingNominationsApi } from '../src/data/sources.js'

const LIMITS = { name: 100, email: 254, message: 2000 }
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const clean = (v, max, multiline) => {
  if (typeof v !== 'string') return ''
  let s = v.normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/g, '')
  s = multiline ? s.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n') : s.replace(/\s+/g, ' ')
  s = s.trim()
  return s.length > max ? null : s
}

export function validateContact(body) {
  const name = clean(body.name, LIMITS.name, false)
  const email = clean(body.email, LIMITS.email, false)
  const message = clean(body.message, LIMITS.message, true)
  const errors = []
  if (name === null) errors.push(`Your name must be ${LIMITS.name} characters or fewer.`)
  else if (!name) errors.push('Please enter your first and last name.')
  if (email === null || (email && !EMAIL_OK.test(email))) errors.push('Please check your email address.')
  else if (!email) errors.push('Please enter your school email.')
  if (message === null) errors.push(`Your message must be ${LIMITS.message} characters or fewer.`)
  else if (!message) errors.push('Please write your message or question.')
  return errors.length ? { errors } : { name, email: email.toLowerCase(), message }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method', message: 'POST only.' })
  if (!homecomingNominationsApi) {
    return res.status(503).json({ ok: false, error: 'not-configured', message: 'The contact form isn\u2019t connected yet.' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  body = body || {}

  // Bots fill the hidden "website" field or submit instantly. Tell them it worked and drop it.
  if ((typeof body.website === 'string' && body.website.trim()) || Number(body.elapsed) < 2000) {
    return res.status(200).json({ ok: true })
  }

  const v = validateContact(body)
  if (v.errors) return res.status(400).json({ ok: false, error: 'invalid', message: v.errors.join(' '), errors: v.errors })

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)
  let out
  try {
    const r = await fetch(homecomingNominationsApi, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'contact', name: v.name, email: v.email, message: v.message, ip }),
      redirect: 'follow',
      signal: ctrl.signal,
    })
    out = await r.json()
  } catch {
    out = null
  } finally {
    clearTimeout(timer)
  }

  if (!out || typeof out !== 'object') {
    return res.status(502).json({ ok: false, error: 'busy', message: 'Couldn\u2019t send right now. Please try again in a moment.' })
  }
  if (out.ok === true) return res.status(200).json({ ok: true })
  // An older script version doesn't know 'contact' and asks for a sign-in instead.
  if (out.error === 'signin' || out.error === 'bad-action') {
    return res.status(503).json({ ok: false, error: 'not-configured', message: 'The contact form isn\u2019t connected yet.' })
  }
  const status = out.error === 'invalid' ? 400 : out.error === 'rate' ? 429 : 502
  return res.status(status).json({ ok: false, error: out.error || 'busy', message: out.message || 'Couldn\u2019t send right now. Please try again in a moment.' })
}
