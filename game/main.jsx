
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "./index.js";

function isGalleryRoute(pathname) {
  return pathname === "/game" || pathname === "/game/";
}

function filenameWithoutExtension(name) {
  return String(name).replace(/\.[^.]+$/, "");
}

function ScreenshotGallery() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [scenes, setScenes] = useState([]);
  const [previewBySceneId, setPreviewBySceneId] = useState({});
  const [hoveredSceneId, setHoveredSceneId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [scenesResponse, screenshotsResponse] = await Promise.all([
          fetch("/api/scenes"),
          fetch("/api/screenshots?limit=100"),
        ]);

        if (!scenesResponse.ok) {
          throw new Error(`Unable to load scenes (HTTP ${scenesResponse.status})`);
        }

        if (!screenshotsResponse.ok) {
          throw new Error(`Unable to load screenshots (HTTP ${screenshotsResponse.status})`);
        }

        const scenePayload = await scenesResponse.json();
        const screenshotPayload = await screenshotsResponse.json();

        const nextScenes = Array.isArray(scenePayload?.scenes) ? scenePayload.scenes : [];
        const screenshotFiles = Array.isArray(screenshotPayload?.files) ? screenshotPayload.files : [];

        const nextPreviewBySceneId = {};

        for (const screenshot of screenshotFiles) {
          const sceneId = filenameWithoutExtension(screenshot?.name ?? "");

          if (sceneId && typeof screenshot?.url === "string") {
            nextPreviewBySceneId[sceneId] = screenshot.url;
          }
        }

        if (!cancelled) {
          setScenes(nextScenes);
          setPreviewBySceneId(nextPreviewBySceneId);
          setStatus("ready");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message ?? "Unable to load gallery");
          setStatus("error");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const gridContent = useMemo(() => {
    return scenes.map(scene => {
      const sceneId = scene?.id ?? "";
      const sceneName = scene?.name ?? `${sceneId}.json`;
      const sceneLabel = filenameWithoutExtension(sceneName);
      const previewUrl = previewBySceneId[sceneId] ?? null;
      const isHovered = hoveredSceneId === sceneId;

      return (
        <article
          key={sceneId || sceneName}
          onMouseEnter={() => setHoveredSceneId(sceneId)}
          onMouseLeave={() => setHoveredSceneId(null)}
          style={{
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid #334155",
            background: "#0b1220",
          }}
        >
          <a
            href={`/game/${sceneId}`}
            style={{
              display: "block",
              position: "relative",
              textDecoration: "none",
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={sceneName}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "180px",
                  objectFit: "cover",
                  display: "block",
                  background: "#020617",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #1e293b, #0f172a)",
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                No preview image
              </div>
            )}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "10px 12px",
                background: "rgba(2, 6, 23, 0.75)",
                color: "#f8fafc",
                fontSize: "14px",
                fontWeight: 600,
                letterSpacing: "0.01em",
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateY(0)" : "translateY(-6px)",
                transition: "opacity 120ms ease, transform 120ms ease",
                pointerEvents: "none",
              }}
            >
              {sceneLabel}
            </div>
          </a>
        </article>
      );
    });
  }, [hoveredSceneId, previewBySceneId, scenes]);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        zIndex: 10002,
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "28px" }}>Game Scenes</h1>
        <p style={{ margin: "0 0 20px", color: "#94a3b8" }}>
          All scenes from <code>game/scene</code>. Hover a preview to see the filename.
        </p>
        {status === "loading" ? <div>Loading scenes...</div> : null}
        {status === "error" ? (
          <div
            style={{
              border: "1px dashed #334155",
              borderRadius: "10px",
              padding: "24px",
              color: "#94a3b8",
            }}
          >
            {error}
          </div>
        ) : null}
        {status === "ready" && scenes.length === 0 ? (
          <div
            style={{
              border: "1px dashed #334155",
              borderRadius: "10px",
              padding: "24px",
              color: "#94a3b8",
            }}
          >
            No scenes found in <code>game/scene</code>.
          </div>
        ) : null}
        {status === "ready" && scenes.length > 0 ? (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {gridContent}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function getFirstConversation(npc) {
  if (!npc || !Array.isArray(npc.conversations) || npc.conversations.length === 0) {
    return null;
  }

  return npc.conversations[0] ?? null;
}

function GameplayOverlay() {

  const [conversationScene, setConversationScene] = useState(
    () => window.__hblConversationScene ?? { npcs: [], range: 5 },
  );

  const [activeNpcId, setActiveNpcId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);

  const npcById = useMemo(() => {
    const map = new Map();

    for (const npc of conversationScene?.npcs ?? []) {
      if (npc?.id) {
        map.set(npc.id, npc);
      }
    }

    return map;
  }, [conversationScene]);

  const activeNpc = activeNpcId ? npcById.get(activeNpcId) ?? null : null;
  const activeConversation = useMemo(() => {
    if (!activeNpc) {
      return null;
    }

    return getFirstConversation(activeNpc);
  }, [activeNpc]);

  const currentNode = useMemo(() => {
    if (!activeConversation || !currentNodeId) {
      return null;
    }

    return activeConversation.tree?.[currentNodeId] ?? null;
  }, [activeConversation, currentNodeId]);

  const dialogChoices = Array.isArray(currentNode?.choices) ? currentNode.choices : [];

  function setDialogActiveFlag(active) {
    window.__hblDialogActive = active === true;
  }

  function closeConversation() {
    setActiveNpcId(null);
    setActiveConversationId(null);
    setCurrentNodeId(null);
    setDialogActiveFlag(false);
  }

  function openConversationForNpc(npcId) {
    const npc = npcById.get(npcId);
    const conversation = getFirstConversation(npc);

    if (!npc || !conversation || !conversation.start) {
      return false;
    }

    setActiveNpcId(npcId);
    setActiveConversationId(conversation.id ?? `${npcId}-conversation`);
    setCurrentNodeId(conversation.start);
    setDialogActiveFlag(true);

    return true;
  }

  function chooseDialogOption(choiceIndex) {
    const choice = dialogChoices[choiceIndex];

    if (!choice) {
      return;
    }

    const nextNodeId = choice.next;

    if (!nextNodeId || !activeConversation?.tree?.[nextNodeId]) {
      closeConversation();
      return;
    }

    setCurrentNodeId(nextNodeId);
  }

  useEffect(() => {
    function handleConversationSceneEvent(event) {
      if (event?.detail) {
        setConversationScene(event.detail);
      }
    }

    function handleConversationInteractionEvent(event) {
      const npcId = event?.detail?.npcId ?? null;

      if (!npcId) {
        return;
      }

      if (activeConversationId) {
        return;
      }

      openConversationForNpc(npcId);
    }

    window.addEventListener("hbl:conversation-scene", handleConversationSceneEvent);
    window.addEventListener("hbl:conversation-interaction", handleConversationInteractionEvent);

    return () => {
      window.removeEventListener("hbl:conversation-scene", handleConversationSceneEvent);
      window.removeEventListener("hbl:conversation-interaction", handleConversationInteractionEvent);
      setDialogActiveFlag(false);
    };
  }, [activeConversationId, activeNpcId, npcById]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConversation();
        return;
      }

      const index = Number.parseInt(event.key, 10);

      if (!Number.isInteger(index) || index < 1 || index > 9) {
        return;
      }

      event.preventDefault();
      chooseDialogOption(index - 1);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeConversationId, dialogChoices, activeConversation]);

  useEffect(() => {
    if (activeConversationId && !currentNode) {
      closeConversation();
    }
  }, [activeConversationId, currentNode]);

  return (
    <>
      {activeConversationId && currentNode ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(2, 6, 23, 0.55)",
            zIndex: 10004,
          }}
        >
          <div
            style={{
              width: "min(760px, 92vw)",
              background: "linear-gradient(180deg, #0f172a, #111827)",
              color: "#e2e8f0",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              borderRadius: "14px",
              boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
              padding: "18px",
            }}
          >
            <div
              style={{
                marginBottom: "10px",
                color: "#93c5fd",
                fontWeight: 600,
              }}
            >
              {currentNode.speaker ?? "Bear"}
            </div>
            <div
              style={{
                lineHeight: 1.45,
                fontSize: "15px",
                marginBottom: "14px",
                whiteSpace: "pre-wrap",
              }}
            >
              {currentNode.text ?? "..."}
            </div>
            {dialogChoices.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: "8px",
                }}
              >
                {dialogChoices.map((choice, index) => (
                  <button
                    key={choice.id ?? `${activeConversationId}-${currentNodeId}-${index}`}
                    type="button"
                    onClick={() => chooseDialogOption(index)}
                    style={{
                      textAlign: "left",
                      background: "rgba(30, 41, 59, 0.92)",
                      color: "#f8fafc",
                      border: "1px solid rgba(148, 163, 184, 0.55)",
                      borderRadius: "9px",
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {`${index + 1}. ${choice.text ?? "Continue"}`}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={closeConversation}
                style={{
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "9px",
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                {currentNode.end ? "End conversation" : "Close"}
              </button>
            )}
            <div
              style={{
                marginTop: "12px",
                color: "#94a3b8",
                fontSize: "12px",
              }}
            >
              Press 1-9 to choose • Esc to close
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import { Routes, Route } from "react-router";


export default function App() {
  const gallery = isGalleryRoute(window.location.pathname);

  return gallery ? <ScreenshotGallery /> : <GameplayOverlay />;

  return <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/game" element={<ScreenshotGallery/>} />
        <Route path="/game/:sceneId" element={<GameplayOverlay/>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>;

}


//function App() { }
import { StrictMode } from "react";
import { BrowserRouter } from "react-router";
createRoot(document.getElementById("root")).render(
  React.createElement(App)
);
