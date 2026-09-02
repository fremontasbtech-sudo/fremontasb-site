import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import logo from '../assets/fremont-tower.png'
import { LangToggle } from '../i18n'

// Primary links show in the bar; "More" holds seasonal + secondary pages.
// Homecoming Court and Elections are separate pages on separate schedules — never merge them.
const primary = [
  { to: '/', label: 'Home', end: true },
  { to: '/media', label: 'Media' },
  { to: '/photos', label: 'Photos' },
  { to: '/clubs', label: 'Clubs' },
  { to: '/resources', label: 'Resources' },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/contact', label: 'Contact' },
]
const more = [
  { to: '/homecoming-court', label: 'Homecoming Court' },
  { to: '/elections', label: 'Elections' },
  { to: '/download-app', label: 'Download the App' },
]

// Desktop link: rust text + 2px rust rule underneath when active; hover is color only.
const desktopLink = ({ isActive }) =>
  `relative inline-flex h-16 items-center px-3 font-display text-[15px] font-bold transition-colors
   after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand after:transition-opacity
   ${isActive ? 'text-brand after:opacity-100' : 'text-ink hover:text-brand after:opacity-0'}`

const mobileLink = ({ isActive }) =>
  `block rounded-btn px-3 py-3 font-display text-lg font-bold min-h-[44px] ${isActive ? 'text-brand bg-brand-tint' : 'text-ink'}`

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const { pathname } = useLocation()
  const moreActive = more.some((m) => pathname === m.to)

  // Close everything on navigation
  useEffect(() => { setOpen(false); setMoreOpen(false) }, [pathname])

  // Escape closes; clicking/tapping outside closes the "More" menu
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setMoreOpen(false) } }
    const onDown = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [])

  // Lock page scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <nav className="sticky top-0 z-40 border-b border-rule bg-paper" aria-label="Main">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex min-h-[44px] items-center gap-2.5 shrink-0" aria-label="Fremont ASB home">
          <img src={logo} alt="" className="h-9 w-auto" />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink leading-none">
            Fremont <span className="text-brand">ASB</span>
          </span>
        </Link>

        {/* Desktop */}
        <ul className="hidden lg:flex items-center">
          {primary.map((l) => (
            <li key={l.to}><NavLink to={l.to} end={l.end} className={desktopLink}>{l.label}</NavLink></li>
          ))}
          <li className="relative" ref={moreRef}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMoreOpen(false) }}>
            <button type="button" aria-haspopup="true" aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={`relative inline-flex h-16 items-center gap-1 px-3 font-display text-[15px] font-bold transition-colors
                after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand
                ${moreActive ? 'text-brand after:opacity-100' : 'text-ink hover:text-brand after:opacity-0'}`}>
              More <Chevron open={moreOpen} />
            </button>
            {moreOpen && (
              <ul className="absolute right-0 top-full w-56 pt-1">
                <li className="card-surface shadow-lg py-1.5">
                  {more.map((l) => (
                    <NavLink key={l.to} to={l.to}
                      className={({ isActive }) => `block px-4 py-2.5 font-display text-[15px] font-bold ${isActive ? 'text-brand' : 'text-ink hover:text-brand hover:bg-brand-tint'}`}>
                      {l.label}
                    </NavLink>
                  ))}
                </li>
              </ul>
            )}
          </li>
        </ul>

        <LangToggle className="ml-2 mr-1 lg:ml-3" />

        {/* Mobile toggle */}
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-btn text-ink hover:bg-brand-tint"
          aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu — fixed panel below the bar, scrolls on short screens */}
      {open && (
        <div id="mobile-menu" className="lg:hidden fixed inset-x-0 top-16 bottom-0 overflow-y-auto border-t border-rule bg-paper">
          <ul className="container-site py-3 grid gap-0.5">
            {primary.map((l) => (
              <li key={l.to}><NavLink to={l.to} end={l.end} className={mobileLink}>{l.label}</NavLink></li>
            ))}
            <li className="mt-3 mb-1 px-3 eyebrow">More</li>
            {more.map((l) => (
              <li key={l.to}><NavLink to={l.to} className={mobileLink}>{l.label}</NavLink></li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}

function Chevron({ open }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
