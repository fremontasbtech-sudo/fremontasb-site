import PageHero from '../components/PageHero'
import Button from '../components/Button'
import { links } from '../data/sources'

/**
 * Download the App — companion ASB app, still in development.
 * Store links come from src/data/sources.js (links.appStore / links.playStore).
 * Leave them null → "Coming soon" buttons. Paste real URLs → live buttons. Nothing else changes.
 */

const STORES = [
  { key: 'appStore', label: 'App Store', platform: 'iPhone' },
  { key: 'playStore', label: 'Google Play', platform: 'Android' },
]

// What lives where. Only what ASB Tech has said the app does — no extra promises.
const WEBSITE = [
  'Latest news and spirit points totals',
  'Club list, handbook and accountability tracker',
  'FremontTV episodes and event photos',
  'Homecoming Court, Elections, Opportunities',
  'School Store and Contact links',
]
const APP = [
  { t: 'Club form submissions', d: 'Submit club forms in the app.' },
  { t: 'Spirit points tracking', d: 'Points are tracked and updated automatically.' },
  { t: 'Bell schedules', d: 'The day’s bell schedule.' },
  { t: 'Teacher bonuses', d: 'Teachers award bonus spirit points.' },
]

export default function DownloadApp() {
  const anyLive = STORES.some((s) => links[s.key])

  return (
    <>
      <PageHero
        title="Download the App"
        eyebrow="In development"
        subtext="The Fremont ASB app is being built by ASB Tech. It handles club forms, spirit points, bell schedules and teacher bonuses — the parts of ASB that need a sign-in."
      />

      <section className="section-space">
        <div className="container-site">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            {/* Store buttons */}
            <div className="lg:col-span-5">
              <div className="card-surface p-6 sm:p-8">
                <p className="eyebrow">Get the app</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink">
                  {anyLive ? 'Available now' : 'Coming soon'}
                </h2>
                <div className="rule-accent-left" />
                <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                  {STORES.map((s) => (
                    <li key={s.key}><StoreButton store={s} href={links[s.key]} /></li>
                  ))}
                </ul>
                <p className="mt-5 text-sm leading-relaxed text-body">
                  {anyLive
                    ? 'Sign in with Google after installing.'
                    : 'Store links will be added here when the app is released. Until then, everything in the website list still works.'}
                </p>
              </div>
            </div>

            {/* Website vs app */}
            <div className="lg:col-span-7">
              <p className="eyebrow">Website vs. app</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                The website is for reading. The app is for doing.
              </h2>
              <div className="rule-accent-left" />

              <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-6">
                <div>
                  <h3 className="border-b-2 border-rule pb-2 font-display text-sm font-bold uppercase tracking-wider text-body">
                    On fremontasb.org
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-body">
                    {WEBSITE.map((w) => (
                      <li key={w} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-body/50" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="border-b-2 border-brand pb-2 font-display text-sm font-bold uppercase tracking-wider text-brand">
                    Only in the app
                  </h3>
                  <ul className="mt-4 space-y-4">
                    {APP.map((a) => (
                      <li key={a.t} className="flex gap-3">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-brand" />
                        <div>
                          <p className="font-display font-bold text-ink">{a.t}</p>
                          <p className="mt-0.5 text-sm text-body">{a.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-8 border-t border-rule pt-5 text-sm text-body">
                The app requires Google sign-in.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ── local pieces ─────────────────────────────────────────────────────────── */

/**
 * StoreButton — plain text labels, no store logos (badge art is added once links are live).
 * Two short lines, never wrapping: "App Store" over "Coming soon" (or the platform name once live).
 */
function StoreButton({ store, href }) {
  const label = (
    <span className="flex flex-col items-start leading-tight">
      <span className="whitespace-nowrap">{store.label}</span>
      <span className="whitespace-nowrap text-xs font-normal">{href ? store.platform : 'Coming soon'}</span>
    </span>
  )
  if (!href) {
    return <Button variant="disabled" className="w-full justify-start">{label}</Button>
  }
  return <Button href={href} external className="w-full justify-between">{label}</Button>
}

function Check({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
