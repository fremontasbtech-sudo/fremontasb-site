# Fremont ASB Website (fremontasb.org)

The Fremont High School ASB website, built in React + Vite + Tailwind and deployed on Vercel.
Maintained by Fremont ASB Tech. It is live at https://fremontasb.org (and
https://fremontasb-site.vercel.app).

This README has two readers in mind: a future ASB member with no coding background who needs to
update content, and a future technical lead who runs and deploys the code.

Almost nothing that changes during the year lives in code. Content comes from Google Sheets,
Forms, Slides, Flickr, YouTube, and the athletics feed, pulled live at runtime. Edit the source,
and the site updates on its own, usually within a few minutes. No redeploy needed for content.

---

## Part 1: Updating content (no coding needed)

| What | Where you edit it | Shows up on |
|---|---|---|
| Spirit points | Spirit Points Google Sheet (matrix: col A = class, each next column = an event) | Home |
| Latest News (written posts) | News Google Sheet (`title`, `date`, `blurb`, optional `type`, `link`, `pinned`) | Home |
| Announcements | Morning-announcements Sheet (one tab per month, weekly Wed/Fri grid) | Home (Morning Announcements) |
| Upcoming Events + Sports | Shared "Firebird Hub Events (26-27)" Sheet (same one the app reads) | Home (Upcoming Events + Latest News) |
| Club list | "Official Clubs List" Sheet (already connected) | Clubs |
| Homecoming Court | Court Sheet (`name`, `photoUrl`, `bio`, `active`, `cycle`) | Homecoming Court |
| Elections | Elections Sheet (`section`, `name`, `photoUrl`, `bio`, `active`) | Elections |
| Contact form | The Google Form itself (responses land in its linked Sheet) | Contact |
| Opportunities | The Google Doc (the embed updates on its own) | Opportunities |
| Photo albums | Nothing. Auto-pulled from the ASB Flickr | Photos + Home |
| FremontTV / videos | Nothing. Auto-pulled from the ASB YouTube channel | Media + Home |

Rules that make the Sheets work:

- Row 1 is the column headers. Blank rows are ignored.
- Share every sheet as "Anyone with the link, Viewer." The site reads it as CSV, no key.
- `active` column (Court/Elections): blank or `TRUE` shows the row, `FALSE` hides it. To close a
  cycle, set every row to `FALSE`. Do not delete rows, that is your archive.
- Edits appear on the site within about 1 to 5 minutes (short CDN cache), not instantly. A hard
  refresh (Cmd+Shift+R) after that shows the change right away.

Seasonal pages (Homecoming Court, Elections) ship "off" until their sheet has active rows, so
nothing fake ever shows. The sample data in `src/data/*.json` is fictional and only a format guide.

### Announcements (Morning Announcements on Home)

