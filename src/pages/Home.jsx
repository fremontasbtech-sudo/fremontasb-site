import { useState, useMemo, useEffect, useRef } from 'react'
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
import { useEvents, scoreNote, seasonOf } from '../data/useEvents'
import { cleanAlbumTitle } from '../data/albumTitle'

/**
 * Home - hero video, Spirit Points ladder, Latest News, Download-the-App band.
 * Data: Spirit Points + News come from useSheetData (Google Sheet → local JSON fallback).
 * Swap the hero video/poster by editing embeds.heroVideo / embeds.heroPoster in src/data/sources.js.
 *
 * Card is intentionally NOT used here: the Spirit ladder and news list are ranked/dated rows,
 * not image tiles, so a card grid would flatten the hierarchy this page depends on.
 */
export default function Home() {
  const { upcoming, recent, events: curatedEvents, finishedGames, seniorSeason, loading: eventsLoading } = useEvents()
  return (
    <>
      <Hero />
      <SpiritPoints />
      <LatestNews eventsRecent={recent} eventsUpcoming={upcoming} eventsAll={curatedEvents} eventsFinished={finishedGames} seniorSeason={seniorSeason} eventsLoading={eventsLoading} />
      <MorningAnnouncements />
      <AppBanner />
    </>
  )
}

/* ───────────────────────── 1. Hero video ───────────────────────── */

