import { useId, useRef } from 'react'
import { ExternalIcon } from './Button'
import { trackOutbound } from '../lib/analytics'

/**
 * Embed - responsive iframe wrapper for Google Docs / Slides / Forms / YouTube.
 * props: src, title, ratio ('16 / 9' default) or minHeight for tall forms,
 *        fallback - what VISITORS see if the URL is still a PLACEHOLDER (node or string),
 *        openHref + openLabel - an "open it in full" link placed BEFORE the frame,
 *        skipLabel - text of the skip link (default "Skip past the document").
 * In `npm run dev` a developer hint is shown instead so it's obvious what to fix.
 *
 * Keyboard: a Google Doc or Slides frame pulls focus into its own hidden text frame and never
 * gives it back, so Tab got stuck inside it for good (WCAG 2.1.2). The frame is therefore kept
 * out of the Tab order (tabIndex -1; mouse and touch still scroll and click it), keyboard users
 * get the open link first, and a "Skip past" link (shown when focused) jumps to just after it.
 */
export default function Embed({ src, title, ratio = '16 / 9', minHeight, fallback, className = '', openHref, openLabel, skipLabel = 'Skip past the document' }) {
  const placeholder = /PLACEHOLDER/.test(src)
  const afterRef = useRef(null)
  const afterId = `after-embed-${useId().replace(/:/g, '')}`
  const skip = (e) => {
    e.preventDefault()
    afterRef.current?.focus()
  }
  return (
    <div className={className}>
      {!placeholder && openHref && (
        <p className="mb-2">
          <a href={openHref} target="_blank" rel="noopener noreferrer" onClick={trackOutbound(openLabel || title, openHref)}
            className="link-brand inline-flex min-h-[44px] items-center gap-1.5 font-display text-sm font-bold">
            {openLabel}<ExternalIcon />
          </a>
        </p>
      )}
      <div className="relative w-full overflow-hidden rounded-lg border border-rule bg-[#F6F4F2]"
           style={minHeight ? { minHeight } : { aspectRatio: ratio }}>
        {/* Shown over the frame's top corner only while focused, so nothing shifts. */}
        {!placeholder && (
          <a href={`#${afterId}`} onClick={skip}
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-btn focus:bg-ink focus:px-4 focus:font-display focus:text-sm focus:font-bold focus:text-white">
            {skipLabel}
          </a>
        )}
        {placeholder ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            {import.meta.env.DEV ? (
              <>
                <p className="font-display font-bold text-ink">Embed not connected yet (dev only)</p>
                <p className="text-sm text-body max-w-xs">Paste the real embed URL in <code className="rounded bg-paper px-1.5 py-0.5 text-xs">src/data/sources.js</code>. Visitors will see the fallback text instead of this box.</p>
              </>
            ) : (
              <p className="text-sm text-body max-w-sm">{fallback ?? `${title} isn't posted yet. Check back soon.`}</p>
            )}
          </div>
        ) : (
          <iframe src={src} title={title} className="absolute inset-0 h-full w-full" loading="lazy" tabIndex={-1}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
        )}
      </div>
      {/* Where "Skip past" lands: the next Tab goes on to whatever follows the embed. */}
      <span id={afterId} ref={afterRef} tabIndex={-1} className="block outline-none" />
    </div>
  )
}
