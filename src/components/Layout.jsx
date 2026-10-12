import { useEffect } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { useLang } from '../i18n'
import { ES } from '../data/es'

const SITE_URL = 'https://www.fremontasb.org'

// The SPA serves one index.html for every path, so the tab title, canonical URL and noindex
// (for the not-found page) are set here from the matched route's handle in src/App.jsx.
function useHeadTags(pathname) {
  const matches = useMatches()
  const { lang } = useLang()
  const handle = [...matches].reverse().find((m) => m.handle)?.handle || {}
  const { title, notFound } = handle
  useEffect(() => {
    const name = title && (lang === 'es' ? ES[title] || title : title)
    document.title = name ? `${name} | Fremont ASB` : 'Fremont ASB'
    let canon = document.head.querySelector('link[rel="canonical"]')
    let robots = document.head.querySelector('meta[name="robots"]')
    if (notFound) {
      if (canon) canon.remove()
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
      robots.content = 'noindex'
      return
    }
    if (robots) robots.remove()
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon) }
    canon.href = SITE_URL + (pathname.replace(/\/+$/, '').toLowerCase() || '/') // routes match case-insensitively
  }, [pathname, lang, title, notFound])
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  useHeadTags(pathname)
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-btn focus:bg-brand focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
