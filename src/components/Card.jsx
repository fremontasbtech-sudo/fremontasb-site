import { ExternalIcon } from './Button'

/**
 * Card — image + title + optional caption. Wraps itself in a link if href/to is given.
 * props: image (url), alt, title, caption, href (external), children (extra body), ratio ('16/9' default), imageFit
 */
export default function Card({ image, alt = '', title, caption, href, children, ratio = '16 / 9', className = '', placeholder }) {
  const body = (
    <>
      {(image || placeholder) && (
        <div className="overflow-hidden bg-rule" style={{ aspectRatio: ratio }}>
          {image ? (
            <img src={image} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-tint text-brand">{placeholder}</div>
          )}
        </div>
      )}
      <div className="p-4 sm:p-5">
        {title && (
          <h3 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-brand transition-colors flex items-start gap-2">
            <span>{title}</span>
            {href && <ExternalIcon className="mt-1 h-4 w-4 shrink-0 text-brand/70" />}
          </h3>
        )}
        {caption && <p className="mt-1 text-sm text-body">{caption}</p>}
        {children}
      </div>
    </>
  )
  const cls = `group card-surface overflow-hidden block ${className}`
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
    )
  }
  return <div className={cls}>{body}</div>
}
