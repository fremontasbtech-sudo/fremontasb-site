import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ES } from './data/es'

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
    const val = dict[key]
    if (val && val !== key) node.nodeValue = raw.replace(key, val)
  }
  root.querySelectorAll('[aria-label],[placeholder],[title],img[alt]').forEach((el) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a)
      if (!v) continue
      const val = dict[v.trim()]
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

/** Subtle EN/ES switch used in the navbar. */
export function LangToggle({ className = '' }) {
  const { lang, setLang } = useLang()
  const next = lang === 'es' ? 'en' : 'es'
  const label = lang === 'es' ? 'English' : 'Español'
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      lang={next}
      aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a español'}
      className={`inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold uppercase tracking-wide text-body/70 transition-colors hover:text-brand ${className}`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" />
        <path d="M2.5 10h15M10 2.5c2.5 2.4 2.5 12.6 0 15M10 2.5c-2.5 2.4-2.5 12.6 0 15" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  )
}
