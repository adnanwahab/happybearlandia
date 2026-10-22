
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "./index.js";

function isGalleryRoute(pathname) {
  return pathname === "/game" || pathname === "/game/";
}

function filenameWithoutExtension(name) {
  return String(name).replace(/\.[^.]+$/, "");
}

function sceneIdFromPathname(pathname) {
  const parts = String(pathname)
    .split("/")
    .filter(Boolean);

  if (parts[0] === "game" && parts[1]) {
    return parts[1];
  }

  return "1";
}

const CONSTITUTION_NEIGHBORHOOD_SCENE_ID = "constitution-neighborhood";

const DEFAULT_CONSTITUTION_NEIGHBORHOOD_SPEC = `# Constitution Neighborhood Spec

## 1) Nested rule documents by scope
- World: treaties, trade rules, migration rules
- Country: constitution (hard limits)
- City: ordinances, zoning, taxes, policing budget
- Neighborhood: HOA rules and local norms
- House: chores, curfew, screen time, rent expectations

Lower levels inherit from higher levels and can only narrow them.
Conflicts are linted and marked invalid (e.g. unconstitutional rules do not apply).

## 2) Rules shift incentives, not direct behavior
Represent three rule types:
- Constraints: required/forbidden actions
- Incentives: taxes, fines, subsidies, allowances
- Enforcement: detection odds and responsible enforcers

Agents choose actions from needs + traits:
- hunger, sleep, money, social, safety, status

Expected cost example:
- fine: $500
- enforcement probability: 0.20
- expected cost added to action utility: $100

Example rule:
scope city: Houston
law noise_ordinance:
  forbid  play_loud_music  between 22:00 and 07:00
  fine    250
  enforce 0.15  (scaled by police_budget)

## 3) Legal prose compiler workflow
- LLM compiles prose clauses into structured rules
- Every compiled rule keeps source-clause traceability
- Human reviews/approves before simulation runs
- Runtime stays deterministic over approved rules only

Potential sources:
- Municode / American Legal (city codes)
- eCFR (federal regs)
- constitutional texts
- user-pasted HOA covenants

## 4) Multi-scale simulation detail
- House: individuals, minute ticks
- Neighborhood: agents + shared places, hourly ticks
- City: grouped cohorts + markets + budget + traffic, daily ticks
- World: countries as agents (trade, migration, conflict), monthly ticks

Techniques:
- Simulate in detail where camera is focused; aggregate elsewhere
- Couple levels both ways:
  - Bottom-up: individual outcomes -> city metrics
  - Top-down: wages/rent/prices -> household conditions

## 5) Real data + uncertainty
Data inputs:
- OpenStreetMap buildings/roads
- city zoning GIS
- Census ACS
- BLS
- World Bank

Method:
1. Calibrate baseline to current reality
2. Change one rule and compare runs
3. Run many random seeds and report ranges, not single-point predictions

## 6) Visualization requirements
- Continuous zoom: world -> city -> neighborhood -> house cutaway
- Heatmaps: happiness, money flow, violations, enforcement
- A/B law compare worlds side-by-side
- Decision trace on click: needs + laws + penalties that tipped choice
- Multi-tab editor with cross-level conflict warnings

## 7) Architecture
rule docs -> compiler (LLM + review) -> approved rules
real-world data -> world builder -> ECS simulation (Web Worker, later Rust/WASM)
simulation snapshots -> renderer (Three.js / deck.gl) + charts + decision traces

## 8) Build order
1. House (3-5 people, 6 needs, ~10 rule types, decision traces)
2. Neighborhood (shared places + norm spread)
3. City (grouped populations + budget + zoning + one real city dataset)
4. Constitution layer + cross-level conflict checker
5. World level

## Map goals
- Neighborhood map visible in-panel
- World map visible in-panel
- Later: bind map overlays to simulation metrics
`;

