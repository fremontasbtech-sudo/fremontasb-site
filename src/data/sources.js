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
  // Home → Spirit Points Tracker.
  // Sheet is a matrix: first column = class (Freshmen/Sophomores/Juniors/Seniors),
  // each following column = an event (BTS Rally, Homecoming, ...). A class's total
  // is the sum of its row, so adding an event = adding a column. Nothing else to do.
  spiritPoints: 'https://docs.google.com/spreadsheets/d/1gS0bbOGgpjMpCfeYOUBI4B39oPEtNU-1Y2n1nEWkZ7o/edit?gid=0#gid=0',

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
    'https://docs.google.com/spreadsheets/d/1ZpDVioKRc0TDzUSYpGspEOOEEM9TXBVjk8Tl6wzirJE/edit',
  clubHandbook:
    'https://docs.google.com/document/d/1fiowHLXAjMT61OVWanui4NadO_apk0Ufc40KnZYiXng/edit',
  // Club Info Meeting deck — normal view link for the "Open the slides" button (embed lives in embeds.clubInfoSlides).
  clubInfoSlides:
    'https://docs.google.com/presentation/d/1GV6dM2eOitIWyesUN5ciMVs3Cq9pqc8a-hBYtz1OmIs/edit?usp=sharing',
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
  studentWellness: 'https://fhs.fuhsd.org/guidance-student-support/student-wellness-resources',
  fundraiserApproval: 'https://app.informedk12.com/link_campaigns/fundraiser-form-59de5f92-6589-4b27-a103-a684782f1c47?token=1D7o2fJ7jgbtjjbREaZxw2sq',
  reimbursements: 'https://app.informedk12.com/link_campaigns/check-request-electronic-form-638b46dd-9d91-411d-9056-ca54f5cb63f1?token=nLaHtqkbjGdUbqL1AvB7f3Mp',
  incomeEligibility: 'https://app.informedk12.com/link_campaigns/fuhsd-income-eligibility-form?token=8N8nQUcZx2jhd2HM2dwH4QZr',

  // App store links — leave null to show "Coming soon"
  appStore: null,
  playStore: null,
}

