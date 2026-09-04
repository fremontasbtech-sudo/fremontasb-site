/**
 * PageHero - top of every inner page: bold centered title, rust underline, optional italic subtext.
 * props: title, subtext, children (e.g. buttons rendered under the subtext), eyebrow
 */
export default function PageHero({ title, subtext, eyebrow, children, narrow = true }) {
  return (
    <header className="border-b border-rule bg-paper">
      <div className={`container-site py-12 sm:py-16 text-center ${narrow ? 'max-w-3xl' : ''}`}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        <div className="rule-accent" />
        {subtext && <p className="subtext mt-5 mx-auto max-w-2xl">{subtext}</p>}
        {children && <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </header>
  )
}
