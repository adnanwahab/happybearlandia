import { createRoot } from "react-dom/client";
//import App from "./App.jsx";
// import "./index.css";

import React, { useEffect, useMemo, useRef, useState } from "react";
// import "./index.js";

// const h = React.createElement;

function isGalleryRoute(pathname) {
  return pathname === "/game" || pathname === "/game/";
}

function sceneIdFromScreenshotName(name) {
  const match = String(name).match(/^(\d+)/);
  return match ? match[1] : null;
}

function ScreenshotGallery() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/screenshots?limit=9");

        if (!response.ok) {
          throw new Error(`Unable to load screenshots (HTTP ${response.status})`);
        }

        const payload = await response.json();
        const nextFiles = Array.isArray(payload?.files) ? payload.files.slice(0, 9) : [];

        if (!cancelled) {
          setFiles(nextFiles);
          setStatus("ready");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message ?? "Unable to load screenshots");
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
    return files.map(file => {
      const sceneId = sceneIdFromScreenshotName(file.name);
      return <article key={file.name}>
        <img src={file.url} alt={file.name} loading="lazy" style={{
          width: "100%",
          height: "180px",
          objectFit: "cover",
          display: "block",
          background: "#020617",
        }} />
      </article>


    });
  }, [files]);

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
        <h1 style={{ margin: "0 0 8px", fontSize: "28px" }}>Game Screenshots</h1>
        <p style={{ margin: "0 0 20px", color: "#94a3b8" }}>3x3 gallery from data/screenshots</p>
        {status === "loading" ? <div>Loading screenshots...</div> : null}
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
        {status === "ready" && files.length === 0 ? (
          <div
            style={{
              border: "1px dashed #334155",
              borderRadius: "10px",
              padding: "24px",
              color: "#94a3b8",
            }}
          >
            No screenshots found yet. Add images to data/screenshots or run bun run screenshot:index.
          </div>
        ) : null}
        {status === "ready" && files.length > 0 ? (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

  const [nearbyNpcId, setNearbyNpcId] = useState(
    () => window.__hblConversationProximity?.npcId ?? null,
  );

  const [activeNpcId, setActiveNpcId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);

  const lastAutoOpenedNpcIdRef = useRef(null);

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

    function handleConversationProximityEvent(event) {
      setNearbyNpcId(event?.detail?.npcId ?? null);
    }

    window.addEventListener("hbl:conversation-scene", handleConversationSceneEvent);
    window.addEventListener("hbl:conversation-proximity", handleConversationProximityEvent);

    return () => {
      window.removeEventListener("hbl:conversation-scene", handleConversationSceneEvent);
      window.removeEventListener("hbl:conversation-proximity", handleConversationProximityEvent);
      setDialogActiveFlag(false);
    };
  }, []);

  useEffect(() => {
    if (!nearbyNpcId) {
      lastAutoOpenedNpcIdRef.current = null;

      if (activeNpcId) {
        closeConversation();
      }

      return;
    }

    if (activeNpcId && activeNpcId !== nearbyNpcId) {
      closeConversation();
      return;
    }

    if (!activeNpcId && lastAutoOpenedNpcIdRef.current !== nearbyNpcId) {
      const opened = openConversationForNpc(nearbyNpcId);

      if (opened) {
        lastAutoOpenedNpcIdRef.current = nearbyNpcId;
      }
    }
  }, [nearbyNpcId, activeNpcId, npcById]);

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

  const nearbyPromptVisible = nearbyNpcId && !activeConversationId;


  return (
    <>
      {nearbyPromptVisible ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "86px",
            transform: "translateX(-50%)",
            padding: "8px 12px",
            background: "rgba(0, 0, 0, 0.75)",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: "8px",
            color: "#f8fafc",
            fontSize: "13px",
            letterSpacing: "0.2px",
            zIndex: 10003,
            pointerEvents: "none",
          }}
        >
          Bear nearby... starting conversation
        </div>
      ) : null}
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

export default function App() {
  const gallery = isGalleryRoute(window.location.pathname);
  return gallery ? <ScreenshotGallery /> : <GameplayOverlay />;
}


//function App() { }

createRoot(document.getElementById("root")).render(
  React.createElement(App)
);
