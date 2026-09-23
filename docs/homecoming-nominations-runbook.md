# Homecoming Court Nominations — Deploy + Test Runbook

Do every step signed in as **amehta251@student.fuhsd.org** (the school account). Budget: ~45 minutes including tests.

## 1. Why this is fraud-proof

There is no email box anywhere — nothing a student types is trusted as identity. Google itself makes every visitor sign in to a FUHSD account before the nomination page even loads. The server reads the visitor's Google-verified email with `Session.getActiveUser()` and writes it to the sheet; the browser never sends an email. One row per student: submitting again overwrites that student's own row, so the tab can't be stuffed and is already deduped.

## 2. Before you start

The Sheet **must be owned by the school account** (amehta251@student.fuhsd.org or another @fuhsd.org account). If it's owned by the personal Gmail, the "Anyone within <your district>" option won't exist and `Session.getActiveUser()` comes back empty for everyone.

1. Open the nominations Sheet → **Share** (top right) → look at who is marked **Owner**.
2. Owner is a fuhsd.org account → skip to section 3.
3. Owner is the personal Gmail → copy it into the school account:
   1. **Still signed in as the personal Gmail:** open the old Sheet → **Share** → add `amehta251@student.fuhsd.org` as **Viewer** (Viewer is enough) → **Send**. Without this, the school account gets "You need access" in the next step.
   2. Sign in as amehta251@student.fuhsd.org (use the account chooser, or an Incognito window to be sure).
   3. Open the old Sheet → **File → Make a copy** → name it `Homecoming Nominations` → **Make a copy**.
   4. The copy is now owned by the school account. Note its URL — this is THE Sheet from now on. Don't use the old one again.
   5. **Make a copy also copies the OLD bound Apps Script project.** In section 3 you will overwrite `Code.gs` and add `Index`; any other file in that project's Files list (extra `.gs` or `.html`) must be deleted (hover it → **⋮ → Delete**) so no old `doGet`/`doPost` survives to collide with the new code.
4. Confirm the copy has exactly these three tabs and headers (add/fix them if not):
   - `Config` — column A = key, column B = value. Rows: `open` (yes|no), `mode` (test|live), `cycle` (e.g. `Homecoming 2026`), `deadline` (free text, e.g. `Fri, Oct 3`). For today set `open` = `yes`, `mode` = `test`.
   - **`deadline` must be TEXT, not a date.** If Sheets auto-parses it as a Date cell, the page shows only `Fri, Oct 3` — the time (`at 3:00 PM`) is silently dropped (the server formats Date cells as `EEE, MMM d`). Either type it with a leading apostrophe (`'Fri, Oct 3 at 3:00 PM`) or select cell B and **Format → Number → Plain text** before typing.
   - `Nominations` — row 1 exactly: `Timestamp | Nominator Email | N1 First | N1 Last | N2 First | N2 Last | N3 First | N3 Last | N4 First | N4 Last`
   - `Test Submissions` — same row 1 as Nominations.
   Tab names are case-sensitive and must match exactly; the script finds tabs by name.
   - **Never hand-edit or hand-paste rows into column B (Nominator Email)** in either tab. The script matches a student's existing row on that column; a typo or pasted row means their resubmit creates a duplicate instead of replacing.

## 3. Install the code

1. In the Sheet: **Extensions → Apps Script**. A project opens (name it `Homecoming Nominations` via the title at top left).
2. In the left file list click `Code.gs`. Select all, delete, paste the full contents of `apps-script/homecoming-nominations.gs` from the repo.
3. Click **+** next to "Files" → **HTML** → name it exactly `Index` (capital I; Google adds `.html`). Select all in the new file, paste the full contents of `apps-script/homecoming-nominations.html`.
4. The Files list must now contain only `Code.gs` and `Index.html`. Delete anything else (see section 2, step 3.v).
5. **Ctrl/Cmd+S** to save both files. Fix any red error markers before continuing (usually a partial paste).
6. First run (authorize once): in the toolbar pick `getState` in the function dropdown → **Run**.
   - A dialog says "Authorization required" → **Review permissions** → pick amehta251@student.fuhsd.org.
   - You may see "Google hasn't verified this app" → **Advanced → Go to Homecoming Nominations (unsafe)**. It's your own script; this is normal.
   - It asks to see/edit your Google Sheets spreadsheets and "See your primary Google Account email address" → **Allow**. (No "external service" permission — the script never calls anything outside Google.)
   - This is YOU (the owner) authorizing the script to write to YOUR sheet. Students never see any of this — the script runs as you.
   - **Pass = the Execution log shows `Execution completed` with no red error.** The function's return value is NOT printed (Apps Script never logs return values), so don't look for `signedIn` there.
   - Optional, to actually see the value: paste this at the bottom of `Code.gs`, save, pick `debugState` in the dropdown → **Run**, read the Execution log (should show `"signedIn":true` and your email), then delete the helper and save again:
     ```js
     function debugState(){ Logger.log(JSON.stringify(getState())); }
     ```
   - Only a red error means something is wrong: a syntax error → the paste in step 2 or 3 was incomplete, redo it; an authorization error → **Run** again and pick the school account. (A wrong tab name does NOT error here — it shows up later: a misnamed `Config` makes the page say closed; a misnamed `Nominations`/`Test Submissions` fails test (a) with `no-tab`.)

