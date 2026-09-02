import { useMemo, useState } from 'react'
import PageHero from '../components/PageHero'
import Button from '../components/Button'
import Embed from '../components/Embed'
import SectionHeader from '../components/SectionHeader'
import { Loading, DevNote } from '../components/DataState'
import { useSheetData } from '../data/useSheetData'
import { sheets, links, school, embeds, clubDates } from '../data/sources'
import clubsJson from '../data/clubs.json'

// ─────────────────────────────────────────────────────────────────────────────
// Data shape. The live "Official Clubs List" sheet has headers like
//   f | Club Purpose | Student Advisors | Teacher Avisor | Meeting Location & Times | Email List | Other Information
// (yes, "Avisor" — the typo is in the sheet). useSheetData camelCases those, so we
// accept every spelling we've seen plus the local JSON keys and normalise to one shape.
// ─────────────────────────────────────────────────────────────────────────────
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

function pick(row, keys) {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function normalizeClub(row) {
  if (row && row.__normalized) return row
  const name =
    pick(row, ['name', 'f', 'club', 'clubName', 'clubs']) ||
    String(Object.values(row)[0] ?? '').trim()
  const rawStudents = pick(row, ['studentAdvisors', 'studentAdvisor', 'studentLeaders', 'presidents', 'officers'])
  const rawEmail = pick(row, ['email', 'emailList', 'emails', 'contact', 'contactEmail'])
  const other = pick(row, ['other', 'otherInformation', 'otherInfo', 'notes'])

  // Emails hide inside the advisor cell as "Name (email)" or "Name <email>". Pull them out.
  const emails = uniq([...(rawEmail.match(EMAIL_RE) ?? []), ...(rawStudents.match(EMAIL_RE) ?? [])])
  const studentAdvisors = rawStudents
    .replace(/[(<\[][^)>\]]*@[^)>\]]*[)>\]]/g, '') // "(email)" / "<email>" / "[email]"
    .replace(EMAIL_RE, '')
    .replace(/\s*[,;/|]\s*/g, ', ')
    .replace(/(, )+/g, ', ')
    .replace(/^, |, $/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // A club is disbanded only when the sheet says so in the NAME cell, e.g. "Chess Club (disbanded)".
  // Other-info text like "inactive members welcome" must not hide a club.
  const disbanded = /disband/i.test(name)
  return {
    __normalized: true,
    name: name.replace(/\s*[(\[]?\s*disbanded\s*[)\]]?\s*/i, ' ').replace(/\s{2,}/g, ' ').trim() || 'Untitled club',
    purpose: pick(row, ['purpose', 'clubPurpose', 'description', 'about']),
    studentAdvisors,
    teacherAdvisor: pick(row, ['teacherAdvisor', 'teacherAvisor', 'advisor', 'staffAdvisor', 'teacher']),
    meetingInfo: pick(row, ['meetingInfo', 'meetingLocationTimes', 'meetingLocationTime', 'meetingLocationAndTimes', 'meetings', 'meeting', 'location']),
    emails,
    other,
    disbanded,
  }
}

const uniq = (arr) => Array.from(new Set(arr.map((s) => s.toLowerCase())))

// Hover colour only on devices that actually hover — otherwise the rust "sticks" after a tap on phones.
const HOVER_BRAND = '[@media(hover:hover)]:hover:text-brand'

