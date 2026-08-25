import PageHero from '../components/PageHero'
import Button from '../components/Button'
import { links } from '../data/sources'

/**
 * School Store — intentionally simple. One job: send people to the external web store.
 * The store URL lives in src/data/sources.js (links.schoolStore). Nothing else to configure.
 */

// Names only — the store itself lists what's in stock.
const CATEGORIES = ['Spirit wear', 'Dance tickets', 'ASB card', 'Yearbook']

export default function SchoolStore() {
  return (
    <>
      <PageHero
        title="School Store"
        eyebrow="Online store"
        subtext="Spirit wear, dance tickets, ASB cards and yearbooks are sold through Fremont's online store. Purchases happen there, not on this site."
      >
        <Button href={links.schoolStore} external className="px-8 py-3.5 text-lg">Open the School Store</Button>
      </PageHero>

      <section className="section-space">
        <div className="container-site">
          <div className="mx-auto max-w-2xl border-y border-rule py-6 text-center">
            <p className="eyebrow">Sold in the store</p>
            {/* Stacked at phone width (no dangling separators); one line from sm up. */}
            <ul className="mt-3 flex flex-col items-center gap-y-1 font-display text-lg font-bold text-ink sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
              {CATEGORIES.map((c, i) => (
                <li key={c} className="flex items-center gap-x-3">
                  {i > 0 && <span className="hidden h-1.5 w-1.5 rounded-full bg-brand sm:block" aria-hidden="true" />}
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
