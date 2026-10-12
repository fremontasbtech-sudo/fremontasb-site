// Shared upstream-fetch timeout for the /api helpers. A slow Google, Flickr or YouTube response
// must not hold a revalidation open until Vercel kills the function (which leaves the stale copy
// in place longer). The callback gets the abort signal and should read the body inside it, so the
// timer covers the whole download, not just the headers:
//   const text = await withTimeout(10000, async (signal) => (await fetch(url, { signal })).text())
export async function withTimeout(ms, fn) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fn(ctrl.signal) } finally { clearTimeout(timer) }
}
