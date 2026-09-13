// Shared robustness for the site's live-data hooks. Three guarantees, applied uniformly so
// no section flashes, disappears, or reorders on reload even when an upstream feed is flaky:
//   • TTL cache — seed the first paint from the last good response (instant AND stable), and
//     never seed from a snapshot older than ttlMs (so it can't flash something stale).
//   • Retry — a transient empty/failed upstream (YouTube RSS, Flickr, gviz sheets) is retried.
//   • No downgrade — the caller keeps a good render instead of reverting to an empty fallback.

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

// Resolve with fresh JSON, retrying on network error, non-OK, or a caller-defined "empty"
// result. Rejects only after every attempt fails, so the caller keeps whatever it already has.
export function fetchJsonRetry(url, { attempts = 3, delayMs = 1500, isEmpty = () => false } = {}) {
  return new Promise((resolve, reject) => {
    let n = 0
    const go = () => {
      n += 1
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
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
