// Display helpers for Flickr album names. The Flickr albums keep their own names;
// we only clean them for the website. The album's real date is shown separately
// (date rail in Latest News, a month label on the Photos page), so we strip the
// scattered date bits people bake into album titles and show a consistent date.

export function cleanAlbumTitle(name) {
  let s = String(name || '').trim()
  // slashed dates anywhere (bounded): 9/19, 10/25, 5/11/24, 8/26
  s = s.replace(/(^|[\s(–\u2014-])\d{1,2}\/\d{1,2}(\/\d{2,4})?(?=$|[\s)(,–\u2014-])/g, '$1')
  // "Mon." / "Month" + year: "Aug. 2026", "August 2026"
  s = s.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}\b/ig, ' ')
  // leading bare year: "2025 Winter Rally"
  s = s.replace(/^(19|20)\d{2}\s+/, '')
  // trailing bare year, but keep "Class of YYYY" and hyphen ranges (2023-2024)
  s = s.replace(/([A-Za-z)])\s+(19|20)\d{2}\s*$/, (m, pre, y, off, str) =>
    /\bof$/i.test(str.slice(0, off + 1).trim()) ? m : pre)
  // tidy leftover spaces / empty parens / stray separators
  s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\(\)/g, '')
       .replace(/\s{2,}/g, ' ').replace(/\s+([),.])/g, '$1')
       .replace(/[\s–\u2014:-]+$/, '').replace(/^[\s–\u2014:-]+/, '').trim()
  return s || String(name || '').trim()
}

/** "2026-05-20" → "May 2026". Blank/invalid → ''. */
export function formatAlbumMonth(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  if (!m) return ''
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
