# Fremont ASB Website — Handoff Context

Paste or attach this at the start of a new chat when asking Claude to edit the website.

## What this is

The rebuilt fremontasb.org site for Fremont High School ASB (Sunnyvale, CA). Built Aug 2026 from the "ASB Website Prompt List" spec + PRD, replacing the old Wix site. It lives on my Mac at **`Desktop/Class/ASB/fremontasb-site/`** (the ASB folder is connected to this Claude project). Do NOT touch `ASB/www.fremontasb.org/` — that's the archived Wix scrape — or `ASB/fremontasb-site.zip` (backup of the original delivery).

**Stack:** React 18 + Vite 5 + Tailwind CSS 3 + React Router 6. Deploys to Vercel (`vercel.json` included, not yet deployed). Run locally: `npm install && npm run dev` → localhost:5173 (or double-click `start-site.command`; `stop-site.command` kills it).

## Workflow for edits

1. Stage the files you need from `ASB/fremontasb-site/` into the cloud workspace, edit there, `npm run build` must pass, then commit the changed files back to the same paths on my Mac. Never edit blind — verify with a build and, for visual changes, a screenshot at 375 / 768 / 1280 px.
2. Keep the original folder structure; don't create parallel copies.

## Architecture rules (do not break)

- **Every external URL, Google Sheet, embed, and link lives in `src/data/sources.js`** — pages import from it, never hardcode URLs. This is the one file non-technical ASB members edit.
- **All Sheet-driven content uses `useSheetData(sheetUrl, fallbackJson)`** from `src/data/useSheetData.js` (fetches gviz CSV, camelCases headers, falls back to the local JSON in `src/data/` if the sheet is null or the fetch fails). Active/hidden flags use `isHidden()`: blank = shown, explicit FALSE = hidden.
- **Design tokens live only in `tailwind.config.js` + reusable classes in `src/index.css`** — documented in `THEME.md` (read it before any UI work). Brand: rust `#9E3B1B` (brand), white backgrounds, charcoal `#222` headings (ink), gray `#595959` body, Archivo display font. Page titles: bold, centered, short rust underline (`PageHero` does this).
- **Shared components** in `src/components/`: Navbar, Footer, Layout, Button (primary/secondary/inverse/disabled), Card, SectionHeader, PageHero, Embed (shows visitor-friendly fallback for PLACEHOLDER urls; dev hints only in `npm run dev`), DataState (Loading/Notice/DevNote).
- **Homecoming Court and Elections are deliberately separate pages** on separate seasonal schedules — never merge them or share a candidate component.
- Routes (one file each in `src/pages/`): Home, Media (merged FremontTV+Videos), Photos, Clubs, HomecomingCourt, Elections, Opportunities, Resources, Contact, SchoolStore, DownloadApp. Route table in `src/App.jsx`; nav links in `components/Navbar.jsx`.

## Content quality bar (enforced during the build — keep it)

No AI-slop: no gradients, glass cards, emoji icons, purple/blue accents, generic icon-card rows, or filler copy ("Welcome to…", "Discover…", "vibrant", "seamless", "journey"). Write like a student who runs ASB: direct, specific, short. Never invent facts (room numbers, dates, processes, stats) — placeholder states must say honestly what's coming instead of faking it. Maintainer notes go in `DevNote` (dev-only), never visible to visitors. Mobile-first: perfect at 375px, no horizontal scroll, tap targets ≥44px.

## Current data wiring status

- **Live now:** Clubs list — wired to the real "Official Clubs List" Google Sheet (id `1Px1BMs1w8M115022aC4y_8O-21iRwugQdhxU4OW3eAk`). Its headers are messy (first column header is literally "f", "Teacher Avisor" typo); `normalizeClub` in `Clubs.jsx` handles that, strips emails out of advisor names, and filters `(DISBANDED)` clubs into a collapsed toggle.
- **Still null in sources.js (showing local sample JSON):** spiritPoints, news, homecomingCourt, elections sheets. Court/Elections sample data uses fictional names and ships `active:false` so nothing fake renders — don't flip to true without real candidates.
- **Placeholder embeds:** contactForm (Google Form) and opportunitiesSlides (Google Slides) in `embeds`.
- **Placeholder `#` links:** the five Resources-page links + `communityResources` etc.
- **Hero video** still streams from the old Wix CDN URL; plan is to download it to `/public/hero.mp4` eventually.
- Real content already in: 9 YouTube episodes (`media.json`), 4 Flickr albums (`photos.json`), store link (fremonths.myschoolcentral.com), Club Handbook + Accountability Tracker Google Doc/Sheet links, address/email/tagline in `school`.

## Known environment quirk

In Claude's cloud sandbox, Google Fonts / YouTube / Google Sheets fetches are blocked — pages show fallbacks/sample data there. That's expected, not a bug; everything works in a real browser and in production.

## Docs inside the repo

`README.md` — run/deploy/DNS + content-update guide for non-technical members. `THEME.md` — full design-system reference. Read both before big changes; update them if your change affects anything they describe.
