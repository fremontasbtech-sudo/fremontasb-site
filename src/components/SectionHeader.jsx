/**
 * SectionHeader - section title + short rust underline.
 * props: title, eyebrow (small caps label above), align: 'left' (default) | 'center', action (node rendered on the right)
 */
export default function SectionHeader({ title, eyebrow, align = 'left', action, as: Tag = 'h2', className = '' }) {
  const centered = align === 'center'
  return (
    <div className={`mb-8 sm:mb-10 ${centered ? 'text-center' : 'flex flex-wrap items-end justify-between gap-4'} ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <Tag className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{title}</Tag>
        <div className={centered ? 'rule-accent' : 'rule-accent-left'} />
      </div>
      {action && !centered && <div className="shrink-0">{action}</div>}
    </div>
  )
}