function NeighborhoodMiniMap() {
  const landmarkStyle = {
    position: "absolute",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.6)",
    color: "#e2e8f0",
    fontSize: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "170px",
        borderRadius: "10px",
        border: "1px solid rgba(148, 163, 184, 0.35)",
        background: "#0b1220",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "#142332" }} />
      <div style={{ position: "absolute", top: "45%", left: 0, right: 0, height: "12%", background: "#1f2937" }} />
      <div style={{ position: "absolute", left: "47%", top: 0, bottom: 0, width: "9%", background: "#1f2937" }} />
      <div style={{ ...landmarkStyle, left: "8%", top: "14%", width: "22%", height: "22%", background: "#166534" }}>Park</div>
      <div style={{ ...landmarkStyle, left: "66%", top: "12%", width: "24%", height: "24%", background: "#1d4ed8" }}>School</div>
      <div style={{ ...landmarkStyle, left: "67%", top: "62%", width: "22%", height: "24%", background: "#7c2d12" }}>Store</div>
      <div style={{ ...landmarkStyle, left: "10%", top: "64%", width: "42%", height: "20%", background: "#334155" }}>Homes</div>
    </div>
  );
}

function WorldMiniMap() {
  return (
    <svg
      viewBox="0 0 360 180"
      style={{
        width: "100%",
        height: "170px",
        borderRadius: "10px",
        border: "1px solid rgba(148, 163, 184, 0.35)",
        background: "#0b1220",
      }}
    >
      <rect x="0" y="0" width="360" height="180" fill="#082f49" />
      <path d="M24 58 L72 45 L112 58 L126 80 L88 98 L38 90 Z" fill="#14532d" />
      <path d="M130 44 L188 36 L228 52 L214 78 L166 88 L136 72 Z" fill="#166534" />
      <path d="M244 48 L320 54 L334 84 L300 106 L250 98 L232 72 Z" fill="#15803d" />
      <circle cx="164" cy="82" r="4" fill="#facc15" />
      <circle cx="286" cy="88" r="4" fill="#f97316" />
      <circle cx="86" cy="78" r="4" fill="#38bdf8" />
      <text x="10" y="170" fontSize="11" fill="#cbd5e1">World policy layer (concept preview)</text>
    </svg>
  );
}

