// Public: latest Instagram posts for the website's "Follow Along" section.
// GET /api/instagram -> { username, posts:[{ id, type, image, caption, permalink, date }] }
// Env:
//   IG_TOKEN  (secret)  long-lived token from "Instagram API with Instagram Login" (instagram_business_basic).
//   SOCIAL    (KV, optional) lets this function refresh the token itself so it never hits its 60-day expiry.
// Without SOCIAL the token must be replaced by hand before it expires (every ~60 days).
// If anything fails the site hides the Instagram grid and keeps the Follow button.

const GRAPH = "https://graph.instagram.com";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const DAY = 86400000;

async function token(env) {
  if (!env.SOCIAL) return env.IG_TOKEN;
  const saved = await env.SOCIAL.get("ig_token", "json"); // { token, at }
  // A new IG_TOKEN secret wins over an older saved one.
  const cur = saved && saved.seed === env.IG_TOKEN ? saved : { token: env.IG_TOKEN, at: 0, seed: env.IG_TOKEN };
  // Refresh weekly. Instagram allows a refresh once the token is a day old and not yet expired.
  if (Date.now() - cur.at > 7 * DAY) {
    try {
      const r = await fetch(`${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cur.token)}`);
      if (r.ok) {
        const j = await r.json();
        if (j.access_token) { cur.token = j.access_token; cur.at = Date.now(); await env.SOCIAL.put("ig_token", JSON.stringify(cur)); }
      } else if (!cur.at) {
        // Brand-new token (under a day old) can't be refreshed yet; try again tomorrow.
        cur.at = Date.now() - 6 * DAY; await env.SOCIAL.put("ig_token", JSON.stringify(cur));
      }
    } catch (e) { /* keep using the current token */ }
  }
  return cur.token;
}

export async function onRequestGet({ env, request, waitUntil }) {
  if (!env.IG_TOKEN) return Response.json({ error: "not configured" }, { status: 503 });
  const cache = caches.default;
  const key = new Request(new URL("/api/instagram", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const t = await token(env);
    const [me, media] = await Promise.all([
      fetch(`${GRAPH}/me?fields=username&access_token=${encodeURIComponent(t)}`).then(r => r.ok ? r.json() : {}),
      fetch(`${GRAPH}/me/media?fields=${FIELDS}&limit=9&access_token=${encodeURIComponent(t)}`)
        .then(r => { if (!r.ok) throw new Error(`Instagram ${r.status}`); return r.json(); }),
    ]);
    const posts = (media.data || []).map(m => ({
      id: m.id,
      type: m.media_type, // IMAGE, VIDEO or CAROUSEL_ALBUM
      image: m.media_type === "VIDEO" ? (m.thumbnail_url || "") : (m.media_url || ""),
      caption: String(m.caption || "").slice(0, 300),
      permalink: m.permalink || "",
      date: m.timestamp || "",
    })).filter(p => p.image && p.permalink);
    // Cache 30 minutes so the site doesn't call Instagram on every page view.
    const res = Response.json({ username: me.username || "", posts }, { headers: { "cache-control": "public, max-age=1800" } });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
