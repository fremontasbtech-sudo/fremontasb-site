import PageHero from '../components/PageHero'
import Button from '../components/Button'
import { links, school } from '../data/sources'

// Six resources, two groups. Links live in src/data/sources.js — a '#' means
// ASB Tech hasn't confirmed the real URL yet, and the block says so instead of pretending.
// Descriptions stay to one neutral sentence: what the resource is for, nothing we can't confirm.
const GROUPS = [
  {
    eyebrow: 'For students',
    title: 'Help, support, and spirit wear',
    blurb: 'The three links students ask the ASB office for most. Anyone can use them — no club or cabinet needed.',
    items: [
      {
        title: 'School Store',
        featured: true,
        body: 'The online store for Fremont spirit wear and ASB purchases, run through MySchoolCentral.',
        href: links.schoolStore,
        cta: 'Open the School Store',
      },
      {
        title: 'ASB Community Resources',
        body: 'A list of local community resources for Firebirds and their families.',
        href: links.communityResources,
        cta: 'View community resources',
      },
      {
        title: 'Student Wellness',
        body: 'Where students can find support and wellness resources at Fremont.',
        href: links.studentWellness,
        cta: 'View wellness resources',
      },
    ],
  },
  {
    eyebrow: 'Money & approvals',
    title: 'Fundraisers, reimbursements, and fee help',
    blurb: 'For club officers, class cabinets, advisors, and families.',
    items: [
      {
        title: 'Fundraiser Approval',
        featured: true,
        body: 'The form clubs and cabinets use to get a fundraiser approved by ASB before it runs.',
        href: links.fundraiserApproval,
        cta: 'Request fundraiser approval',
      },
      {
        title: 'Reimbursements / Check Request',
        body: 'The request form for getting reimbursed or having ASB issue a check.',
        href: links.reimbursements,
        cta: 'Submit a check request',
      },
      {
        title: 'FUHSD Income Eligibility',
        body: 'The district’s income eligibility application for families.',
        href: links.incomeEligibility,
        cta: 'Go to FUHSD',
      },
    ],
  },
]

const isPlaceholder = (href) => !href || href === '#'

export default function Resources() {
  return (
    <>
      <PageHero
        title="Resources"
        subtext="The links ASB gets asked for. If a block says “link coming soon,” ASB Tech is still confirming the URL — email us and we’ll send it directly."
      />

      {GROUPS.map((group, i) => (
        <section key={group.eyebrow} className={`container-site section-space ${i > 0 ? 'border-t border-rule' : ''}`}>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
              <p className="eyebrow mb-2">{group.eyebrow}</p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{group.title}</h2>
              <div className="rule-accent-left" />
              <p className="mt-5 text-body leading-relaxed">{group.blurb}</p>
            </div>

            <div className="grid gap-5 lg:col-span-8 md:grid-cols-2">
              {group.items.map((item) => (
                <ResourceBlock key={item.title} {...item} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="border-t border-rule">
        <div className="container-site py-10 sm:py-12">
          <p className="text-sm text-body">
            The old Forms link was removed because it no longer worked.
            Questions about any of the above: <a href={`mailto:${school.email}`} className="link-brand">{school.email}</a>.
          </p>
        </div>
      </section>
    </>
  )
}

function ResourceBlock({ title, body, href, cta, featured }) {
  const placeholder = isPlaceholder(href)
  return (
    <article
      className={`flex flex-col border border-rule p-6 sm:p-7 ${featured ? 'md:col-span-2 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-10 bg-brand-tint/40' : ''}`}
    >
      <div>
        <h3 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h3>
        <div className="rule-accent-left" />
        <p className="mt-4 text-body leading-relaxed">{body}</p>
      </div>
      <div className={`mt-6 flex flex-wrap items-center gap-3 ${featured ? 'md:mt-0 md:flex-col md:items-start' : 'mt-auto pt-6'}`}>
        {placeholder ? (
          // No gray button for a link we don't have yet — just say so.
          <span className="inline-flex min-h-[44px] items-center font-display text-xs font-bold uppercase tracking-[0.14em] text-body">
            Link coming soon
          </span>
        ) : (
          <Button href={href} variant="primary" external>{cta}</Button>
        )}
      </div>
    </article>
  )
}