export default function Clubs() {
  const { rows, loading, error, source } = useSheetData(sheets.clubs, clubsJson, { map: normalizeClub })
  const [query, setQuery] = useState('')
  const [showDisbanded, setShowDisbanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const clubs = useMemo(
    () => rows.map(normalizeClub).filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  )
  const active = useMemo(() => clubs.filter((c) => !c.disbanded), [clubs])
  const disbanded = useMemo(() => clubs.filter((c) => c.disbanded), [clubs])

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return active
    return active.filter((c) =>
      [c.name, c.purpose, c.studentAdvisors, c.teacherAdvisor, c.meetingInfo].join(' ').toLowerCase().includes(q),
    )
  }, [active, q])

  // Keep the page short: show a first batch, reveal the rest on demand. A search shows every match.
  const INITIAL_COUNT = 6
  const visibleResults = q || showAll ? results : results.slice(0, INITIAL_COUNT)

  return (
    <>
      <PageHero
        title="Clubs"
        eyebrow={school.year}
        subtext="Every club that is official this year, who runs it, and where it meets. Officers: the tracker and handbook are your two links."
      >
        <Button href="#accountability-tracker" variant="primary">Club Accountability Tracker</Button>
        <Button href={links.clubHandbook} variant="primary" external>Club Handbook</Button>
        <Button href="#club-list" variant="secondary">Browse the club list</Button>
        <Button href="#club-dates" variant="secondary">Key dates</Button>
        <Button href="#start-a-club" variant="secondary">How to start a club</Button>
      </PageHero>

      <ClubDates />

      {/* ── Club list ──────────────────────────────────────────────────────── */}
      <section id="club-list" className="container-site section-space scroll-mt-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Side rail: search + count */}
          <aside className="lg:col-span-4">
            <p className="eyebrow mb-2">Club list</p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">Find a club</h2>
            <div className="rule-accent-left" />

            <label htmlFor="club-search" className="mt-6 block text-sm font-bold text-ink">
              Search by name, purpose, advisor, or room
            </label>
            <div className="relative mt-2">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-body/60" />
              {/* Focus ring comes from the global :focus-visible rule in index.css — no component ring, or it doubles up. */}
              <input
                id="club-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="chess, robotics, Mr. Chen, room 12…"
                autoComplete="off"
                className="w-full rounded-btn border border-rule bg-paper py-3 pl-10 pr-4 text-base text-ink placeholder:text-body/50 focus:border-brand min-h-[44px]"
              />
            </div>

            <p className="mt-4 text-sm text-body" aria-live="polite">
              {loading ? (
                'Loading the list…'
              ) : q ? (
                <>
                  <span className="font-bold text-ink">{results.length}</span> of {active.length} clubs match “{query.trim()}”
                </>
              ) : (
                <>
                  <span className="font-bold text-ink">{active.length}</span> active clubs
                  {disbanded.length > 0 && <>, {disbanded.length} disbanded</>}
                </>
              )}
            </p>

            {/* Maintainer-only hint. DevNote renders nothing in the production build. */}
            {source === 'local' && !loading && (
              <DevNote>
                Showing src/data/clubs.json.{' '}
                {error ? 'The live sheet could not be reached.' : 'Set sheets.clubs in sources.js to the Official Clubs List to go live.'}
              </DevNote>
            )}

            <HelpLinks className="mt-6 hidden lg:block" />
          </aside>

          {/* Results */}
          <div className="lg:col-span-8">
            {loading ? (
              <Loading label="Loading the Official Clubs List…" />
            ) : results.length === 0 ? (
              <div className="border-t border-rule py-10">
                <p className="font-display text-lg font-bold text-ink">No club matches “{query.trim()}”.</p>
                <p className="mt-2 text-sm text-body">
                  Try a shorter word, or{' '}
                  <button type="button" onClick={() => setQuery('')} className="link-brand">clear the search</button>.
                </p>
              </div>
            ) : (
              <>
                <ul className="border-t border-rule">
                  {visibleResults.map((club, index) => (
                    <ClubRow key={`${club.name}-${index}`} club={club} />
                  ))}
                </ul>
                {!q && results.length > INITIAL_COUNT && (
                  <div className="mt-6 flex justify-center border-t border-rule pt-6">
                    <button
                      type="button"
                      onClick={() => setShowAll((v) => !v)}
                      aria-expanded={showAll}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-btn border border-rule px-6 font-display text-sm font-bold text-ink ${HOVER_BRAND} [@media(hover:hover)]:hover:border-brand`}
                    >
                      {showAll ? 'Show fewer' : `Show all ${results.length} clubs`}
                      <Chevron open={showAll} />
                    </button>
                  </div>
                )}
              </>
            )}

            {!loading && disbanded.length > 0 && !q && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setShowDisbanded((v) => !v)}
                  aria-expanded={showDisbanded}
                  className={`inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-body ${HOVER_BRAND}`}
                >
                  <Chevron open={showDisbanded} />
                  {showDisbanded ? 'Hide' : 'Show'} {disbanded.length} disbanded {disbanded.length === 1 ? 'club' : 'clubs'}
                </button>
                {showDisbanded && (
                  <ul className="mt-3 border-t border-rule">
                    {disbanded.map((club, index) => (
                      <ClubRow key={`${club.name}-${index}`} club={club} />
                    ))}
                  </ul>
                )}
              </div>
            )}
            <HelpLinks className="mt-8 lg:hidden" />
          </div>
        </div>
      </section>

      {/* ── Club Accountability Tracker (live preview of the sheet) ─────────── */}
      <section id="accountability-tracker" className="container-site section-space scroll-mt-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:gap-12">
          <div className="min-w-0">
            <SectionHeader eyebrow="Live from the sheet" title="Club Accountability Tracker" className="!mb-4" />
            <Embed
              src={embeds.clubAccountabilityTracker}
              title="Club Accountability Tracker"
              minHeight="70vh"
              fallback="The accountability tracker isn't shared yet — check with ASB."
            />
          </div>
          <aside>
            <p className="eyebrow mb-2">How to read it</p>
            <div className="rule-accent-left mb-4" />
            <p className="text-sm leading-relaxed text-body">
              This is the live tracker — it updates as ASB records constitutions, Clubs Day, the monthly
              check-ins, Grub Day, and strikes. Find your club’s row to see where you stand.
            </p>
            <div className="mt-6">
              <Button href={links.clubAccountabilityTracker} variant="primary" external>
                Open in Google Sheets
              </Button>
            </div>
          </aside>
        </div>
      </section>

      {/* ── How to start a club ──────────────────── */}
      {/*
        Copy below is limited to what the old site and the Club Accountability Tracker
        columns confirm: teacher advisor, constitution, submit to ASB, Clubs Day (both
        semesters), the three check-ins, Grub Day, and strikes on the tracker. Do NOT add
        a strike limit, months, or deadlines here — ASB Tech confirms those in the Handbook.
      */}
      <section id="start-a-club" className="border-t border-rule bg-paper scroll-mt-20">
        <div className="container-site section-space">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <SectionHeader eyebrow="Start a club" title="How to start a club" className="mb-4 sm:mb-5" />
              <p className="text-body leading-relaxed">
                Three steps to get on the Official Clubs List, then the things every club does during the year to stay on it.
                The Club Handbook has the full rules and this year’s dates.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button href={links.clubHandbook} variant="primary" external>Read the Club Handbook</Button>
              </div>
            </div>

            <div className="lg:col-span-8">
              <ol className="border-t border-rule">
                {START_STEPS.map((step, i) => (
                  <li key={step.title} className="grid grid-cols-[3rem_1fr] gap-x-4 border-b border-rule py-6 sm:grid-cols-[4rem_1fr] sm:gap-x-6">
                    <span className="font-display text-3xl font-extrabold leading-none text-brand sm:text-4xl" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-ink sm:text-xl">{step.title}</h3>
                      <p className="mt-2 text-body leading-relaxed">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-12">
                <h3 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Staying active</h3>
                <div className="rule-accent-left" />
                <p className="mt-4 text-body leading-relaxed">
                  Once you’re on the list, ASB tracks these on the{' '}
                  <a href={links.clubAccountabilityTracker} className="link-brand" target="_blank" rel="noopener noreferrer">
                    Club Accountability Tracker
                  </a>
                  . Missed items show up as strikes on the tracker, so check your club’s row.
                </p>
                <dl className="mt-6 border-t border-rule">
                  {ACTIVE_REQUIREMENTS.map((r) => (
                    <div key={r.label} className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
                      <dt className="font-display text-sm font-bold uppercase tracking-wide text-ink">{r.label}</dt>
                      <dd className="text-sm text-body leading-relaxed sm:text-base">{r.body}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-12">
                <h3 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Renewing for next year</h3>
                <div className="rule-accent-left" />
                <p className="mt-4 text-body leading-relaxed">
                  Clubs don’t carry over automatically. Incoming officers renew with ASB each year so the club stays on the list.
                  The renewal steps and the deadline are in the Club Handbook.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function HelpLinks({ className = '' }) {
  return (
    <div className={`border-t border-rule pt-5 text-sm text-body ${className}`}>
      <p>
        Missing or out of date? Email{' '}
        <a href={`mailto:${school.email}`} className="link-brand">{school.email}</a> or edit the{' '}
        <a href={links.clubsListSheet} className="link-brand" target="_blank" rel="noopener noreferrer">Official Clubs List sheet</a>.
      </p>
      <p className="mt-3">
        Don’t see yours? <a href="#start-a-club" className="link-brand">Start a club</a>.
      </p>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function ClubRow({ club }) {
  const [open, setOpen] = useState(false)
  // Expand only if the detail grid would show something beyond the collapsed row
  const hasDetails = Boolean(club.emails.length || club.other || club.studentAdvisors || club.teacherAdvisor || club.meetingInfo || (club.purpose && club.purpose.length > 160))
  const leaders = splitNames(club.studentAdvisors)
  const leadLine = leaders.length ? (leaders.length > 2 ? `${leaders.slice(0, 2).join(', ')} +${leaders.length - 2}` : leaders.join(', ')) : ''

  return (
    <li className="border-b border-rule py-5">
      <h3 className="font-display text-lg font-bold leading-snug text-ink sm:text-xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          disabled={!hasDetails}
          className="group flex w-full min-h-[44px] items-start justify-between gap-3 text-left transition-colors enabled:[@media(hover:hover)]:hover:text-brand disabled:cursor-default"
        >
          <span>
            {club.name}
            {club.disbanded && <span className="ml-2 align-middle font-sans text-xs font-bold uppercase tracking-wide text-body">Disbanded</span>}
          </span>
          {hasDetails && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-brand ring-1 ring-inset ring-rule [@media(hover:hover)]:group-hover:bg-brand-tint">
              <Chevron open={open} />
            </span>
          )}
        </button>
      </h3>
      {club.purpose ? (
        <p className={`mt-1 text-body ${open ? '' : 'line-clamp-2'}`}>{club.purpose}</p>
      ) : (
        <p className="mt-1 text-body/70 italic">Purpose not listed yet.</p>
      )}
      {!open && (
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-body">
        {club.meetingInfo && <Meta label="Meets">{club.meetingInfo}</Meta>}
        {club.teacherAdvisor && <Meta label="Advisor">{club.teacherAdvisor}</Meta>}
        {leadLine && <Meta label="Led by">{leadLine}</Meta>}
      </div>
      )}

      {open && (
        <div className="mt-5 grid gap-x-8 gap-y-4 border-t border-dashed border-rule pt-5 sm:grid-cols-2">
          {leaders.length > 0 && (
            <Detail label="Student leaders">{leaders.join(', ')}</Detail>
          )}
          {club.teacherAdvisor && <Detail label="Teacher advisor">{club.teacherAdvisor}</Detail>}
          {club.meetingInfo && <Detail label="Meeting location & times">{club.meetingInfo}</Detail>}
          {club.emails.length > 0 && (
            <Detail label="Contact">
              <ul className="space-y-1">
                {club.emails.map((e) => (
                  <li key={e}><a href={`mailto:${e}`} className="link-brand break-all">{e}</a></li>
                ))}
              </ul>
            </Detail>
          )}
          {club.other && <Detail label="Other information" className="sm:col-span-2">{club.other}</Detail>}
        </div>
      )}
    </li>
  )
}

function Meta({ label, children }) {
  return (
    <span className="inline-flex gap-1.5">
      <span className="font-bold text-ink">{label}</span>
      <span className="truncate max-w-[18rem]">{children}</span>
    </span>
  )
}

function Detail({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="eyebrow text-[0.65rem] mb-1">{label}</p>
      <div className="text-sm text-ink leading-relaxed">{children}</div>
    </div>
  )
}

function splitNames(s) {
  return s.split(/\s*(?:,|;|\/|\band\b|&)\s*/i).map((n) => n.trim()).filter(Boolean)
}

function Chevron({ open }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.5 13.5L17 17" strokeLinecap="round" />
    </svg>
  )
}

/* ── Key dates (from the Club Info Meeting deck; data in sources.js clubDates) ── */
function ClubDates() {
  const today = new Date().toISOString().slice(0, 10)
  const items = [...clubDates.items].sort((a, b) => a.iso.localeCompare(b.iso))
  const nextIso = items.find((it) => it.iso >= today)?.iso
  const dot = { event: 'bg-brand', deadline: 'bg-ink', process: 'bg-body/40' }
  return (
    <section id="club-dates" className="container-site section-space scroll-mt-20">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeader eyebrow="26–27 calendar" title="Key dates" className="!mb-4" />
          <p className="text-base leading-relaxed text-body">
            Clubs Day, the big club nights, and the deadlines that keep your club official — all in one place. ASB emails the details ahead of each one.
          </p>
          {clubDates.note && (
            <p className="mt-4 text-sm leading-relaxed text-body">{clubDates.note}</p>
          )}
          <p className="mt-6 text-xs uppercase tracking-wider text-body">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand align-middle" />Event
            <span className="ml-4 mr-1.5 inline-block h-2 w-2 rounded-full bg-ink align-middle" />Deadline
            <span className="ml-4 mr-1.5 inline-block h-2 w-2 rounded-full bg-body/40 align-middle" />Process
          </p>
        </div>
        <div className="lg:col-span-7">
          <ol className="divide-y divide-rule border-y border-rule">
            {items.map((it) => {
              const past = it.iso < today
              const next = it.iso === nextIso
              return (
                <li key={it.iso + it.label} className={`flex items-baseline gap-4 py-4 ${past ? 'opacity-45' : ''}`}>
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${dot[it.type] || 'bg-body/40'}`} />
                  <span className="w-24 shrink-0 font-display font-bold tabular-nums text-ink">{it.display}</span>
                  <span className="min-w-0">
                    <span className="font-display font-bold text-ink">{it.label}</span>
                    {next && <span className="eyebrow ml-2 text-brand">Next up</span>}
                    {it.detail && <span className="block text-sm text-body">{it.detail}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ── Static copy ───────────────────────────────────────────────────────────────
// Only the confirmed steps. Deadlines, templates, and review timing live in the Handbook.
const START_STEPS = [
  {
    title: 'Find a teacher advisor.',
    body: 'A Fremont staff member has to agree to advise the club and host its meetings. Ask before you do anything else.',
  },
  {
    title: 'Write a club constitution.',
    body: 'Club name, purpose, officer positions, and how you meet. The Club Handbook covers what it needs to include.',
  },
  {
    title: 'Submit it to ASB.',
    body: 'Turn the constitution in to ASB. Approved clubs go on the Official Clubs List above and get a row on the Club Accountability Tracker.',
  },
]

// Row labels match the tracker columns. No dates here on purpose — the Handbook owns them.
const ACTIVE_REQUIREMENTS = [
  { label: 'Club Constitution', body: 'On file with ASB.' },
  { label: 'Clubs Day', body: 'Table at Clubs Day both semesters. This is where clubs pick up most of their members.' },
  { label: 'October Check-In', body: 'First check-in of the year with ASB.' },
  { label: 'Dec/Jan Check-In', body: 'Second check-in.' },
  { label: 'Feb/March Check-In', body: 'Third check-in.' },
  { label: 'Grub Day', body: 'Take part in Grub Day. Food sales need Fundraiser Approval first — see the Resources page.' },
  { label: 'Strikes', body: 'Missed items are recorded as strikes on the Club Accountability Tracker.' },
]
