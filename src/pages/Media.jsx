import { useMemo, useState } from 'react'
import PageHero from '../components/PageHero'
import SectionHeader from '../components/SectionHeader'
import Button, { ExternalIcon } from '../components/Button'
import { links, youtubeFeed } from '../data/sources'
import overlay from '../data/media.json'
import { useYouTube } from '../data/useYouTube'

/**
 * Media — FremontTV + rally/event videos in one place.
 * Data: src/data/media.json  [{ title, date, youtubeId, hosts, kind }]
 * Swap rows in that file and this page updates; nothing here is hardcoded to an episode.
 * Newest row = featured player. Everything else = archive.
 */

const KINDS = ['FremontTV', 'Rally', 'Event']

const embedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`
const thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Media() {
  const { rows: episodes } = useYouTube(youtubeFeed, overlay)
  const sorted = useMemo(
    () => [...episodes].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [episodes],
  )
  const latest = sorted[0]
  // The featured episode is not repeated in the archive.
  const rest = useMemo(
    () => (latest ? sorted.filter((e) => e.youtubeId !== latest.youtubeId) : sorted),
    [sorted, latest],
  )
  const [kind, setKind] = useState('All')

  const counts = useMemo(() => {
    const c = { All: rest.length }
    for (const k of KINDS) c[k] = rest.filter((e) => e.kind === k).length
    return c
  }, [rest])

  const archive = kind === 'All' ? rest : rest.filter((e) => e.kind === kind)

  return (
    <>
      <PageHero
        title="Media"
        eyebrow="FremontTV · Rallies · Events"
        subtext="FremontTV video announcements are created by the ASB Technology and Content Creation Commission and are played bi-weekly during 4th block."
      >
        <Button variant="secondary" href={links.youtube} external>YouTube channel</Button>
      </PageHero>

      {/* Latest episode — the one focal point on the page */}
      {latest && (
        <section className="section-space">
          <div className="container-site">
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-8">
                <Player episode={latest} />
              </div>
              <div className="lg:col-span-4 lg:pt-2">
                <p className="eyebrow">Latest episode</p>
                <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
                  {latest.title}
                </h2>
                <div className="rule-accent-left" />
                <dl className="mt-5 space-y-3 text-sm">
                  <Meta label="Aired">{formatDate(latest.date)}</Meta>
                  {latest.hosts && <Meta label="Hosts">{latest.hosts}</Meta>}
                  <Meta label="Type">{latest.kind}</Meta>
                </dl>
                <p className="mt-6 text-sm leading-relaxed text-body">
                  New episodes play in 4th block every other week. Missed one? Everything we've published is in the archive below.
                </p>
                <a href={watchUrl(latest.youtubeId)} target="_blank" rel="noopener noreferrer"
                   className="link-brand mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold">
                  Watch on YouTube <ExternalIcon />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Archive */}
      <section className="border-t border-rule section-space">
        <div className="container-site">
          {/* Title + filters: one render; the filter row drops below the title until lg. */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 sm:mb-10">
            <SectionHeader title="Archive" eyebrow={`${rest.length} earlier videos`} className="!mb-0" />
            <Filters kind={kind} setKind={setKind} counts={counts} className="w-full lg:w-auto" />
          </div>

          {archive.length === 0 ? (
            <p className="text-body">No {kind} videos in the archive yet.</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {archive.map((e) => (
                <li key={e.youtubeId}>
                  <ArchiveCard episode={e} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-rule pt-8">
            <p className="text-sm text-body">Older videos and full rally recordings live on the channel.</p>
            <Button variant="secondary" href={links.youtube} external>All videos on YouTube</Button>
          </div>
        </div>
      </section>
    </>
  )
}

/* ── local pieces ─────────────────────────────────────────────────────────── */

function Meta({ label, children }) {
  return (
    <div className="flex gap-4">
      <dt className="w-14 shrink-0 font-display font-bold text-ink">{label}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  )
}

function Filters({ kind, setKind, counts, className = '' }) {
  return (
    <div role="group" aria-label="Filter videos by type" className={`flex flex-wrap gap-2 ${className}`}>
      {['All', ...KINDS].map((k) => (
        <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
          {k} <span className="ml-1 opacity-70">{counts[k]}</span>
        </FilterChip>
      ))}
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  const base = 'inline-flex min-h-[44px] items-center rounded-btn px-4 text-sm font-display font-bold transition-colors'
  const cls = active
    ? `${base} bg-brand text-white`
    : `${base} bg-paper text-ink ring-1 ring-inset ring-rule hover:bg-brand-tint hover:text-brand`
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{children}</button>
  )
}

/**
 * Player — poster + play button; loads the YouTube iframe only when clicked.
 * Keeps the page fast and gives a neutral 16:9 box when YouTube can't be reached.
 * The title lives in the h2 beside/below the player, so the poster carries no caption.
 */
function Player({ episode }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-rule bg-rule" style={{ aspectRatio: '16 / 9' }}>
      {playing ? (
        <iframe
          src={embedUrl(episode.youtubeId)}
          title={episode.title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${episode.title}`}
          className="group absolute inset-0 flex h-full w-full items-center justify-center text-left"
        >
          <Thumb id={episode.youtubeId} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="relative z-10 flex items-center gap-3 rounded-btn bg-brand px-5 py-3 font-display font-bold text-white transition-colors group-hover:bg-brand-dark">
            <PlayIcon /> Play episode
          </span>
        </button>
      )}
    </div>
  )
}

function ArchiveCard({ episode }) {
  return (
    <a href={watchUrl(episode.youtubeId)} target="_blank" rel="noopener noreferrer"
       className="group block">
      <div className="relative overflow-hidden rounded-lg border border-rule bg-rule" style={{ aspectRatio: '16 / 9' }}>
        <Thumb id={episode.youtubeId} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute left-3 top-3 z-10 rounded-btn bg-paper px-2 py-1 text-xs font-display font-bold uppercase tracking-wider text-brand">
          {episode.kind}
        </span>
        <span className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white opacity-90 transition-opacity group-hover:opacity-100">
          <PlayIcon className="h-4 w-4" />
        </span>
      </div>
      <div className="pt-3">
        <h3 className="font-display text-base font-bold leading-snug text-ink transition-colors group-hover:text-brand">
          {episode.title}
        </h3>
        <p className="mt-1 text-sm text-body">
          {formatDate(episode.date)}{episode.hosts ? ` · ${episode.hosts}` : ''}
        </p>
      </div>
    </a>
  )
}

/** YouTube thumbnail; hides itself if the image can't load so the gray box stays clean. */
function Thumb({ id, alt, className }) {
  return (
    <img
      src={thumbUrl(id)}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
    />
  )
}

function PlayIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 4.5v11l9-5.5z" />
    </svg>
  )
}
