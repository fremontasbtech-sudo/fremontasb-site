import { useEffect, useRef, useState } from 'react'
import { school } from '../data/sources'
import { Notice } from './DataState'

/**
 * ContactForm - the Contact page form. Same 3 questions as the old Google Form.
 * POSTs to /api/contact, which saves one row in the private "Contact" tab of the Events sheet.
 * No sign-in, so parents and staff can use it too. A draft survives a reload (sessionStorage).
 */
const LIMITS = { name: 100, email: 254, message: 2000 }
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DRAFT_KEY = 'fasb.contact.draft'
const EMPTY = { name: '', email: '', message: '' }

const inputBase =
  'w-full rounded-btn border bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-body/45 ' +
  'transition-colors focus-visible:border-brand'
const linkCls = 'font-bold text-brand underline-offset-4 hover:underline'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function readDraft() {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
    if (d && typeof d === 'object') {
      return { name: String(d.name || ''), email: String(d.email || ''), message: String(d.message || '') }
    }
  } catch { /* private mode or bad JSON */ }
  return EMPTY
}
function writeDraft(v) {
  try {
    if (!v.name && !v.email && !v.message) sessionStorage.removeItem(DRAFT_KEY)
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v))
  } catch { /* ignore */ }
}

function check(v) {
  const e = {}
  if (!v.name.trim()) e.name = 'Please enter your first and last name.'
  else if (v.name.trim().length > LIMITS.name) e.name = `Your name must be ${LIMITS.name} characters or fewer.`
  if (!v.email.trim()) e.email = 'Please enter your school email.'
  else if (!EMAIL_OK.test(v.email.trim()) || v.email.trim().length > LIMITS.email) e.email = 'Please check your email address.'
  if (!v.message.trim()) e.message = 'Please write your message or question.'
  else if (v.message.trim().length > LIMITS.message) e.message = `Your message must be ${LIMITS.message} characters or fewer.`
  return e
}

