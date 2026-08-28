// Vercel serverless function: GET /api/youtube → { videos: [{ youtubeId, title, date }] }
// Pulls the newest uploads from the ASB channel's public RSS feed at request time.
// channelId is read from src/data/sources.js so there is one place to change it.
import { fetchChannelVideos } from './_feed.js'
import { youtubeFeed } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    const videos = await fetchChannelVideos(youtubeFeed.channelId)
    // Cache at the edge for 30 min, serve stale up to 1h while revalidating.
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    res.status(200).json({ videos })
  } catch (err) {
    // Never hard-fail: the page falls back to media.json when videos is empty.
    res.status(200).json({ videos: [], error: String(err && err.message || err) })
  }
}
