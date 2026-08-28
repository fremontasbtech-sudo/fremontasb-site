// Shared server-side helper: fetch a YouTube channel's public RSS feed (no API
// key, no secrets) and return the newest uploads as plain objects.
// Used by both api/youtube.js (Vercel serverless function, in production) and
// the dev middleware in vite.config.js (so `npm run dev` on localhost works too).
// YouTube's RSS feed returns roughly the 15 most recent uploads.

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim()
}

export async function fetchChannelVideos(channelId) {
  if (!channelId) throw new Error('no channelId')
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FremontASB-site/1.0)' },
  })
  if (!res.ok) throw new Error(`feed ${res.status}`)
  const xml = await res.text()

  const videos = []
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1]
    if (!id) continue
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || ''
    videos.push({ youtubeId: id, title: decodeEntities(title), date: published.slice(0, 10) })
  }
  return videos
}