export default function ContactForm() {
  const [values, setValues] = useState(readDraft)
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('form') // form | sending | sent
  const [notice, setNotice] = useState('')
  const [sent, setSent] = useState(null)
  const [website, setWebsite] = useState('') // honeypot
  const openedAt = useRef(Date.now())
  const errRef = useRef(null)
  const headRef = useRef(null)
  const firstRender = useRef(true)

  useEffect(() => { if (phase === 'form') writeDraft(values) }, [values, phase])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    headRef.current?.focus({ preventScroll: true })
    headRef.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [phase === 'sent'])

  const set = (k) => (ev) => {
    const val = ev.target.value
    setValues((v) => ({ ...v, [k]: val }))
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n })
  }

  async function send(payload) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const out = await r.json().catch(() => null)
        if (out && out.ok === true) return { ok: true }
        if (out && out.error && out.error !== 'busy') return out
      } catch { /* network: retry once */ }
      if (attempt === 0) await sleep(800 + Math.random() * 700)
    }
    return { ok: false, error: 'busy' }
  }

  async function onSubmit(ev) {
    ev.preventDefault()
    if (phase === 'sending') return
    setNotice('')
    const e = check(values)
    setErrors(e)
    if (Object.keys(e).length) {
      requestAnimationFrame(() => { errRef.current?.focus({ preventScroll: true }); errRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) })
      return
    }
    setPhase('sending')
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      message: values.message.trim(),
      website,
      elapsed: Date.now() - openedAt.current,
    }
    const out = await send(payload)
    if (out.ok) {
      setSent(payload)
      setValues(EMPTY)
      writeDraft(EMPTY)
      setPhase('sent')
      return
    }
    setPhase('form')
    if (out.error === 'invalid' && out.message) setNotice(out.message)
    else if (out.error === 'rate') setNotice('You’ve sent a few messages in a row. Please wait a few minutes and try again.')
    else setNotice('busy')
  }

  const again = () => {
    setSent(null)
    setErrors({})
    setNotice('')
    openedAt.current = Date.now()
    setPhase('form')
  }

  if (phase === 'sent' && sent) {
    return (
      <section className="card-surface scroll-mt-24 p-6 sm:p-8" aria-labelledby="contact-heading">
        <p className="eyebrow flex items-center gap-2" role="status" aria-live="polite">
          <CheckIcon />Message sent
        </p>
        <h2 id="contact-heading" ref={headRef} tabIndex={-1} className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink outline-none sm:text-3xl">
          Thanks for reaching out
        </h2>
        <p className="mt-4 leading-relaxed text-body">
          Your message is with the ASB officers now. If you asked a question, we&rsquo;ll reply to the email you gave us.
        </p>
        <div className="mt-6 rounded-lg border border-rule bg-[#F6F4F2] p-4 sm:p-5">
          <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-ink">What you sent</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-body">From</dt>
              <dd translate="no" className="mt-0.5 break-words font-bold text-ink">{sent.name}</dd>
              <dd translate="no" className="break-all text-ink">{sent.email}</dd>
            </div>
            <div>
              <dt className="text-body">Message</dt>
              <dd translate="no" className="mt-0.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-ink">{sent.message}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row">
          <button type="button" className="btn-secondary" onClick={again}>Send another message</button>
        </div>
      </section>
    )
  }

  const errList = Object.values(errors)
  const sending = phase === 'sending'
  const count = values.message.trim().length
  const near = count > LIMITS.message * 0.9

  return (
    <section className="card-surface scroll-mt-24 p-6 sm:p-8" aria-labelledby="contact-heading">
      <p className="eyebrow">Send us a message</p>
      <h2 id="contact-heading" ref={headRef} tabIndex={-1} className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink outline-none sm:text-3xl">
        Contact Fremont ASB
      </h2>
      <p className="mt-4 leading-relaxed text-body">
        Have a question, suggestion, or idea for Fremont&rsquo;s Associated Student Body? We want to hear from you. Use this form to reach your student officers, share feedback about an event, or ask about upcoming school activities.
      </p>

      <div
        ref={errRef}
        tabIndex={-1}
        role="alert"
        className={errList.length ? 'mt-6 scroll-mt-24 rounded-btn border border-brand/40 bg-brand-tint px-4 py-3 text-sm text-ink outline-none' : 'sr-only'}
      >
        {errList.length > 0 && (
          <>
            <p className="font-bold">{errList.length > 1 ? 'Please fix the following:' : 'Please fix this:'}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              {errList.map((er) => <li key={er}>{er}</li>)}
            </ul>
          </>
        )}
      </div>

      <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate aria-busy={sending}>
        <Field id="ct-name" label="Full name (first and last)" error={errors.name}>
          <input
            id="ct-name" name="name" type="text" autoComplete="name" translate="no"
            value={values.name} onChange={set('name')} maxLength={LIMITS.name + 20} disabled={sending}
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'ct-name-err' : undefined}
            className={`${inputBase} min-h-[44px] ${errors.name ? 'border-brand ring-1 ring-brand' : 'border-rule'}`}
          />
        </Field>

        <Field id="ct-email" label="School email" hint="We’ll only use this to reply to you." error={errors.email}>
          <input
            id="ct-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} translate="no"
            placeholder="you@student.fuhsd.org"
            value={values.email} onChange={set('email')} maxLength={LIMITS.email} disabled={sending}
            aria-invalid={!!errors.email} aria-describedby={`ct-email-hint${errors.email ? ' ct-email-err' : ''}`}
            className={`${inputBase} min-h-[44px] ${errors.email ? 'border-brand ring-1 ring-brand' : 'border-rule'}`}
          />
        </Field>

        <Field id="ct-message" label="Message or question for Fremont ASB" error={errors.message}
          aside={<span className={`tabular-nums ${near ? 'font-bold text-brand' : ''}`} aria-hidden="true">{count} / {LIMITS.message}</span>}
        >
          <textarea
            id="ct-message" name="message" rows={6} translate="no"
            value={values.message} onChange={set('message')} maxLength={LIMITS.message + 200} disabled={sending}
            aria-invalid={!!errors.message} aria-describedby={errors.message ? 'ct-message-err' : undefined}
            className={`${inputBase} min-h-[160px] resize-y leading-relaxed ${errors.message ? 'border-brand ring-1 ring-brand' : 'border-rule'}`}
          />
        </Field>

        {/* Honeypot: hidden from people and screen readers; bots that fill it are dropped. */}
        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="ct-website">Website</label>
          <input id="ct-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {notice && (
          <div role="alert">
            <Notice>
              {notice === 'busy' ? (
                <>
                  <span>Couldn&rsquo;t send your message right now. Please try again in a moment, or email us at </span>
                  <a href={`mailto:${school.email}`} className={`${linkCls} [overflow-wrap:anywhere]`}>{school.email}</a>.
                </>
              ) : notice}
            </Notice>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
          <button type="submit" className={sending ? 'btn-disabled' : 'btn-primary'} disabled={sending}>
            {sending
              ? <><span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" /><span>Sending…</span></>
              : 'Send message'}
          </button>
          <p className="sr-only" role="status" aria-live="polite">{sending ? 'Sending your message.' : ''}</p>
        </div>
      </form>

      <div className="mt-7 border-t border-rule pt-5 text-sm leading-relaxed text-body">
        <p>
          <span>Your name, email, and message are saved in an ASB Google Sheet that only ASB advisors and ASB Tech can see. We use them only to read and answer your message. </span>
          <a href="/privacy" className={linkCls}>Read our privacy policy</a>.
        </p>
      </div>
    </section>
  )
}

function Field({ id, label, hint, error, aside, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-display text-sm font-bold text-ink">
          <span>{label}</span>
          <span className="ml-0.5 text-brand" aria-hidden="true">*</span>
          <span className="sr-only"> (required)</span>
        </label>
        {aside && <span className="shrink-0 text-xs text-body">{aside}</span>}
      </div>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-body">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1.5 text-sm font-bold text-brand">{error}</p>}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  )
}
