import { serve } from "bun";
import { join, normalize, relative } from "node:path";

const gameRoot = normalize("./game");

// -------------------------------------------------------------------------
// Multiplayer state
// -------------------------------------------------------------------------

// playerId -> {
//   position: { x, y, z },
//   quaternion: { x, y, z, w },
//   crouched: boolean
// }
const players = new Map();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number
    : fallback;
}

const server = serve({
  port: 3000,

  async fetch(request, server) {
    const url = new URL(request.url);

    // ---------------------------------------------------------------------
    // WebSocket
    // ---------------------------------------------------------------------

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(request, {
        data: {
          // Every socket gets its own server-generated player ID.
          playerId: crypto.randomUUID(),
        },
      });

      if (upgraded) {
        return;
      }

      return new Response(
        "WebSocket upgrade failed",
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------------------
    // Root index
    // ---------------------------------------------------------------------

    if (url.pathname === "/") {
      const file = Bun.file("./index.html");

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response(
        "Not found",
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------------------
    // Static tool files
    // ---------------------------------------------------------------------

    if (
      url.pathname === "/tools" ||
      url.pathname.startsWith("/tools/")
    ) {
      const relativePath =
        decodeURIComponent(
          url.pathname
            .slice("/tools".length)
            .replace(/^\/+/, "")
        ) || "index.html";

      const filePath = normalize(
        join(
          "./tools",
          relativePath
        )
      );

      if (
        relative(
          "./tools",
          filePath
        ).startsWith("..")
      ) {
        return new Response(
          "Not found",
          {
            status: 404,
          }
        );
      }

      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response(
        "Not found",
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------------------
    // Static game files
    // ---------------------------------------------------------------------

    if (
      url.pathname === "/game" ||
      url.pathname.startsWith("/game/")
    ) {
      const relativePath =
        decodeURIComponent(
          url.pathname
            .slice("/game".length)
            .replace(/^\/+/, "")
        ) || "index.html";

      const filePath = normalize(
        join(
          gameRoot,
          relativePath
        )
      );

      if (
        relative(
          gameRoot,
          filePath
        ).startsWith("..")
      ) {
        return new Response(
          "Not found",
          {
            status: 404,
          }
        );
      }

      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response(
        "Not found",
        {
          status: 404,
        }
      );
    }

    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  },

  websocket: {
    // ---------------------------------------------------------------------
    // Player connects
    // ---------------------------------------------------------------------

    open(ws) {
      const playerId =
        ws.data.playerId;

      console.log(
        `Player connected: ${playerId}`
      );

      ws.subscribe("game");

      // Send the new player all players
      // that already exist.
      ws.send(
        JSON.stringify({
          type: "welcome",

          playerId,

          players:
            [...players.entries()].map(
              ([id, state]) => ({
                id,
                state,
              })
            ),
        })
      );

      const initialState = {
        position: {
          x: 0,
          y: 0,
          z: 0,
        },

        quaternion: {
          x: 0,
          y: 0,
          z: 0,
          w: 1,
        },

        crouched: false,
      };

      players.set(
        playerId,
        initialState
      );

      // Tell everyone else that
      // this player joined.
      ws.publish(
        "game",

        JSON.stringify({
          type: "playerJoined",

          playerId,

          state: initialState,
        })
      );
    },

    // ---------------------------------------------------------------------
    // Receive player movement
    // ---------------------------------------------------------------------

    message(ws, message) {
      let msg;

      try {
        msg = JSON.parse(
          message.toString()
        );
      } catch {
        console.warn(
          "Received invalid JSON"
        );

        return;
      }

      // For now playerState is the only
      // network message we accept.
      if (
        msg.type !== "playerState"
      ) {
        return;
      }

      const playerId =
        ws.data.playerId;

      // Sanitize incoming numbers.
      const state = {
        position: {
          x: finiteNumber(
            msg.position?.x
          ),

          y: finiteNumber(
            msg.position?.y
          ),

          z: finiteNumber(
            msg.position?.z
          ),
        },

        quaternion: {
          x: finiteNumber(
            msg.quaternion?.x
          ),

          y: finiteNumber(
            msg.quaternion?.y
          ),

          z: finiteNumber(
            msg.quaternion?.z
          ),

          w: finiteNumber(
            msg.quaternion?.w,
            1
          ),
        },

        crouched:
          Boolean(
            msg.crouched
          ),
      };

      // Store the latest player state.
      players.set(
        playerId,
        state
      );

      // Broadcast it to every OTHER client.
      ws.publish(
        "game",

        JSON.stringify({
          type: "playerState",

          playerId,

          ...state,
        })
      );
    },

    // ---------------------------------------------------------------------
    // Player disconnects
    // ---------------------------------------------------------------------

    close(ws) {
      const playerId =
        ws.data.playerId;

      console.log(
        `Player disconnected: ${playerId}`
      );

      players.delete(
        playerId
      );

      ws.publish(
        "game",

        JSON.stringify({
          type: "playerLeft",

          playerId,
        })
      );
    },

    error(ws, error) {
      console.error(
        `WebSocket error for ${ws.data?.playerId}:`,
        error
      );
    },
  },
});

console.log(
  `Game server running at http://localhost:${server.port}/game`
);

console.log(
  `WebSocket running at ws://localhost:${server.port}/ws`
);
