// Vercel serverless function: GET /api/flickr → { albums: [{ name, coverImageUrl, flickrUrl }] }
// Pulls all albums from the ASB Flickr at request time.
// The API key is read from the FLICKR_API_KEY env var (server-side only, never
// shipped to the browser). nsid comes from src/data/sources.js.
import { fetchAlbums } from './_flickr.js'
import { flickrFeed } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    const albums = await fetchAlbums(process.env.FLICKR_API_KEY, flickrFeed.nsid)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.status(200).json({ albums })
  } catch (err) {
    // Never hard-fail: the page falls back to photos.json when albums is empty.
    res.status(200).json({ albums: [], error: String(err && err.message || err) })
  }
}
