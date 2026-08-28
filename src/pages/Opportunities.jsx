import { useEffect, useState } from 'react'
import PageHero from '../components/PageHero'
import Embed from '../components/Embed'
import Button from '../components/Button'
import { DevNote } from '../components/DataState'
import { embeds, links } from '../data/sources'

/**
 * Opportunities — a Google Slides deck the college & career counselors keep updated.
 * Swapping the deck = change `embeds.opportunitiesSlides` in src/data/sources.js.
 * Set `links.opportunitiesDeck` (the normal share link) to show the "Open in Google Slides" button.
 */
export default function Opportunities() {
  // Slides is unusable at 16:9 on a phone — give it a squarer box below md.
  const wide = useMinWidth(768)

  return (
    <>
      <PageHero
        title="Opportunities"
        eyebrow="Internships, programs, and scholarships"
        subtext="Postings shared by the college and career counselors. New ones are added to the document below."
      />

      <section className="container-site section-space">
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:gap-12">
          <div className="min-w-0">
            <Embed
              src={embeds.opportunitiesSlides}
              title="Opportunities document"
              ratio={wide ? '16 / 9' : '4 / 3'}
              fallback="The opportunities deck isn't posted yet — check with the College & Career Center."
            />
          </div>

          <aside>
            <p className="eyebrow mb-2">About these postings</p>
            <div className="rule-accent-left mb-4" />
            <p className="text-sm leading-relaxed text-body">
              The college and career counselors share these postings. The document updates whenever they
              add to it. For questions about a specific posting, ask the College &amp; Career Center.
            </p>
            {links.opportunitiesDeck ? (
              <div className="mt-6">
                <Button href={links.opportunitiesDeck} variant="primary" external>
                  Open the document in Google Docs
                </Button>
              </div>
            ) : (
              <DevNote>Set links.opportunitiesDeck in sources.js to show the &ldquo;Open the deck&rdquo; button.</DevNote>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}

/* Tiny local media-query hook. Candidate for src/data or components if another page needs it. */
function useMinWidth(px) {
  const query = `(min-width: ${px}px)`
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : true))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
