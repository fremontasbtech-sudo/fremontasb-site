import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchChannelVideos } from './api/_feed.js'
import { youtubeFeed } from './src/data/sources.js'

// Dev-only: serve the same /api/youtube endpoint the Vercel function serves in
// production, so the Media page auto-pulls live videos on localhost too.
function youtubeDevApi() {
  return {
    name: 'youtube-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/youtube', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const videos = await fetchChannelVideos(youtubeFeed.channelId)
          res.end(JSON.stringify({ videos }))
        } catch (err) {
          res.end(JSON.stringify({ videos: [], error: String(err && err.message || err) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), youtubeDevApi()],
})
