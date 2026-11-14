// Planning Applications Simplified: a small proxy that lets the public page call Claude
// without exposing your Anthropic API key. Deployed as a Cloudflare Worker.
//
// Settings (see README):
//   ANTHROPIC_API_KEY  secret, your key
//   ALLOWED_ORIGINS    comma-separated list of sites allowed to call this, e.g. https://your-name.github.io
//   MODEL              optional, defaults to claude-sonnet-5-5
//   LIMITER            optional rate-limit binding (see wrangler.toml)

const MAX_PROMPT_BYTES = 300000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": okOrigin ? origin : (allowed[0] || ""),
      "Vary": "Origin"
    };
    const reply = (status, message) =>
      new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" }
      });
    }
    if (request.method !== "POST") return reply(405, "POST only");
    if (!okOrigin) return reply(403, "This site isn't allowed to use this service.");
    if (!env.ANTHROPIC_API_KEY) return reply(500, "Not configured.");

    if (env.LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return reply(429, "Too many requests. Try again in a minute.");
    }

    if ((Number(request.headers.get("Content-Length")) || 0) > MAX_PROMPT_BYTES + 5000) return reply(413, "Too large.");
    let body;
    try { body = await request.json(); } catch { return reply(400, "Bad request."); }
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    if (!prompt) return reply(400, "Bad request.");
    if (new TextEncoder().encode(prompt).length > MAX_PROMPT_BYTES) return reply(413, "Too large.");

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: env.MODEL || "claude-sonnet-5-5",
          max_tokens: 16000,
          stream: true,
          messages: [{ role: "user", content: prompt }]
        })
      });
    } catch { return reply(502, "Couldn't reach Claude."); }

    if (!upstream.ok) return reply(upstream.status === 429 ? 429 : 502, "Claude couldn't answer right now.");
    // pass the stream straight through; nothing is stored or logged
    return new Response(upstream.body, {
      status: 200,
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-store" }
    });
  }
};