## 4. Deploy TWICE (same code, two audiences)

**Deployment A — the FUHSD-only nomination page**

1. Top right **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Description: `FUHSD page`. Execute as: **Me (amehta251@student.fuhsd.org)**. Who has access: **Anyone within <your district>** — Google shows the district's full name here (e.g. "Anyone within Fremont Union High School District"), so don't panic if the word FUHSD isn't literally on screen; pick the option that names the district. If there is NO district-named option at all (only Only myself / Anyone with Google account / Anyone), the Sheet/script is not in the school account — go back to section 2.
4. **Deploy** → **Copy** the Web app URL. It ends in `/exec`. Save it as `homecomingNominationsPage`.

**Deployment B — the public config feed the website reads**

1. **Deploy → New deployment** again → gear → **Web app**.
2. Description: `Public config`. Execute as: **Me**. Who has access: **Anyone**.
3. **Deploy** → **Copy** the URL (ends in `/exec`). Save it as `homecomingNominationsApi`.

Notes:
- Both deployments run the exact same Code.gs + Index.html and read the same Config tab. Only the audience differs.
- Sanity check B now: open `<homecomingNominationsApi>?view=config` in an Incognito window. You should see JSON like `{"open":true,"mode":"test","cycle":"Homecoming 2026","deadline":"..."}`.
- **If you ever edit Code.gs or Index.html**, the live URLs won't change until you publish a new version — for **BOTH** deployments: **Deploy → Manage deployments → (pencil) Edit → Version: New version → Deploy**. The URLs stay the same.
- **Editing the Config tab never needs a redeploy.** Changes show within a few minutes (the site caches the config briefly).

## 5. Wire the site

1. In the repo open `src/data/sources.js` (near the bottom). The two exports do NOT start in the same state:
   - `homecomingNominationsPage` ships as `null` (with a `TODO(Abir)` comment above it). Replace `null` with Deployment A's URL **in quotes**.
   - `homecomingNominationsApi` already holds an OLDER real `/exec` URL. Overwrite that whole string with Deployment B's URL.
   After the edit it should read:
   ```js
   export const homecomingNominationsApi  = 'https://script.google.com/macros/s/.../exec'  // Deployment B (Anyone)
   export const homecomingNominationsPage = 'https://script.google.com/macros/s/.../exec'  // Deployment A (Anyone within <district>)
   ```
   Don't mix them up: Api = "Anyone", Page = "Anyone within <your district>".
   **Expected pre-wire state:** until the Page URL is pasted and Vercel has rebuilt, fremontasb.org/homecoming-court intentionally shows "Nominations will open here soon." in the hero and "Nominations aren’t connected yet. Check back soon." in the card, with no button. That is by design (nothing insecure is live), not a bug.
2. `git add src/data/sources.js` → `git commit -m "Homecoming nominations: wire deployment URLs"` → `git push origin main`.
3. Vercel auto-deploys in ~1–2 minutes (check the Vercel dashboard for the green check).
4. Open `https://fremontasb.org/homecoming-court`. With Config `open=yes` you should see the "Verified by your school account" card with a **Nominate now** button that opens Deployment A's URL.

## 6. Test matrix

