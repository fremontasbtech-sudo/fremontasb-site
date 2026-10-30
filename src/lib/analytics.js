// Google Analytics 4, loaded at runtime (not in index.html). On only in production builds with
// VITE_GA_MEASUREMENT_ID set (Vercel env var); otherwise every export here quietly does nothing.
// Privacy: events carry labels and URLs only, never names, emails or form values (README "Analytics").
const ID = import.meta.env.VITE_GA_MEASUREMENT_ID
export const analyticsOn = import.meta.env.PROD && !!ID && typeof window !== 'undefined'

let started = false
let lastPath = null

function init() {
  if (started) return
  started = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', ID, {
    send_page_view: false, // the router sends page_view itself (usePageViews in Layout.jsx)
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`
  document.head.appendChild(s)
}

export function trackEvent(name, params = {}) {
  if (!analyticsOn) return
  init()
  window.gtag('event', name, params)
}

// One page_view per path change. The lastPath check stops a repeat for the same path
// (StrictMode effect re-runs, or a language toggle that only changes the title).
export function trackPageView(path, title) {
  if (!analyticsOn || path === lastPath) return
  lastPath = path
  trackEvent('page_view', { page_path: path, page_title: title, page_location: window.location.origin + path })
}

// onClick for links that leave the site: <a onClick={trackOutbound('School Store', url)} ...>
// The query string is dropped (some form links carry access tokens).
export const trackOutbound = (label, url) => () =>
  trackEvent('outbound_click', { link_label: label, link_url: String(url).split(/[?#]/)[0] })
