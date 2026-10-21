import { toCsvUrl, parseCsv } from './useSheetData'
import { ptIsoDate } from './liveData'

/**
 * Clubs page announcement cards, read from the "Announcements" tab of the Official Clubs List.
 * One row per card. Columns are read by header name (extra columns are ignored):
 *   title | description | button_label | button_url | show_from | hide_after | priority
 * A row shows from show_from through hide_after (inclusive, Pacific time). Rows missing a
 * title, description or a valid date are skipped. Any failure resolves to [] (no cards).
 */

// One request per page load, shared by every mount of the component.
let pending = null
export function loadClubAnnouncements(sheetUrl) {
  if (!sheetUrl) return Promise.resolve([])
  if (!pending) {
    pending = fetch(toCsvUrl(sheetUrl))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`Sheet returned ${r.status}`))))
      .then((text) => activeAnnouncements(parseCsv(text)))
      .catch(() => [])
  }
  return pending
}

export function activeAnnouncements(rows, today = ptIsoDate()) {
  return rows
    .map(toAnnouncement)
    .filter((a) => a && a.showFrom <= today && today <= a.hideAfter)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return b.showFrom.localeCompare(a.showFrom) // tie: newest show_from first
    })
}

function toAnnouncement(row) {
  const title = clean(row.title)
  const description = clean(row.description)
  const showFrom = toIsoDate(row.showFrom)
  const hideAfter = toIsoDate(row.hideAfter)
  if (!title || !description || !showFrom || !hideAfter) return null

  // Button only for an https link. A label with no link shows nothing; a link with no label says "Learn More".
  const url = clean(row.buttonUrl)
  const href = /^https:\/\/\S+$/i.test(url) ? url : ''
  const label = href ? clean(row.buttonLabel) || 'Learn More' : ''

  const p = clean(row.priority)
  const priority = p !== '' && Number.isFinite(Number(p)) ? Number(p) : Infinity // blank sorts last

  return { title, description, href, label, showFrom, hideAfter, priority }
}

const clean = (v) => String(v ?? '').trim()

// YYYY-MM-DD, or M/D/YYYY in case Sheets reformats a typed date. Rejects impossible dates like 2026-02-30.
function toIsoDate(v) {
  const s = clean(v)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const [y, mo, d] = m ? [m[1], m[2], m[3]] : (m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)) ? [m[3], m[1], m[2]] : []
  if (!y) return ''
  const date = new Date(Date.UTC(+y, +mo - 1, +d))
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +mo - 1 || date.getUTCDate() !== +d) return ''
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
