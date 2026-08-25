# THEME.md — Fremont ASB design tokens

Everything visual is defined in **two files**. Change a color there and it changes everywhere.

| Where | What lives there |
|---|---|
| `tailwind.config.js` | Color, font, spacing and radius **tokens** |
| `src/index.css` | Reusable **classes** built from those tokens |

## Tokens (`tailwind.config.js`)

| Token | Value | Use |
|---|---|---|
| `brand` | `#9E3B1B` | Rust maroon — logo, buttons, active nav, underline accents, tagline |
| `brand-dark` | `#7F2E14` | Button hover |
| `brand-tint` | `#FBF1ED` | Very light rust wash — secondary buttons, highlighted rows, banners |
| `ink` | `#222222` | Headings |
| `body` | `#595959` | Body text |
| `rule` | `#E6E1DD` | Hairline borders and dividers |
| `paper` | `#FFFFFF` | Page background |
| `font-display` | Archivo → Helvetica Neue | Headings, buttons, nav |
| `font-sans` | Helvetica Neue / Arial | Body text |
| `max-w-site` | 76rem | Page content width |
| `py-section` / `py-section-sm` | 5rem / 3.5rem | Vertical rhythm between sections |
| `rounded-btn` | 0.375rem | Button / card corner radius |

Usage in JSX: `bg-brand`, `text-ink`, `border-rule`, `font-display`, `max-w-site`, etc.

## Classes (`src/index.css`)

| Class | What it is | Used by |
|---|---|---|
| `.container-site` | Centered page column with side padding | every page |
| `.page-title` | Bold, centered, large title | `PageHero` |
| `.rule-accent` | Short centered rust underline under a title | `PageHero`, `SectionHeader` (center) |
| `.rule-accent-left` | Same underline, left-aligned | `SectionHeader` |
| `.subtext` | Gray italic text under a title | `PageHero` |
| `.eyebrow` | Small rust uppercase label above a heading | `SectionHeader`, pages |
| `.eyebrow-on-dark` | Same, white — for rust/dark bands | Home app banner, hero |
| `.btn-primary` | Solid rust, white text, rounded, no border | `Button` (default) |
| `.btn-secondary` | Rust tint background, rust text, no border | `Button variant="secondary"` |
| `.btn-inverse` | White button, rust text — for rust bands | `Button variant="inverse"` |
| `.btn-disabled` | Gray, not clickable — "coming soon" | `Button variant="disabled"` |
| `.tagline` | Bold italic rust — "Fremont You Know!" | Footer, Home hero |
| `.section-space` | Section padding (responsive) | pages |
| `.card-surface` | White card with hairline border and rounded corners | `Card`, dropdowns |
| `.link-brand` | Rust underlined inline link | text links |

## Components that wrap these (`src/components/`)

- **PageHero** — `title`, `subtext`, `eyebrow`, children (buttons). Top of every inner page.
- **SectionHeader** — `title`, `eyebrow`, `align="center"`, `action`. Title + rust underline for a section.
- **Button** — `text` / children, `to` (internal), `href` (external, gets the ↗ icon), `variant`.
- **Card** — `image`, `title`, `caption`, `href`. Image + caption box for grids.
- **Embed** — `src`, `title`, `ratio` / `minHeight`, `fallback`. Responsive iframe for Forms / Slides.
- **DataState** — `Loading`, `Notice`, `DevNote` for sheet-driven sections.

## Rules of thumb

- Buttons are always solid rust with white text (spec). Secondary/inverse variants exist only for a second action next to a primary one.
- Backgrounds are white. The only colored bands are `bg-brand` (rust) or `bg-brand-tint`.
- No gradients, shadows-on-everything, emoji icons, or new colors. If you need a new token, add it to `tailwind.config.js` and document it here.
