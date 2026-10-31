import { seasonOf } from './useEvents'

// Matching Flickr albums to games, shared by Home (Latest News) and Photos.

// True when an album title names this exact sport as a whole phrase, and not only inside a
// longer name: "Football" is not "Flag Football", and not the "Firebird Football" spirit event.
const OTHER_NAMES = ['firebird football', 'powder puff football', 'powderpuff football', 'flag football']
const phrase = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function namesSport(albumTitle, sport, sportNames = []) {
  const s = phrase(sport)
  let a = ` ${phrase(albumTitle)} `
  if (!s || !a.includes(` ${s} `)) return false
  for (const longer of [...sportNames.map(phrase), ...OTHER_NAMES]) {
    if (longer !== s && ` ${longer} `.includes(` ${s} `)) a = a.split(` ${longer} `).join(' | ')
  }
  return a.includes(` ${s} `)
}

// Short names in album titles, spelled out so they match the sport ("XC Senior Night").
const SPORT_SHORT = { xc: 'cross country', wp: 'water polo', bball: 'basketball', vball: 'volleyball', fh: 'field hockey' }
// True when an album names this sport's core ("Volleyball" for Girls Volleyball). If the album
// names a gender, it must be this sport's. A longer, different sport name ("Flag Football") in
// the album doesn't count as the shorter one ("Football").
export function namesCoreSport(albumTitle, sport, sportNames = []) {
  const gender = (x) => (/\b(girls?|womens?)\b/.test(x) ? 'g' : /\b(boys?|mens?)\b/.test(x) ? 'b' : '')
  const core = (x) => phrase(x).replace(/\b(girls?|boys?|womens?|mens?|varsity|jv)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const c = core(sport)
  let a = ` ${phrase(albumTitle).split(' ').map((w) => SPORT_SHORT[w] || w).join(' ')} `
  if (!c) return false
  for (const longer of [...sportNames, ...OTHER_NAMES]) {
    const lc = core(longer)
    if (lc !== c && ` ${lc} `.includes(` ${c} `)) a = a.split(` ${lc} `).join(' | ')
  }
  if (!a.includes(` ${c} `)) return false
  const ag = gender(a), sg = gender(phrase(sport))
  return !ag || !sg || ag === sg
}

// The date typed in an album's Flickr name ("Volleyball Senior Night - 10/19/26"), as YYYY-MM-DD.
export function typedAlbumDate(name) {
  const m = /(\d{1,2})\/(\d{1,2})(?:\/|\s*')(\d{2}|\d{4})\b/.exec(String(name || ''))
  if (!m) return ''
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
}

const dayMs = (iso) => new Date(`${iso}T12:00:00`).getTime()

/**
 * The senior night game a "Senior Night" album belongs to, or null. Senior night photos always
 * go with that game, however late they are uploaded or whatever date the camera stamped:
 *  - the album names the sport (short names count: "XC", "vball"), so it is that sport's senior
 *    night in the same season, the nearest one to the album's date;
 *  - it names no sport, so it is the only senior night within a day of the album's date.
 * album: { title, name, date }; games: finished/recent games with { sport, date, seniorNight }.
 */
export function seniorGameForAlbum(album, games = [], sportNames = []) {
  const title = `${album.title || ''} ${album.name || ''}`
  if (!/senior\s*night/i.test(title)) return null
  const ref = typedAlbumDate(album.name) || album.date
  if (!ref) return null
  const seniors = games.filter((g) => g && g.seniorNight && g.date)
  const season = seasonOf(new Date(`${ref}T12:00:00`))
  const near = (g) => Math.abs(dayMs(g.date) - dayMs(ref))
  const named = seniors.filter((g) => seasonOf(new Date(`${g.date}T12:00:00`)) === season && namesCoreSport(album.title || album.name, g.sport, sportNames))
  if (named.length) return named.sort((a, b) => near(a) - near(b))[0]
  const anyNamed = seniors.some((g) => namesCoreSport(album.title || album.name, g.sport, sportNames))
  if (anyNamed) return null
  // Part of a sport's name ("Hockey Senior Night" for Field Hockey) counts when exactly one
  // senior night this season has that word.
  const words = ` ${phrase(album.title || album.name)} `
  const GENERIC = new Set(['girls', 'girl', 'boys', 'boy', 'womens', 'mens', 'varsity', 'jv', 'senior', 'night'])
  const partial = seniors.filter((g) => seasonOf(new Date(`${g.date}T12:00:00`)) === season &&
    phrase(g.sport).split(' ').some((w) => w.length >= 4 && !GENERIC.has(w) && words.includes(` ${w} `)))
  if (new Set(partial.map((g) => g.sport)).size === 1) return partial[0]
  const close = seniors.filter((g) => near(g) <= 86400000)
  return new Set(close.map((g) => g.sport)).size === 1 ? close[0] : null
}
