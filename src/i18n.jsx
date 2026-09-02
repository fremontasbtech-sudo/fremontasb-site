import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { ES } from './data/es'

// Match text regardless of straight vs. curly apostrophes/quotes and whitespace runs,
// so a dictionary key and the page text resolve even when their punctuation differs.
const norm = (t) => t
  .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, String.fromCharCode(39))
  .replace(/[\u201C\u201D\u201E\u2033]/g, String.fromCharCode(34))
  .replace(/\s+/g, ' ')
  .trim()
const NORM = Object.create(null)
for (const k in ES) NORM[norm(k)] = ES[k]
const lookup = (key) => ES[key] || NORM[norm(key)]

/**
 * Lightweight site-wide translation. One curated dictionary (src/data/es.js) maps the
 * site's static English UI to Spanish. When Spanish is on, we translate the visible text
 * nodes (exact trimmed match) plus a few attributes, and re-apply on React re-renders via
 * a MutationObserver. Dynamic feed content (video titles, album names, announcements,
 * club names, people, dates) has no dictionary entry, so it stays in its source language.
 * Switching back to English reloads the page (simplest reliable restore). Choice persists
 * in localStorage. The switch itself lives in the navbar (subtle).
 */
const LangCtx = createContext({ lang: 'en', setLang: () => {} })
export const useLang = () => useContext(LangCtx)

const STORE = 'fhs-lang'
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt']

function readStored() {
  try { return localStorage.getItem(STORE) === 'es' ? 'es' : 'en' } catch { return 'en' }
}

function translateTree(root, dict) {
  if (!root || root.querySelectorAll === undefined) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)
  for (const node of nodes) {
    const raw = node.nodeValue
    if (!raw) continue
    const key = raw.trim()
    if (!key) continue
    const val = lookup(key)
    if (val && val !== key) node.nodeValue = raw.replace(key, val)
  }
  root.querySelectorAll('[aria-label],[placeholder],[title],img[alt]').forEach((el) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a)
      if (!v) continue
      const val = lookup(v.trim())
      if (val && val !== v.trim()) el.setAttribute(a, val)
    }
  })
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStored)

  useEffect(() => {
    document.documentElement.lang = lang
    if (lang !== 'es') return
    let scheduled = false
    const run = () => { scheduled = false; translateTree(document.body, ES) }
    run()
    const obs = new MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(run)
    })
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [lang])

  const setLang = useCallback((next) => {
    try { localStorage.setItem(STORE, next) } catch (e) { /* private mode */ }
    if (next === 'en') { window.location.reload(); return }
    setLangState('es')
  }, [])

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

/** Subtle language dropdown used in the navbar: shows the current language, lists both. */
export function LangToggle({ className = '' }) {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [])
  const current = lang === 'es' ? 'Español' : 'English'
  const options = [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }]
  const choose = (code) => { setOpen(false); if (code !== lang) setLang(code) }
  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        aria-label="Language / Idioma"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-body/70 transition-colors hover:text-brand">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M2.5 10h15M10 2.5c2.5 2.4 2.5 12.6 0 15M10 2.5c-2.5 2.4-2.5 12.6 0 15" strokeLinecap="round" />
        </svg>
        {current}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-50 mt-1 w-40 card-surface py-1.5 shadow-lg">
          {options.map((o) => (
            <li key={o.code}>
              <button type="button" onClick={() => choose(o.code)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left font-display text-[15px] font-bold ${o.code === lang ? 'text-brand' : 'text-ink hover:bg-brand-tint hover:text-brand'}`}>
                {o.label}
                {o.code === lang && (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
