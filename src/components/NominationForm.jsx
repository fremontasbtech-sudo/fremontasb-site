import { homecomingNominationsPage } from '../data/sources'
import { Notice } from './DataState'

/**
 * NominationForm - the "Nominate now" hand-off card for Homecoming Court.
 *
 * There is no form on the site any more, on purpose. Nominating happens on a separate
 * Apps Script page deployed "Anyone within FUHSD" (homecomingNominationsPage in
 * sources.js): Google makes the student sign in with a school account before that page
 * even loads, and the script reads the verified email itself. Nobody types an email, so
 * there is nothing to fake. One submission per student; submitting again replaces it.
 *
 * This component only explains that and links out. The export name and the `mode` prop
 * are kept so HomecomingCourt.jsx is unchanged in how it uses it:
 *   mode === 'test'  -> shows the test-preview banner above the card.
 */
const STEPS = [
  { label: 'Sign in', detail: 'with your @student.fuhsd.org account' },
  { label: 'Pick up to 4 seniors', detail: 'first and last names' },
  { label: 'Done', detail: 'come back any time to change your picks' },
]

export default function NominationForm({ mode = 'test' }) {
  return (
    <div className="mx-auto max-w-xl">
      {mode === 'test' && (
        <div className="mb-6 rounded-lg border-2 border-brand bg-brand-tint px-4 py-3">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.12em] text-brand">
            Test preview: not the real nominations
          </p>
          <p className="mt-1 text-sm text-ink">
            This is a test run. Anything you submit on the nomination page will <strong>not</strong> count toward Homecoming Court.
          </p>
        </div>
      )}

      {homecomingNominationsPage ? (
        <NominateCTA href={homecomingNominationsPage} />
      ) : (
        <Notice tone="neutral">Nominations aren&rsquo;t connected yet. Check back soon.</Notice>
      )}
    </div>
  )
}

function NominateCTA({ href }) {
  return (
    <section className="card-surface p-6 sm:p-8" aria-labelledby="nominate-heading">
      <p className="eyebrow">Verified by your school account</p>
      <h3 id="nominate-heading" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        Nominate with your school account
      </h3>
      <div className="mt-4 space-y-3 leading-relaxed text-body">
        <p>
          Sign in with your school Google account on the next page and your nominations are counted
          under your name. There&rsquo;s no email to type.
        </p>
        <p>
          One submission per student. Submitting again replaces your earlier picks, so only your latest set counts.
        </p>
      </div>

      {/* flex-col on phones stretches the button full width; sm:flex-row lets it sit at its natural width. */}
      <div className="mt-6 flex flex-col sm:flex-row">
        <a href={href} rel="noopener" className="btn-primary">
          Nominate now
        </a>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-body">
        Opens the secure nomination page. If you&rsquo;re signed in to a personal Google account, it will ask you to
        switch to your @student.fuhsd.org account.
      </p>

      <div className="mt-6 border-t border-rule pt-5">
        <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-ink">How it works</p>
        <ol className="mt-3 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex items-start gap-3 text-sm">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-sm font-bold text-brand"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="mt-1 leading-relaxed">
                <span className="font-display font-bold text-ink">{step.label}</span>
                <span className="text-body"> &middot; {step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
