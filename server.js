import { withUniverseNavigation } from './world/universe/html-navigation.js';
import {createCausalityHandler} from './world/causality/api.js';
import {createReleaseHealthHandler,initializeReleaseStorage} from './ops/release-health.js';
const releaseStorage=initializeReleaseStorage();
const handleReleaseHealth=createReleaseHealthHandler(releaseStorage);
const handleCausality=createCausalityHandler({dbPath:releaseStorage.worldDbPath});
import {createActNormalService} from './world/party/act-normal-server.js';
const actNormalService=createActNormalService();
import {loadLocalOpenAISettings} from './world/ai/local-settings.js';
loadLocalOpenAISettings();
import {createDateMysteryHandler} from './world/date/mystery-api.js';
const handleDateMystery=createDateMysteryHandler();
import {createDatePlacesHandler} from './world/house/date-drive-search.js';
const handleDatePlaces=createDatePlacesHandler();
import {createWorldPersistenceHandler,EXPERIMENT_MAX_BYTES} from './world/experiments/persistence-api.js';
const handleWorldPersistence=createWorldPersistenceHandler({dbPath:releaseStorage.worldDbPath});
import {createRealityShareHandler} from './world/reality/share-api.js';
import {createOpenQuestionsHandler} from './world/questions/api.js';
const handleRealityShares=createRealityShareHandler();
const handleOpenQuestions=createOpenQuestionsHandler();
import {createTemporalCityHandler} from './world/temporal/api.js';
const handleTemporalCity=createTemporalCityHandler();
import {createCharacterJournalsHandler} from './world/journals/api.js';
const handleCharacterJournals=createCharacterJournalsHandler({root:process.env.HBL_JOURNAL_ROOT||'.hbl-city'});
import {createConstitutionSourceHandler} from './world/constitution-city/source-api.js';
import {createEconomyRecordsHandler} from './world/economy-records-api.js';
const handleEconomyRecords=createEconomyRecordsHandler();
import { handleConstitutionSummary } from './world/constitution-summary-api.js';
import { serve } from "bun";
import { readdir } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { getArea, handleArea, handleAreaEnrichment, handleOverpassHealth, OVERPASS_ENDPOINTS, OVERPASS_TIMEOUT_MS } from "./world/api.js";
import { createExperimentsHandler } from "./world/experiments-api.js";
import { buildPlanApiPayload } from "./world/plan-response.js";
import { handlePlanParameterPatch } from "./world/plan-parameter-api.js";
import { createServerCivicApiHandler } from "./world/server-civic-api.js";
import { createDecisionExperimentsHandler } from "./world/decision/api.js";
import { createWorldEditApiHandler } from "./world/ai/provider-api.js";
import { createOptimizationApiHandler } from "./world/decision/optimization-api.js";

import { createBusinessCompilerHandler } from "./world/models/business-v1/compiler-api.js";
const handleBusinessCompiler = createBusinessCompilerHandler();

const PORT = Number(process.env.PORT) || 3000;
const DEAR_CONGRESS_URL = process.env.DEAR_CONGRESS_URL || "https://dear-congress.fly.dev/api";

const notFound = () => new Response("Not found", { status: 404 });

