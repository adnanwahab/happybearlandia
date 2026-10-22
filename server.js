import { serve } from "bun";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { validateScene } from "./game/scene-loader.js";
import { join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = normalize(fileURLToPath(new URL(".", import.meta.url)));
const gameRoot = normalize(join(projectRoot, "game"));
const toolsRoot = normalize(join(projectRoot, "tools"));
const dataRoot = normalize(join(projectRoot, "data"));
const sceneIdPattern = /^[a-zA-Z0-9_\-]+$/;

import homepage from './index.html'
import gamepage from './game/index.html'

async function loadProjectEnvFiles() {
  const protectedKeys = new Set(
    Object.entries(process.env)
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      .map(([key]) => key)
  );

  const parseAndApply = source => {
    const lines = source.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;

      if (protectedKeys.has(key)) {
        continue;
      }

      let value = rawValue.trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, "").trim();
      }

      process.env[key] = value;
    }
  };

  for (const fileName of [".env", ".env.local", ".env.op"]) {
    try {
      const fullPath = join(projectRoot, fileName);
      const source = await readFile(fullPath, "utf8");
      parseAndApply(source);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`Failed to load ${fileName}:`, error);
      }
    }
  }
}

await loadProjectEnvFiles();

const jsxTranspiler = new Bun.Transpiler({ loader: "jsx" });

function isPathInside(rootPath, targetPath) {
  return !relative(rootPath, targetPath).startsWith("..");
}

function normalizeSceneId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value
    .split("/")
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  if (!parts.every(part => sceneIdPattern.test(part))) {
    return null;
  }

  return parts.join("/");
}

function getSceneIdFromPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const remainder = pathname
    .slice(prefix.length)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!remainder) {
    return null;
  }

  return normalizeSceneId(remainder);
}

function getSceneFilePath(sceneId) {
  const normalizedSceneId = normalizeSceneId(sceneId);

  if (!normalizedSceneId) {
    return null;
  }

  return normalize(join(gameRoot, "scene", `${normalizedSceneId}.json`));
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

function extractOpenAiText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      const candidate = part?.text ?? part?.output_text ?? null;

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
}

