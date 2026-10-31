import { serve } from "bun";
import { extname, join, normalize, relative } from "node:path";
import { handleArea, OVERPASS_URL, OVERPASS_TIMEOUT_MS } from "./world/api.js";

const PORT = Number(process.env.PORT) || 3000;

const notFound = () => new Response("Not found", { status: 404 });

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

    // Twitch plays robot (short URL kept for old links)
    if (pathname === "/twitch-plays-robot") return serveFile("./tools/twitch-plays-robot.html");

    // Tools: /tools/scene-reconstruction, /tools/twitch-plays-robot
    if (under(pathname, "/tools")) return serveStatic("/tools", "./tools", pathname);

    // Jolt physics music game
    if (under(pathname, "/game")) return serveStatic("/game", "./game", pathname);

    // Synthetic world: /world?lat=29.7286&lng=-95.4746
    if (pathname === "/api/area") return handleArea(new URL(request.url));
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
console.log(`  overpass ${OVERPASS_URL} (timeout ${OVERPASS_TIMEOUT_MS}ms)`);
