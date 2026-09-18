import { serve } from "bun";
import { validateScene } from "./game/scene-loader.js";
import { join, normalize, relative } from "node:path";

const gameRoot = normalize("./game");

// -------------------------------------------------------------------------
// Multiplayer player state
// -------------------------------------------------------------------------

const players = new Map();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

// -------------------------------------------------------------------------
// Multiplayer teal cube state
// -------------------------------------------------------------------------

let cubeAuthorityPlayerId = null;

const sceneData = validateScene(await Bun.file(new URL('./game/scene.json', import.meta.url)).json());
const cubeDefinition = sceneData.objects.find(object => object.id === 'teal-cube');
const [cubeX, cubeY, cubeZ] = cubeDefinition.position;
const [cubeQX, cubeQY, cubeQZ, cubeQW] = cubeDefinition.rotation ?? [0, 0, 0, 1];

let cubeState = {
  position: { x: cubeX, y: cubeY, z: cubeZ },
  quaternion: { x: cubeQX, y: cubeQY, z: cubeQZ, w: cubeQW },
  linearVelocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
};

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
    // Root
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

      // First connected player controls the cube initially.
      if (
        cubeAuthorityPlayerId === null
      ) {
        cubeAuthorityPlayerId =
          playerId;

        console.log(
          "Initial cube authority:",
          cubeAuthorityPlayerId
        );
      }

      // Tell this client about the existing world.
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

          cubeState,

          cubeAuthorityPlayerId,
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
    // Receive messages
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

      const playerId =
        ws.data.playerId;

      // ===================================================================
      // PLAYER STATE
      // ===================================================================

      if (
        msg.type === "playerState"
      ) {
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

        players.set(
          playerId,
          state
        );

        ws.publish(
          "game",

          JSON.stringify({
            type: "playerState",

            playerId,

            ...state,
          })
        );

        return;
      }

      // ===================================================================
      // PLAYER CLAIMS TEAL CUBE
      // ===================================================================

      if (
        msg.type === "cubeClaim"
      ) {
        if (
          cubeAuthorityPlayerId !==
          playerId
        ) {
          cubeAuthorityPlayerId =
            playerId;

          console.log(
            "Cube authority changed:",
            cubeAuthorityPlayerId
          );

          const authorityMessage =
            JSON.stringify({
              type:
                "cubeAuthority",

              playerId:
                cubeAuthorityPlayerId,
            });

          // Send to claimant.
          ws.send(
            authorityMessage
          );

          // Send to everyone else.
          ws.publish(
            "game",
            authorityMessage
          );
        }

        return;
      }

      // ===================================================================
      // TEAL CUBE STATE
      // ===================================================================

      if (
        msg.type === "cubeState"
      ) {
        // Ignore cube updates from clients
        // that do not own the cube.
        if (
          cubeAuthorityPlayerId !==
          playerId
        ) {
          return;
        }

        cubeState = {
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

          linearVelocity: {
            x: finiteNumber(
              msg.linearVelocity?.x
            ),

            y: finiteNumber(
              msg.linearVelocity?.y
            ),

            z: finiteNumber(
              msg.linearVelocity?.z
            ),
          },

          angularVelocity: {
            x: finiteNumber(
              msg.angularVelocity?.x
            ),

            y: finiteNumber(
              msg.angularVelocity?.y
            ),

            z: finiteNumber(
              msg.angularVelocity?.z
            ),
          },
        };

        // Broadcast to everyone except
        // the authoritative client.
        ws.publish(
          "game",

          JSON.stringify({
            type: "cubeState",

            playerId,

            ...cubeState,
          })
        );

        return;
      }
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

      // If this player controlled the cube,
      // transfer authority to another player.
      if (
        cubeAuthorityPlayerId ===
        playerId
      ) {
        cubeAuthorityPlayerId =
          players.keys()
            .next()
            .value ??
          null;

        console.log(
          "New cube authority:",
          cubeAuthorityPlayerId
        );

        server.publish(
          "game",

          JSON.stringify({
            type:
              "cubeAuthority",

            playerId:
              cubeAuthorityPlayerId,
          })
        );
      }
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
