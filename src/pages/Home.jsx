import { useState, useMemo, useEffect } from 'react'
import Calendar from '../components/Calendar'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import { Loading, Notice, DevNote } from '../components/DataState'
import { useSheetData, isTrue } from '../data/useSheetData'
import { useSpiritPoints } from '../data/useSpiritPoints'
import { useYouTube } from '../data/useYouTube'
import { useFlickr } from '../data/useFlickr'
import { sheets, embeds, school } from '../data/sources'
import spiritPointsJson from '../data/spiritPoints.json'
import newsJson from '../data/news.json'
import mediaOverlay from '../data/media.json'
import photoAlbums from '../data/photos.json'
import { useAnnouncements } from '../data/useAnnouncements'
import { useEvents } from '../data/useEvents'
import { cleanAlbumTitle } from '../data/albumTitle'

/**
 * Home — hero video, Spirit Points ladder, Latest News, Download-the-App band.
 * Data: Spirit Points + News come from useSheetData (Google Sheet → local JSON fallback).
 * Swap the hero video/poster by editing embeds.heroVideo / embeds.heroPoster in src/data/sources.js.
 *
 * Card is intentionally NOT used here: the Spirit ladder and news list are ranked/dated rows,
 * not image tiles, so a card grid would flatten the hierarchy this page depends on.
 */
