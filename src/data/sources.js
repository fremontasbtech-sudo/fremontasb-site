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

  // Clubs → Club List.  "Official Clubs List" sheet (first tab).
  // Columns: name | purpose | studentAdvisors | teacherAdvisor | meetingInfo | email | other
  // TODO(26-27): this is the interim 25-26 list. Swap in the 26-27 sheet once it exists.
  clubs: 'https://docs.google.com/spreadsheets/d/1M-PZR_C9X4JCqk_uDWEE6MsLFpinhewrbd6oiPRMgqw/edit?gid=0#gid=0',

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
  // TODO(26-27): interim 25-26 list — swap to the 26-27 sheet when ready (keep in sync with sheets.clubs above).
  clubsListSheet:
    'https://docs.google.com/spreadsheets/d/1M-PZR_C9X4JCqk_uDWEE6MsLFpinhewrbd6oiPRMgqw/edit?gid=0#gid=0',

  schoolStore: 'https://fremonths.myschoolcentral.com/',
  flickr: 'https://flickr.com/people/fremonthighschoolasb/',
  youtube: 'https://www.youtube.com/@fremonthighschoolasb',
  instagram: 'https://www.instagram.com/firebirdfelipe/',
  tiktok: 'https://www.tiktok.com/@felipethefirebird',

  // Opportunities: a normal link to the same Doc so phones can open it full-screen
  opportunitiesDeck: 'https://docs.google.com/document/d/1Eejgl40HokOrwIrHIZB21hpTecIMvW_AmEOnn9ex7kw/preview',

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

  // Opportunities page: the College & Career Center's "Job & Internship Opportunities" Google Doc.
  // Embed uses the /preview view of the Doc (an /edit link will NOT load in an iframe).
  // Contact to update: Ms. Adriana Magallon-Loredo (FUHSD College & Career Center).
  opportunitiesSlides:
    'https://docs.google.com/document/d/1Eejgl40HokOrwIrHIZB21hpTecIMvW_AmEOnn9ex7kw/preview',

  // Home hero video. Put a file in /public and reference it as "/hero.mp4", or keep the current Wix-hosted URL.
  heroVideo: 'https://video.wixstatic.com/video/b35fac_b0d9c758e6a044bd86a375a3f74f8bde/1080p/mp4/file.mp4',
  heroPoster: '/photos-neon-nights-2024.jpg',
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE AUTO-PULL (Media page) — LIVE, via the channel's public RSS feed.
//   The Media page auto-pulls the newest uploads (no API key, no secrets). The
//   feed is fetched server-side by /api/youtube (api/youtube.js on Vercel in
//   production; the dev middleware in vite.config.js on localhost), both reading
//   the channelId below. media.json is the OVERLAY: it supplies "hosts" and
//   "kind" (FremontTV/Rally/Event) the feed can't provide, and keeps older
//   episodes in the archive after they scroll out of the feed.
//   To point at a different channel, change channelId (the "UC…" id).
// ─────────────────────────────────────────────────────────────────────────────
export const youtubeFeed = {
  channelId: 'UC6n36BKoWwrJhwwGobgJSqw',   // youtube.com/@fremonthighschoolasb
}

// ─────────────────────────────────────────────────────────────────────────────
// FLICKR AUTO-PULL (Photos page) — LIVE albums via the Flickr API.
//   The Photos page auto-pulls every album (photoset) from the ASB Flickr.
//   Needs two things (see .env.example / README):
//     • nsid below — the ASB Flickr account's user id (already filled in).
//     • a free Flickr API key, kept SERVER-SIDE as the FLICKR_API_KEY env var —
//       never in this file or the client bundle. Locally: put it in .env
//       (FLICKR_API_KEY=...). On Vercel: Project → Settings → Environment Variables.
//   Served by /api/flickr (api/flickr.js on Vercel; dev middleware in vite.config.js).
//   Until the key is set, the page falls back to the sample albums in photos.json.
// ─────────────────────────────────────────────────────────────────────────────
export const flickrFeed = {
  nsid: '199104771@N02',   // flickr.com/people/fremonthighschoolasb
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
