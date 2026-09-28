import PageHero from '../components/PageHero'
import { Loading, DevNote } from '../components/DataState'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sheets, googleClientId, homecomingNominationsClosesAt, homecomingNominationsClosesLabel } from '../data/sources'
import { useSheetData, isHidden } from '../data/useSheetData'
import localCourt from '../data/homecomingCourt.json'
import NominationForm from '../components/NominationForm'
import { useNominationConfig } from '../data/useNominationConfig'

/**
 * Homecoming Court - seasonal, view-only.
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
 * This page intentionally shares nothing with /elections, they run on different
 * schedules and are edited by different people.
 */
const CLOSE_MS = Date.parse(homecomingNominationsClosesAt)
// The closed page shows from the deadline until the court is posted (or 45 days, whichever is first).
const CLOSED_PAGE_MS = 45 * 24 * 60 * 60 * 1000

/** true once the nomination deadline has passed. Flips on its own at the deadline, no reload needed. */
function useNominationsClosed() {
  const [closed, setClosed] = useState(() => Number.isFinite(CLOSE_MS) && Date.now() >= CLOSE_MS)
  useEffect(() => {
    if (closed || !Number.isFinite(CLOSE_MS)) return
    const ms = CLOSE_MS - Date.now()
    if (ms > 2 ** 31 - 1) return // more than ~24 days away; a later visit will pick it up
    const t = setTimeout(() => setClosed(true), Math.max(0, ms) + 250)
    return () => clearTimeout(t)
  }, [closed])
  return closed
}

export default function HomecomingCourt() {
  const { rows, loading, error, source } = useSheetData(sheets.homecomingCourt, localCourt.candidates)
  const { config: nom, loading: nomLoading } = useNominationConfig()
  const pastDeadline = useNominationsClosed()
  const showClosed = pastDeadline && Date.now() < CLOSE_MS + CLOSED_PAGE_MS

  const candidates = rows.filter((r) => (r.name || '').trim() !== '' && !isHidden(r.active))
  const active = source === 'sheet' ? candidates.length > 0 : localCourt.active !== false
  const cycle =
    rows.find((r) => (r.cycle || '').trim())?.cycle.trim() || nom?.cycle || localCourt.cycle || 'Homecoming Court'

  // Once the deadline passes, the closed page shows until the final court is posted. It does not
  // wait for the Config tab, so it appears exactly on time even if nobody touches the sheet.
  if (showClosed && !active && !loading) return <NominationsClosed cycle={cycle} />

  if (loading || nomLoading) {
    return (
      <>
        <PageHero title="Homecoming Court" />
        <div className="container-site section-space"><Loading label="Loading the court…" /></div>
      </>
    )
  }

  // Phase 1 - nominations window. A single Config cell in the Sheet (read via the Apps
  // Script Web App's ?view=config) opens this; the court display below only appears after
  // nominations close and the final 12 are entered. Students nominate right here: Sign in
  // with Google, then /api/nominate verifies the token server-side before anything is saved
  // (no email is ever typed). See useNominationConfig + NominationForm.
  if (nom?.open && !pastDeadline) {
    return (
      <>
        <PageHero
          title="Homecoming Court"
          eyebrow={cycle !== 'Homecoming Court' ? cycle : 'Nominations'}
          subtext={
            !googleClientId
              ? 'Nominations will open here soon.'
              : 'Nominations are open. Nominate up to 4 senior classmates for the Homecoming Court using your school account.'
          }
        />
        <section className="container-site section-space">
          <div className="mx-auto max-w-xl">
            <p className="eyebrow mb-2">Peer nominations</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Nominate up to 4 seniors
            </h2>
            <div className="rule-accent-left" />
            <div className="mt-5 space-y-4 leading-relaxed text-body">
              <p>
                You can nominate up to 4 seniors. To be inclusive of all students, Hoco Court will be made
                up of 12 students regardless of gender identity. 8 members will be chosen via student
                nomination, and the other 4 will be selected by teachers.
              </p>
              <p>
                Nominations are tied to your school Google account, so that everyone can only submit once.
                If you submit multiple times, only your most recent nominations will count.
              </p>
              <div className="rounded-lg border border-rule bg-[#F6F4F2] p-4 text-sm">
                <p className="font-display font-bold text-ink">Rules</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Do not nominate the same senior more than once, or all your nominations will be thrown out.</li>
                  <li>Use real names, not nicknames. Spelling has to be close enough to identify the student.</li>
                </ol>
              </div>
              <p className="text-sm">
                Once the court is chosen, voting for the 2 Homecoming Royalty winners will happen during
                Homecoming Week.
              </p>
              {googleClientId && (homecomingNominationsClosesLabel || nom?.deadline) ? (
                <p className="text-sm font-bold text-ink">
                  {`Nominations close ${homecomingNominationsClosesLabel || nom.deadline}.`}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-8">
            <NominationForm mode={nom.mode} deadline={homecomingNominationsClosesLabel || nom.deadline} />
          </div>
        </section>
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
        subtext="View only. Voting happens in class and on the official ballot. This page is for reading up on the court before you vote."
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

/** Shown from the nomination deadline until the final court is posted. */
function NominationsClosed({ cycle }) {
  const steps = [
    { title: 'Counting the nominations', text: 'ASB is going through every student’s nominations now.' },
    { title: 'The court is announced', text: '8 members come from student nominations, and the other 4 are selected by teachers. All 12 will be posted on this page.' },
    { title: 'Royalty voting', text: 'Voting for the 2 Homecoming Royalty winners happens during Homecoming Week, October 5 to 9.' },
  ]
  return (
    <>
      <PageHero
        title="Homecoming Court"
        eyebrow={cycle !== 'Homecoming Court' ? cycle : 'Nominations'}
        subtext="Nominations are closed. Thank you to everyone who nominated a senior!"
      />
      <section className="container-site section-space">
        <div className="mx-auto max-w-xl">
          <div className="card-surface p-6 sm:p-8">
            <p className="eyebrow flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-tint text-brand" aria-hidden="true">
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 8h8" /></svg>
              </span>
              Nominations closed
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Thank you for nominating
            </h2>
            <p className="mt-4 leading-relaxed text-body">
              {`Nominations closed on ${homecomingNominationsClosesLabel}, and new nominations or changes can’t be saved anymore. If you already nominated, your most recent picks are the ones that count.`}
            </p>

            <p className="mt-7 font-display text-xs font-bold uppercase tracking-[0.14em] text-ink">What happens next</p>
            <ol className="mt-3 space-y-3">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3 rounded-lg border border-rule px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-sm font-bold text-brand" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-body">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:gap-5">
              <Link to="/" className="btn-secondary">Back to Home</Link>
              <Link to="/contact" className="text-sm font-bold text-brand underline-offset-4 hover:underline">Questions? Contact ASB</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/* Local to this page on purpose, Elections has its own card with its own layout. */
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
