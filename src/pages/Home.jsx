import { Link } from 'react-router-dom'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import { Loading, Notice, DevNote } from '../components/DataState'
import { useSheetData } from '../data/useSheetData'
import { sheets, embeds, school } from '../data/sources'
import spiritPointsJson from '../data/spiritPoints.json'
import newsJson from '../data/news.json'

/**
 * Home — hero video, Spirit Points ladder, Latest News, Download-the-App band.
 * Data: Spirit Points + News come from useSheetData (Google Sheet → local JSON fallback).
 * Swap the hero video/poster by editing embeds.heroVideo / embeds.heroPoster in src/data/sources.js.
 *
 * Card is intentionally NOT used here: the Spirit ladder and news list are ranked/dated rows,
 * not image tiles, so a card grid would flatten the hierarchy this page depends on.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <SpiritPoints />
      <LatestNews />
      <AppBanner />
    </>
  )
}

/* ───────────────────────── 1. Hero video ───────────────────────── */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white" aria-label="Fremont High School ASB">
      {/* Video is decorative. Poster paints the frame until (or if) the file loads. */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={embeds.heroVideo}
        poster={embeds.heroPoster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Flat scrim so white text stays readable over any frame. */}
      <div className="absolute inset-0 bg-ink/70" aria-hidden="true" />

      <div className="container-site relative flex min-h-[72vh] flex-col justify-end pb-12 pt-20 sm:min-h-[76vh] sm:pb-16 sm:pt-32 lg:min-h-[80vh]">
        <div className="max-w-3xl">
          <p className="eyebrow-on-dark">Fremont High School ASB</p>
          <h1 className="mt-4 font-display text-5xl font-extrabold italic leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
            Fremont<br />You Know!
          </h1>
          <div className="mt-5 h-1 w-14 bg-brand" aria-hidden="true" />
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            We're the students behind the rallies, the clubs, and FremontTV — plus the spirit points race that keeps
            all four grades going. Glad you're here.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button to="/media" text="Watch FremontTV" />
            <a
              href="#spirit-points"
              className="group inline-flex min-h-[44px] items-center gap-2 font-display font-bold text-white underline-offset-4 hover:underline"
            >
              Spirit points
              <Arrow className="text-white" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── 2. Spirit Points ───────────────────────── */

function SpiritPoints() {
  const { rows, loading, error, source } = useSheetData(sheets.spiritPoints, spiritPointsJson)

  const classes = rows
    .map((r) => ({ grade: r.grade, classOf: r.classOf, points: Number(String(r.points ?? '').replace(/[^\d.-]/g, '')) || 0 }))
    .filter((r) => r.grade)
    .sort((a, b) => b.points - a.points)
  const max = classes[0]?.points || 1
  const lead = classes.length > 1 ? classes[0].points - classes[1].points : 0

  return (
    <section id="spirit-points" className="section-space scroll-mt-16">
      <div className="container-site grid gap-10 lg:grid-cols-12 lg:gap-16">
        {/* 5/12 — heading + how it works */}
        <div className="lg:col-span-5">
          <SectionHeader eyebrow="Class competition" title="Spirit Points Tracker" className="!mb-4 sm:!mb-4" />
          <p className="text-base leading-relaxed text-body">
            Every rally, dress-up day, and class competition adds points to your class total. ASB updates the numbers
            after each event. Seniors, juniors, sophomores, freshmen — one class wins the year.
          </p>
          {classes.length > 1 && !loading && (
            <p className="mt-6 font-display text-lg font-bold text-ink">
              {classes[0].grade} lead by <span className="text-brand">{lead}</span> {lead === 1 ? 'point' : 'points'}.
            </p>
          )}
          {source !== 'sheet' && (
            <DevNote>Showing local sample data. Connect the spirit points Google Sheet in sources.js to go live.</DevNote>
          )}
        </div>

        {/* 7/12 — ranked ladder */}
        <div className="lg:col-span-7">
          {loading && <Loading label="Loading spirit points…" />}
          {error && <Notice>Couldn't reach the Google Sheet ({error}). Showing the last saved numbers.</Notice>}
          {!loading && classes.length > 0 && (
            <ol className="mt-4 divide-y divide-rule border-y border-rule lg:mt-0">
              {classes.map((c, i) => {
                const leader = i === 0
                return (
                  <li key={c.grade} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 ${leader ? 'py-6' : 'py-4'}`}>
                    <span className={`font-display text-2xl font-extrabold tabular-nums ${leader ? 'text-brand' : 'text-body/50'}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={`font-display font-bold text-ink ${leader ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{c.grade}</span>
                        {c.classOf && <span className="whitespace-nowrap text-sm text-body">Class of {c.classOf}</span>}
                        {leader && <span className="eyebrow ml-auto">Leading</span>}
                      </div>
                      <div className="mt-2 h-2 w-full bg-rule" role="presentation">
                        <div
                          className={`h-full ${leader ? 'bg-brand' : 'bg-ink/35'}`}
                          style={{ width: `${Math.max(4, (c.points / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={`font-display font-extrabold tabular-nums text-ink ${leader ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>
                      {c.points.toLocaleString()}
                      <span className="ml-1 text-xs font-bold uppercase tracking-wider text-body">pts</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          {!loading && classes.length === 0 && <Notice>No spirit points posted yet. Check back after the first rally.</Notice>}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── 3. Latest News ───────────────────────── */

const quickLinks = [
  { to: '/media', label: 'Media', note: 'FremontTV episodes and rally videos' },
  { to: '/photos', label: 'Photos', note: 'Event albums on Flickr' },
  { to: '/clubs', label: 'Clubs', note: 'Official list, handbook, renewal forms' },
  { to: '/school-store', label: 'School Store', note: 'ASB cards, dance tickets, gear' },
]

function LatestNews() {
  const { rows, loading, error, source } = useSheetData(sheets.news, newsJson)

  const items = rows
    .filter((n) => n.title)
    .map((n) => ({ ...n, when: parseDate(n.date) }))
    .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))
    .slice(0, 5)

  return (
    <section id="news" className="border-t border-rule bg-paper section-space scroll-mt-16">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* 8/12 — the list */}
        <div className="lg:col-span-8">
          <SectionHeader eyebrow="From ASB" title="Latest News" />
          {source !== 'sheet' && (
            <DevNote>Showing local sample posts. Connect the news Google Sheet in sources.js to go live.</DevNote>
          )}
          {loading && <Loading label="Loading news…" />}
          {error && <Notice>Couldn't reach the Google Sheet ({error}). Showing saved posts.</Notice>}
          {!loading && items.length > 0 && (
            <ol className="divide-y divide-rule border-t border-rule">
              {items.map((n, i) => (
                <li key={`${n.title}-${n.date}`} className="grid grid-cols-[4.25rem_1fr] gap-x-5 py-6 sm:grid-cols-[6rem_1fr] sm:gap-x-8 sm:py-7">
                  <DateRail date={n.when} raw={n.date} featured={i === 0} />
                  <div className="min-w-0">
                    <h3 className={`font-display font-bold leading-snug text-ink ${i === 0 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}>
                      {n.title}
                    </h3>
                    {n.blurb && (
                      <p className={`mt-2 leading-relaxed text-body ${i === 0 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
                        {n.blurb}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!loading && items.length === 0 && <Notice>Nothing posted yet. News goes up here once school starts.</Notice>}
        </div>

        {/* 4/12 — sticky side rail of real destinations */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            {/* The one on-white instance of the brand tagline style (bold italic rust). */}
            <p className="tagline text-xl sm:text-2xl">Fremont You Know!</p>
            <p className="eyebrow mt-6">Around the site</p>
            <ul className="mt-4 border-t border-rule sm:grid sm:grid-cols-2 sm:gap-x-8 lg:block">
              {quickLinks.map((q) => (
                <li key={q.to} className="border-b border-rule">
                  <Link to={q.to} className="group flex min-h-[44px] items-center justify-between gap-4 py-4">
                    <span>
                      <span className="block font-display text-lg font-bold text-ink transition-colors group-hover:text-brand">{q.label}</span>
                      <span className="block text-sm text-body">{q.note}</span>
                    </span>
                    <Arrow />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-body">
              Questions for ASB?{' '}
              <a href={`mailto:${school.email}`} className="link-brand">{school.email}</a>
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function DateRail({ date, raw, featured }) {
  if (!date) return <span className="pt-1 text-sm text-body">{raw}</span>
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.toLocaleDateString('en-US', { day: 'numeric' })
  const year = date.getFullYear()
  return (
    <time dateTime={toIso(date)} className="pt-1 leading-none">
      <span className={`block font-display text-xs font-bold uppercase tracking-[0.18em] ${featured ? 'text-brand' : 'text-body'}`}>{month}</span>
      <span className="mt-1 block font-display text-3xl font-extrabold tabular-nums text-ink sm:text-4xl">{day}</span>
      <span className="mt-1 block text-xs text-body">{year}</span>
    </time>
  )
}

/** "2026-08-28" → local midnight (avoids the UTC off-by-one). Anything else → Date parse or null. */
function parseDate(value) {
  if (!value) return null
  const m = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Arrow({ className = 'text-brand' }) {
  return (
    <svg className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${className}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ───────────────────────── 4. Download the App ───────────────────────── */

function AppBanner() {
  return (
    <section className="bg-brand text-white" aria-labelledby="app-banner-title">
      <div className="container-site grid gap-8 py-14 sm:py-16 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-8">
          <p className="eyebrow-on-dark">Fremont ASB app</p>
          <h2 id="app-banner-title" className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            The stuff the website can't do lives in the app.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            Submit club forms, check spirit points, pull up today's bell schedule, and log teacher bonuses. Sign in with
            your school Google account.
          </p>
        </div>
        <div className="lg:col-span-4 lg:justify-self-end">
          <Button to="/download-app" text="Download the App" variant="inverse" />
          <p className="mt-3 text-sm text-white/80">In development — store links post here first.</p>
        </div>
      </div>
    </section>
  )
}