export const embeds = {
  // Contact page: Google Form → Send → <> Embed → copy the src="…" URL
  contactForm: 'https://docs.google.com/forms/d/e/1FAIpQLScNFE8IoooVpQER65d2GIse6ru1nLIp03EHcBjeGBVpsOJMZQ/viewform?embedded=true',

  // Opportunities page: the College & Career Center's "Job & Internship Opportunities" Google Doc.
  // Embed uses the /preview view of the Doc (an /edit link will NOT load in an iframe).
  // Contact to update: Ms. Adriana Magallon-Loredo (FUHSD College & Career Center).
  opportunitiesSlides:
    'https://docs.google.com/document/d/1Eejgl40HokOrwIrHIZB21hpTecIMvW_AmEOnn9ex7kw/preview',

  // Clubs page: the Clubs Commission's Club Info Meeting deck (Google Slides), previewed on the page.
  //   /embed is the iframe-friendly Slides URL (works for "anyone with the link"). Swap the id to change decks.
  //   (The Club Accountability Tracker sheet embed is intentionally not shown for now.)
  clubInfoSlides:
    'https://docs.google.com/presentation/d/1GV6dM2eOitIWyesUN5ciMVs3Cq9pqc8a-hBYtz1OmIs/embed?start=false&loop=false&delayms=5000',

  // Home hero video. Put a file in /public and reference it as "/hero.mp4", or keep the current Wix-hosted URL.
  heroVideo: '/hero.mp4',
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

// ─────────────────────────────────────────────────────────────────────────────
// MORNING ANNOUNCEMENTS (Home page) — pulled live from the ASB announcements sheet.
//   The sheet is a weekly Wed/Fri grid holding the whole year. The site pulls it
//   server-side (/api/announcements, no embed, no key) and shows ONLY announcements
//   whose morning has passed (8:30 AM cutoff) — so each appears on its Wed/Fri
//   automatically, no scheduler. To point at a different sheet, change the URL
//   (must be shared "anyone with the link — Viewer").
// ─────────────────────────────────────────────────────────────────────────────
export const announcementsSheet =
  'https://docs.google.com/spreadsheets/d/1S4-AYwuZXewRqtRoMeHWgITXbuQH7R8r74RmTMegCqQ/edit'

// -----------------------------------------------------------------------------
// EVENTS + SPORTS -- the SAME sheet the Firebird Hub app reads, so website + app
// never drift. Home -> Latest News surfaces the curated items:
//   * Events tab (gid=0): rows flagged featured = YES (ASB highlights the row red;
//     an Apps Script turns red -> YES). Cols: name,date,endDate,time,location,
//     description,tags,featured.
//   * Sports tab: games flagged push = y in column A (type "y" in a game's first
//     cell to pin it). The 3-hour SportsSync rewrite preserves that y.
// Pulled server-side (/api/events, keyless); the client shows only the upcoming
// window. Edit the sheet -- both surfaces update. Keep "anyone with link - Viewer".
// -----------------------------------------------------------------------------
export const eventsSheet =
  'https://docs.google.com/spreadsheets/d/11Pm2zUc_O40E0oTZekYvsD_D8FenH9s7PiJ43m7JCH0/edit'

export const school = {
  name: 'Fremont High School ASB',
  year: '2026–27',            // shown on Clubs etc. Update every August.
  address: '575 W Fremont Ave, Sunnyvale, CA 94087',
  mapsUrl: 'https://www.google.com/maps/place/575+W+Fremont+Ave,+Sunnyvale,+CA+94087',
  email: 'fremonthighschoolasb@gmail.com',
  tagline: 'Fremont! You Know!',
  credit: 'Created and maintained by Fremont ASB Tech',
}

// ─────────────────────────────────────────────────────────────────────────────
// CLUB KEY DATES (Clubs page) — the Clubs Commission's 26–27 calendar.
//   Source: the Club Info Meeting deck. Edit here to change what the site shows.
//   iso = YYYY-MM-DD (used to sort and to dim dates that have passed / highlight
//   the next one up). display = how the date reads. type = event | deadline | process.
// ─────────────────────────────────────────────────────────────────────────────
export const clubDates = {
  note: 'New-club applications and renewals for 2026–27 closed August 31. A second application round opens in January.',
  items: [
    { iso: '2026-08-31', display: 'Aug 31',    label: 'Applications & renewals due', detail: 'No late submissions', type: 'deadline' },
    { iso: '2026-09-09', display: 'Sep 2–9',   label: 'New club interviews',        type: 'process' },
    { iso: '2026-09-10', display: 'Sep 9–10',  label: 'Clubs list finalized',       type: 'process' },
    { iso: '2026-09-13', display: 'Sep 9–13',  label: 'Clubs Day sign-ups',         type: 'process' },
    { iso: '2026-09-16', display: 'Sep 16',    label: 'Clubs Day',                  type: 'event' },
    { iso: '2026-09-30', display: 'Sep 30',    label: 'First monthly check-in due', detail: 'Due 11:59 PM, then the last of every month', type: 'deadline' },
    { iso: '2026-10-28', display: 'Oct 28',    label: 'Multicultural Night',        type: 'event' },
    { iso: '2027-01-15', display: 'January',   label: '2nd-semester applications open', type: 'process' },
    { iso: '2027-01-27', display: 'Jan 27',    label: 'Club Trivia Night',          type: 'event' },
    { iso: '2027-04-21', display: 'Apr 21',    label: 'Club Grub Day',              type: 'event' },
    { iso: '2027-05-15', display: 'May',       label: 'Club renewals for next year', type: 'process' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE LINK LISTS (Resources page) — ported from the old fremontasb.org
//   "Community Resources" and "Student Wellness" tabs. Each entry: a name, an
//   optional note, and one or more { label, href } links. Edit here to update.
// ─────────────────────────────────────────────────────────────────────────────
export const resourceLinks = {
  community: [
    { name: 'Suicide Prevention', links: [
      { label: 'American Foundation for Suicide Prevention', href: 'https://afsp.org/' },
      { label: 'Crisis Text Line', href: 'https://www.crisistextline.org/' },
      { label: '988 Suicide & Crisis Lifeline', href: 'https://988lifeline.org/' },
    ] },
    { name: 'Community Counseling (sliding fee scale)', links: [
      { label: 'Community Health Awareness Council', href: 'http://www.chacmv.org/clinic/' },
    ] },
    { name: 'LGBTQ Resources', links: [
      { label: 'LGBTQ Youth Space (Billy DeFrank Center)', href: 'http://youthspace.org/locations/the-billy-defrank-center/' },
      { label: 'PFLAG San Jose', href: 'http://www.pflagsanjose.org/' },
    ] },
    { name: 'Grief Support', note: 'Center for Living with Dying · (408) 243-0222', links: [
      { label: 'Kara Grief Support', href: 'http://www.kara-grief.org/' },
    ] },
    { name: 'Emergency Youth Housing', links: [
      { label: 'Bill Wilson Center', href: 'http://www.billwilsoncenter.org/services/all/drop.html' },
    ] },
    { name: 'Child Protective Services', links: [
      { label: 'Suspected Child Abuse — form & instructions (PDF)', href: 'https://oag.ca.gov/sites/all/files/agweb/pdfs/childabuse/ss_8572.pdf' },
    ] },
    { name: 'More resources', links: [
      { label: 'Books on Mental Health & Wellness (Gale)', href: 'https://infotrac.gale.com/itweb/sunn62370?db=GVRL-0' },
      { label: 'FUHSD Mental Health Resources', href: 'https://fhs.fuhsd.org/fs/pages/2482' },
    ] },
  ],
  wellness: [
    { name: 'Wellness Check-In Form', note: 'Request to speak with a school-based therapist or psychologist.', links: [
      { label: 'Open the check-in form', href: 'https://forms.gle/LREikhxnf1nQRogP6' },
    ] },
    { name: 'FUHSD School Linked Services Referral', note: 'Staff referral to the district specialist for community resources.', links: [
      { label: 'Referral form', href: 'https://docs.google.com/forms/d/e/1FAIpQLSe0dXD7SLYPcq0aa3I4XOr9r1DxKw-5U97nBxvA9CafF12QOA/viewform' },
    ] },
    { name: 'Family Community Support Referral', links: [
      { label: 'Referral form', href: 'https://docs.google.com/forms/d/e/1FAIpQLSe9J4wMxyCWdanv292_306Y6ZW5TvcSkqCWeK0cB43Ggv1Gcw/viewform' },
    ] },
    { name: 'Wellness Staff', note: 'Deirdre Louie, LMFT — School-Based Therapist · (408) 522-2487 · A-Building (downstairs).', links: [
      { label: 'SV Community Services', href: 'https://svcommunityservices.org/' },
      { label: 'Mayview Community Health', href: 'https://www.mayview.org/' },
      { label: 'YWCA', href: 'https://www.ywca.org/' },
    ] },
  ],
}
