// Public: serve approved photos and videos from R2 (binding MEDIA). Only the public/ prefix is reachable.
export async function onRequestGet({ request, env, params }) {
  if (!env.MEDIA) return new Response("Not found", { status: 404 });
  const rel = (params.path || []).join("/");
  if (!/^[a-z0-9-]+\/[a-zA-Z0-9._-]+$/.test(rel)) return new Response("Not found", { status: 404 });
  const range = request.headers.get("range");
  const obj = await env.MEDIA.get(`public/${rel}`, range ? { range: request.headers } : undefined);
  if (!obj) return new Response("Not found", { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("cache-control", "public, max-age=86400");
  h.set("accept-ranges", "bytes");
  if (range && obj.range) {
    const { offset = 0, length = obj.size - offset } = obj.range;
    h.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    h.set("content-length", String(length));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set("content-length", String(obj.size));
  return new Response(obj.body, { headers: h });
}
