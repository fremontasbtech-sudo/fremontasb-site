import { useEffect, useState } from 'react'
import Button from './Button'
import { initialClubAnnouncements, loadClubAnnouncements } from '../data/clubAnnouncements'

import './ClubAnnouncements.css'

/**
 * ClubAnnouncements - an "Announcements" eyebrow over a pale rust tray holding one white card per
 * active announcement from the sheet (maroon accent bar on the left; text left / primary button
 * right on sm+, button stacked full width on phones). Paints at once from the cached or bundled
 * rows, then the sheet refreshes them; renders nothing when no row is active. Styles and tokens live in ClubAnnouncements.css.
 */
export default function ClubAnnouncements({ sheetUrl }) {
  const [items, setItems] = useState(initialClubAnnouncements)

  useEffect(() => {
    let cancelled = false
    loadClubAnnouncements(sheetUrl).then((list) => {
      if (!cancelled && list) setItems((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list))
    })
    return () => { cancelled = true }
  }, [sheetUrl])

  if (!items.length) return null

  return (
    <section aria-labelledby="club-announcements-label" className="ann container-site pt-10 sm:pt-12">
      <p id="club-announcements-label" className="eyebrow mb-3">Announcements</p>
      <ul className="ann-tray" role="list">
        {items.map((a, i) => (
          <li key={`${a.title}-${i}`} className="ann-card">
            {/* Sheet text, shown as plain text and left untranslated like the other live feeds. */}
            <div className="ann-text" translate="no">
              <h3 className="font-display text-lg font-bold leading-snug text-ink sm:text-xl">{a.title}</h3>
              <p className="mt-1.5 text-[0.9375rem] leading-normal text-body sm:text-base">{a.description}</p>
            </div>
            {a.href && (
              <Button href={a.href} variant="primary" external className="ann-btn">
                {a.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
