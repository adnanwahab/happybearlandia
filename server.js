import { serve } from "bun";
import { join, normalize, relative } from "node:path";

const gameRoot = normalize("./game");

const server = serve({
  port: 3000,

  async fetch(request, server) {
    const url = new URL(request.url);

    // WebSocket endpoint
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(request);

      if (upgraded) {
        return;
      }

      return new Response("WebSocket upgrade failed", {
        status: 400,
      });
    }

    // Static game files
    if (url.pathname === "/game" || url.pathname.startsWith("/game/")) {
      const relativePath =
        decodeURIComponent(
          url.pathname
            .slice("/game".length)
            .replace(/^\/+/, "")
        ) || "index.html";

      const filePath = normalize(join(gameRoot, relativePath));

      if (relative(gameRoot, filePath).startsWith("..")) {
        return new Response("Not found", {
          status: 404,
        });
      }

      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not found", {
        status: 404,
      });
    }

    return new Response("Not found", {
      status: 404,
    });
  },

  websocket: {
    open(ws) {
      console.log("Player connected");

      ws.subscribe("game");

      server.publish(
        "game",
        JSON.stringify({
          type: "playerJoined",
        })
      );
    },

    message(ws, message) {
      let msg;

      try {
        msg = JSON.parse(message.toString());
      } catch {
        console.warn("Received invalid JSON");
        return;
      }

      console.log("Game message:", msg);

      // Broadcast to all OTHER clients subscribed to "game"
      ws.publish(
        "game",
        JSON.stringify(msg)
      );
    },

    close(ws) {
      console.log("Player disconnected");

      ws.publish(
        "game",
        JSON.stringify({
          type: "playerLeft",
        })
      );
    },

    error(ws, error) {
      console.error("WebSocket error:", error);
    },
  },
});

console.log(
  `Game server running at http://localhost:${server.port}/game`
);

console.log(
  `WebSocket running at ws://localhost:${server.port}/ws`
);
