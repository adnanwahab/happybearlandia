import { serve } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { validateScene } from "./game/scene-loader.js";
import { join, normalize, relative } from "node:path";

const gameRoot = normalize("./game");
const toolsRoot = normalize("./tools");
const dataRoot = normalize("./data");
const sceneIdPattern = /^[a-zA-Z0-9_-]+$/;

function isPathInside(rootPath, targetPath) {
  return !relative(rootPath, targetPath).startsWith("..");
}

function getSceneIdFromPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const remainder = pathname.slice(prefix.length).replace(/^\/+/, "");

  if (!remainder || remainder.includes("/")) {
    return null;
  }

  if (!sceneIdPattern.test(remainder)) {
    return null;
  }

  return remainder;
}

function getSceneFilePath(sceneId) {
  return normalize(join(gameRoot, `${sceneId}.json`));
}

function sanitizeName(value, fallback = "unknown") {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

function dateParts(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return {
    dateFolder: `${year}-${month}-${day}`,
    timestamp: `${year}${month}${day}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}.${String(date.getUTCMilliseconds()).padStart(3, "0")}Z`,
  };
}

async function listDebugEventFiles(limit = 200) {
  const root = normalize(join(dataRoot, "events"));
  const out = [];

  const walk = async (directoryPath) => {
    let entries;

    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = normalize(join(directoryPath, entry.name));

      if (!isPathInside(root, absolutePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const relativePath = relative(root, absolutePath);
      const normalizedRelativePath = relativePath.split("\\").join("/");

      out.push({
        path: `/data/events/${normalizedRelativePath}`,
        filename: entry.name,
      });
    }
  };

  await walk(root);

  out.sort((a, b) => b.filename.localeCompare(a.filename));

  return out.slice(0, limit);
}

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
  port: Number(process.env.PORT ?? 3000),

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
    // Debug events API
    // ---------------------------------------------------------------------

    if (url.pathname === "/api/debug/events") {
      if (request.method === "GET") {
        const requestedLimit = Number(url.searchParams.get("limit") ?? 200);
        const limit = Number.isFinite(requestedLimit)
          ? Math.max(1, Math.min(1000, Math.floor(requestedLimit)))
          : 200;

        const files = await listDebugEventFiles(limit);

        return new Response(
          JSON.stringify({
            ok: true,
            count: files.length,
            files,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, POST" },
        });
      }

      let payload;

      try {
        payload = JSON.parse(await request.text());
      } catch {
        return new Response("Invalid JSON body", { status: 400 });
      }

      const events = Array.isArray(payload?.events) ? payload.events : [];
      const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];

      const sceneId = sanitizeName(payload?.sceneId ?? "scene");
      const sessionId = sanitizeName(payload?.sessionId ?? crypto.randomUUID());

      const { dateFolder, timestamp } = dateParts(new Date());
      const eventsDirectory = normalize(join(dataRoot, "events", dateFolder));

      if (!isPathInside(dataRoot, eventsDirectory)) {
        return new Response("Invalid output path", { status: 400 });
      }

      await mkdir(eventsDirectory, { recursive: true });

      const fileName = `${timestamp}-${sceneId}-${sessionId}.json`;
      const outputPath = normalize(join(eventsDirectory, fileName));

      if (!isPathInside(dataRoot, outputPath)) {
        return new Response("Invalid output file", { status: 400 });
      }

      const document = {
        schemaVersion: 1,
        kind: "debug_session",
        savedAt: new Date().toISOString(),
        sceneId,
        sessionId,
        reason: typeof payload?.reason === "string" ? payload.reason : "unknown",
        startedAt: typeof payload?.startedAt === "string" ? payload.startedAt : null,
        endedAt: typeof payload?.endedAt === "string" ? payload.endedAt : null,
        metadata: {
          userAgent: typeof payload?.metadata?.userAgent === "string" ? payload.metadata.userAgent : null,
          locationPath: typeof payload?.metadata?.locationPath === "string" ? payload.metadata.locationPath : null,
          eventCount: events.length,
          snapshotCount: snapshots.length,
        },
        events,
        snapshots,
      };

      await Bun.write(outputPath, `${JSON.stringify(document, null, 2)}\n`);

      return new Response(
        JSON.stringify({
          ok: true,
          file: `/data/events/${dateFolder}/${fileName}`,
          eventCount: events.length,
          snapshotCount: snapshots.length,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // ---------------------------------------------------------------------
    // Scene API
    // ---------------------------------------------------------------------

    const sceneApiId = getSceneIdFromPath(url.pathname, "/api/scenes/");

    if (sceneApiId) {
      const sceneFilePath = getSceneFilePath(sceneApiId);

      if (!isPathInside(gameRoot, sceneFilePath)) {
        return new Response("Not found", { status: 404 });
      }

      if (request.method === "GET") {
        const sceneFile = Bun.file(sceneFilePath);

        if (!(await sceneFile.exists())) {
          return new Response("Scene not found", { status: 404 });
        }

        return new Response(sceneFile, {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (request.method === "POST") {
        let payload;

        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        let validated;

        try {
          validated = validateScene(payload);
        } catch (error) {
          return new Response(error?.message ?? "Invalid scene data", {
            status: 400,
          });
        }

        await Bun.write(sceneFilePath, `${JSON.stringify(validated, null, 2)}\n`);

        return new Response(
          JSON.stringify({ ok: true, sceneId: sceneApiId }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, POST" },
      });
    }

    // ---------------------------------------------------------------------
    // /game/:id and /edit/:id app routes
    // ---------------------------------------------------------------------

    const gameSceneId = getSceneIdFromPath(url.pathname, "/game/");

    if (gameSceneId) {
      const sceneFilePath = getSceneFilePath(gameSceneId);

      if (!isPathInside(gameRoot, sceneFilePath)) {
        return new Response("Not found", { status: 404 });
      }

      const sceneFile = Bun.file(sceneFilePath);

      if (!(await sceneFile.exists())) {
        return new Response("Scene not found", { status: 404 });
      }

      const gameIndex = Bun.file(join(gameRoot, "index.html"));

      if (await gameIndex.exists()) {
        return new Response(gameIndex);
      }

      return new Response("Not found", { status: 404 });
    }

    const editSceneId =
      getSceneIdFromPath(url.pathname, "/edit/") ??
      getSceneIdFromPath(url.pathname, "/edit-game/");

    if (editSceneId) {
      const sceneFilePath = getSceneFilePath(editSceneId);

      if (!isPathInside(gameRoot, sceneFilePath)) {
        return new Response("Not found", { status: 404 });
      }

      const sceneFile = Bun.file(sceneFilePath);

      if (!(await sceneFile.exists())) {
        return new Response("Scene not found", { status: 404 });
      }

      const editFile = Bun.file(join(toolsRoot, "edit-game.html"));

      if (await editFile.exists()) {
        return new Response(editFile);
      }

      return new Response("Not found", { status: 404 });
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
          toolsRoot,
          relativePath
        )
      );

      if (!isPathInside(toolsRoot, filePath)) {
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
    // Static data files
    // ---------------------------------------------------------------------

    if (
      url.pathname === "/data" ||
      url.pathname.startsWith("/data/")
    ) {
      const relativePath =
        decodeURIComponent(
          url.pathname
            .slice("/data".length)
            .replace(/^\/+/, "")
        ) || "index.html";

      const filePath = normalize(
        join(
          dataRoot,
          relativePath
        )
      );

      if (!isPathInside(dataRoot, filePath)) {
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

      if (!isPathInside(gameRoot, filePath)) {
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
