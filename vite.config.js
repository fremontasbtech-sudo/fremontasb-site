import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchChannelVideos } from './api/_feed.js'
import { fetchAlbums } from './api/_flickr.js'
import { youtubeFeed, flickrFeed } from './src/data/sources.js'

// Dev-only: serve the same /api/* endpoints the Vercel functions serve in
// production, so the Media and Photos pages auto-pull live data on localhost too.
function devApi(flickrKey) {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/youtube', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          res.end(JSON.stringify({ videos: await fetchChannelVideos(youtubeFeed.channelId) }))
        } catch (err) {
          res.end(JSON.stringify({ videos: [], error: String(err && err.message || err) }))
        }
      })
      server.middlewares.use('/api/flickr', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          res.end(JSON.stringify({ albums: await fetchAlbums(flickrKey, flickrFeed.nsid) }))
        } catch (err) {
          res.end(JSON.stringify({ albums: [], error: String(err && err.message || err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv reads .env (incl. FLICKR_API_KEY) for the dev server. Not exposed to the client.
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), devApi(env.FLICKR_API_KEY)] }
})
