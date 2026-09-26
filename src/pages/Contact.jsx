import PageHero from '../components/PageHero'
import ContactForm from '../components/ContactForm'
import { school, links } from '../data/sources'

/**
 * Contact - the in-site contact form (saves to the "Contact" tab of the Events sheet via
 * /api/contact) + the same address/email the footer shows.
 */
export default function Contact() {
  return (
    <>
      <PageHero
        title="Contact ASB"
        subtext="Fremont ASB strives to improve your school environment. Please submit any feedback or questions you may have below."
      />

      <section className="container-site section-space">
        <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:gap-14">
          {/* Form first in source order so it comes first on mobile */}
          <div className="min-w-0">
            <ContactForm />
          </div>

          <aside>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
              <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                <p className="eyebrow mb-2">Email</p>
                <a
                  href={`mailto:${school.email}`}
                  className="link-brand inline-flex min-h-[44px] items-center font-display text-lg font-bold [overflow-wrap:anywhere]"
                >
                  {school.email}
                </a>
                <p className="mt-1 text-sm text-body">Email us for club questions, fundraiser approvals, or anything the form doesn’t cover.</p>
              </div>

              <div>
                <p className="eyebrow mb-2">Address</p>
                <address className="not-italic">
                  <a
                    href={school.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center font-display text-lg font-bold text-ink hover:text-brand"
                  >
                    Fremont High School
                  </a>
                  <p className="text-sm text-body">{school.address}</p>
                  <a
                    href={school.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-brand mt-1 inline-flex min-h-[44px] items-center text-sm"
                  >
                    Open in Google Maps
                  </a>
                </address>
              </div>

              <div>
                <p className="eyebrow mb-2">Instagram</p>
                <a
                  href={links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center font-display text-lg font-bold text-ink hover:text-brand"
                >
                  @firebirdfelipe
                </a>
                <p className="text-sm text-body">Follow us for the latest rally, dance, and spirit week updates.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