// Compile JSX and bundle React from the installed lockfile on request so local
// edits take effect on reload. Keep the game engine as native browser modules.
async function serveGameBundle() {
  const result = await Bun.build({
    entrypoints: ["./game/main.jsx"],
    target: "browser",
    external: ["/game/index.js"],
  });
  if (!result.success) {
    console.error("Game bundle failed", ...result.logs);
    return new Response("Unable to build game", { status: 500 });
  }
  return new Response(result.outputs[0], {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" },
  });
}
const handleServerCivicApi = createServerCivicApiHandler();
const handleDecisionExperiments = createDecisionExperimentsHandler();
const handleWorldEdits = createWorldEditApiHandler();
const handleOptimizations = createOptimizationApiHandler();

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
  return (await file.exists()) ? withUniverseNavigation(new Response(file, { headers: path.startsWith("./world/") ? { "cache-control": "no-cache" } : {} }), path) : notFound();
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
  if (await file.exists()) return withUniverseNavigation(new Response(file, { headers: prefix === "/world" ? { "cache-control": "no-cache" } : {} }), filePath);
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

    // Dear Congress can return either a single object or an array of candidate
    // plans. Always return one stable HBL object envelope so clients can rely on
    // payload.civicExperiment regardless of the upstream response shape.
    const payload = buildPlanApiPayload(synthesis, requestPayload);

    return Response.json(payload, {
      status: res.status,
      headers: {
        "cache-control": "no-store",
        "x-hbl-civic-experiment": "civic-experiment.v1",
        "x-hbl-plan-response": "hbl-plan-response.v1",
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
const handleConstitutionSource = createConstitutionSourceHandler({fetchPlan:()=>fetchPlanFromDearCongress({includeSynthetic:false}),sourceUrl:new URL(DEAR_CONGRESS_URL).origin+'/'});

const server = serve({
  maxRequestBodySize:EXPERIMENT_MAX_BYTES,
  port: PORT,

  async fetch(request, server) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/health" || pathname === "/api/ready") return handleReleaseHealth(request);
    if(pathname.startsWith('/api/act-normal/'))return actNormalService.fetch(request,server);
    if(/^\/world\/party\/act-normal\/?$/.test(pathname))return serveFile('./world/party/act-normal.html');

    if (pathname === "/api/character-journals") return handleCharacterJournals(request);
    if (pathname === "/api/economy-records") return handleEconomyRecords(request);
    if (pathname === "/world/economy-records" || pathname === "/world/economy-records/") return serveFile("./world/economy-records.html");

    // Multiplayer WebSocket for /game
    if (pathname === "/ws") {
      if (server.upgrade(request)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (/^\/world\/bench\/(aerial-city|downtown|construction|rush-hour|night|rain)\/?$/.test(pathname)) return serveFile("./world/index.html");

    // Population benchmark is an explicit worker workload, separate from renderer scenes.
    if (pathname === "/world/bench/people" || pathname === "/world/bench/people/") return serveFile("./world/people-benchmark.html");

    if (pathname.replace(/\/$/, "") === "/routes") return serveFile("./routes.html");
    // Public landing page
    if (pathname === "/" || pathname === "/index.html") {
      return serveFile("./index.html");
    }
    if (pathname === "/favicon.ico") return new Response(null, { status: 204 });
    // This Jolt distribution embeds its WASM; no CDN or separate WASM fetch is needed.
    if (pathname === "/vendor/jolt/jolt-physics.wasm-compat.js") return serveFile("./node_modules/jolt-physics/dist/jolt-physics.wasm-compat.js");
    // Curated local Three modules for the building workspace. No general
    // node_modules serving. Addons are ESM and use the page's `three` import map.
    if (under(pathname, "/vendor/three")) {
      let vendorPath;
      try { vendorPath = normalize(decodeURIComponent(pathname)); } catch { return notFound(); }
      if (["/vendor/three/three.module.js", "/vendor/three/three.core.js", "/vendor/three/three.webgpu.js", "/vendor/three/three.tsl.js"].includes(vendorPath)) return serveFile(`./node_modules/three/build/${vendorPath.split("/").at(-1)}`);
      if (vendorPath.startsWith("/vendor/three/addons/") && vendorPath.endsWith(".js")) return serveStatic("/vendor/three/addons", "./node_modules/three/examples/jsm", vendorPath);
      return notFound();
    }

    // Browser-safe universe wire contracts; keep server-only shared modules private.
    if (pathname === "/shared/causality/index.js") return serveFile("./shared/causality/index.js");
    if (under(pathname, "/visualizations")) return serveStatic("/visualizations", "./visualizations", pathname);

    // Twitch plays robot (short URL kept for old links)
    if (pathname === "/twitch-plays-robot") return serveFile("./tools/twitch-plays-robot.html");

    // Tools: /tools/scene-reconstruction, /tools/twitch-plays-robot
    if (pathname === "/tools/simulation-health") return serveFile("./tools/simulation-health/index.html");
    if (under(pathname, "/tools")) return serveStatic("/tools", "./tools", pathname);

    // Game media/assets
    if (under(pathname, "/data/screenshots")) return serveStatic("/data/screenshots", "./data/screenshots", pathname);
    if (under(pathname, "/data")) return serveStatic("/data", "./data", pathname);

    // Jolt physics music game (SPA-style routes like /game/1 should fall back to game/index.html)
    if (pathname === "/game/main.js") return serveGameBundle();
    if (pathname.startsWith("/game/conversations/")) return handleGameConversation(pathname);
    if (under(pathname, "/game")) {
      const res = await serveStatic("/game", "./game", pathname);
      if (res.status === 404 && !extname(pathname)) return serveFile("./game/index.html");
      return res;
    }

    if (under(pathname, "/api/business")) return handleBusinessCompiler(request);
    if (pathname === "/world/models/business-v1/compiler-api.js") return notFound();
    if (pathname === "/business-simulator" || pathname === "/business-simulator/") return serveFile("./world/business.html");
    if (pathname === "/world-business-simulator" || pathname === "/world-business-simulator/") return Response.redirect("/world?business_mode=true", 302);

    // Synthetic world: /world?lat=29.7286&lng=-95.4746
    if (["/api/date-places", "/api/date-places/drive", "/api/date-places/nearby", "/api/date-drive-options"].includes(pathname)) return handleDatePlaces(request);
    if (pathname === "/api/area") {
      try {
        return await handleArea(new URL(request.url));
      } catch (err) {
        const msg = String(err?.message || err);
        console.error(`[world] /api/area unhandled error: ${msg}`);
        return Response.json({ source: "none", error: `area handler crashed: ${msg}` }, { status: 200 });
      }
    }
    if (pathname === "/api/area/enrichment") return handleAreaEnrichment(new URL(request.url));
    if (pathname === "/api/overpass-health") return handleOverpassHealth();
    if (pathname === "/api/config") return handleConfig();
    if (under(pathname, "/api/causality")) return handleCausality(request);
    if (under(pathname, "/api/world-history")) return handleTemporalCity(request);
    if (under(pathname, "/api/reality-shares")) return handleRealityShares(request);
    if (under(pathname, "/api/world-homes")) return handleWorldPersistence(request);
    if (under(pathname, "/api/world-experiments")) return handleWorldPersistence(request);
    if (["/api/date-mystery/status","/api/date-mystery/generate"].includes(pathname)) return handleDateMystery(request);
    if (pathname === "/api/world-questions") return handleOpenQuestions(request);
    if (under(pathname, "/api/decision-experiments")) return handleDecisionExperiments(request);
    if (under(pathname, "/api/world-edits")) return handleWorldEdits(request);
    if (under(pathname, "/api/decision-optimizations")) return handleOptimizations(request);
    if (under(pathname, "/api/city-experiments") || under(pathname, "/api/experiments") || under(pathname, "/api/runs")) {
      return handleServerCivicApi(request);
    }
    if (under(pathname, "/api/world/experiments")) return handleExperiments(request);
    if (pathname === "/api/world/parameter-patch") return handlePlanParameterPatch(request);
    if (pathname === "/api/constitution-summary") return handleConstitutionSummary(request);
    if (pathname === "/api/constitution-city/plan") return handleConstitutionSource(request);
    if (/^\/r\/[A-Za-z0-9_-]{8,16}\/?$/.test(pathname)) return serveFile("./world/reality-compiler.html");
    if (["/change", "/reality-compiler", "/city-speaks"].includes(pathname.replace(/\/$/, ""))) return serveFile("./world/reality-compiler.html");
    // House mode observes/restores the same saved population authority as /world.
    // Asset URLs in this entry point are absolute so household IDs are not directories.
    if (/^\/world\/date\/[^/]{1,540}\/?$/.test(pathname)&&!pathname.endsWith('.js')&&!pathname.endsWith('.css')&&!pathname.endsWith('.html')) return serveFile("./world/date/index.html");
    if (/^\/world\/house(?:\/[A-Za-z0-9_-]{1,80})?\/?$/.test(pathname)) return serveFile("./world/house/index.html");
    if (pathname.replace(/\/$/, "") === "/visualize-constitution") return serveFile("./world/constitution-city.html");
    if (["/world/visualize-consitution", "/world/visualize-constitution"].includes(pathname.replace(/\/$/, ""))) return serveFile("./world/constitution-city.html");
    if (pathname === "/api/plan") return handlePlan(request);
    if (pathname === "/api/outcomes") return handleOutcomes();
    if (pathname === "/api/publish_draft") return handlePublishDraft(request);
    if (pathname === "/api/scenes") return handleScenes();
    if (pathname.startsWith("/api/scenes/")) return handleSceneById(pathname);
    if (pathname === "/api/screenshots") return handleScreenshots(new URL(request.url));
    if (under(pathname, "/api/dear-congress")) return proxyDearCongress(request);
    if (under(pathname, "/world")) {
      let decodedWorldPath;
      try { decodedWorldPath = normalize(decodeURIComponent(pathname)); } catch { return notFound(); }
      if (decodedWorldPath === "/world/models/business-v1/compiler-api.js") return notFound();
      if (decodedWorldPath === "/world/constitution-city/source-api.js") return notFound();
      if (/^\/world\/temporal\/(api|store)\.js$/.test(decodedWorldPath)) return notFound();
      if (decodedWorldPath === "/world/reality/share-store.js") return notFound();
      if (decodedWorldPath === "/world/experiments/persistence-store.js") return notFound();
      if (/^\/world\/decision\/(api|store|worker|optimization-api)\.js$/.test(decodedWorldPath)) return notFound();
      if (/^\/world\/ai\//.test(decodedWorldPath) && !/^\/world\/ai\/(edit-schema|edit-validator|revisions)\.js$/.test(decodedWorldPath)) return notFound();
      if (pathname.endsWith("/api.js") || pathname.endsWith("-api.js")) return notFound(); // server-only code
      return serveStatic("/world", "./world", pathname);
    }

    // Blog: Observable Framework build output (cd blog && npm run build)
    if (under(pathname, "/blog")) return serveStatic("/blog", "./blog/dist", pathname);

    return notFound();
  },

  websocket: {
    pong(ws){if(ws.data?.roomId)actNormalService.websocket.pong(ws);},
    open(ws) {
      if(ws.data?.roomId)return actNormalService.websocket.open(ws);
      console.log("Player connected");
      ws.subscribe("game");
      server.publish("game", JSON.stringify({ type: "playerJoined" }));
    },

    message(ws, message) {
      if(ws.data?.roomId)return actNormalService.websocket.message(ws,message);
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
      if(ws.data?.roomId)return actNormalService.websocket.close(ws);
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
