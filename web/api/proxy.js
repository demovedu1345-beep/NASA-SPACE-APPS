const BACKEND_ORIGIN = "https://vanrakshak-ai-scu6.onrender.com";
const BLOCKED_REQUEST_HEADERS = new Set([
  "host", "connection", "content-length", "transfer-encoding", "accept-encoding"
]);
const BLOCKED_RESPONSE_HEADERS = new Set([
  "connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length"
]);

module.exports = async function handler(req, res) {
  const rawPath = req.query && req.query.__proxy_path;
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");

  // Only forward valid relative API paths; do not accept arbitrary upstream URLs.
  const segments = path.split("/");
  if (!path || segments.some(part => !part || part === "." || part === ".." || !/^[A-Za-z0-9._~-]+$/.test(part))) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Invalid API path" }));
    return;
  }

  const upstreamUrl = new URL("/api/" + segments.map(encodeURIComponent).join("/"), BACKEND_ORIGIN);
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "__proxy_path" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      upstreamUrl.searchParams.append(key, String(item));
    }
  }

  const method = String(req.method || "GET").toUpperCase();
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    const lower = key.toLowerCase();
    if (BLOCKED_REQUEST_HEADERS.has(lower) || value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }

  let body;
  if (!["GET", "HEAD"].includes(method) && req.body !== undefined) {
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(55000)
    });

    res.statusCode = upstream.status;
    for (const [key, value] of upstream.headers.entries()) {
      if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
    }
    if (!res.hasHeader("cache-control")) res.setHeader("cache-control", "no-store");
    if (method === "HEAD") {
      res.end();
      return;
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.end(payload);
  } catch (error) {
    console.error("API proxy request failed", {
      path,
      method,
      name: error && error.name
    });
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({
      ok: false,
      error: "The data service could not be reached. Retry shortly."
    }));
  }
};