async function getOpenAiConversationReply({
  sceneId,
  npcId,
  npcName,
  conversationContext,
  userMessage,
}) {
  const rawApiKey = process.env.OPENAI_API_KEY;
  const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : "";

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "OPENAI_API_KEY is not configured on the server.",
    };
  }

  if (apiKey.startsWith("op://")) {
    return {
      ok: false,
      status: 503,
      error:
        "OPENAI_API_KEY is still a 1Password reference (op://...). Start the server with `op run --env-file=.env.op -- bun run server.js` or set a real key in .env.",
    };
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const systemPrompt = [
    "You are roleplaying a single NPC in a simulation game.",
    "Respond in one concise paragraph (max 120 words).",
    "Stay in-character and grounded in the city context.",
    "Do not include markdown.",
  ].join(" ");

  const userPrompt = [
    `Scene: ${sceneId ?? "unknown"}`,
    `NPC ID: ${npcId ?? "unknown"}`,
    `NPC Name: ${npcName ?? "Resident"}`,
    `Current dialog context: ${conversationContext ?? "(none)"}`,
    `Player message: ${userMessage}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_output_tokens: 220,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      ok: false,
      status: 502,
      error: `OpenAI request failed (HTTP ${response.status})`,
      details: errorBody.slice(0, 500),
    };
  }

  const payload = await response.json();
  const reply = extractOpenAiText(payload);

  if (!reply) {
    return {
      ok: false,
      status: 502,
      error: "OpenAI returned no text output.",
    };
  }

  return {
    ok: true,
    reply,
    model,
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

async function listScreenshotFiles(limit = 9) {
  const root = normalize(join(dataRoot, "screenshots"));
  let entries;

  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const images = entries
    .filter(entry => {
      if (!entry.isFile()) {
        return false;
      }

      return /\.(png|jpe?g|webp|gif)$/i.test(entry.name);
    })
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .slice(0, limit)
    .map(name => ({
      name,
      url: `/data/screenshots/${encodeURIComponent(name)}`,
    }));

  return images;
}

async function listSceneFiles() {
  const root = normalize(join(gameRoot, "scene"));
  const out = [];

  const walk = async (directoryPath, relativePrefix = "") => {
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
        const nextPrefix = relativePrefix
          ? `${relativePrefix}/${entry.name}`
          : entry.name;

        await walk(absolutePath, nextPrefix);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const fileStem = entry.name.replace(/\.json$/i, "");
      const id = relativePrefix
        ? `${relativePrefix}/${fileStem}`
        : fileStem;

      const normalizedId = normalizeSceneId(id);

      if (!normalizedId) {
        continue;
      }

      out.push({
        id: normalizedId,
        name: `${normalizedId}.json`,
      });
    }
  };

  await walk(root);

  return out.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
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

const sceneData = validateScene(await Bun.file(new URL('./game/scene/1.json', import.meta.url)).json());
const cubeDefinition = sceneData.objects.find(object => object.id === 'teal-cube');

const sceneRoutes = Object.fromEntries(
  (await listSceneFiles()).flatMap(scene => [
    [`/game/${scene.id}`, gamepage],
    [`/game/${scene.id}/`, gamepage],
  ])
);

const appRoutes = {
  "/": homepage,
  "/game": gamepage,
  "/game/": gamepage,
  "/game/constitution-neighborhood/:city": gamepage,
  "/game/constitution-neighborhood/:city/": gamepage,
  ...sceneRoutes,
};
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

  routes: appRoutes,

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
      return new Response("Not found", {
        status: 404,
      });
    }

    if (url.pathname === "/game") {
      return new Response("Not found", { status: 404 });
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

      const sceneId = sanitizeName(payload?.sceneId ?? "1");
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
    // Screenshot listing API
    // ---------------------------------------------------------------------

    if (url.pathname === "/api/screenshots") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      }

      const requestedLimit = Number(url.searchParams.get("limit") ?? 9);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(100, Math.floor(requestedLimit)))
        : 9;

      const files = await listScreenshotFiles(limit);

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

    // ---------------------------------------------------------------------
    // Open-ended NPC conversation API
    // ---------------------------------------------------------------------

    if (url.pathname === "/api/conversations/open-ended") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }

      let payload;

      try {
        payload = await request.json();
      } catch {
        return new Response("Invalid JSON body", { status: 400 });
      }

      const userMessage =
        typeof payload?.message === "string"
          ? payload.message.trim()
          : "";

      if (!userMessage) {
        return new Response("message is required", { status: 400 });
      }

      const result = await getOpenAiConversationReply({
        sceneId: typeof payload?.sceneId === "string" ? payload.sceneId : "unknown",
        npcId: typeof payload?.npcId === "string" ? payload.npcId : "unknown",
        npcName: typeof payload?.npcName === "string" ? payload.npcName : "Resident",
        conversationContext:
          typeof payload?.conversationContext === "string"
            ? payload.conversationContext
            : "",
        userMessage,
      });

      if (!result.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: result.error,
            details: result.details ?? null,
          }),
          {
            status: result.status ?? 502,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          reply: result.reply,
          model: result.model,
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

    if (url.pathname === "/api/scenes") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      }

      const scenes = await listSceneFiles();

      return new Response(
        JSON.stringify({
          ok: true,
          count: scenes.length,
          scenes,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const sceneApiId = getSceneIdFromPath(url.pathname, "/api/scenes/");

    if (sceneApiId) {
      const sceneFilePath = getSceneFilePath(sceneApiId);

      if (!sceneFilePath || !isPathInside(gameRoot, sceneFilePath)) {
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
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/game/") {
      return new Response("Not found", { status: 404 });
    }

    const editSceneId =
      getSceneIdFromPath(url.pathname, "/edit/") ??
      getSceneIdFromPath(url.pathname, "/edit-game/");

    if (editSceneId) {
      const sceneFilePath = getSceneFilePath(editSceneId);

      if (!sceneFilePath || !isPathInside(gameRoot, sceneFilePath)) {
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
        if (filePath.endsWith(".jsx")) {
          const source = await file.text();
          const transpiled = jsxTranspiler.transformSync(source);

          return new Response(transpiled, {
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
            },
          });
        }

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
