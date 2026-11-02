import { serve } from "bun";
import { readdir } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { getArea, handleArea, handleOverpassHealth, OVERPASS_ENDPOINTS, OVERPASS_TIMEOUT_MS } from "./world/api.js";
import { createExperimentsHandler } from "./world/experiments-api.js";
import { buildCivicExperiment } from "./world/civic-experiment.js";

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

const SCENE_ROOT = normalize("./game/scene");
const GAME_CONVERSATIONS_ROOT = normalize("./game/conversations");
const SCREENSHOT_ROOT = normalize("./data/screenshots");

async function collectSceneIds(absDir, prefix = "") {
  const entries = await readdir(absDir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(prefix + entry.name.replace(/\.json$/i, ""));
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await collectSceneIds(join(absDir, entry.name), `${prefix}${entry.name}/`);
      out.push(...nested);
    }
  }
  return out;
}

async function handleScenes() {
  try {
    const ids = (await collectSceneIds(SCENE_ROOT)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return Response.json({
      scenes: ids.map((id) => ({
        id,
        name: `${id}.json`,
        url: `/game/scene/${id}.json`,
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ error: `failed to list scenes: ${String(err?.message || err)}` }, { status: 500 });
  }
}

async function handleSceneById(pathname) {
  const id = decodeURIComponent(pathname.slice("/api/scenes/".length)).replace(/^\/+/, "");
  if (!id) return Response.json({ error: "scene id is required" }, { status: 400 });

  const filePath = normalize(join(SCENE_ROOT, `${id}.json`));
  if (relative(SCENE_ROOT, filePath).startsWith("..")) return notFound();

  const file = Bun.file(filePath);
  if (!(await file.exists())) return notFound();
  return new Response(file, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function handleScreenshots(url) {
  const rawLimit = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(1000, Math.floor(rawLimit))) : 100;
  try {
    const entries = await readdir(SCREENSHOT_ROOT, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && /\.(gif|png|jpe?g|webp)$/i.test(e.name))
      .map((e) => ({
        name: e.name,
        url: `/data/screenshots/${encodeURIComponent(e.name)}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .slice(0, limit);

    return Response.json({ files }, { headers: { "cache-control": "no-store" } });
  } catch {
    // Keep /game usable even when screenshot directory is absent.
    return Response.json({ files: [] }, { headers: { "cache-control": "no-store" } });
  }
}

async function handleGameConversation(pathname) {
  const rel = decodeURIComponent(pathname.slice("/game/conversations/".length)).replace(/^\/+/, "");
  if (!rel || !rel.endsWith(".json")) return notFound();

  const filePath = normalize(join(GAME_CONVERSATIONS_ROOT, rel));
  if (relative(GAME_CONVERSATIONS_ROOT, filePath).startsWith("..")) return notFound();

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return Response.json({ npcs: [] }, { headers: { "cache-control": "no-store" } });
  }

  return new Response(file, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
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

async function handleOutcomes() {
  const base = DEAR_CONGRESS_URL.endsWith("/") ? DEAR_CONGRESS_URL : DEAR_CONGRESS_URL + "/";
  const upstream = new URL("outcomes", base);
  try {
    const res = await fetch(upstream, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "HappyBearLandia/0.1 (+https://happybearlandia.fly.dev)",
      },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: `outcomes proxy failed: ${String(err?.message || err)}` }, { status: 502 });
  }
}

async function handlePlan(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Use POST /api/plan" }, { status: 405, headers: { allow: "POST" } });
  }

  const base = DEAR_CONGRESS_URL.endsWith("/") ? DEAR_CONGRESS_URL : DEAR_CONGRESS_URL + "/";
  const upstream = new URL("synthesize", base);

  let body = "{}";
  try {
    const raw = await request.text();
    if (raw && raw.trim()) body = raw;
  } catch {
    body = "{}";
  }

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "HappyBearLandia/0.1 (+https://happybearlandia.fly.dev)",
      },
      body,
      signal: AbortSignal.timeout(12000),
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json; charset=utf-8";

    // Preserve upstream errors exactly as Dear Congress returned them.
    if (!res.ok) {
      return new Response(text, {
        status: res.status,
        headers: { "content-type": contentType, "cache-control": "no-store" },
      });
    }

    // Feature 1: turn the synthesized plan into the shared, versioned contract
    // consumed by HBL now and Digital Pensieve later. If Dear Congress ever
    // returns non-JSON, fall back to the old transparent proxy behavior.
    let synthesis;
    try {
      synthesis = JSON.parse(text);
    } catch {
      return new Response(text, {
        status: res.status,
        headers: { "content-type": contentType, "cache-control": "no-store" },
      });
    }

    let requestPayload = {};
    try {
      requestPayload = JSON.parse(body);
    } catch {
      // The upstream already accepted the body, so a local parse failure should
      // not turn a successful synthesis into an error.
    }

    const civicExperiment = buildCivicExperiment(synthesis, requestPayload);
    const payload = synthesis && typeof synthesis === "object" && !Array.isArray(synthesis)
      ? { ...synthesis, civicExperiment }
      : { synthesis, civicExperiment };

    return Response.json(payload, {
      status: res.status,
      headers: {
        "cache-control": "no-store",
        "x-hbl-civic-experiment": "civic-experiment.v1",
      },
    });
  } catch (err) {
    return Response.json({ error: `plan synthesize failed: ${String(err?.message || err)}` }, { status: 502 });
  }
}

async function handlePublishDraft(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Use POST /api/publish_draft" }, { status: 405, headers: { allow: "POST" } });
  }

  const base = DEAR_CONGRESS_URL.endsWith("/") ? DEAR_CONGRESS_URL : DEAR_CONGRESS_URL + "/";
  const upstream = new URL("publish_draft", base);

  const body = await request.text();
  const voterId = request.headers.get("x-voter-id");

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/json",
        accept: "application/json",
        "user-agent": "HappyBearLandia/0.1 (+https://happybearlandia.fly.dev)",
        ...(voterId ? { "x-voter-id": voterId } : {}),
      },
      body,
      signal: AbortSignal.timeout(12000),
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: `publish_draft failed: ${String(err?.message || err)}` }, { status: 502 });
  }
}

async function fetchPlanFromDearCongress(body) {
  const base = DEAR_CONGRESS_URL.endsWith("/") ? DEAR_CONGRESS_URL : DEAR_CONGRESS_URL + "/";
  const res = await fetch(new URL("synthesize", base), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "HappyBearLandia/0.1 (+https://happybearlandia.fly.dev)",
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`dear-congress synthesize HTTP ${res.status}`);
  return await res.json();
}

const handleExperiments = createExperimentsHandler({ fetchPlan: fetchPlanFromDearCongress, getArea });

const server = serve({
  port: PORT,

  async fetch(request, server) {
    const { pathname } = new URL(request.url);

    // Multiplayer WebSocket for /game
    if (pathname === "/ws") {
      if (server.upgrade(request)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Home → world
    if (pathname === "/") {
      return Response.redirect(`/world?lat=29.7286&lng=-95.4746`, 302);
    }
    if (pathname === "/favicon.ico") return new Response(null, { status: 204 });

    // Twitch plays robot (short URL kept for old links)
    if (pathname === "/twitch-plays-robot") return serveFile("./tools/twitch-plays-robot.html");

    // Tools: /tools/scene-reconstruction, /tools/twitch-plays-robot
    if (under(pathname, "/tools")) return serveStatic("/tools", "./tools", pathname);

    // Game media/assets
    if (under(pathname, "/data/screenshots")) return serveStatic("/data/screenshots", "./data/screenshots", pathname);
    if (under(pathname, "/data")) return serveStatic("/data", "./data", pathname);

    // Jolt physics music game (SPA-style routes like /game/1 should fall back to game/index.html)
    if (pathname.startsWith("/game/conversations/")) return handleGameConversation(pathname);
    if (under(pathname, "/game")) {
      const res = await serveStatic("/game", "./game", pathname);
      if (res.status === 404 && !extname(pathname)) return serveFile("./game/index.html");
      return res;
    }

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
    if (under(pathname, "/api/world/experiments")) return handleExperiments(request);
    if (pathname === "/api/plan") return handlePlan(request);
    if (pathname === "/api/outcomes") return handleOutcomes();
    if (pathname === "/api/publish_draft") return handlePublishDraft(request);
    if (pathname === "/api/scenes") return handleScenes();
    if (pathname.startsWith("/api/scenes/")) return handleSceneById(pathname);
    if (pathname === "/api/screenshots") return handleScreenshots(new URL(request.url));
    if (under(pathname, "/api/dear-congress")) return proxyDearCongress(request);
    if (under(pathname, "/world")) {
      if (pathname.endsWith("/api.js") || pathname.endsWith("-api.js")) return notFound(); // server-only code
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