The announcements sheet has one tab per month, named like `September 2026`. Each tab is a weekly
Wed/Fri grid. The site shows only announcements whose morning has already passed, using an
8:30 AM cutoff, so each one appears on its own Wednesday or Friday with no scheduling on your end.
Put content under the correct day column, and keep the day and date labels correct. If a day
column is empty, nothing shows for that day (that is the usual reason "an announcement did not
appear": it was placed under the wrong or mislabeled column).

Each announcement gets a short, clean topic title generated automatically (see LLM titles below),
so a long paragraph shows up as, for example, "Astrophysics Club."

### Upcoming Events and Sports (from the shared Firebird Hub sheet)

Home reads the same Google Sheet the Firebird Hub app uses, so the website and app never drift.
It surfaces two things:

- Events: rows on the Events tab flagged `featured = YES` (ASB highlights the row; an Apps Script
  turns the highlight into YES). Shows all featured events in the next 3 weeks.
- Games: rows on the Sports tab flagged `push = y` in column A (type `y` in a game's first cell),
  OR any game marked as a senior night. Rules:
  - Only the soonest upcoming game per sport shows at a time (one football, one volleyball, and so
    on). Flag a whole season with `y` and the calendar shows one row per sport, rotating on its own
    as each game's day passes.
  - Senior nights get a "Senior Night" badge and show even if the sport is not pinned.
  - When a game finishes, it moves from Upcoming Events into Latest News with its final score. The
    score comes from the FHS athletics results feed (the same source the app uses), matched by
    sport, date, level, and opponent. If athletics has not posted the score yet, the game still
    moves to Latest News and shows "Final score soon" until the score is in. You can also type a
    score straight into the Sports tab's `score` column to override, and it shows within a minute.

Flag inputs are forgiving: `y`, `Y`, `yes`, `x`, a check, or `1` all count. Dates work as
`YYYY-MM-DD` or `M/D/YYYY`.

### Links and embeds (one file)

Every external URL the site uses (store link, Flickr, YouTube, handbook, contact form, Opportunities
doc, the sheets, the hero video) lives in `src/data/sources.js`, each with a comment. Change the
link there, save, and redeploy (Part 4).

### Link preview and hero

- The link-preview image (what shows when you paste the site link in iMessage or social) is
  `public/og.jpg`, the white Fremont logo on brand red, wired up via meta tags in `index.html`.
  Note: iMessage caches previews per URL, so an already-shared link may keep the old image until
  its cache expires. Share with a small URL tweak (for example `fremontasb.org/?v=2`) to force a
  fresh preview.
- The hero background is the drone video `public/hero.mp4`, with `public/hero-poster.jpg` (a frame
  from that video) as the still. If a phone blocks autoplay (for example iOS Low Power Mode), the
  poster shows cleanly with no stranded play button.

### Language toggle

The site has an English / Español toggle in the navbar. Translations live in `src/data/es.js`,
keyed by the exact English text. If you change an English string, update its matching key in
`es.js` too, or that line falls back to English.

---

## Part 2: How the live data works (architecture)

Content is pulled at runtime through two layers:

1. Client hooks in `src/data/` fetch data when a page loads and fall back to local sample JSON if a
   fetch fails, so a page never renders empty:
   - `useSheetData(url, fallbackJson)`: generic Google Sheet (CSV) reader (spirit points, news, clubs, court, elections).
   - `useSpiritPoints`, `useYouTube`, `useFlickr`, `useAnnouncements`, `useEvents`.
   - `useAnnouncements` and `useEvents` also cache their last result in the browser (localStorage)
     and render it instantly on repeat visits, then refresh in the background. No loading spinner
     for return visitors.

2. Serverless functions in `api/` (run on Vercel) do the work that cannot happen safely in the
   browser (keys, multi-tab merges, other sites' feeds):
   - `api/youtube.js` + `api/_feed.js`: newest FremontTV videos from the YouTube channel RSS.
   - `api/flickr.js` + `api/_flickr.js`: ASB Flickr albums (needs a read-only Flickr key).
   - `api/announcements.js` + `api/_announcements.js`: parses the monthly announcement tabs.
   - `api/events.js` + `api/_events.js`: featured events + pinned/senior-night games, and it merges
     final scores from the FHS athletics results feed.
   - `api/_llm.js`: the shared title cleaner used by announcements and Flickr (see below).
   Each `/api/*` route is mirrored by a dev-only route in `vite.config.js`, so localhost behaves
   like production.

Every `/api/*` response is CDN-cached for a short time (events about 60s, announcements about 5
min, Flickr about 1 hour) with stale-while-revalidate, and each function adds a cache-buster to its
Google Sheet fetches so it never serves Google's own stale copy. Net effect: sheet edits reach the
site fast without recomputing for every visitor.

### LLM titles (announcements + Flickr albums)

`api/_llm.js` turns messy source text into short, clean titles in one batched call, cached by the
source text. It auto-detects an API key from the environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
or `GEMINI_API_KEY`, in that order) and uses stable model aliases so it keeps working as providers
retire versions. If no key is set or a call fails, it falls back to a built-in heuristic, so titles
are always reasonable.

- Announcements: a full paragraph becomes a 2 to 5 word topic ("Come join Friday Night Live..." to
  "Friday Night Live").
- Flickr albums: the album name is cleaned and the year/date is stripped, because the site shows the
  album's month separately ("Prom 2026" to "Prom", with "May 2026" as the date label).

---

## Part 3: Environment variables (set in Vercel, Project, Settings)

| Variable | Used by | Notes |
|---|---|---|
| `GEMINI_API_KEY` | announcement + album titles | Google AI Studio key made on the ASB Gmail. Optional; without it the site uses the heuristic. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` also work. |
| `FLICKR_API_KEY` | Photos | Read-only, non-commercial Flickr key. A default is baked into `api/_flickr.js`, so this is only an override. |

Keys are read server-side only and never ship to the browser. Never commit a key.

The athletics results feed (public, no key) is a Google Apps Script URL hardcoded in
`api/_events.js`. If athletics changes it, update that constant.

---

## Part 4: Running the project locally (technical lead)

```bash
git clone <repo-url>
cd fremontasb-site
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Requirements: Node 18+ (built on Node 22). To exercise the live feeds/titles in dev, create a
`.env` file with `FLICKR_API_KEY=...` and, optionally, `GEMINI_API_KEY=...`. Dev mode shows small
gray "dev only" hints; they are stripped from production builds and visitors never see them.

### Project structure

```
api/            Vercel serverless functions (youtube, flickr, announcements, events)
                and their _shared helpers, plus _llm.js (the title cleaner)
src/
  components/    Shared UI: Navbar, Footer, Layout, Button, Card, SectionHeader,
                 PageHero, Embed, DataState, Calendar  (design system in THEME.md)
  pages/         One file per route (Home, Media, Photos, Clubs, HomecomingCourt,
                 Elections, Opportunities, Resources, Contact, DownloadApp)
  data/          sources.js (ALL urls/links/embeds, the config file)
                 use*.js data hooks; albumTitle.js; es.js (Spanish); *.json fallbacks
  i18n.jsx       English/Español context + toggle
  assets/        Logo images
public/          Favicon, logo, og.jpg (link preview), hero.mp4 + hero-poster.jpg, sample images
vite.config.js   Dev mirrors of the /api routes
```

Conventions: pages never hardcode URLs (import from `sources.js`); sheet-driven sections use a
`use*` hook with a JSON fallback so the page still renders if a fetch fails; Homecoming Court and
Elections stay independent pages; keep the language keys in `es.js` in sync with English copy.

---

## Part 5: Deployment (Vercel) and the domain

1. The repo lives on the shared `fremontasbtech-sudo` GitHub account (not a personal one, so access
   survives graduation).
2. The Vercel project is `fremontasb-site` on the `fremont-asb-tech` team. Every push to `main`
   auto-deploys in about 1 to 2 minutes. Content edits made in GitHub's web editor also deploy.
3. `vercel.json` handles URL rewrites so page routes work on refresh. Its catch-all rewrite MUST
   exclude `/api` (`/((?!api/).*)`), or it shadows the serverless functions.

### Custom domain (fremontasb.org)

Connected. DNS points at Vercel (`A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`; trust
Vercel, Settings, Domains for the current values). If DNS ever breaks, compare the registrar's
records against what that screen asks for and fix them to match. Do not remove the domain's email
(MX) records while editing.

### Pushing changes (auth note)

The Mac's git is signed in to a different GitHub account that has read but not write access, so a
plain `git push` can 403. This repo is set up to push as `fremontasbtech-sudo` automatically via a
stored credential, so a normal `git push` works. If it ever 403s again, the stored token expired;
create a new classic token with the `repo` scope and re-store it.

### Handoff checklist for each new tech lead

- [ ] Access to: registrar login, Vercel team, the `fremontasbtech-sudo` GitHub account, the ASB
      Gmail, and each connected Google Sheet.
- [ ] Confirm the Vercel env vars (`GEMINI_API_KEY`, `FLICKR_API_KEY`) are set.
- [ ] Update `school.year` in `src/data/sources.js` every August.
- [ ] Read THEME.md before touching any UI.

---

## Status / still to wire up

- `sheets.spiritPoints` is connected; `sheets.news`, `sheets.homecomingCourt`, and
  `sheets.elections` in `sources.js` may be `null`, which shows sample/local data. Create the
  sheet (columns above) and paste its URL to go live.
- Resources page links marked `#` are "coming soon" until ASB confirms the real URLs.
- App store links (`links.appStore` / `links.playStore`) are `null`, so "Coming soon" buttons show.
