// Shared server-side helper: fetch all albums (photosets) for a Flickr account
// via the Flickr REST API. Used by api/flickr.js (Vercel) and the dev
// middleware in vite.config.js. Needs a Flickr API key (server-side only).
// primary_photo_extras asks Flickr for ready-made cover image URLs so we don't
// have to construct them by hand.

export async function fetchAlbums(apiKey, userId) {
  if (!apiKey) throw new Error('no FLICKR_API_KEY set')
  if (!userId) throw new Error('no flickr nsid')
  const params = new URLSearchParams({
    method: 'flickr.photosets.getList',
    api_key: apiKey,
    user_id: userId,
    primary_photo_extras: 'url_z,url_c,url_m',
    format: 'json',
    nojsoncallback: '1',
  })
  const res = await fetch(`https://api.flickr.com/services/rest/?${params.toString()}`)
  if (!res.ok) throw new Error(`flickr ${res.status}`)
  const data = await res.json()
  if (data.stat !== 'ok') throw new Error(data.message || 'flickr error')

  const sets = (data.photosets && data.photosets.photoset) || []
  return sets.map((s) => {
    const ex = s.primary_photo_extras || {}
    const cover =
      ex.url_z || ex.url_c || ex.url_m ||
      (ex.server ? `https://live.staticflickr.com/${ex.server}/${s.primary}_${ex.secret}_z.jpg` : '')
    return {
      name: (s.title && s.title._content) || 'Untitled album',
      coverImageUrl: cover,
      flickrUrl: `https://www.flickr.com/photos/${userId}/albums/${s.id}`,
      count: Number(s.photos || 0),
    }
  })
}
