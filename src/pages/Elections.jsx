import PageHero from '../components/PageHero'
import { Loading, DevNote } from '../components/DataState'
import { sheets } from '../data/sources'
import { useSheetData, isHidden } from '../data/useSheetData'
import localRows from '../data/elections.json'

/**
 * Elections - seasonal, view-only.
 *
 * Data: src/data/elections.json, one row per candidate { section, active, name, photoUrl, bio },
 * or the Google Sheet in sources.js with the same columns.
 *
 * Showing / hiding:
 *   `active` blank or TRUE = shown. FALSE (or no / 0 / hidden / archived) = hidden.
 *   To archive a whole section after voting, set every one of its rows to FALSE,
 *   the section disappears when none of its rows are shown. There is no separate
 *   settings tab. Old cycles stay in the file/sheet as FALSE rows; nothing needs deleting.
 *
 * Runs on its own schedule and shares nothing with /homecoming-court on purpose.
 */
const SECTION_ORDER = ['ASB Cabinet', 'Freshman Cabinet', 'Sophomore Cabinet', 'Junior Cabinet', 'Senior Cabinet']

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function Elections() {
  const { rows, loading, error } = useSheetData(sheets.elections, localRows)

  const sections = SECTION_ORDER
    .map((title) => ({
      title,
      id: slug(title),
      candidates: rows.filter(
        (r) => (r.section || '').trim() === title && !isHidden(r.active) && (r.name || '').trim(),
      ),
    }))
    .filter((s) => s.candidates.length > 0)

  if (loading) {
    return (
      <>
        <PageHero title="Elections" />
        <div className="container-site section-space"><Loading label="Loading candidates…" /></div>
      </>
    )
  }

  if (sections.length === 0) {
    return (
      <>
        <PageHero title="Elections" />
        <section className="container-site section-space">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-display text-2xl font-extrabold tracking-tight text-ink">
              No election is running right now.
            </p>
            <p className="mt-3 text-body">
              Candidate statements show up here once the ballot is set. Check back during election season.
            </p>
          </div>
        </section>
      </>
    )
  }

  const total = sections.reduce((n, s) => n + s.candidates.length, 0)

  return (
    <>
      <PageHero
        title="Elections"
        eyebrow="ASB and class cabinets"
        subtext="View only. Voting happens on the official ballot. Read the statements here first."
      />

      <div className="container-site section-space">
        <div className="grid gap-10 lg:grid-cols-[13rem_1fr] lg:gap-14">
          <nav aria-label="Election sections" className="min-w-0">
            <p className="eyebrow mb-3">Jump to</p>
            <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:flex-col lg:gap-1">
              {sections.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-btn border border-rule px-4 text-sm font-display font-bold text-ink hover:border-brand hover:text-brand lg:w-full lg:justify-between lg:border-0 lg:border-l-2 lg:border-rule lg:rounded-none lg:px-3 lg:hover:border-brand"
                  >
                    <span className="whitespace-nowrap">{s.title}</span>
                    <span className="text-xs font-normal text-body">{s.candidates.length}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 hidden text-sm leading-relaxed text-body lg:block">
              {total} candidates across {sections.length} {sections.length === 1 ? 'section' : 'sections'}.
            </p>
            {error && <DevNote>Sheet fetch failed ({error}); showing elections.json.</DevNote>}
          </nav>

          <div className="min-w-0">
            {sections.map((s, idx) => (
              <section
                key={s.id}
                id={s.id}
                className={`scroll-mt-24 ${idx > 0 ? 'mt-14 border-t border-rule pt-12 sm:mt-16 sm:pt-14' : ''}`}
              >
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{s.title}</h2>
                    <div className="rule-accent-left" />
                  </div>
                  <p className="text-sm text-body">
                    {s.candidates.length} {s.candidates.length === 1 ? 'candidate' : 'candidates'}
                  </p>
                </div>

                {/* Horizontal rows on phones/tablets; 3-up portrait cards on desktop */}
                <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                  {s.candidates.map((c, i) => (
                    <li key={`${s.id}-${c.name}-${i}`}>
                      <CandidateCard name={c.name} photoUrl={c.photoUrl} bio={c.bio} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* Local to this page on purpose, Homecoming Court has its own card. */
function CandidateCard({ name, photoUrl, bio }) {
  return (
    <article className="card-surface flex h-full gap-4 p-4 sm:gap-5 sm:p-5 lg:flex-col lg:gap-0 lg:p-0 lg:overflow-hidden">
      <div className="aspect-[4/5] w-24 shrink-0 self-start overflow-hidden rounded-md bg-brand-tint sm:w-28 lg:aspect-square lg:w-full lg:self-auto lg:rounded-none">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <span className="font-display text-2xl font-extrabold text-brand sm:text-3xl lg:text-6xl">{initials(name)}</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 lg:p-5">
        <h3 className="font-display text-lg font-bold leading-snug text-ink">{name}</h3>
        {bio && <p className="mt-1.5 text-sm leading-relaxed text-body sm:mt-2">{bio}</p>}
      </div>
    </article>
  )
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}
