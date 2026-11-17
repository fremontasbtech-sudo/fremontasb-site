/**
 * Phone numbers on the site: every number becomes a tap-to-call tel: link that never breaks
 * across lines. Use <PhoneText text="..."/> for any copy that may contain a US number like
 * "(408) 522-2487", "408-522-2487" or "408.522.2487"; the rest of the text is left as it is.
 * The link's tap area is 44 px tall (an invisible ::after) without changing the line height.
 */
const PHONE = /(\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b)/g

export const telHref = (number) => {
  const digits = String(number).replace(/\D/g, '')
  return `tel:${digits.length === 10 ? `+1${digits}` : digits}`
}

export const phoneLinkCls =
  "link-brand relative whitespace-nowrap font-semibold after:absolute after:-inset-x-1 after:-inset-y-[14px] after:content-['']"

// link={false} keeps the number on one line without a link, for text already inside a link.
export default function PhoneText({ text, link = true }) {
  const parts = String(text || '').split(PHONE)
  if (parts.length === 1) return text
  return parts.map((p, i) => (i % 2 === 1
    ? (link ? <a key={i} href={telHref(p)} className={phoneLinkCls}>{p}</a> : <span key={i} className="whitespace-nowrap">{p}</span>)
    : p))
}

/** "Name · (408) 522-2487 · Room" as separate text nodes, so the Spanish switch (which translates
 *  whole text nodes) can translate each part it knows, with the number as a tel: link. */
export function NoteText({ text }) {
  const parts = String(text || '').split(' · ')
  return parts.map((p, i) => (
    <span key={i}>{i > 0 && ' · '}<span><PhoneText text={p} /></span></span>
  ))
}
