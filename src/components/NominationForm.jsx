import { useRef, useState } from 'react'
import { homecomingNominationsApi } from '../data/sources'
import { Notice } from './DataState'

/**
 * NominationForm - peer nomination for Homecoming Court.
 *
 * Students nominate UP TO 4 senior classmates (free-text first/last, matching last year).
 * All validation is client-side before submit; the Apps Script backend does the email
 * dedup. Because the POST is no-cors (see below) the frontend can't read the response, so
 * a duplicate drop and a real save look identical here - an accepted tradeoff.
 *
 * POST: no-cors, application/x-www-form-urlencoded (a "simple" request, so no CORS
 * preflight). The Apps Script reads e.parameter and appends a row to the tab its Config
 * cell selects (Test Submissions while testing, Nominations when live).
 */
const SLOTS = [1, 2, 3, 4]
const emptySlot = () => ({ first: '', last: '' })
const normName = (f, l) => `${f} ${l}`.toLowerCase().replace(/\s+/g, ' ').trim()
const inputCls =
  'min-h-[44px] w-full rounded-btn border border-rule bg-paper px-3.5 py-2.5 text-base text-ink ' +
  'placeholder:text-body/45 focus-visible:border-brand'

export default function NominationForm({ mode = 'test' }) {
  const [email, setEmail] = useState('')
  const [slots, setSlots] = useState(SLOTS.map(emptySlot))
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const errRef = useRef(null)

  const setSlot = (i, key, val) =>
    setSlots((s) => s.map((slot, j) => (j === i ? { ...slot, [key]: val } : slot)))

  function validate() {
    const errs = []
    const filled = slots
      .map((s, i) => ({ i, first: s.first.trim(), last: s.last.trim() }))
      .filter((s) => s.first || s.last)

    if (!email.trim()) errs.push('Enter your school email so your nominations can be counted.')
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.push('That email doesn’t look right — double-check it.')

    if (filled.length === 0) errs.push('Add at least one senior to nominate.')

    for (const s of filled) {
      if (!s.first || !s.last) errs.push(`Nominee ${s.i + 1}: enter both a first and last name.`)
    }

    // No nominating the same senior twice (would void all your picks at tally time).
    const seen = new Map()
    for (const s of filled) {
      if (!s.first || !s.last) continue
      const key = normName(s.first, s.last)
      if (seen.has(key)) errs.push(`You’ve listed ${s.first} ${s.last} more than once — each nominee must be a different senior.`)
      else seen.set(key, true)
    }
    return errs
  }

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (errs.length) {
      requestAnimationFrame(() => errRef.current?.focus())
      return
    }
    setSubmitting(true)
    try {
      const body = new URLSearchParams()
      body.set('email', email.trim())
      slots.forEach((s, i) => {
        body.set(`n${i + 1}First`, s.first.trim())
        body.set(`n${i + 1}Last`, s.last.trim())
      })
      await fetch(homecomingNominationsApi, { method: 'POST', mode: 'no-cors', body })
      setDone(true)
    } catch {
      setErrors(['Couldn’t submit — check your connection and try again.'])
      requestAnimationFrame(() => errRef.current?.focus())
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="card-surface mx-auto max-w-xl p-6 text-center sm:p-8" role="status">
        <p className="font-display text-2xl font-extrabold tracking-tight text-ink">Nominations submitted</p>
        <p className="mt-3 text-body">
          Thanks for nominating. Only your first submission from this email counts, so there&rsquo;s no need
          to send it again.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-xl">
      {mode === 'test' && (
        <div className="mb-6">
          <Notice tone="neutral">
            Test mode &mdash; these submissions go to the Test tab, not the real tally.
          </Notice>
        </div>
      )}

      {errors.length > 0 && (
        <div
          ref={errRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-btn border border-brand/40 bg-brand-tint px-4 py-3 text-sm text-ink"
        >
          <p className="font-bold">Please fix the following:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      <div className="mb-7">
        <label htmlFor="nom-email" className="block font-display text-sm font-bold text-ink">
          Your school email
        </label>
        <input
          id="nom-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@student.fuhsd.org"
          className={`mt-2 ${inputCls}`}
        />
      </div>

      <fieldset>
        <legend className="font-display text-sm font-bold text-ink">Your senior nominees</legend>
        <p className="mt-1 text-sm text-body">Up to 4. Leave slots blank if you have fewer.</p>
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
                    id={`n${i}-first`}
                    type="text"
                    autoComplete="off"
                    value={slot.first}
                    onChange={(e) => setSlot(i, 'first', e.target.value)}
                    placeholder="First name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor={`n${i}-last`} className="sr-only">Nominee {i + 1} last name</label>
                  <input
                    id={`n${i}-last`}
                    type="text"
                    autoComplete="off"
                    value={slot.last}
                    onChange={(e) => setSlot(i, 'last', e.target.value)}
                    placeholder="Last name"
                    className={inputCls}
                  />
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 flex items-center gap-4">
        <button type="submit" className={submitting ? 'btn-disabled' : 'btn-primary'} aria-disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit nominations'}
        </button>
        <p className="text-xs text-body">Real names only &mdash; spelling close enough to identify the student.</p>
      </div>
    </form>
  )
}