export default function Home() {
  const { upcoming, recent, loading: eventsLoading } = useEvents()
  return (
    <>
      <Hero />
      <SpiritPoints />
      <LatestNews eventsRecent={recent} eventsUpcoming={upcoming} eventsLoading={eventsLoading} />
      <MorningAnnouncements />
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
            Fremont!<br />You Know!
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
  const { rows, loading, error, source } = useSpiritPoints(sheets.spiritPoints, spiritPointsJson)

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
  { to: '/resources', label: 'School Store', note: 'ASB cards, dance tickets, gear' },
]

function LatestNews({ eventsRecent = [], eventsUpcoming = [], eventsLoading = false }) {
  const { rows, loading: newsLoading, source } = useSheetData(sheets.news, newsJson)
  const { rows: videos, loading: vLoading } = useYouTube(mediaOverlay)
  const { albums, loading: aLoading } = useFlickr(photoAlbums)

  const items = buildNews(rows, source, videos, albums, eventsRecent)
  const loading = (newsLoading || vLoading || aLoading) && items.length === 0

  return (
    <section id="news" className="border-t border-rule bg-paper section-space scroll-mt-16">
      <div className="container-site">
        {/* Two co-equal columns: the recap (newest first) and the calendar-ahead
            (soonest first) — same NewsItem rows so they read at the same weight. */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionHeader eyebrow="From ASB" title="Latest News" />
            {source !== 'sheet' && (
              <DevNote>Auto-feed: newest FremontTV episodes + photo albums. Connect sheets.news in sources.js to add written announcements on top.</DevNote>
            )}
            {loading && <Loading label="Loading the latest…" />}
            {!loading && items.length > 0 && (
              <ol className="divide-y divide-rule border-t border-rule">
                {items.map((item) => (
                  <li key={item.key}>
                    <NewsItem item={item} />
                  </li>
                ))}
              </ol>
            )}
            {!loading && items.length === 0 && <Notice>Nothing posted yet — check back once school events get going.</Notice>}
          </div>

          <div>
            <SectionHeader eyebrow="On the calendar" title="Upcoming Events" />
            {eventsLoading && eventsUpcoming.length === 0 && <Loading label="Loading upcoming events…" />}
            {eventsUpcoming.length > 0 && (
              <ol className="divide-y divide-rule border-t border-rule">
                {eventsUpcoming.map((item) => (
                  <li key={item.key}>
                    <NewsItem item={item} />
                  </li>
                ))}
              </ol>
            )}
            {!eventsLoading && eventsUpcoming.length === 0 && <Notice>Nothing coming up in the next three weeks — check back soon.</Notice>}
          </div>
        </div>

        {/* Around the site — full width beneath both columns, so the nav sits with the
            page chrome instead of hanging off the bottom of a tall column. */}
        <div className="mt-14 border-t border-rule pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="eyebrow">Around the site</p>
            {/* The one on-white instance of the brand tagline style (bold italic rust). */}
            <p className="tagline text-lg sm:text-xl">{school.tagline}</p>
          </div>
          <ul className="mt-5 grid border-t border-rule sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8">
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
          <p className="mt-6 text-sm text-body">
            Questions for ASB?{' '}
            <a href={`mailto:${school.email}`} className="link-brand">{school.email}</a>
          </p>
        </div>
      </div>
    </section>
  )
}
const TYPE_STYLES = {
  Announcement: 'bg-brand-tint text-brand',
  Event: 'bg-brand-tint text-brand',
  Rally: 'bg-brand-tint text-brand',
  Sports: 'bg-brand-tint text-brand',
  FremontTV: 'bg-ink/5 text-ink',
  Photos: 'bg-ink/5 text-ink',
}

function TypeBadge({ type }) {
  const cls = TYPE_STYLES[type] || 'bg-ink/5 text-ink'
  return (
    <span className={`inline-flex items-center rounded-btn px-2 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.12em] ${cls}`}>
      {type}
    </span>
  )
}

/**
 * Latest News feed — blends, freshest first:
 *  - Written announcements from the news Google Sheet, but ONLY when one is connected
 *    (source === 'sheet'); we never render the local sample as if it were real news.
 *    Optional sheet columns: type, link, pinned (pinned rows stay on top).
 *  - Auto items from the already-live feeds: newest FremontTV episodes + photo albums.
 * Result: the section is always real and current, even before anyone writes an announcement.
 */
function buildNews(newsRows, source, videos, albums, eventsRecent = []) {
  const manual = source === 'sheet'
    ? newsRows.filter((n) => n.title).map((n) => ({
        key: `a-${n.title}-${n.date || ''}`,
        type: n.type && String(n.type).trim() ? String(n.type).trim() : 'Announcement',
        title: n.title,
        blurb: n.blurb || '',
        href: n.link || n.href || null,
        when: parseDate(n.date),
        pinned: isTrue(n.pinned),
      }))
    : []

  const vids = (videos || []).slice(0, 3).map((v) => {
    const kind = v.kind || 'FremontTV'
    return {
      key: `v-${v.youtubeId}`,
      type: kind,
      title: v.title,
      blurb: v.hosts
        ? `Hosted by ${v.hosts}`
        : kind === 'FremontTV' ? 'New FremontTV episode' : `New ${kind.toLowerCase()} video`,
      href: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      when: parseDate(v.date),
      pinned: false,
    }
  })

  const albs = (albums || []).slice(0, 3).map((a) => ({
    key: `f-${a.flickrUrl || a.name}`,
    type: 'Photos',
    title: cleanAlbumTitle(a.name),
    blurb: a.count ? `${a.count} new photos on Flickr` : 'New album on Flickr',
    href: a.flickrUrl || null,
    when: parseDate(a.date),
    pinned: false,
  }))

  // Only THIS school year (starts Aug 1 of the school-year start): drop last year's episodes/albums.
  const nowD = new Date()
  const syStart = (nowD.getMonth() + 1) >= 7 ? nowD.getFullYear() : nowD.getFullYear() - 1
  const cutoff = new Date(syStart, 7, 1) // Aug 1
  // Curated upcoming events + pinned games (from the shared sheet) lead the feed, soonest
  // first; the dated/recent items fill the rest, freshest first. Cap the lead so real news
  // still shows through.
  return [...manual, ...vids, ...albs, ...eventsRecent.map((it) => ({ ...it, pinned: false }))]
    .filter((it) => it.title && it.when && it.when >= cutoff)
    .sort((x, y) => (Number(y.pinned) - Number(x.pinned)) || ((y.when?.getTime() ?? 0) - (x.when?.getTime() ?? 0)))
    .slice(0, 5)
}

function NewsItem({ item, featured }) {
  const rowCls = `grid grid-cols-[4.25rem_1fr] gap-x-5 py-6 sm:grid-cols-[6rem_1fr] sm:gap-x-8 sm:py-7${item.href ? ' group' : ''}`
  const inner = (
    <>
      <DateRail date={item.when} raw="New" featured={featured} />
      <div className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          {item.seniorNight && (
            <span className="inline-flex items-center gap-1 rounded-btn bg-brand px-2 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white">★ Senior Night</span>
          )}
        </span>
        <h3 className={`mt-2 font-display font-bold leading-snug text-ink ${featured ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}${item.href ? ' transition-colors group-hover:text-brand' : ''}`}>
          {item.title}
        </h3>
        {item.blurb && (
          <p className={`mt-2 leading-relaxed text-body ${featured ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
            {item.blurb}
          </p>
        )}
        {item.href && (
          <span className="mt-3 inline-flex min-h-[24px] items-center gap-1.5 font-display text-sm font-bold text-brand">
            View <Arrow />
          </span>
        )}
      </div>
    </>
  )
  return item.href ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={rowCls}>{inner}</a>
  ) : (
    <div className={rowCls}>{inner}</div>
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

function Chevron({ open }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Arrow({ className = 'text-brand' }) {
  return (
    <svg className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${className}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─────────────────── 3.5 Morning Announcements ─────────────────── */

/**
 * Morning Announcements — the recap of what went out over the PA on Wednesday and
 * Friday mornings, pulled live from the ASB sheet via /api/announcements (never embedded).
 * Only past mornings show (8:30 AM cutoff, in useAnnouncements). Collapsed by default:
 * each row shows a topic title + date, and expands on click — read only the ones you want.
 */
function MorningAnnouncements() {
  const { items, loading } = useAnnouncements()

  // Group past announcements by date; the calendar marks each date that has any.
  const byDate = useMemo(() => {
    const m = new Map()
    for (const a of items) {
      if (!m.has(a.date)) m.set(a.date, [])
      m.get(a.date).push(a)
    }
    for (const arr of m.values()) arr.sort((x, y) => x.title.localeCompare(y.title)) // alphabetical by topic
    return m
  }, [items])
  const dates = useMemo(() => [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1)), [byDate])
  const years = useMemo(() => {
    // Cover the current school year (Aug–Jun spans two calendar years) plus any years present.
    const now = new Date()
    const startYear = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1
    const ys = new Set([startYear, startYear + 1, now.getFullYear()])
    for (const d of dates) ys.add(+d.slice(0, 4))
    return [...ys]
  }, [dates])
  const latest = dates[0] || null

  const [selected, setSelected] = useState(null)
  const [view, setView] = useState(null)
  useEffect(() => {
    if (dates.length && !selected) {
      setSelected(dates[0])
      const [y, mm] = dates[0].split('-').map(Number)
      setView({ y, m: mm - 1 })
    }
  }, [dates, selected])

  const jumpLatest = () => {
    if (!latest) return
    setSelected(latest)
    const [y, mm] = latest.split('-').map(Number)
    setView({ y, m: mm - 1 })
  }

  if (!loading && items.length === 0) return null
  const dayItems = selected ? byDate.get(selected) || [] : []

  return (
    <section id="announcements" className="border-t border-rule bg-paper section-space scroll-mt-16">
      <div className="container-site">
        <SectionHeader eyebrow="Read on the PA" title="Morning Announcements" />
        <p className="-mt-3 mb-8 max-w-2xl leading-relaxed text-body">
          Read over the PA on Wednesday and Friday mornings. Pick a marked day on the calendar to catch that morning&rsquo;s announcements, then tap any headline to open it.
        </p>
        {loading && <Loading label="Loading announcements…" />}
        {view && (
          <>
            <div className="mx-auto max-w-md">
              <Calendar view={view} setView={setView} datesWith={byDate} selected={selected} onSelect={setSelected} years={years} latest={latest} onJumpLatest={jumpLatest} />
            </div>

            <div className="mt-10">
              {dayItems.length > 0 ? (
                <>
                  <h3 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                    {formatAnnDate(selected)}
                  </h3>
                  <div className="rule-accent-left" />
                  <ul className="mt-5 divide-y divide-rule border-y border-rule">
                    {dayItems.map((a) => (
                      <li key={a.key}><AnnouncementRow item={a} /></li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-body">Pick a highlighted day on the calendar to read that morning&rsquo;s announcements.</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function AnnouncementRow({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="group flex w-full min-h-[56px] items-center justify-between gap-4 py-5 text-left">
        <span className="font-display text-lg font-bold leading-snug text-ink transition-colors group-hover:text-brand sm:text-xl">
          {item.title}
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-brand ring-1 ring-inset ring-rule [@media(hover:hover)]:group-hover:bg-brand-tint">
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="pb-6">
          <p className="max-w-4xl text-base leading-relaxed text-body [overflow-wrap:anywhere]">{item.text}</p>
        </div>
      )}
    </div>
  )
}

function formatAnnDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
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