Set Config `open=yes`, `mode=test` first. Use a second student account (a friend's, with them present) for the "real student" tests, or your own.

| # | Test | How | Pass looks like |
|---|------|-----|-----------------|
| a | Student can nominate | Signed in as a @student.fuhsd.org account, open fremontasb.org/homecoming-court → **Nominate now** → page loads, shows "Nominating as <that email>" → fill 2 nominees → **Submit nominations** (the button reads **Replace my picks** if that account already has a row) | Success screen listing the picks; ONE new row in **Test Submissions** with Timestamp + that email + names. No prompt asked for an email. |
| b | Resubmit replaces | Same account, click "Change my picks", change a name, submit again | The SAME row is updated (new Timestamp, new names, unused slots blank). Row count unchanged. |
| c | Personal Gmail blocked | In Incognito, sign in only to a personal @gmail.com and open the Page URL (Deployment A) | Google shows "You need access" / asks you to switch to a FUHSD account. Form never appears. |
| d | Closed gate | Set Config `open` = `no`. Reload fremontasb.org/homecoming-court (wait up to 5 min for cache) and reload the nomination page | Site shows the closed state (no button). Page shows "Nominations aren’t open right now." with no form; if you had the form open and submit anyway, the error reads "Nominations closed while you were filling this out." over "Nominations are not open right now." Set `open` back to `yes` after. |
| e | Mode picks the tab | With `mode` = `test` submit → check **Test Submissions**. Set `mode` = `live`, reload page, submit → check **Nominations**. Set back to `test`. | Each submission lands in the matching tab only. (While `mode=test`, both the nomination page and the site card show the "Test preview: not the real nominations" banner.) |
| f | Phone end-to-end | On an iPhone in Safari and on any phone in Chrome, signed in to a student account: site → Nominate now → submit | Layout fits the screen, inputs don't zoom, buttons are tappable, row appears. |
| g | Duplicate nominee | Enter the same person in slot 1 and slot 2 (any spacing/case) → Submit | The page blocks the submit itself under "Please fix the following:" with "You’ve listed <First Last> more than once (nominees 1 and 2). Each nominee must be a different senior." Nothing new in the sheet. (The server has its own copy of this check — "You listed … more than once. Each nominee can only appear one time." — you only see that one if the browser check is bypassed.) |
| h | Public URL can't submit | Incognito, no Google sign-in: open `<Api URL>?view=config` → JSON. Then open the Api URL without `?view=config` and try to submit | JSON returns fine. Page without the parameter shows "Sign in with your school account" with a **Use your school account** button and no form; any submit fails with `not-signed-in`. Nothing written. |

Any failure → section 8. After all pass, delete the test rows from **Test Submissions** (optional) and never touch **Nominations** by hand.

## 7. Go live Friday

1. Config tab: `open` = `yes`, `mode` = `live`, `deadline` = the real cutoff text (e.g. `Fri, Oct 3 at 3:00 PM`), `cycle` = `Homecoming 2026`. No redeploy needed.
2. Reload fremontasb.org/homecoming-court — button visible, no test banner on the nomination page.
3. Announce **the site link** (fremontasb.org/homecoming-court), not the raw script URL, so the explanation card shows first.
4. Closing: set `open` = `no` at the deadline. The site flips to closed within minutes; the page refuses submits immediately.

**How to tally.** The **Nominations** tab is already one row per student (resubmits overwrote in place), so every row counts once.
- Add a tab `Tally` and in A1 paste:
  `=QUERY({Nominations!C2:D; Nominations!E2:F; Nominations!G2:H; Nominations!I2:J}, "select Col1, Col2, count(Col1) where Col1 <> '' group by Col1, Col2 order by count(Col1) desc label count(Col1) 'Nominations'")`
  That stacks all four nominee slots into one list and counts each first+last pair.
- Or: **Insert → Pivot table** on that stacked list, or `=COUNTIF(Nominations!C:J, "Firstname")` for a quick spot check of one name.
- Merge near-duplicate spellings by hand ("Jon"/"Jonathan", extra spaces, nicknames) before announcing the court.

## 8. If something breaks

| Symptom | Cause | Fix |
|---------|-------|-----|
| A real student sees "Sign in with your school account" on the nomination page | Deployment A was made from the personal Gmail, or its access isn't **Anyone within <your district>**, or the site's `homecomingNominationsPage` was given the "Anyone" URL | Deploy → Manage deployments → check Deployment A's settings; confirm `sources.js` has the right URL in the right variable; if the script lives in the personal Gmail, redo section 2. |
| Site says "Nominations will open here soon." and the card says "Nominations aren’t connected yet. Check back soon." with no button | `homecomingNominationsPage` is still `null` in `sources.js`, the commit wasn't pushed, or Vercel hasn't finished rebuilding | Expected before section 5 is done. Confirm the Page URL is pasted in quotes, pushed to `main`, and the Vercel build is green; then hard-reload. |
| Site shows closed but Config says `open=yes` | Site is reading an old deployment URL, `?view=config` isn't being appended, or the site's 5-minute cache | Open `<Api URL>?view=config` in Incognito — if the JSON says `open:true`, wait 5 min and hard-reload. If it's wrong or errors, confirm the URL in `sources.js` and redeploy Deployment B as a new version. |
| Error "The nominations sheet is busy right now." (the server's "The server is busy right now. Please try again in a moment." appears beneath it) | Two submissions collided on the lock, or a transient Google hiccup | Just retry. If it persists for minutes, check the Apps Script **Executions** page for errors. |
| Error mentions a missing tab (`no-tab`) | A tab was renamed or deleted | Rename it back exactly: `Nominations`, `Test Submissions` (and `Config`). Case-sensitive. |
| Submit says success but nothing appears in the sheet | The script isn't bound to the Sheet the owner authorized (copied script, or the Sheet is owned by a different account than the deployment) | Open the script from **that** Sheet's Extensions → Apps Script, confirm it's the same project, re-run `getState` (section 3 step 6), publish a new version of both deployments. |
| Page shows the deadline without the time (just `Fri, Oct 3` instead of `Fri, Oct 3 at 3:00 PM`) | Config `deadline` cell was auto-parsed as a Date, so the server drops the time | Retype it as plain text (section 2, step 4). No redeploy. |
| A student's resubmit added a second row instead of replacing | Column B in that tab was hand-edited/pasted, or has a typo/space | Fix column B to the exact lowercase email; never hand-edit it (section 2, step 4). |

One more: after any Code.gs/Index.html change, test (a) again — a forgotten "New version" is the most common reason "nothing changed."
