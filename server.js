import { serve } from "bun";
import { extname, join, normalize, relative } from "node:path";
import { handleArea, handleOverpassHealth, OVERPASS_ENDPOINTS, OVERPASS_TIMEOUT_MS } from "./world/api.js";

const PORT = Number(process.env.PORT) || 3000;
const DEAR_CONGRESS_URL = process.env.DEAR_CONGRESS_URL || "https://dear-congress.fly.dev/api";

const notFound = () => new Response("Not found", { status: 404 });

function handleConfig() {
  return Response.json({
    source: "runtime-config",
    generatedAt: new Date().toISOString(),
    config: {
      port: PORT,
      overpass: {
        endpoints: OVERPASS_ENDPOINTS,
        timeoutMs: OVERPASS_TIMEOUT_MS,
      },
      dearCongress: {
        baseUrl: DEAR_CONGRESS_URL,
      },
    },
  }, {
    headers: { "cache-control": "no-store" },
  });
}

// Serve one file, or 404.
async function serveFile(path) {
  const file = Bun.file(path);
  return (await file.exists()) ? new Response(file) : notFound();
}

// Serve a folder under a URL prefix:
//   /prefix          → root/index.html
//   /prefix/a/b.js   → root/a/b.js
//   /prefix/page     → root/page.html (clean URLs, e.g. Observable output)
// Paths that try to escape the folder (../) are refused.
async function serveStatic(prefix, root, pathname) {
  root = normalize(root);
  let rel;
  try {
    rel = decodeURIComponent(pathname.slice(prefix.length).replace(/^\/+/, ""));
  } catch {
    return notFound(); // malformed %-encoding
  }
  if (rel === "" || rel.endsWith("/")) rel += "index.html";

  const filePath = normalize(join(root, rel));
  if (relative(root, filePath).startsWith("..")) return notFound();

  const file = Bun.file(filePath);
  if (await file.exists()) return new Response(file);
  if (!extname(filePath)) return serveFile(filePath + ".html");
  return notFound();
}

// Does this path belong to /prefix (exactly, or something under it)?
const under = (pathname, prefix) => pathname === prefix || pathname.startsWith(prefix + "/");

async function proxyDearCongress(request) {
  const url = new URL(request.url);
  const raw = url.pathname.replace(/^\/api\/dear-congress/, "");
  const remainder = raw.replace(/^\/+/, "") || "packages";
  const base = DEAR_CONGRESS_URL.endsWith("/") ? DEAR_CONGRESS_URL : DEAR_CONGRESS_URL + "/";
  const upstream = new URL(remainder + url.search, base);
  try {
    const res = await fetch(upstream, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "HappyBearLandia/0.1 (+https://happybearlandia.fly.dev)",
      },
      signal: AbortSignal.timeout(8000),
    });

    // Dear-congress may not expose all guessed paths; return empty package list instead of browser 404 noise.
    if (res.status === 404) {
      return Response.json({ packages: [], error: `dear-congress route not found: ${upstream.pathname}` }, {
        status: 200,
        headers: { "cache-control": "no-store" },
      });
    }

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: `dear-congress proxy failed: ${String(err?.message || err)}` }, { status: 502 });
  }
}

const server = serve({
  port: PORT,

  async fetch(request, server) {
    const { pathname } = new URL(request.url);

    // Multiplayer WebSocket for /game
    if (pathname === "/ws") {
      if (server.upgrade(request)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Home
    if (pathname === "/") return serveFile("./index.html");
    if (pathname === "/favicon.ico") return new Response(null, { status: 204 });

    // Twitch plays robot (short URL kept for old links)
    if (pathname === "/twitch-plays-robot") return serveFile("./tools/twitch-plays-robot.html");

    // Tools: /tools/scene-reconstruction, /tools/twitch-plays-robot
    if (under(pathname, "/tools")) return serveStatic("/tools", "./tools", pathname);

    // Jolt physics music game
    if (under(pathname, "/game")) return serveStatic("/game", "./game", pathname);

    // Synthetic world: /world?lat=29.7286&lng=-95.4746
    if (pathname === "/api/area") {
      try {
        return await handleArea(new URL(request.url));
      } catch (err) {
        const msg = String(err?.message || err);
        console.error(`[world] /api/area unhandled error: ${msg}`);
        return Response.json({ source: "none", error: `area handler crashed: ${msg}` }, { status: 200 });
      }
    }
    if (pathname === "/api/overpass-health") return handleOverpassHealth();
    if (pathname === "/api/config") return handleConfig();
    if (under(pathname, "/api/dear-congress")) return proxyDearCongress(request);
    if (under(pathname, "/world")) {
      if (pathname.endsWith("/api.js")) return notFound(); // server-only code
      return serveStatic("/world", "./world", pathname);
    }

    // Blog: Observable Framework build output (cd blog && npm run build)
    if (under(pathname, "/blog")) return serveStatic("/blog", "./blog/dist", pathname);

    return notFound();
  },

  websocket: {
    open(ws) {
      console.log("Player connected");
      ws.subscribe("game");
      server.publish("game", JSON.stringify({ type: "playerJoined" }));
    },

    message(ws, message) {
      let msg;
      try {
        msg = JSON.parse(message.toString());
      } catch {
        console.warn("Received invalid JSON");
        return;
      }
      // Broadcast to all OTHER clients subscribed to "game"
      ws.publish("game", JSON.stringify(msg));
    },

    close(ws) {
      console.log("Player disconnected");
      ws.publish("game", JSON.stringify({ type: "playerLeft" }));
    },
  },
});

console.log(`HappyBearLandia running at http://localhost:${server.port}`);
console.log(`  /game   http://localhost:${server.port}/game`);
console.log(`  /world  http://localhost:${server.port}/world?lat=29.7286&lng=-95.4746`);
console.log(`  /tools  http://localhost:${server.port}/tools/scene-reconstruction`);
console.log(`  /blog   http://localhost:${server.port}/blog (after building blog/)`);
console.log(`  ws      ws://localhost:${server.port}/ws`);
console.log(`  overpass ${OVERPASS_ENDPOINTS.join(" | ")} (timeout ${OVERPASS_TIMEOUT_MS}ms)`);
console.log(`  dear-congress proxy base ${DEAR_CONGRESS_URL}`);
