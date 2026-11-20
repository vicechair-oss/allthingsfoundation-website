// Public: published events and approved photos/videos for the website.
// GET /api/events -> { upcoming:[...], past:[...], gallery:[...], shorts:[...] }
// Env: AIRTABLE_TOKEN (read access to the ATF Operations base), OPS_BASE_ID.
// Only Published + Show on Website events and Approved media are returned. Staff fields are never sent.

const TZ = "America/New_York";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

async function all(env, table) {
  const out = []; let offset = "";
  do {
    const qs = new URLSearchParams({ pageSize: "100", ...(offset ? { offset } : {}) });
    const r = await fetch(`https://api.airtable.com/v0/${env.OPS_BASE_ID}/${encodeURIComponent(table)}?${qs}`,
      { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!r.ok) throw new Error(`Airtable ${r.status}`);
    const j = await r.json();
    out.push(...j.records); offset = j.offset || "";
  } while (offset);
  return out;
}

const mediaUrl = key => `/media/${String(key).replace(/^public\//, "")}`;

export async function onRequestGet({ env }) {
  if (!env.AIRTABLE_TOKEN || !env.OPS_BASE_ID) return Response.json({ error: "not configured" }, { status: 503 });
  try {
    const [evs, media] = await Promise.all([all(env, "Events"), all(env, "Event Media")]);
    const byEvent = {}, gallery = [], shorts = [];
    const evName = Object.fromEntries(evs.map(e => [e.id, e.fields["Name"] || ""]));
    const evDate = Object.fromEntries(evs.map(e => [e.id, e.fields["Date"] || ""]));
    const evSlug = Object.fromEntries(evs.map(e => [e.id, e.fields["Slug"] || e.id]));
    const live = new Set(evs.filter(e => e.fields["Status"] === "Published" && e.fields["Show on Website"]).map(e => e.id));
    for (const m of media) {
      const f = m.fields; const ev = (f["Event"] || [])[0];
      if (f["Status"] !== "Approved") continue;
      const kind = f["Kind"] || "Photo";
      // Shorts can stand alone; everything else needs a published event.
      if (kind === "Short" || kind === "YouTube Short") {
        if (kind === "Short" && !String(f["Storage Key"] || "").startsWith("public/")) continue;
        shorts.push({ id: m.id, kind, caption: f["Caption"] || "", src: kind === "Short" ? mediaUrl(f["Storage Key"]) : f["YouTube URL"],
          event: live.has(ev) ? evSlug[ev] : "", eventName: live.has(ev) ? evName[ev] : "", created: m.createdTime });
        continue;
      }
      if (!live.has(ev)) continue;
      if (kind !== "YouTube" && !String(f["Storage Key"] || "").startsWith("public/")) continue;
      const item = { id: m.id, kind, caption: f["Caption"] || "", credit: f["Credit"] || "",
        src: kind === "YouTube" ? f["YouTube URL"] : mediaUrl(f["Storage Key"]),
        event: evSlug[ev], eventName: evName[ev], eventDate: evDate[ev], created: m.createdTime };
      (byEvent[ev] = byEvent[ev] || []).push(item);
      if (f["In Gallery"]) gallery.push(item);
    }
    const t = today(), upcoming = [], past = [];
    for (const e of evs) {
      if (!live.has(e.id)) continue;
      const f = e.fields;
      const last = f["End Date"] || f["Date"] || "";
      const ev = {
        slug: f["Slug"] || e.id, name: f["Name"] || "", type: f["Type"] || "", label: f["Label"] || "",
        description: f["Description"] || "", recap: f["Recap"] || "", date: f["Date"] || "", endDate: f["End Date"] || "",
        start: f["Start Time"] || "", end: f["End Time"] || "", venue: f["Venue"] || "", address: f["Address"] || "",
        details: String(f["Details"] || "").split("\n").map(l => l.split(/:\s*/)).filter(p => p.length > 1 && p[0].trim())
          .map(([k, ...v]) => [k.trim(), v.join(": ").trim()]),
        button: f["Button"] || "No button", buttonText: f["Button Text"] || "", buttonLink: f["Button Link"] || "",
        logo: f["Logo Key"] || "", accent: f["Accent"] || "Red", featured: !!f["Featured"],
        media: (byEvent[e.id] || []).sort((a, b) => a.created.localeCompare(b.created)),
      };
      const isPast = f["Auto Past"] !== false && last && last < t;
      (isPast ? past : upcoming).push(ev);
    }
    upcoming.sort((a, b) => (b.featured - a.featured) || a.date.localeCompare(b.date));
    past.sort((a, b) => b.date.localeCompare(a.date));
    shorts.sort((a, b) => b.created.localeCompare(a.created));
    gallery.sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.created.localeCompare(a.created));
    return Response.json({ upcoming, past, gallery, shorts }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (e) {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
