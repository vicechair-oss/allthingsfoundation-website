# All Things Foundation website

Single page (`index.html`) with #hash tabs, plus two Pages Functions:

- `functions/api/events.js` reads published events and approved photos from the ATF Operations base in Airtable.
  Upcoming, Past Events, photo strips on event cards, and the Gallery all render from it.
  If it fails, the static cards in `index.html` stay up.
- `functions/media/[[path]].js` serves approved files from the R2 bucket (only the `public/` prefix).
- `functions/api/instagram.js` returns the 9 latest Instagram posts for the Home page "Follow Along" section (cached 30 min).
  If it isn't set up or fails, the section shows only the Follow button.

Facebook in "Follow Along" uses Meta's free Page plugin. Put the Page's address in `data-page` on `#fb-card` in `index.html`; the card stays hidden until then.

Cloudflare settings for this Pages project:
- Variable `OPS_BASE_ID` = `apptO5kk42533Siyp`
- Secret `AIRTABLE_TOKEN` = a **read-only** token (`data.records:read` on the ATF Operations base only). Use a separate token from the staff portal.
- R2 binding `MEDIA` = bucket `atf-media` (same bucket as the staff portal).
- Secret `IG_TOKEN` = long-lived Instagram token (Instagram API with Instagram Login, `instagram_business_basic`). The Instagram account must be a professional (Business or Creator) account.
- KV binding `SOCIAL` (optional, recommended) = any KV namespace. With it the function refreshes the token weekly by itself. Without it, replace `IG_TOKEN` before it expires every 60 days.

Events are managed in the staff portal Events tab.
