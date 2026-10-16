// Vercel serverless function: GET /api/youtube → { videos: [{ youtubeId, title, date }] }
// Pulls the newest uploads from the ASB channel's public RSS feed at request time.
// channelId is read from src/data/sources.js so there is one place to change it.
import { fetchChannelVideos } from './_feed.js'
import { youtubeFeed } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    const videos = await fetchChannelVideos(youtubeFeed.channelId)
    if (videos.length) {
      // Cache a good result at the edge for 2 min, then serve the stale copy for up to 10 min
      // while it refreshes in the background, so a new upload shows within a few minutes.
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    } else {
      // Do NOT cache an empty feed: a transient RSS hiccup must not pin every viewer to the
      // older media.json fallback for 30 min. Let the next request re-hit the RSS.
      res.setHeader('Cache-Control', 'no-store')
    }
    res.status(200).json({ videos, titleSource: videos.titleSource || 'heuristic', titleFallbacks: videos.titleFallbacks || 0, titleError: videos.titleError || '' })
  } catch (err) {
    // Never hard-fail: the page falls back to media.json when videos is empty.
    res.status(200).json({ videos: [], error: String(err && err.message || err) })
  }
}
