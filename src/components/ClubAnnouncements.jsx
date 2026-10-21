import { useEffect, useState } from 'react'
import Button from './Button'
import { loadClubAnnouncements } from '../data/clubAnnouncements'

/**
 * ClubAnnouncements - one rust card holding every active announcement from the sheet, each as
 * its own darker inner card (text left / button right on sm+, stacked with a full-width button
 * on phones). Renders nothing while loading, on any error, or when no row is active.
 */
export default function ClubAnnouncements({ sheetUrl }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    loadClubAnnouncements(sheetUrl).then((list) => { if (!cancelled) setItems(list) })
    return () => { cancelled = true }
  }, [sheetUrl])

  if (!items.length) return null

  return (
    <div className="container-site pt-section-sm">
      <section aria-label="Announcements" className="space-y-3 rounded-lg bg-brand p-3 text-white sm:space-y-4 sm:p-5">
        {items.map((a, i) => (
          <article
            key={`${a.title}-${i}`}
            className="rounded-lg border border-white/[0.08] bg-black/15 px-5 py-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-7"
          >
            {/* Sheet text, shown as plain text and left untranslated like the other live feeds. */}
            <div className={a.href ? 'max-w-2xl' : ''} translate="no">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">{a.title}</h2>
              <p className="mt-2 text-base leading-relaxed text-white/90">{a.description}</p>
            </div>
            {a.href && (
              // The global focus ring is rust, which disappears on this card, so flip it to white here.
              <Button
                href={a.href}
                variant="inverse"
                external
                className="mt-5 w-full shrink-0 sm:mt-0 sm:w-auto focus-visible:ring-paper focus-visible:ring-offset-brand"
              >
                {a.label}
              </Button>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
