/**
 * Embed — responsive iframe wrapper for Google Forms / Slides / YouTube.
 * props: src, title, ratio ('16 / 9' default) or minHeight for tall forms,
 *        fallback — what VISITORS see if the URL is still a PLACEHOLDER (node or string)
 * In `npm run dev` a developer hint is shown instead so it's obvious what to fix.
 */
export default function Embed({ src, title, ratio = '16 / 9', minHeight, fallback, className = '' }) {
  const placeholder = /PLACEHOLDER/.test(src)
  return (
    <div className={`relative w-full overflow-hidden rounded-lg border border-rule bg-[#F6F4F2] ${className}`}
         style={minHeight ? { minHeight } : { aspectRatio: ratio }}>
      {placeholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          {import.meta.env.DEV ? (
            <>
              <p className="font-display font-bold text-ink">Embed not connected yet (dev only)</p>
              <p className="text-sm text-body max-w-xs">Paste the real embed URL in <code className="rounded bg-paper px-1.5 py-0.5 text-xs">src/data/sources.js</code>. Visitors will see the fallback text instead of this box.</p>
            </>
          ) : (
            <p className="text-sm text-body max-w-sm">{fallback ?? `${title} isn't posted yet — check back soon.`}</p>
          )}
        </div>
      ) : (
        <iframe src={src} title={title} className="absolute inset-0 h-full w-full" loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      )}
    </div>
  )
}
