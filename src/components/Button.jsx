import { Link } from 'react-router-dom'

/**
 * Button - the one button style on the site.
 * props: text | children, href (external) or to (internal route) or onClick,
 *        variant: 'primary' (default) | 'secondary' | 'inverse' (white on rust) | 'disabled', external (adds icon + new tab)
 */
export default function Button({ text, children, href, to, onClick, variant = 'primary', external, className = '', ...rest }) {
  const label = children ?? text
  const cls = `${variantClass[variant] ?? variantClass.primary} ${className}`
  const icon = external ? <ExternalIcon /> : null

  if (variant === 'disabled') {
    return <span className={cls} aria-disabled="true" {...rest}>{label}</span>
  }
  if (to) {
    return <Link to={to} className={cls} {...rest}>{label}</Link>
  }
  if (href) {
    const ext = external ?? /^https?:/.test(href)
    return (
      <a href={href} className={cls} target={ext ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined} {...rest}>
        {label}{ext && icon}
      </a>
    )
  }
  return <button type="button" onClick={onClick} className={cls} {...rest}>{label}</button>
}

const variantClass = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  disabled: 'btn-disabled',
  inverse: 'btn-inverse', // white button for use on rust/dark bands
}

export function ExternalIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M11 4h5v5M16 4l-7 7M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
