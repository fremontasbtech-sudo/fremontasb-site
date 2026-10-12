// Shared robustness for the site's live-data hooks. Four guarantees, applied uniformly so
// no section flashes, disappears, or reorders on reload even when an upstream feed is flaky:
//   • TTL cache — seed the first paint from the last good response (instant AND stable), and
//     never seed from a snapshot older than ttlMs (so it can't flash something stale).
//   • Retry — a transient empty/failed upstream (YouTube RSS, Flickr, gviz sheets) is retried.
//   • No downgrade — the caller keeps a good render instead of reverting to an empty fallback.
//   • Revalidate — an open page keeps itself current (useRevalidate below), so a phone tab
//     restored from memory or a screen left on during a rally shows the sheet's latest numbers.
import { useEffect, useRef } from 'react'

export function makeCache(key, ttlMs) {
  return {
    read() {
      try {
        const obj = JSON.parse(localStorage.getItem(key) || 'null')
        if (!obj || obj.t == null) return null
        if (ttlMs && Date.now() - obj.t > ttlMs) return null
        return obj.d
      } catch { return null }
    },
    write(d) {
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })) } catch { /* private mode / full: ignore */ }
    },
  }
}

// True when Vercel's edge answered with its stale copy (it refreshes in the background, so a
// second request a few seconds later gets the new one). Readable on same-origin requests.
export const isStaleResponse = (r) => /^stale$/i.test((r && r.headers && r.headers.get('x-vercel-cache')) || '')

// Resolve with fresh JSON, retrying on network error, non-OK, or a caller-defined "empty"
// result. Rejects only after every attempt fails, so the caller keeps whatever it already has.
// onStale() runs when the answer was the edge's stale copy (see useRevalidate).
export function fetchJsonRetry(url, { attempts = 3, delayMs = 1500, isEmpty = () => false, onStale } = {}) {
  return new Promise((resolve, reject) => {
    let n = 0
    const go = () => {
      n += 1
      fetch(url)
        .then((r) => {
          if (!r.ok) return Promise.reject(new Error(`http ${r.status}`))
          if (onStale && isStaleResponse(r)) onStale()
          return r.json()
        })
        .then((data) => {
          if (!isEmpty(data)) return resolve(data)
          if (n < attempts) { setTimeout(go, delayMs); return }
          reject(new Error('empty'))
        })
        .catch((e) => {
          if (n < attempts) { setTimeout(go, delayMs); return }
          reject(e)
        })
    }
    go()
  })
}

// Today's date in Fremont (America/Los_Angeles) as YYYY-MM-DD, whatever the device's time zone.
export function ptIsoDate(d = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((x) => [x.type, x.value]))
    return `${p.year}-${p.month}-${p.day}`
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
}

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart']

/**
 * useRevalidate(refresh, options) - keeps an open page's live data current.
 * Runs refresh() on mount, then again:
 *   • when the tab becomes visible, the window gets focus, or the device comes back online,
 *     if the last fetch started over minGapMs ago;
 *   • every pollMs while the tab is visible, until there has been no pointer, key or scroll
 *     input for idleMs (a forgotten tab stops polling; any input resumes it). A rally screen
 *     opened with ?display=1 in the URL never stops;
 *   • once, staleRetryMs after an answer that was the edge's stale copy, to pick up the copy
 *     the edge refreshed in the background meanwhile.
 * onTick() runs every tickMs while visible (and on becoming visible) with no network, so a
 * caller can re-window its last data: the 3-week window and finished games roll over on a
 * page left open past midnight.
 * refresh({ onStale, alive }) should pass onStale to fetchJsonRetry (or call it when
 * isStaleResponse(r)), check alive() before setting state, and keep the no-downgrade rule:
 * never replace a non-empty list with an empty one. Polls reach the CDN, not Apps Script.
 */
export function useRevalidate(refresh, { minGapMs = 30000, pollMs = 120000, tickMs = 60000, idleMs = 30 * 60000, staleRetryMs = 8000, onTick } = {}) {
  const refreshRef = useRef(refresh)
  const tickRef = useRef(onTick)
  refreshRef.current = refresh
  tickRef.current = onTick

  useEffect(() => {
    let alive = true, busy = false, last = 0, lastInput = Date.now(), staleTimer = null
    let display = false
    try { display = new URLSearchParams(window.location.search).get('display') === '1' } catch { /* no URL */ }
    const visible = () => document.visibilityState !== 'hidden'
    const idle = () => !display && Date.now() - lastInput > idleMs
    const tick = () => { if (tickRef.current) tickRef.current() }

    const run = (reason) => {
      if (!alive || busy) return
      busy = true
      last = Date.now()
      // Only a normal fetch may schedule the stale retry, so it happens once, never in a loop.
      const onStale = reason === 'stale' ? undefined : () => {
        if (staleTimer || !alive) return
        staleTimer = setTimeout(() => { staleTimer = null; run('stale') }, staleRetryMs)
      }
      Promise.resolve()
        .then(() => refreshRef.current({ onStale, alive: () => alive, reason }))
        .catch(() => { /* the caller keeps its last good data */ })
        .finally(() => { busy = false })
    }
    const maybeRun = () => { if (visible() && Date.now() - last >= minGapMs) run('resume') }
    const onVisibility = () => { if (visible()) { tick(); maybeRun() } }
    const onInput = () => { const wasIdle = idle(); lastInput = Date.now(); if (wasIdle) maybeRun() }

    run('mount')
    const timer = setInterval(() => {
      if (!visible()) return
      tick()
      if (!idle() && Date.now() - last >= pollMs - 1000) run('poll')
    }, tickMs)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', maybeRun)
    window.addEventListener('online', maybeRun)
    for (const e of INPUT_EVENTS) window.addEventListener(e, onInput, { passive: true })
    return () => {
      alive = false
      clearInterval(timer)
      clearTimeout(staleTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', maybeRun)
      window.removeEventListener('online', maybeRun)
      for (const e of INPUT_EVENTS) window.removeEventListener(e, onInput)
    }
    // Options are read once; refresh and onTick are read through refs, so they can change freely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
