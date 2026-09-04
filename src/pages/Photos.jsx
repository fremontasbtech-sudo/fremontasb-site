import PageHero from '../components/PageHero'
import Button, { ExternalIcon } from '../components/Button'
import { links, school } from '../data/sources'
import { cleanAlbumTitle, formatAlbumMonth } from '../data/albumTitle'
import fallbackAlbums from '../data/photos.json'
import { useFlickr } from '../data/useFlickr'

/**
 * Photos - event albums on Flickr.
 * Data: src/data/photos.json  [{ name, coverImageUrl, flickrUrl }]  - first row is the featured album.
 * Add an album: drop a cover image in /public, add a row to the JSON. Nothing else changes.
 *
 * Layout
 *   375  : one column, 4:3 covers
 *   768  : featured album spans both columns at 16:9, the rest pair up at 4:3
 *   1280 : featured 7 cols at 7:5, second album 5 cols square (same height), then 6/6 rows at 16:10
 */
function slot(i) {
  if (i === 0) return { col: 'md:col-span-2 lg:col-span-7', ratio: 'md:aspect-[16/9] lg:aspect-[7/5]' }
  if (i === 1) return { col: 'md:col-span-1 lg:col-span-5', ratio: 'lg:aspect-square' }
  return { col: 'md:col-span-1 lg:col-span-6', ratio: 'lg:aspect-[16/10]' }
}

export default function Photos() {
  const { albums: events } = useFlickr(fallbackAlbums)
  return (
    <>
      <PageHero
        title="Photos"
        eyebrow={`${events.length} albums`}
        subtext="Click a photo below to see all photos from individual events, or click the button below to be redirected to the Fremont ASB Flickr page."
      >
        <Button href={links.flickr} external className="px-7 text-lg">Flickr</Button>
      </PageHero>

      <section className="section-space">
        <div className="container-site">
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
            {events.map((ev, i) => {
              const s = slot(i)
              return (
                <li key={ev.flickrUrl} className={s.col}>
                  <AlbumCard event={ev} featured={i === 0} ratio={s.ratio} />
                </li>
              )
            })}
          </ul>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-8">
            <p className="text-sm text-body">
              Every album (rallies, dances, spirit weeks) is on the ASB Flickr. Took photos at an event? Email them to{' '}
              <a href={`mailto:${school.email}`} className="link-brand">{school.email}</a>.
            </p>
            <Button variant="secondary" href={links.flickr} external>All albums on Flickr</Button>
          </div>
        </div>
      </section>
    </>
  )
}

/* ── local card: image fills a fixed-ratio box, caption pinned to the bottom ── */

function AlbumCard({ event, featured, ratio }) {
  return (
    <a href={event.flickrUrl} target="_blank" rel="noopener noreferrer"
       className="group card-surface flex h-full flex-col overflow-hidden">
      {/* grow: if a neighbour's title wraps, the cover absorbs the extra height (object-cover), no dead white */}
      <div className={`relative aspect-[4/3] w-full grow overflow-hidden bg-rule ${ratio}`}>
        <img
          src={event.coverImageUrl}
          alt={`${(event.title || cleanAlbumTitle(event.name))} cover photo`}
          loading={featured ? 'eager' : 'lazy'}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          {event.date && <p className="eyebrow mb-1 text-[0.6rem]">{formatAlbumMonth(event.date)}</p>}
          <h2 className={`font-display text-lg font-bold leading-snug text-ink transition-colors group-hover:text-brand ${featured ? 'lg:text-2xl' : ''}`}>
            {(event.title || cleanAlbumTitle(event.name))}
          </h2>
        </div>
        <ExternalIcon className="mb-1 h-4 w-4 shrink-0 text-brand/70" />
      </div>
    </a>
  )
}