function Hero() {
  // The poster IS the video's first frame (public/hero-poster.jpg is extracted from hero.mp4), so
  // the instant the video starts playing it continues seamlessly from the still: no cross-fade, no
  // jump from a different photo. The video is only hidden until it actually plays so a phone that
  // blocks autoplay (e.g. iOS Low Power Mode) shows the still frame, not a play-button overlay.
  // If hero.mp4 is ever replaced, regenerate the poster from its first frame:
  //   ffmpeg -i public/hero.mp4 -frames:v 1 -q:v 7 public/hero-poster.jpg
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlaying = () => setPlaying(true)
    v.addEventListener('playing', onPlaying)
    if (!v.paused && v.readyState > 2) setPlaying(true) // already playing (fast cache hit)
    const p = v.play && v.play()
    if (p && typeof p.catch === 'function') p.catch(() => {}) // autoplay blocked → poster stays
    return () => v.removeEventListener('playing', onPlaying)
  }, [])
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white" aria-label="Fremont High School ASB">
      {/* First frame of the drone shot, painted immediately; the video takes over from it. */}
      <img
        src={embeds.heroPoster}
        alt=""
        aria-hidden="true"
        fetchpriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover ${playing ? 'opacity-100' : 'opacity-0'}`}
        src={embeds.heroVideo}
        poster={embeds.heroPoster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
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
            We’re the student leaders who plan rallies, run clubs, make Fremont TV, and keep track of spirit points for all four grades. This site has everything you need to stay updated on what’s happening at Fremont.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button to="/media" text="Watch Fremont TV" />
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
  const top = classes.length ? classes[0].points : 0
  const tiedTop = classes.filter((c) => c.points === top) // more than one = a tie for first

  return (
    <section id="spirit-points" className="section-space scroll-mt-16">
      <div className="container-site grid gap-10 lg:grid-cols-12 lg:gap-16">
        {/* 5/12 - heading + how it works */}
        <div className="lg:col-span-5">
          <SectionHeader eyebrow="Class competition" title="Spirit Points Tracker" className="!mb-4 sm:!mb-4" />
          <p className="text-base leading-relaxed text-body">
            Every rally, dress-up day, and class competition adds points to your class’s total. ASB updates the numbers after each event, and the class with the most points at the end of the year wins.
          </p>
          {classes.length > 1 && !loading && top > 0 && (
            <p className="mt-6 font-display text-lg font-bold text-ink">
              {tiedTop.length > 1 ? (
                <>
                  <span>Tied for first:</span>{' '}
                  {tiedTop.map((c, i) => (
                    <span key={c.grade}>{i > 0 && <span aria-hidden="true"> &amp; </span>}<span className="text-brand">{c.grade}</span></span>
                  ))}
                </>
              ) : (
                <>{classes[0].grade} lead by <span className="text-brand">{lead}</span> {lead === 1 ? 'point' : 'points'}.</>
              )}
            </p>
          )}
          {source !== 'sheet' && (
            <DevNote>Showing local sample data. Connect the spirit points Google Sheet in sources.js to go live.</DevNote>
          )}
        </div>

        {/* 7/12 - ranked ladder */}
        <div className="lg:col-span-7">
          {loading && <Loading label="Loading spirit points…" />}
          {!loading && classes.length > 0 && (
            <ol className="mt-4 divide-y divide-rule border-y border-rule lg:mt-0">
              {classes.map((c, i) => {
                const leader = top > 0 && c.points === top
                const rank = 1 + classes.filter((o) => o.points > c.points).length
                return (
                  <li key={c.grade} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 ${leader ? 'py-6' : 'py-4'}`}>
                    <span className={`font-display text-2xl font-extrabold tabular-nums ${leader ? 'text-brand' : 'text-body/50'}`}>
                      {rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={`font-display font-bold text-ink ${leader ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{c.grade}</span>
                        {c.classOf && <span className="whitespace-nowrap text-sm text-body">Class of {c.classOf}</span>}
                        {leader && <span className="eyebrow ml-auto">{tiedTop.length > 1 ? 'Tied' : 'Leading'}</span>}
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
          {!loading && classes.length === 0 && <Notice>No spirit points have been posted yet. Check back after the first rally.</Notice>}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── 3. Latest News ───────────────────────── */

const quickLinks = [
  { to: '/media', label: 'Media', note: 'Fremont TV episodes and rally videos' },
  { to: '/photos', label: 'Photos', note: 'Event albums on Flickr' },
  { to: '/clubs', label: 'Clubs', note: 'The official club list, handbook, and renewal forms' },
  { to: '/resources', label: 'School Store', note: 'ASB cards, dance tickets, and spirit wear' },
]

function LatestNews({ eventsRecent = [], eventsUpcoming = [], eventsAll = [], eventsFinished = [], seniorSeason = null, eventsLoading = false }) {
  // At most 5 upcoming items, soonest first; the rest of the next 30 days sit behind "Show more".
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const UPCOMING_MAX = 5
  const upcomingMore = Math.max(0, eventsUpcoming.length - UPCOMING_MAX)
  const upcomingShown = showAllUpcoming ? eventsUpcoming : eventsUpcoming.slice(0, UPCOMING_MAX)
  const { rows, loading: newsLoading, source } = useSheetData(sheets.news, newsJson)
  const { rows: videos, loading: vLoading } = useYouTube(mediaOverlay)
  const { albums, loading: aLoading } = useFlickr(photoAlbums)

  const items = buildNews(rows, source, videos, albums, eventsRecent, eventsAll, eventsFinished, seniorSeason)
  const loading = (newsLoading || vLoading || aLoading) && items.length === 0

  return (
    <section id="news" className="border-t border-rule bg-paper section-space scroll-mt-16">
      <div className="container-site">
        {/* Two co-equal columns: the recap (newest first) and the calendar-ahead
            (soonest first), same NewsItem rows so they read at the same weight. */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionHeader eyebrow="From ASB" title="Latest News" />
            {source !== 'sheet' && (
              <DevNote>Auto-feed: newest Fremont TV episodes + photo albums. Connect sheets.news in sources.js to add written announcements on top.</DevNote>
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
            {!loading && items.length === 0 && <Notice>Nothing has been posted yet. Check back once school events start.</Notice>}
          </div>

          <div>
            <SectionHeader eyebrow="On the calendar" title="Upcoming Events" />
            {eventsLoading && eventsUpcoming.length === 0 && <Loading label="Loading upcoming events…" />}
            {eventsUpcoming.length > 0 && (
              <ol id="upcoming-list" className="divide-y divide-rule border-t border-rule">
                {upcomingShown.map((item) => (
                  <li key={item.key}>
                    <NewsItem item={item} />
                  </li>
                ))}
              </ol>
            )}
            {upcomingMore > 0 && (
              <button
                type="button"
                aria-expanded={showAllUpcoming}
                aria-controls="upcoming-list"
                onClick={() => setShowAllUpcoming((v) => !v)}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-between gap-3 rounded-btn border border-rule bg-paper px-4 py-2 text-left font-display text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span>{showAllUpcoming ? 'Show fewer events' : 'Show more events'}</span>
                <span className="inline-flex items-center gap-2">
                  {!showAllUpcoming && <span className="rounded-btn bg-brand-tint px-2 py-0.5 text-xs text-brand">{`+${upcomingMore}`}</span>}
                  <svg className={`h-4 w-4 transition-transform ${showAllUpcoming ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
              </button>
            )}
            {!eventsLoading && eventsUpcoming.length === 0 && <Notice>There are no events in the next 30 days. Check back soon for updates.</Notice>}
          </div>
        </div>

        {/* Around the site, full width beneath both columns, so the nav sits with the
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
  'Fremont TV': 'bg-ink/5 text-ink',
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
 * Latest News feed - blends, freshest first:
 *  - Written announcements from the news Google Sheet, but ONLY when one is connected
 *    (source === 'sheet'); we never render the local sample as if it were real news.
 *    Optional sheet columns: type, link, pinned (pinned rows stay on top).
 *  - Auto items from the already-live feeds: newest Fremont TV episodes + photo albums.
 * Result: the section is always real and current, even before anyone writes an announcement.
 */
function buildNews(newsRows, source, videos, albums, eventsRecent = [], curatedEvents = [], finishedGames = [], seniorSeason = null) {
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
    const kind = v.kind || 'Fremont TV'
    return {
      key: `v-${v.youtubeId}`,
      type: kind,
      title: v.title,
      blurb: v.hosts
        ? `Hosted by ${v.hosts}`
        : kind === 'Fremont TV' ? 'New Fremont TV episode' : `New ${kind.toLowerCase()} video`,
      href: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      when: parseDate(v.date),
      pinned: false,
      // Ordering flag from the Gemini feed (api/_feed.js). Fallback keeps it correct offline,
      // where only the bundled media.json overlay is available and morningShow isn't set.
      morningShow: v.morningShow ?? (kind === 'Fremont TV'),
    }
  })

  // Photo albums, titles resolved. An album that matches a recent game (e.g. the
  // "Football vs Westmont" album) is FOLDED INTO that game's result card as a photos
  // link, instead of showing as its own row — so we track which albums get consumed.
  const albumList = (albums || []).map((a) => ({
    title: a.title || cleanAlbumTitle(a.name),
    href: a.flickrUrl || null,
    count: a.count || 0,
    date: a.date || '',
    // takenAt (last photo's capture time) orders same-day albums by when they happened.
    when: a.takenAt && a.takenAt.slice(0, 10) === a.date ? new Date(a.takenAt) : parseDate(a.date),
  }))
  const norm = (s2) => String(s2 || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  // A score card that took over an album sorts by the album's capture time when it's the same
  // day, so it keeps the album's place among that day's other albums.
  const sameDayLater = (gameWhen, albumWhen) =>
    (albumWhen && gameWhen && albumWhen.toDateString() === gameWhen.toDateString() && albumWhen > gameWhen ? albumWhen : gameWhen)
  // Game titles say "vs", "at" or ":" by home/away and meet; drop those so "Football vs Westmont"
  // (an album) still matches "Football at Westmont" (the game).
  const normGame = (s2) => norm(String(s2 || '').toLowerCase().replace(/\b(vs|v|at)\b/g, ' '))
  const consumed = new Set()
  const sportNames = [...new Set([...eventsRecent, ...finishedGames].map((g) => g.sport).filter(Boolean))]
  // Same game: the titles match, or the album is from the game's day and names its exact sport,
  // e.g. "Homecoming Football Game" on Oct 9 is the Oct 9 "Football vs Jefferson" game.
  const albumIsGame = (al, g, gi) => {
    const ai = normGame(al.title)
    if (ai && gi.length >= 6 && (ai === gi || ai.includes(gi) || (ai.length >= 6 && gi.includes(ai)))) return true
    if (al.date && al.date === g.date && namesSport(al.title, g.sport, sportNames)) return true
    return seniorAlbumIsGame(al, g)
  }
  // Senior night photos always fold into that senior night's card, never a separate Photos row.
  // An album that says "Senior Night" matches a senior-night game within a day of it that it
  // names by sport (short names count: "XC" is Cross Country), or the only senior night that day.
  const seniorGames = [...eventsRecent, ...finishedGames].filter((g) => g.seniorNight)
  const nearDay = (a, b) => !!a && !!b && Math.abs(new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) <= 86400000
  const seniorAlbumIsGame = (al, g) => {
    if (!g.seniorNight || !/senior\s*night/i.test(al.title) || !nearDay(al.date, g.date)) return false
    if (namesCoreSport(al.title, g.sport, sportNames)) return true
    const named = seniorGames.some((o) => nearDay(al.date, o.date) && namesCoreSport(al.title, o.sport, sportNames))
    const sameDay = new Set(seniorGames.filter((o) => nearDay(al.date, o.date)).map((o) => o.sport))
    return !named && sameDay.size === 1
  }

  // Recent finished games. If a photo album matches the game, show its photos link right on the
  // score card and mark the album consumed so it isn't repeated.
  const games = eventsRecent.map((it) => {
    const gi = normGame(it.title)
    const m = albumList.find((al) => al.href && !consumed.has(al) && albumIsGame(al, it, gi))
    if (!m) return { ...it, pinned: false }
    consumed.add(m)
    return { ...it, pinned: false, when: sameDayLater(it.when, m.when), href: m.href, viewLabel: m.count ? `View ${m.count} photos` : 'View photos' }
  })

  // A photo album that matches a FINISHED game (any age, not just the last 2 weeks) becomes a
  // Sports score card with the final score + photos link — same shape as a recent game card —
  // instead of a bare "N new photos" row. So an older game (e.g. the season opener) whose album
  // shows up still leads with its score. Dated by the game, and skipped if a recent game card
  // already covers it.
  const gameTitles = new Set(games.map((g) => normGame(g.title)))
  const finishedCards = []
  for (const al of albumList) {
    if (!al.href || consumed.has(al)) continue
    if (normGame(al.title).length < 6 && !al.date) continue
    const fg = (finishedGames || []).find((g) => albumIsGame(al, g, normGame(g.title)))
    if (!fg || gameTitles.has(normGame(fg.title))) continue
    consumed.add(al)
    finishedCards.push({
      key: `gm-${fg.date}-${norm(fg.title)}`,
      type: 'Sports',
      title: fg.title,
      href: al.href,
      when: sameDayLater(fg.when, al.when),
      seniorNight: fg.seniorNight,
      sport: fg.sport,
      date: fg.date,
      blurb: [fg.seniorNight ? 'Senior Night' : '', scoreNote(fg.score, fg.when, undefined, fg.sport), fg.level].filter(Boolean).join(' · '),
      viewLabel: al.count ? `View ${al.count} photos` : 'View photos',
      pinned: false,
    })
  }

  // Every senior night of the season gets its own card in Latest News, so each team is shown
  // equally, not only the newest few; the whole set leaves together 10 days after the season's
  // last senior night (seniorSeason, from useEvents; Abir 2026-10-30). Cards already built above
  // (recent games, album score cards) are kept; the rest come straight from the finished games.
  const thisSeason = seniorSeason
  const covered = new Set([...games, ...finishedCards].map((c) => `${c.sport}|${c.date}`))
  const seniorCards = (finishedGames || [])
    .filter((fg) => fg.seniorNight && fg.when && seasonOf(fg.when) === thisSeason && !covered.has(`${fg.sport}|${fg.date}`))
    .map((fg) => ({
      key: `gm-${fg.date}-${fg.sport}`,
      type: 'Sports',
      title: fg.title,
      href: null,
      when: fg.when,
      seniorNight: true,
      blurb: ['Senior Night', scoreNote(fg.score, fg.when, undefined, fg.sport), fg.level].filter(Boolean).join(' · '),
      pinned: false,
    }))

  const albs = albumList.filter((al) => !consumed.has(al)).slice(0, 3).map((al) => {
    // A photo album for a curated EVENT (e.g. "Clubs Day") is dated by the EVENT itself, not
    // the Flickr upload/EXIF guess (which can land a day or two late). Match title -> event.
    const an = norm(al.title)
    const ev = an.length >= 4 ? curatedEvents.find((e) => { const en = norm(e.name); return en && (en === an || en.includes(an) || an.includes(en)) }) : null
    const evWhen = ev && ev.date ? parseDate(ev.date) : null
    return {
      key: `f-${al.href || al.title}`,
      type: 'Photos',
      title: al.title,
      blurb: al.count ? `${al.count} new photos on Flickr` : 'New album on Flickr',
      href: al.href,
      when: evWhen || al.when,
      pinned: false,
    }
  })

  // Only THIS school year (starts Aug 1 of the school-year start): drop last year's episodes/albums.
  const nowD = new Date()
  const syStart = (nowD.getMonth() + 1) >= 7 ? nowD.getFullYear() : nowD.getFullYear() - 1
  const cutoff = new Date(syStart, 7, 1) // Aug 1
  // Curated upcoming events + pinned games lead the feed, soonest first; the dated/recent
  // items fill the rest, freshest first. Cap the lead so real news still shows through.
  const dayKey = (d) => (d ? d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate() : 0)
  const ranked = [...manual, ...vids, ...albs, ...games, ...finishedCards, ...seniorCards]
    .filter((it) => it.title && it.when && it.when >= cutoff)
    .sort((x, y) => {
      const p = Number(y.pinned) - Number(x.pinned)
      if (p) return p // a human-pinned announcement still wins the very top
      const xk = dayKey(x.when), yk = dayKey(y.when)
      if (xk !== yk) return yk - xk // newer day first
      // Same day: a morning show SINKS BELOW the day's games/events. Fremont TV airs 4th period,
      // so it's the earliest thing that day; a game or event happens later, so in a newest-first
      // feed it sits ABOVE the episode. `morningShow` is set by the Gemini feed (api/_feed.js)
      // off the LLM-classified kind, so this rule holds for every future episode automatically.
      const fx = x.morningShow ? 1 : 0
      const fy = y.morningShow ? 1 : 0
      if (fx !== fy) return fx - fy // morning show last among same-day items
      return (y.when?.getTime() ?? 0) - (x.when?.getTime() ?? 0) // else newest first
    })
  // At most ONE Fremont TV item in Latest News (the newest). 'kind' is classified by the LLM
  // server-side (api/_feed.js), so a future episode is caught even if it's titled differently.
  // The 5 newest other items, plus every senior night this season (they don't use up the 5).
  let fremontTVShown = false
  let others = 0
  return ranked
    .filter((it) => {
      if (it.type === 'Fremont TV') { if (fremontTVShown) return false; fremontTVShown = true }
      if (it.seniorNight) return seasonOf(it.when) === thisSeason
      return others++ < 5
    })
}

// True when an album title names this exact sport as a whole phrase, and not only inside a
// longer name: "Football" is not "Flag Football", and not the "Firebird Football" spirit event.
const OTHER_NAMES = ['firebird football', 'powder puff football', 'powderpuff football', 'flag football']
const phrase = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function namesSport(albumTitle, sport, sportNames = []) {
  const s = phrase(sport)
  let a = ` ${phrase(albumTitle)} `
  if (!s || !a.includes(` ${s} `)) return false
  for (const longer of [...sportNames.map(phrase), ...OTHER_NAMES]) {
    if (longer !== s && ` ${longer} `.includes(` ${s} `)) a = a.split(` ${longer} `).join(' | ')
  }
  return a.includes(` ${s} `)
}

// Short names in album titles, spelled out so they match the sport ("XC Senior Night").
const SPORT_SHORT = { xc: 'cross country', wp: 'water polo', bball: 'basketball', vball: 'volleyball', fh: 'field hockey' }
// True when an album names this sport's core ("Volleyball" for Girls Volleyball). If the album
// names a gender, it must be this sport's. A longer, different sport name ("Flag Football") in
// the album doesn't count as the shorter one ("Football").
function namesCoreSport(albumTitle, sport, sportNames = []) {
  const gender = (x) => (/\b(girls?|womens?)\b/.test(x) ? 'g' : /\b(boys?|mens?)\b/.test(x) ? 'b' : '')
  const core = (x) => phrase(x).replace(/\b(girls?|boys?|womens?|mens?|varsity|jv)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const c = core(sport)
  let a = ` ${phrase(albumTitle).split(' ').map((w) => SPORT_SHORT[w] || w).join(' ')} `
  if (!c) return false
  for (const longer of [...sportNames, ...OTHER_NAMES]) {
    const lc = core(longer)
    if (lc !== c && ` ${lc} `.includes(` ${c} `)) a = a.split(` ${lc} `).join(' | ')
  }
  if (!a.includes(` ${c} `)) return false
  const ag = gender(a), sg = gender(phrase(sport))
  return !ag || !sg || ag === sg
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
            <span className="inline-flex items-center gap-1 rounded-btn bg-brand px-2 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white"><span aria-hidden="true">★</span><span>Senior Night</span></span>
          )}
        </span>
        <h3 className={`mt-2 font-display font-bold leading-snug text-ink ${featured ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}${item.href ? ' transition-colors group-hover:text-brand' : ''}`}>
          {item.title}
        </h3>
        {item.blurb && (
          <p className={`mt-2 leading-relaxed text-body ${featured ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
            {blurbParts(item.blurb)}
          </p>
        )}
        {item.href && (
          <span className="mt-3 inline-flex min-h-[24px] items-center gap-1.5 font-display text-sm font-bold text-brand">
            {item.viewLabel || 'View'} <Arrow />
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

// "Senior Night · Final score soon · Varsity" as separate text nodes, so the Spanish switch
// (which translates whole text nodes) can translate each part it knows.
function blurbParts(blurb) {
  const parts = String(blurb).split(' · ')
  if (parts.length < 2) return blurb
  return parts.map((p, i) => <span key={i}>{i > 0 && ' · '}<span>{p}</span></span>)
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
 * Morning Announcements - the recap of what went out over the PA on Wednesday and
 * Friday mornings, pulled live from the ASB sheet via /api/announcements (never embedded).
 * Only past mornings show (8:30 AM cutoff, in useAnnouncements). Collapsed by default:
 * each row shows a topic title + date, and expands on click, read only the ones you want.
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
  // Follow the newest morning until the visitor picks a day themselves, so a fresh pull (or
  // 8:30 AM passing) moves the calendar to the new day instead of leaving it on a cached one.
  const picked = useRef(false)
  const pick = (d) => { picked.current = true; setSelected(d) }
  useEffect(() => {
    if (!latest || picked.current || selected === latest) return
    setSelected(latest)
    const [y, mm] = latest.split('-').map(Number)
    setView({ y, m: mm - 1 })
  }, [latest, selected])

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
          Announcements are read over the PA on Wednesday and Friday mornings. Pick a highlighted day on the calendar to see that morning’s announcements, and click on a headline to read the whole announcement.
        </p>
        {loading && <Loading label="Loading announcements…" />}
        {view && (
          <>
            <div className="mx-auto max-w-md">
              <Calendar view={view} setView={setView} datesWith={byDate} selected={selected} onSelect={pick} years={years} latest={latest} onJumpLatest={jumpLatest} />
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
          {String(item.text).split(/\n{2,}/).map((para, i) => (
            <p key={i} className={`max-w-4xl text-base leading-relaxed text-body [overflow-wrap:anywhere]${i ? ' mt-3' : ''}`}>{para}</p>
          ))}
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
            Use the app for things that need a sign-in
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            In the app, you can submit club forms, check spirit points, see today’s bell schedule, and log teacher bonuses. You sign in with your school Google account.
          </p>
        </div>
        <div className="lg:col-span-4 lg:justify-self-end">
          <Button to="/download-app" text="Download the App" variant="inverse" />
          <p className="mt-3 text-sm text-white/80">The app is still in development. Download links will be posted here first.</p>
        </div>
      </div>
    </section>
  )
}
