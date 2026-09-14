import { useEffect, useState } from 'react'
import { makeCache, fetchJsonRetry } from './liveData'
import { homecomingNominationsApi } from './sources'

/**
 * useNominationConfig()
 *
 * One sheet-controlled toggle drives BOTH the page and the backend. The Apps Script
 * Web App (bound to the nominations Sheet) reads its own "Config" tab and answers a GET
 * with { open, mode, cycle, deadline }; the same cells decide which tab a POST is written
 * to (Test Submissions vs Nominations). So flipping the form on/off, or Test -> live, is a
 * single cell edit in the Sheet: no site redeploy, no Apps Script redeploy.
 *
 * Robustness (same contract as the rest of the site): the last good status is cached in
 * localStorage (short TTL, since it can change mid-window) so a flaky request never hides
 * the form for a returning visitor, and a transient failure is retried before giving up.
 *
 * If homecomingNominationsApi is null (not deployed yet), this is inert and the form
 * never renders — the page falls through to the court display / off state.
 */
const cache = makeCache('fasb.hcnominations.v1', 5 * 60 * 1000) // 5 min

const truthy = (v) => v === true || ['yes', 'true', 'y', '1', 'open'].includes(String(v).trim().toLowerCase())

export function useNominationConfig() {
  const [state, setState] = useState(() => {
    if (!homecomingNominationsApi) return { config: null, loading: false }
    const cached = cache.read()
    return cached ? { config: cached, loading: false } : { config: null, loading: true }
  })

  useEffect(() => {
    if (!homecomingNominationsApi) return
    let cancelled = false
    fetchJsonRetry(homecomingNominationsApi, {
      attempts: 3,
      delayMs: 1500,
      isEmpty: (d) => !d || typeof d.open === 'undefined',
    })
      .then((d) => {
        if (cancelled) return
        const config = {
          open: truthy(d.open),
          mode: String(d.mode || 'test').trim().toLowerCase() === 'live' ? 'live' : 'test',
          cycle: (d.cycle || '').toString().trim(),
          deadline: (d.deadline || '').toString().trim(),
        }
        cache.write(config)
        setState({ config, loading: false })
      })
      // Never hard-fail the page: keep a cached status if we have one, else treat as "not open".
      .catch(() => { if (!cancelled) setState((s) => ({ config: s.config, loading: false })) })
    return () => { cancelled = true }
  }, [])

  return state
}
