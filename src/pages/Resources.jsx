import PageHero from '../components/PageHero'
import Button from '../components/Button'
import { links, resourceLinks } from '../data/sources'
import { trackOutbound } from '../lib/analytics'
import PhoneText, { NoteText } from '../components/PhoneText'
import { useLang } from '../i18n'

// Six resources, two groups. Links live in src/data/sources.js, a '#' means
// ASB Tech hasn't confirmed the real URL yet, and the block says so instead of pretending.
// Descriptions stay to one neutral sentence: what the resource is for, nothing we can't confirm.
const GROUPS = [
  {
    eyebrow: 'For students',
    title: 'Spirit wear and game dates',
    blurb: 'The School Store is what students ask the ASB office about the most, and the athletics website has every team\u2019s games. Community and wellness resources are listed below.',
    items: [
      {
        title: 'School Store',
        featured: true,
        body: 'The online store for Fremont spirit wear and ASB purchases, run through MySchoolCentral.',
        href: links.schoolStore,
        cta: 'Open the School Store',
      },
      {
        title: 'Athletics',
        featured: true,
        body: 'Game schedules, scores, and team pages for every Fremont sport, on the athletics department\u2019s website.',
        href: links.athletics,
        cta: 'Open Fremont Athletics',
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
      <PageHero title="Resources" />

      {GROUPS.map((group, i) => (
        <section key={group.eyebrow} className={`container-site section-space ${i > 0 ? 'border-t border-rule' : ''}`}>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
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

      <LinkListSection
        eyebrow="Support"
        title="Community Resources"
        blurb="These are local and national support resources for Firebirds and their families. If you or someone you know is in crisis, please reach out. These lines are free and confidential."
        groups={resourceLinks.community}
        top={<CrisisLine />}
      />

      <LinkListSection
        eyebrow="At Fremont"
        title="Student Wellness"
        blurb="Fremont has wellness support on campus. You can talk to a therapist, get a referral, or reach out to the wellness staff."
        groups={resourceLinks.wellness}
      />
    </>
  )
}

// The first thing in Community Resources: the two crisis lines as tap-to-call and tap-to-text
// buttons, so a student on a phone reaches a person in one tap. sms:741741?&body=HOME fills in
// "HOME" on both iPhone and Android. In Spanish the buttons send AYUDA instead, which both
// services route to Spanish-speaking counselors (988lifeline.org "What to Expect";
// crisistextline.org, 2021-10-15), and calling 988 then pressing 2 reaches Spanish help.
// The Spanish copy is rendered here (not through es.js) because the links themselves change.
function CrisisLine() {
  const { lang } = useLang()
  const es = lang === 'es'
  const btn = 'btn-primary whitespace-nowrap'
  const lines = es
    ? [
        { href: 'tel:988', label: 'Llamar al 988' },
        { href: 'sms:988?&body=AYUDA', label: 'Enviar AYUDA al 988' },
        { href: 'sms:741741?&body=AYUDA', label: 'Enviar AYUDA al 741741' },
      ]
    : [
        { href: 'tel:988', label: 'Call 988' },
        { href: 'sms:988', label: 'Text 988' },
        { href: 'sms:741741?&body=HOME', label: 'Text HOME to 741741' },
      ]
  return (
    <div className="border-l-4 border-brand bg-brand-tint/40 px-5 py-5 sm:col-span-2" role="region" aria-labelledby="crisis-line-title">
      <h3 id="crisis-line-title" className="font-display text-lg font-extrabold tracking-tight text-ink">If you need help right now</h3>
      {es ? (
        <p className="mt-1 text-sm leading-relaxed text-body" translate="no">
          Puedes llamar al 988 y marcar 2 para hablar en español, o enviar AYUDA por mensaje de texto al 988 o al 741741. Ambas líneas son gratuitas, confidenciales y atienden las 24 horas del día.
        </p>
      ) : (
        <p className="mt-1 text-sm leading-relaxed text-body">
          You can call or text 988, or text HOME to 741741. Both are free, confidential, and open 24 hours a day.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3" translate={es ? 'no' : undefined}>
        {lines.map((l) => (
          <a key={l.href} href={l.href} className={btn} onClick={trackOutbound(l.label, l.href)}>{l.label}</a>
        ))}
      </div>
    </div>
  )
}

function LinkListSection({ eyebrow, title, blurb, groups, top = null }) {
  return (
    <section className="container-site section-space border-t border-rule">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{title}</h2>
          <div className="rule-accent-left" />
          <p className="mt-5 text-body leading-relaxed">{blurb}</p>
        </div>
        <div className="grid gap-x-10 gap-y-6 lg:col-span-8 sm:grid-cols-2">
          {top}
          {groups.map((g) => (
            <div key={g.name}>
              <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">{g.name}</h3>
              {g.note && <p className="mt-1 text-sm leading-relaxed text-body"><NoteText text={g.note} /></p>}
              <ul className="mt-1">
                {g.links.map((l) => (
                  <li key={l.href}>
                    {/^(tel|sms):/.test(l.href) ? (
                      <a href={l.href} onClick={trackOutbound(l.label, l.href)}
                        className="link-brand inline-flex min-h-[44px] min-w-[44px] items-center font-display text-sm font-bold">
                        <PhoneText text={l.label} link={false} />
                      </a>
                    ) : (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" onClick={trackOutbound(l.label, l.href)}
                        className="link-brand inline-flex min-h-[44px] min-w-[44px] items-center font-display text-sm font-bold">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
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
          // No gray button for a link we don't have yet, just say so.
          <span className="inline-flex min-h-[44px] items-center font-display text-xs font-bold uppercase tracking-[0.14em] text-body">
            Link coming soon
          </span>
        ) : (
          <Button href={href} variant="primary" external onClick={trackOutbound(title, href)}>{cta}</Button>
        )}
      </div>
    </article>
  )
}
