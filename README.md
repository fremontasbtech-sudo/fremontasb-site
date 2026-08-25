# Fremont ASB Website (fremontasb.org)

The Fremont High School ASB website, rebuilt in React + Vite + Tailwind, deployed on Vercel.
Maintained by **Fremont ASB Tech**. This README is written for two readers: a future ASB member
with no coding background who needs to **update content**, and a future technical lead who needs
to **run and deploy the code**.

---

## Part 1 — Updating content (no coding needed)

Almost everything that changes during the year lives in **Google Sheets, Forms, and Slides**, not
in code. Once the site is wired up (Part 3), you update content like this:

| What | Where to edit | Shows up on |
|---|---|---|
| Spirit points | The Spirit Points Google Sheet (columns: `grade`, `points`) | Home |
| News | The News Google Sheet (columns: `title`, `date`, `blurb`) | Home |
| Club list | The "Official Clubs List" Google Sheet (already connected) | Clubs |
| Homecoming Court | The Court Google Sheet (columns: `name`, `photoUrl`, `bio`, `active`, `cycle`) | Homecoming Court |
| Elections | The Elections Google Sheet (columns: `section`, `name`, `photoUrl`, `bio`, `active`) | Elections |
| Contact form | Edit the Google Form itself — responses land in its linked Sheet | Contact |
| Opportunities | Edit the Google Slides deck — the embed updates automatically | Opportunities |
| FremontTV / videos | `src/data/media.json` (title, date, youtubeId) — ask the tech lead, or edit on GitHub | Media |
| Photo albums | `src/data/photos.json` (name, cover image, Flickr link) | Photos |

Rules that make the Sheets work:

- Row 1 must be the column headers. Blank rows are ignored.
- Share each sheet as **Anyone with the link → Viewer** (the site reads it as CSV).
- `active` column: leave blank or write `TRUE` to show; write `FALSE` to hide. To close a
  Court/Election cycle, set every row's `active` to `FALSE` — don't delete rows, that's your archive.
- Changes appear the next time someone loads the page. No redeploy needed for Sheet content.

**Seasonal pages:** Homecoming Court and Elections ship "off" (nothing displayed) until their
sheet has active rows, so nothing fake ever shows. The sample data in `src/data/*.json` uses
fictional names and is only a formatting reference.

### Links and embeds (one file)

Every external URL the site uses — the store link, Flickr, YouTube, the handbook, the contact-form
embed, the Slides embed, the hero video, app store links — lives in **`src/data/sources.js`**,
with comments explaining each. Change the link there, save, and redeploy (Part 3). Nothing else
to touch.

---

## Part 2 — Running the project locally (technical lead)

```bash
git clone <repo-url>
cd fremontasb-site
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Requirements: Node 18+ (built on Node 22). In dev mode you'll see small gray "dev only" hints
(e.g. "connect this Sheet in sources.js") — visitors never see them; they're stripped from
production builds automatically.

### Project structure

```
src/
  components/    Shared UI: Navbar, Footer, Layout, Button, Card, SectionHeader,
                 PageHero, Embed, DataState  (see THEME.md for the design system)
  pages/         One file per route (Home, Media, Photos, Clubs, HomecomingCourt,
                 Elections, Opportunities, Resources, Contact, SchoolStore, DownloadApp)
  data/          sources.js (ALL urls/links/embeds — the config file)
                 useSheetData.js (the one Google-Sheets fetch/parse hook)
                 *.json (local sample data, used as fallback when a sheet isn't connected)
  assets/        Logo images
public/          Favicon, photos, sample portraits
tailwind.config.js + src/index.css   Brand tokens and classes — documented in THEME.md
```

Conventions: pages never hardcode URLs (import from `sources.js`); sheet-driven sections use
`useSheetData(sheetUrl, fallbackJson)` so the page still renders if a fetch fails; Homecoming
Court and Elections are deliberately independent pages — don't merge them or share a candidate
component between them.

---

## Part 3 — Deployment (Vercel) and the domain

1. Push the repo to GitHub — use the **shared ASB Tech GitHub account/org**, not a personal
   account, so access survives graduation.
2. In [vercel.com](https://vercel.com) (shared ASB Tech team): **Add New Project → Import** the
   repo. Vercel auto-detects Vite. Defaults are fine (`npm run build`, output `dist/`).
   `vercel.json` in the repo handles the URL rewrites so page routes work on refresh.
3. Every push to `main` auto-deploys. Content edits made on GitHub's web editor
   (e.g. `media.json`) also trigger a deploy.

### Custom domain (fremontasb.org)

The domain stays at its current registrar — only DNS points at Vercel:

1. Vercel → Project → Settings → Domains → add `fremontasb.org` and `www.fremontasb.org`.
2. At the registrar's DNS panel set the records Vercel shows, currently:
   `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`.
   (If Vercel shows different values, trust Vercel's screen — do not remove the domain's
   MX/email records while editing.)
3. Wait for DNS to propagate (minutes to a few hours). Vercel issues HTTPS automatically.

**If DNS ever breaks:** log into the registrar, compare the A/CNAME records against what
Vercel → Settings → Domains currently asks for, and fix them to match. That's the whole repair.

### Handoff checklist for each new tech lead

- [ ] Access to: registrar login, Vercel team, GitHub org, the ASB gmail, each connected Google Sheet
- [ ] Update `school.year` in `src/data/sources.js` every August
- [ ] Read THEME.md before adding any UI

---

## Status / still to wire up

- `sheets.spiritPoints`, `sheets.news`, `sheets.homecomingCourt`, `sheets.elections` in
  `sources.js` are `null` → those sections show sample/local data. Create the sheets
  (columns above) and paste their URLs.
- Contact form + Opportunities deck embeds are placeholders (`embeds.*` in `sources.js`).
- Resources page links marked `#` are "coming soon" until ASB confirms the real URLs.
- Hero video still points at the old Wix-hosted MP4 — download it and drop it in `public/hero.mp4`,
  then set `embeds.heroVideo: '/hero.mp4'`.
- App store links (`links.appStore/playStore`) are `null` → "Coming soon" buttons show.
