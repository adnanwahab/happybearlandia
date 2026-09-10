import { serve } from "bun";
import { join, normalize, relative } from "node:path";

const gameRoot = normalize("./game");

const server = serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/game" || url.pathname.startsWith("/game/")) {
      const relativePath = decodeURIComponent(url.pathname.slice("/game".length).replace(/^\/+/, "")) || "index.html";
      const filePath = normalize(join(gameRoot, relativePath));

      if (relative(gameRoot, filePath).startsWith("..")) {
        return new Response("Not found", { status: 404 });
      }

      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not found", { status: 404 });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Game server running at http://localhost:${server.port}/game`);
