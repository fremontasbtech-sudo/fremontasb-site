import { useEffect, useState } from 'react'
import Button from './Button'
import { loadClubAnnouncements } from '../data/clubAnnouncements'

/**
 * ClubAnnouncements - one rust card holding every active announcement from the sheet, each as
 * its own faint inner card (text left / button right on sm+, stacked with a full-width button
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

  // Concentric corners: outer radius 20px minus the 12px outer padding = 8px inner radius.
  // Text sits in a 65ch column with the button right after it, so the two read as one unit.
  return (
    <div className="container-site pt-section-sm">
      <section aria-label="Announcements" className="space-y-3 rounded-[20px] bg-brand p-3 text-white">
        {items.map((a, i) => (
          <article
            key={`${a.title}-${i}`}
            className="rounded-lg border border-white/10 bg-white/[0.06] p-5 sm:grid sm:grid-cols-[minmax(0,65ch)_auto] sm:items-center sm:justify-start sm:gap-8 sm:px-6"
          >
            {/* Sheet text, shown as plain text and left untranslated like the other live feeds. */}
            <div translate="no">
              <h2 className="font-display text-xl font-bold leading-snug text-white sm:text-[1.375rem]">{a.title}</h2>
              <p className="mt-1.5 max-w-[65ch] text-[0.9375rem] leading-normal text-white/[0.88] sm:text-base">{a.description}</p>
            </div>
            {a.href && (
              // The global focus ring is rust, which disappears on this card, so flip it to white here.
              <Button
                href={a.href}
                variant="inverse"
                external
                className="mt-4 w-full px-4 py-2 text-[0.9375rem] transition-[background-color,transform] hover:-translate-y-px motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-brand sm:mt-0 sm:w-auto"
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
