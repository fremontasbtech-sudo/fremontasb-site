import { useCallback, useEffect, useRef, useState } from 'react'
import { googleClientId } from '../data/sources'
import { Loading, Notice } from './DataState'

/**
 * NominationForm - Homecoming Court peer nominations, right on the page. ONE submission per
 * student, final once submitted.
 *
 *   1. Student clicks "Sign in with Google" (Google Identity Services). Google hands the page
 *      a signed ID token for their account. No email is ever typed.
 *   2. The page asks /api/nominate whether this student has ALREADY nominated. If so it shows
 *      "You've already nominated" with their picks and no form. Only otherwise does the form show.
 *   3. Form → "Review my nominations" (final check, clearly marked as final) → Submit. The
 *      server checks the token with Google, and the Apps Script refuses a second row for the
 *      same email (under a lock), answering 'already' with the picks that count, which the page
 *      then shows. "Your nominations are in" appears only after the row is written.
 *
 * The token lives in memory + sessionStorage (this tab only) until it expires (~1 hour); the
 * confirmed picks are remembered for the tab so a reload shows them instantly.
 * mode === 'test' shows the test banner; the server writes test runs to "Test Submissions".
 */
const SLOTS = 4
const TOKEN_KEY = 'fasb.hcnom.token'
const PICKS_KEY = 'fasb.hcnom.picks' // { email, picks } last confirmed save, this tab only
const emptySlots = () => Array.from({ length: SLOTS }, () => ({ first: '', last: '' }))
const normName = (f, l) => `${f} ${l}`.toLowerCase().replace(/\s+/g, ' ').trim()
const inputCls =
  'min-h-[44px] w-full rounded-btn border border-rule bg-paper px-3.5 py-2.5 text-base text-ink ' +
  'placeholder:text-body/45 focus-visible:border-brand'
const linkCls = 'font-bold text-brand underline-offset-4 hover:underline'

// ── token helpers ─────────────────────────────────────────────────────────────
function tokenExp(tok) {
  try {
    const b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(b)).exp || 0) * 1000
  } catch { return 0 }
}
function loadToken() {
  try {
    const t = sessionStorage.getItem(TOKEN_KEY)
    return t && tokenExp(t) > Date.now() + 60_000 ? t : ''
  } catch { return '' }
}
function tokenEmail(tok) {
  try {
    const b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return String(JSON.parse(atob(b)).email || '').toLowerCase()
  } catch { return '' }
}
function loadPicks(email) {
  try {
    const d = JSON.parse(sessionStorage.getItem(PICKS_KEY) || 'null')
    return d && d.email === email && Array.isArray(d.picks) && d.picks.length ? d.picks : null
  } catch { return null }
}
function savePicks(email, picks) {
  try { picks ? sessionStorage.setItem(PICKS_KEY, JSON.stringify({ email, picks })) : sessionStorage.removeItem(PICKS_KEY) } catch { /* private mode */ }
}
const toSlots = (picks) => emptySlots().map((s, i) => (picks && picks[i] ? { first: picks[i].first || '', last: picks[i].last || '' } : s))
function saveToken(t) {
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

// ── Google Identity Services loader (once per page) ───────────────────────────
let gisPromise
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => (window.google?.accounts?.id ? resolve() : reject(new Error('gis')))
      s.onerror = () => { gisPromise = null; s.remove(); reject(new Error('gis')) }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

async function api(credential, action, nominees) {
  try {
    const r = await fetch('/api/nominate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, action, nominees }),
    })
    const d = await r.json()
    if (d && typeof d === 'object') return d
  } catch { /* offline / non-JSON */ }
  return { ok: false, error: 'busy', message: 'Couldn’t reach the server. Check your connection and try again.' }
}