function ConstitutionNeighborhoodPanel({ textValue, onTextChange }) {
  return (
    <aside
      style={{
        position: "fixed",
        top: "12px",
        left: "12px",
        width: "min(560px, 44vw)",
        height: "calc(100vh - 24px)",
        background: "rgba(2, 6, 23, 0.9)",
        border: "1px solid rgba(148, 163, 184, 0.45)",
        borderRadius: "12px",
        boxShadow: "0 16px 50px rgba(0, 0, 0, 0.45)",
        color: "#e2e8f0",
        display: "grid",
        gridTemplateRows: "auto auto auto 1fr",
        gap: "10px",
        padding: "12px",
        overflow: "hidden",
        zIndex: 10003,
        backdropFilter: "blur(6px)",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>Constitution Neighborhood Workbench</div>
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          Route-specific side panel with editor, neighborhood map, and world map.
        </div>
      </div>

      <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#93c5fd", marginBottom: "4px" }}>Neighborhood map</div>
          <NeighborhoodMiniMap />
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#93c5fd", marginBottom: "4px" }}>World map</div>
          <WorldMiniMap />
        </div>
      </div>

      <div style={{ fontSize: "12px", color: "#94a3b8" }}>
        Edit live specification notes below (stored in localStorage).
      </div>

      <textarea
        value={textValue}
        onChange={event => onTextChange(event.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "10px",
          border: "1px solid rgba(148, 163, 184, 0.45)",
          background: "#020617",
          color: "#e2e8f0",
          padding: "10px",
          resize: "none",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
          fontSize: "12px",
          lineHeight: 1.4,
        }}
      />
    </aside>
  );
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

const POKER_UI_EVENT_NAME = "hbl:poker-ui";
const POKER_ACTION_EVENT_NAME = "hbl:poker-action";

function emitPokerAction(action, amount = null) {
  window.dispatchEvent(
    new CustomEvent(POKER_ACTION_EVENT_NAME, {
      detail: {
        action,
        amount,
      },
    }),
  );
}

function GameplayOverlay() {
  const sceneId = sceneIdFromPathname(window.location.pathname);
  const isConstitutionNeighborhoodRoute = sceneId === CONSTITUTION_NEIGHBORHOOD_SCENE_ID;

  const [constitutionSpecText, setConstitutionSpecText] = useState(() => {
    if (!isConstitutionNeighborhoodRoute) {
      return DEFAULT_CONSTITUTION_NEIGHBORHOOD_SPEC;
    }

    try {
      return localStorage.getItem("hbl:constitution-neighborhood:spec") ?? DEFAULT_CONSTITUTION_NEIGHBORHOOD_SPEC;
    } catch {
      return DEFAULT_CONSTITUTION_NEIGHBORHOOD_SPEC;
    }
  });

  const [conversationScene, setConversationScene] = useState(
    () => window.__hblConversationScene ?? { npcs: [], range: 5 },
  );

  const [activeNpcId, setActiveNpcId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);

  const [pokerUi, setPokerUi] = useState(
    () =>
      window.__hblPokerUi ?? {
        active: false,
        nearTable: false,
        canSit: false,
        canStand: false,
        running: false,
        state: "waiting",
        message: "",
        players: [],
        communityCards: [],
        humanCards: [],
        pot: 0,
        currentBet: 0,
        callAmount: 0,
        minRaiseTo: 0,
        maxRaiseTo: 0,
        suggestedRaiseTo: 0,
        isHumanTurn: false,
        availableActions: {
          fold: false,
          check: false,
          call: false,
          raise: false,
        },
      },
  );

  const [raiseToAmount, setRaiseToAmount] = useState(0);

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
    function handlePokerUiEvent(event) {
      if (event?.detail) {
        setPokerUi(event.detail);
      }
    }

    window.addEventListener(POKER_UI_EVENT_NAME, handlePokerUiEvent);

    return () => {
      window.removeEventListener(POKER_UI_EVENT_NAME, handlePokerUiEvent);
    };
  }, []);

  useEffect(() => {
    const min = Number.isFinite(pokerUi?.minRaiseTo) ? pokerUi.minRaiseTo : 0;
    const max = Number.isFinite(pokerUi?.maxRaiseTo) ? pokerUi.maxRaiseTo : min;
    const suggested = Number.isFinite(pokerUi?.suggestedRaiseTo)
      ? pokerUi.suggestedRaiseTo
      : min;

    if (max <= 0) {
      setRaiseToAmount(0);
      return;
    }

    setRaiseToAmount(prev => {
      if (!Number.isFinite(prev) || prev < min || prev > max) {
        return Math.max(min, Math.min(max, suggested));
      }

      return prev;
    });
  }, [pokerUi?.minRaiseTo, pokerUi?.maxRaiseTo, pokerUi?.suggestedRaiseTo]);

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

  const pokerPlayers = pokerUi?.players ?? [];
  const humanPlayer = pokerPlayers.find(player => player?.isHuman) ?? null;
  const dealerPlayer = pokerPlayers.find(player => player?.id === pokerUi?.dealerPlayerId) ?? null;
  const smallBlindPlayer = pokerPlayers.find(player => player?.id === pokerUi?.smallBlindPlayerId) ?? null;
  const bigBlindPlayer = pokerPlayers.find(player => player?.id === pokerUi?.bigBlindPlayerId) ?? null;

  const minRaiseTo = Number.isFinite(pokerUi?.minRaiseTo) ? pokerUi.minRaiseTo : 0;
  const maxRaiseTo = Number.isFinite(pokerUi?.maxRaiseTo) ? pokerUi.maxRaiseTo : minRaiseTo;
  const canRaise = pokerUi?.availableActions?.raise === true;

  useEffect(() => {
    if (!isConstitutionNeighborhoodRoute) {
      return;
    }

    try {
      localStorage.setItem("hbl:constitution-neighborhood:spec", constitutionSpecText);
    } catch {
      // Ignore storage errors in private/incognito contexts.
    }
  }, [constitutionSpecText, isConstitutionNeighborhoodRoute]);

  return (
    <>
      {isConstitutionNeighborhoodRoute ? (
        <ConstitutionNeighborhoodPanel
          textValue={constitutionSpecText}
          onTextChange={setConstitutionSpecText}
        />
      ) : null}

      {!pokerUi?.active && pokerUi?.canSit ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "28px",
            transform: "translateX(-50%)",
            background: "rgba(2, 6, 23, 0.82)",
            color: "#f8fafc",
            border: "1px solid rgba(148, 163, 184, 0.5)",
            borderRadius: "999px",
            padding: "8px 10px",
            fontSize: "13px",
            zIndex: 10003,
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{pokerUi?.promptText ?? "Press E to play poker"}</span>
          <button
            type="button"
            onClick={() => emitPokerAction("start")}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.55)",
              borderRadius: "999px",
              background: "rgba(30, 41, 59, 0.95)",
              color: "#f8fafc",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            Sit
          </button>
        </div>
      ) : null}

      {pokerUi?.active ? (
        <div
          style={{
            position: "fixed",
            right: "18px",
            bottom: "18px",
            width: "min(420px, 90vw)",
            background: "rgba(2, 6, 23, 0.84)",
            border: "1px solid rgba(148, 163, 184, 0.45)",
            borderRadius: "12px",
            color: "#e2e8f0",
            padding: "12px",
            zIndex: 10003,
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
            <strong>Poker Table</strong>
            <button
              type="button"
              onClick={() => emitPokerAction("stand")}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.5)",
                borderRadius: "8px",
                background: "rgba(30, 41, 59, 0.95)",
                color: "#f8fafc",
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              Stand up (E)
            </button>
          </div>

          <div style={{ fontSize: "13px", color: "#93c5fd", marginBottom: "6px" }}>
            {pokerUi?.message ?? ""}
          </div>

          <div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px" }}>
            Dealer: {dealerPlayer?.name ?? "--"} • SB: {smallBlindPlayer?.name ?? "--"} (${pokerUi?.smallBlindAmount ?? 0}) • BB: {bigBlindPlayer?.name ?? "--"} (${pokerUi?.bigBlindAmount ?? 0})
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginBottom: "8px" }}>
            <div>Pot: <strong>${pokerUi?.pot ?? 0}</strong></div>
            <div>Current bet: <strong>${pokerUi?.currentBet ?? 0}</strong></div>
            <div>Your chips: <strong>${humanPlayer?.chips ?? 0}</strong></div>
            <div>Your cards: <strong>{(pokerUi?.humanCards ?? []).join(" ") || "--"}</strong></div>
          </div>

          <div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px" }}>
            Community: {(pokerUi?.communityCards ?? []).join(" ") || "(none yet)"}
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                onClick={() => emitPokerAction("fold")}
                disabled={!pokerUi?.availableActions?.fold}
                style={{
                  background: "#991b1b",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  cursor: pokerUi?.availableActions?.fold ? "pointer" : "not-allowed",
                  opacity: pokerUi?.availableActions?.fold ? 1 : 0.5,
                }}
              >
                Fold
              </button>

              <button
                type="button"
                onClick={() => emitPokerAction("check")}
                disabled={!pokerUi?.availableActions?.check}
                style={{
                  background: "#1d4ed8",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  cursor: pokerUi?.availableActions?.check ? "pointer" : "not-allowed",
                  opacity: pokerUi?.availableActions?.check ? 1 : 0.5,
                }}
              >
                Check
              </button>

              <button
                type="button"
                onClick={() => emitPokerAction("call")}
                disabled={!pokerUi?.availableActions?.call}
                style={{
                  background: "#0f766e",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  cursor: pokerUi?.availableActions?.call ? "pointer" : "not-allowed",
                  opacity: pokerUi?.availableActions?.call ? 1 : 0.5,
                }}
              >
                Call ${pokerUi?.callAmount ?? 0}
              </button>
            </div>

            <div style={{ opacity: canRaise ? 1 : 0.55 }}>
              <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                Raise to ${raiseToAmount}
              </div>

              <input
                type="range"
                min={minRaiseTo}
                max={Math.max(minRaiseTo, maxRaiseTo)}
                step={pokerUi?.currentBet >= 20 ? 20 : 10}
                value={Math.max(minRaiseTo, Math.min(maxRaiseTo, raiseToAmount || minRaiseTo))}
                disabled={!canRaise}
                onChange={event => setRaiseToAmount(Number(event.target.value))}
                style={{ width: "100%" }}
              />

              <button
                type="button"
                disabled={!canRaise}
                onClick={() => emitPokerAction("raise", raiseToAmount)}
                style={{
                  marginTop: "6px",
                  width: "100%",
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  cursor: canRaise ? "pointer" : "not-allowed",
                  opacity: canRaise ? 1 : 0.5,
                }}
              >
                Raise
              </button>
            </div>
          </div>
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
