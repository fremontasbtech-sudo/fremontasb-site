import PageHero from '../components/PageHero'
import { Loading, DevNote } from '../components/DataState'
import { sheets } from '../data/sources'
import { useSheetData, isHidden } from '../data/useSheetData'
import localCourt from '../data/homecomingCourt.json'

/**
 * Homecoming Court — seasonal, view-only.
 *
 * Data: src/data/homecomingCourt.json  { active, cycle, candidates: [{ name, photoUrl, bio }] }
 * or the Google Sheet in sources.js (columns: name | photoUrl | bio | active | cycle).
 *
 * Showing / hiding the page:
 *   Local file → set `active` to false at the top of the JSON.
 *   Sheet      → the page shows while ANY row is not hidden (blank `active` counts as shown).
 *                After voting, set every row's `active` to FALSE. Nothing gets deleted.
 *   Per row    → a single FALSE row is hidden while the rest of the court still shows.
 * Cycle label → first non-empty `cycle` cell (sheet), else `cycle` in the JSON.
 *
 * This page intentionally shares nothing with /elections — they run on different
 * schedules and are edited by different people.
 */
export default function HomecomingCourt() {
  const { rows, loading, error, source } = useSheetData(sheets.homecomingCourt, localCourt.candidates)

  const candidates = rows.filter((r) => (r.name || '').trim() !== '' && !isHidden(r.active))
  const active = source === 'sheet' ? candidates.length > 0 : localCourt.active !== false
  const cycle =
    rows.find((r) => (r.cycle || '').trim())?.cycle.trim() || localCourt.cycle || 'Homecoming Court'

  if (loading) {
    return (
      <>
        <PageHero title="Homecoming Court" />
        <div className="container-site section-space"><Loading label="Loading the court…" /></div>
      </>
    )
  }

  if (!active) {
    return (
      <>
        <PageHero title="Homecoming Court" />
        <section className="container-site section-space">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-display text-2xl font-extrabold tracking-tight text-ink">
              Homecoming Court isn&rsquo;t live right now.
            </p>
            <p className="mt-3 text-body">
              Check back during homecoming season. This is where the court&rsquo;s names, photos, and
              bios will be once nominations are in.
            </p>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHero
        title="Homecoming Court"
        eyebrow={cycle !== 'Homecoming Court' ? cycle : undefined}
        subtext="View only — voting happens in class and on the official ballot. This page is for reading up on the court before you vote."
      />

      <section className="container-site section-space">
        <div className="grid gap-8 lg:grid-cols-[13rem_1fr] lg:gap-14">
          <div>
            <p className="eyebrow mb-2">The court</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {candidates.length} {candidates.length === 1 ? 'nominee' : 'nominees'}
            </h2>
            <div className="rule-accent-left" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-body">
              Listed in no particular order. Photos and bios come from the nominees themselves.
            </p>
            {error && <DevNote>Sheet fetch failed ({error}); showing homecomingCourt.json.</DevNote>}
          </div>

          <div className="min-w-0">
            {/* Phones: one column of horizontal image + text rows. sm+: portrait card grid. */}
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:gap-6">
              {candidates.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  <CandidateCard name={c.name} photoUrl={c.photoUrl} bio={c.bio} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

/* Local to this page on purpose — Elections has its own card with its own layout. */
function CandidateCard({ name, photoUrl, bio }) {
  return (
    <article className="card-surface flex h-full overflow-hidden sm:flex-col">
      <div className="w-28 shrink-0 bg-brand-tint sm:w-full sm:aspect-[4/5]">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <span className="font-display text-3xl font-extrabold text-brand sm:text-6xl">{initials(name)}</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:justify-start sm:p-5">
        <h3 className="font-display text-base font-bold leading-snug text-ink sm:text-lg">{name}</h3>
        {bio && <p className="mt-1.5 text-sm leading-relaxed text-body sm:mt-2">{bio}</p>}
      </div>
    </article>
  )
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}
