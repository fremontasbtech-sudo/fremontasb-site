import { useId } from 'react'
import Button from './Button'

/**
 * AnnouncementBanner - a rust band for a time-limited call to action (applications, sign-ups).
 * props: heading, body, buttonLabel, href (external links open in a new tab), className
 * Text left / button right on sm+, stacked with a full-width button on phones.
 */
export default function AnnouncementBanner({ heading, body, buttonLabel, href, className = '' }) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-lg bg-brand px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:py-7 ${className}`}
    >
      <div className="max-w-2xl">
        <h2 id={headingId} className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          {heading}
        </h2>
        {body && <p className="mt-2 text-base leading-relaxed text-white/90">{body}</p>}
      </div>
      {buttonLabel && href && (
        // The global focus ring is rust, which disappears on this band, so flip it to white here.
        <Button
          href={href}
          variant="inverse"
          external
          className="mt-5 w-full shrink-0 sm:mt-0 sm:w-auto focus-visible:ring-paper focus-visible:ring-offset-brand"
        >
          {buttonLabel}
        </Button>
      )}
    </section>
  )
}
