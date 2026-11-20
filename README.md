# All Things Foundation website

Single page (`index.html`) with #hash tabs, plus two Pages Functions:

- `functions/api/events.js` reads published events and approved photos from the ATF Operations base in Airtable.
  Upcoming, Past Events, photo strips on event cards, and the Gallery all render from it.
  If it fails, the static cards in `index.html` stay up.
- `functions/media/[[path]].js` serves approved files from the R2 bucket (only the `public/` prefix).

Cloudflare settings for this Pages project:
- Variable `OPS_BASE_ID` = `apptO5kk42533Siyp`
- Secret `AIRTABLE_TOKEN` = a **read-only** token (`data.records:read` on the ATF Operations base only). Use a separate token from the staff portal.
- R2 binding `MEDIA` = bucket `atf-media` (same bucket as the staff portal).

Events are managed in the staff portal Events tab.