export default function NominationForm({ mode = 'test' }) {
  // Start from what this tab already knows so a reload renders instantly; the server is still
  // asked in the background and always has the final word.
  const [boot] = useState(() => {
    const tok = loadToken()
    const em = tok ? tokenEmail(tok) : ''
    const cached = em ? loadPicks(em) : null
    return { tok, em, cached }
  })
  const [token, setToken] = useState(boot.tok)
  // signin | checking | form | review | submitting | done
  const [phase, setPhase] = useState(boot.tok ? (boot.cached ? 'done' : 'checking') : 'signin')
  const [email, setEmail] = useState(boot.em)
  const [slots, setSlots] = useState(() => toSlots(boot.cached))
  const [doneKind, setDoneKind] = useState('already') // 'just' = submitted now | 'already' = submitted before
  const [errors, setErrors] = useState([])
  const [notice, setNotice] = useState('')
  const [signinMsg, setSigninMsg] = useState('')
  const errRef = useRef(null)
  const cardRef = useRef(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const signOut = useCallback((msg = '') => {
    saveToken('')
    savePicks('', null)
    setToken('')
    setEmail('')
    setErrors([])
    setNotice('')
    setSigninMsg(msg)
    setSlots(emptySlots())
    setPhase('signin')
    try { window.google?.accounts?.id?.disableAutoSelect() } catch { /* ignore */ }
  }, [])

  // Handle the server's auth-related answers in one place. Returns true if handled.
  const authProblem = useCallback((d, extra = '') => {
    if (d.error === 'signin') { signOut(`Your sign-in expired. Please sign in again.${extra}`); return true }
    if (d.error === 'wrong-domain') {
      signOut(`${d.email ? `${d.email} isn’t a school account. ` : ''}Sign in with your @student.fuhsd.org account.${extra}`)
      return true
    }
    return false
  }, [signOut])

  const showDone = useCallback((picks, kind, msg = '') => {
    setSlots(toSlots(picks))
    setDoneKind(kind)
    setNotice(msg)
    setErrors([])
    setPhase('done')
  }, [])

  // After sign-in (and on reload with a valid token): ask the server whether this student has
  // ALREADY nominated. The form is only shown once we know they haven't, so nobody is ever
  // invited to fill in a second set that can't count.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api(token, 'state').then((d) => {
      if (cancelled) return
      if (!d.ok) {
        if (authProblem(d)) return
        // Couldn't check (network). Showing the form is still safe: the server refuses a second
        // submission and the page then shows the picks that count.
        if (phaseRef.current === 'checking') setPhase('form')
        return
      }
      if (d.email) setEmail(d.email)
      const saved = Array.isArray(d.existing) ? d.existing : []
      const em = d.email || tokenEmail(token)
      if (saved.length) {
        savePicks(em, saved)
        if (phaseRef.current !== 'submitting') showDone(saved, 'already')
      } else {
        savePicks(em, null)
        // e.g. ASB cleared a test row: the cached "done" view is stale, so open the form.
        if (phaseRef.current === 'checking' || phaseRef.current === 'done') { setSlots(emptySlots()); setPhase('form') }
      }
    })
    return () => { cancelled = true }
  }, [token, authProblem, showDone])

  // While a submission is in flight, warn before the tab is closed.
  useEffect(() => {
    if (phase !== 'submitting') return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const onCredential = useCallback((resp) => {
    if (!resp?.credential) { setSigninMsg('Sign-in didn’t finish. Please try again.'); return }
    saveToken(resp.credential)
    const em = tokenEmail(resp.credential)
    const cached = loadPicks(em)
    setSigninMsg('')
    setErrors([])
    setNotice('')
    setEmail(em)
    setSlots(toSlots(cached))
    setDoneKind('already')
    setPhase(cached ? 'done' : 'checking')
    setToken(resp.credential)
  }, [])

  const setSlot = (i, key, val) => setSlots((s) => s.map((slot, j) => (j === i ? { ...slot, [key]: val } : slot)))
  const focusErrors = () => requestAnimationFrame(() => errRef.current?.focus())
  const toTop = () => requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

  function validate() {
    const errs = []
    const filled = slots.map((s, i) => ({ i, first: s.first.trim(), last: s.last.trim() })).filter((s) => s.first || s.last)
    if (filled.length === 0) errs.push('Add at least one senior to nominate.')
    for (const s of filled) if (!s.first || !s.last) errs.push(`Nominee ${s.i + 1}: enter both a first and last name.`)
    const seen = new Set()
    for (const s of filled) {
      if (!s.first || !s.last) continue
      const key = normName(s.first, s.last)
      if (seen.has(key)) errs.push(`You’ve listed ${s.first} ${s.last} more than once. Each nominee must be a different senior.`)
      seen.add(key)
    }
    return { errs, filled }
  }

  // Step 1: check the form, then show the picks for a final look (nominating is one-time).
  function onReview(e) {
    e.preventDefault()
    const { errs, filled } = validate()
    setErrors(errs)
    if (errs.length) { focusErrors(); return }
    setSlots(toSlots(filled))
    setPhase('review')
    toTop()
  }

  // Step 2: submit. The confirmation only says "in" once the server has written the row.
  async function onSubmit() {
    if (phase === 'submitting') return
    if (tokenExp(token) < Date.now() + 30_000) {
      signOut('Your sign-in expired. Please sign in again. Your nominations were not sent yet.')
      return
    }
    const picksNow = slots.filter((s) => s.first.trim() && s.last.trim()).map((s) => ({ first: s.first.trim(), last: s.last.trim() }))
    setErrors([])
    setPhase('submitting')
    const d = await api(token, 'submit', picksNow)
    if (d.ok) {
      savePicks(email || tokenEmail(token), picksNow)
      showDone(picksNow, 'just')
      return
    }
    if (d.error === 'already') {
      const prior = Array.isArray(d.existing) && d.existing.length ? d.existing : null
      if (prior) savePicks(email || tokenEmail(token), prior)
      showDone(prior || picksNow, 'already', 'You had already nominated, so this new set was not saved. The picks below are the ones that count.')
      return
    }
    if (authProblem(d, ' Your nominations were not sent.')) return
    setPhase('review')
    setErrors([d.message || 'Couldn’t submit right now. Please try again in a moment.'])
    focusErrors()
  }

  const picks = slots.filter((s) => s.first.trim() && s.last.trim())

  const errorBox = (
    <div
      ref={errRef}
      tabIndex={-1}
      role="alert"
      className={errors.length ? 'mt-5 rounded-btn border border-brand/40 bg-brand-tint px-4 py-3 text-sm text-ink' : 'sr-only'}
    >
      {errors.length > 0 && (
        <>
          <p className="font-bold">{errors.length > 1 ? 'Please fix the following:' : 'Please fix this:'}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-xl">
      {mode === 'test' && (
        <div className="mb-6 rounded-lg border-2 border-brand bg-brand-tint px-4 py-3">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.12em] text-brand">
            Test preview: not the real nominations
          </p>
          <p className="mt-1 text-sm text-ink">
            This is a test run. Anything you submit here will <strong>not</strong> count toward Homecoming Court.
          </p>
        </div>
      )}

      <section ref={cardRef} className="card-surface scroll-mt-24 p-6 sm:p-8" aria-labelledby="nominate-heading">
        {phase === 'signin' && <SignIn onCredential={onCredential} message={signinMsg} />}

        {phase === 'checking' && (
          <>
            <p className="eyebrow">Verified by your school account</p>
            <h3 id="nominate-heading" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Checking your nominations…
            </h3>
            {email && <Account email={email} onSwitch={() => signOut()} />}
            <Loading label="Looking up whether you’ve already nominated…" />
          </>
        )}

        {phase === 'form' && (
          <form onSubmit={onReview} noValidate>
            <p className="eyebrow">Verified by your school account</p>
            <h3 id="nominate-heading" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Your senior nominees
            </h3>
            {email && <Account email={email} onSwitch={() => signOut()} />}
            {errorBox}
            <p className="mt-5 text-sm text-body">
              Up to 4 seniors. Leave slots blank if you have fewer. <strong className="text-ink">You can only nominate once.</strong>
            </p>
            <div className="mt-4 space-y-4">
              {slots.map((slot, i) => (
                <fieldset key={i} className="rounded-lg border border-rule p-4">
                  <legend className="px-1 font-display text-xs font-bold uppercase tracking-[0.14em] text-brand">
                    Nominee {i + 1}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`n${i}-first`} className="sr-only">Nominee {i + 1} first name</label>
                      <input
                        id={`n${i}-first`} type="text" autoComplete="off" autoCapitalize="words" maxLength={60}
                        value={slot.first} onChange={(e) => setSlot(i, 'first', e.target.value)}
                        placeholder="First name" className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor={`n${i}-last`} className="sr-only">Nominee {i + 1} last name</label>
                      <input
                        id={`n${i}-last`} type="text" autoComplete="off" autoCapitalize="words" maxLength={60}
                        value={slot.last} onChange={(e) => setSlot(i, 'last', e.target.value)}
                        placeholder="Last name" className={inputCls}
                      />
                    </div>
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="mt-7 flex flex-col sm:flex-row">
              <button type="submit" className="btn-primary">Review my nominations</button>
            </div>
            <p className="mt-3 text-xs text-body">Real names only. Spelling close enough to identify the student.</p>
          </form>
        )}

        {(phase === 'review' || phase === 'submitting') && (
          <div>
            <p className="eyebrow flex items-center gap-2" role="status" aria-live="polite">
              {phase === 'submitting'
                ? <><span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />Submitting…</>
                : 'Final check'}
            </p>
            <h3 id="nominate-heading" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {phase === 'submitting' ? 'Submitting your nominations' : 'Are these right?'}
            </h3>
            {email && <Account email={email} onSwitch={phase === 'submitting' ? null : () => signOut()} />}
            {errorBox}
            <PickList picks={picks} />
            <div className="mt-5 rounded-lg border border-rule bg-[#F6F4F2] p-4 text-sm text-ink">
              <strong>This is final.</strong> Each student can nominate once, and you can&rsquo;t change your picks after you submit.
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <button
                type="button"
                onClick={onSubmit}
                className={phase === 'submitting' ? 'btn-disabled' : 'btn-primary'}
                aria-disabled={phase === 'submitting'}
              >
                {phase === 'submitting' ? 'Submitting…' : 'Submit nominations'}
              </button>
              {phase === 'review' && (
                <button type="button" className={`text-sm ${linkCls}`} onClick={() => { setErrors([]); setSlots(toSlots(picks)); setPhase('form') }}>
                  Go back and edit
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div>
            <p className="eyebrow flex items-center gap-2" role="status" aria-live="polite"><CheckIcon />
              {doneKind === 'just' ? 'Submitted' : 'Already submitted'}
            </p>
            <h3 id="nominate-heading" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {doneKind === 'just' ? 'Your nominations are in' : 'You’ve already nominated'}
            </h3>
            <Account email={email} onSwitch={() => signOut()} />
            {notice && <div className="mt-5"><Notice>{notice}</Notice></div>}
            <p className="mt-5 font-display text-xs font-bold uppercase tracking-[0.14em] text-ink">Your nominations</p>
            <PickList picks={picks} />
            <p className="mt-4 text-sm leading-relaxed text-body">
              Each student can nominate once, so these are final. Thanks for nominating!
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function PickList({ picks }) {
  return (
    <ol className="mt-3 space-y-2">
      {picks.map((p, i) => (
        <li key={i} className="flex items-center gap-3 rounded-lg border border-rule px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-sm font-bold text-brand">
            {i + 1}
          </span>
          <span className="min-w-0 break-words font-display font-bold text-ink">{p.first} {p.last}</span>
        </li>
      ))}
    </ol>
  )
}

function Account({ email, onSwitch }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-body">
      <span>Signed in as <strong className="break-all text-ink">{email}</strong></span>
      {onSwitch && <button type="button" onClick={onSwitch} className={linkCls}>Switch account</button>}
    </p>
  )
}

function SignIn({ onCredential, message }) {
  const btnRef = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | failed

  useEffect(() => {
    let cancelled = false
    const slow = setTimeout(() => { if (!cancelled) setState((s) => (s === 'loading' ? 'failed' : s)) }, 10000)
    loadGis()
      .then(() => {
        if (cancelled || !btnRef.current) return
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: onCredential,
          hd: 'student.fuhsd.org', // pre-selects the school account in Google's chooser
          auto_select: false,
          context: 'signin',
          ux_mode: 'popup',
        })
        const w = Math.round(Math.min(360, Math.max(220, btnRef.current.parentElement?.clientWidth || 300)))
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'left', width: w,
        })
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('failed') })
    return () => { cancelled = true; clearTimeout(slow) }
  }, [onCredential])

  return (
    <>
      <p className="eyebrow">Verified by your school account</p>
      <h3 id="nominate-heading" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        Sign in to nominate
      </h3>
      <p className="mt-4 leading-relaxed text-body">
        Sign in with your <strong className="text-ink">@student.fuhsd.org</strong> Google account. That&rsquo;s how we
        know each set of picks is really yours. There&rsquo;s no email to type.
      </p>

      {message && <div className="mt-5"><Notice>{message}</Notice></div>}

      <div className="mt-6 min-h-[44px]">
        <div ref={btnRef} className={state === 'ready' ? '' : 'hidden'} />
        {state === 'loading' && <Loading label="Loading Google sign-in…" />}
        {state === 'failed' && (
          <Notice tone="neutral">
            Google sign-in didn&rsquo;t load. Turn off any content blocker or ad blocker, or try another browser, then reload this page.
          </Notice>
        )}
      </div>

      <div className="mt-6 space-y-2 border-t border-rule pt-5 text-sm leading-relaxed text-body">
        <p>
          We only get your name and school email from Google, and use them only to count one set of picks per student.{' '}
          <a href="/privacy" className={linkCls}>Privacy</a>
        </p>
      </div>
    </>
  )
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  )
}
