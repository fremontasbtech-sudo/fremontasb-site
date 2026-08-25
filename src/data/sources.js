// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SOURCES — the one file a non-technical ASB member edits.
//
// Every URL that points at a Google Sheet / Form / Slides deck / Flickr /
// YouTube lives here. Change the link, save, redeploy. No other code changes.
//
// GOOGLE SHEETS:
//   1. Open the sheet → Share → "Anyone with the link" (Viewer).
//   2. Paste the normal sheet URL below. We convert it to a CSV feed automatically.
//   Leave a sheet as `null` to fall back to the local sample file in /src/data.
// ─────────────────────────────────────────────────────────────────────────────

export const sheets = {
  // Home → Spirit Points Tracker.  Columns: grade | points
  spiritPoints: null,

  // Home → Latest News.  Columns: title | date | blurb   (newest rows first or last — we sort by date)
  news: null,

  // Clubs → Club List.  Existing "Official Clubs List" sheet (first tab).
  // Columns: name | purpose | studentAdvisors | teacherAdvisor | meetingInfo | email | other
  clubs: 'https://docs.google.com/spreadsheets/d/1Px1BMs1w8M115022aC4y_8O-21iRwugQdhxU4OW3eAk/edit',

  // Homecoming Court.  Columns: name | photoUrl | bio | active | cycle
  //   The page shows while ANY row has active = TRUE (blank counts as TRUE). Set every row to FALSE after voting.
  //   cycle = e.g. "Homecoming 2026" (read from the first row that has one).
  homecomingCourt: null,

  // Elections.  Columns: section | name | photoUrl | bio | active
  //   section must be one of: ASB Cabinet, Freshman Cabinet, Sophomore Cabinet, Junior Cabinet, Senior Cabinet
  //   active blank/TRUE = shown, FALSE = archived. To archive a whole section, set its rows to FALSE.
  elections: null,
}

export const links = {
  clubAccountabilityTracker:
    'https://docs.google.com/spreadsheets/d/1R4lCQLhORgiMtezlPA63ERTk_266YjHO4lmydUQQgeA/edit',
  clubHandbook:
    'https://docs.google.com/document/d/1fiowHLXAjMT61OVWanui4NadO_apk0Ufc40KnZYiXng/edit',
  clubsListSheet:
    'https://docs.google.com/spreadsheets/d/1Px1BMs1w8M115022aC4y_8O-21iRwugQdhxU4OW3eAk/edit',

  schoolStore: 'https://fremonths.myschoolcentral.com/',
  flickr: 'https://flickr.com/people/fremonthighschoolasb/',
  youtube: 'https://www.youtube.com/@fremonthighschoolasb',
  instagram: 'https://www.instagram.com/firebirdfelipe/',
  tiktok: 'https://www.tiktok.com/@felipethefirebird',

  // Opportunities: a normal (non-embed) link to the same deck so phones can open it full-screen
  opportunitiesDeck: null,

  // Resources page (placeholders until ASB Tech confirms the real links)
  communityResources: '#',
  studentWellness: '#',
  fundraiserApproval: '#',
  reimbursements: '#',
  incomeEligibility: '#',

  // App store links — leave null to show "Coming soon"
  appStore: null,
  playStore: null,
}

export const embeds = {
  // Contact page: Google Form → Send → <> Embed → copy the src="…" URL
  contactForm: 'https://docs.google.com/forms/d/e/PLACEHOLDER_FORM_ID/viewform?embedded=true',

  // Opportunities page: Google Slides → File → Share → Publish to web → Embed → copy the src="…" URL
  opportunitiesSlides:
    'https://docs.google.com/presentation/d/e/PLACEHOLDER_DECK_ID/embed?start=false&loop=false&delayms=5000',

  // Home hero video. Put a file in /public and reference it as "/hero.mp4", or keep the current Wix-hosted URL.
  heroVideo: 'https://video.wixstatic.com/video/b35fac_b0d9c758e6a044bd86a375a3f74f8bde/1080p/mp4/file.mp4',
  heroPoster: '/photos-neon-nights-2024.jpg',
}

export const school = {
  name: 'Fremont High School ASB',
  year: '2026–27',            // shown on Clubs etc. Update every August.
  address: '575 W Fremont Ave, Sunnyvale, CA 94087',
  mapsUrl: 'https://www.google.com/maps/place/575+W+Fremont+Ave,+Sunnyvale,+CA+94087',
  email: 'fremonthighschoolasb@gmail.com',
  tagline: 'Fremont You Know!',
  credit: 'Created and maintained by Fremont ASB Tech',
}
