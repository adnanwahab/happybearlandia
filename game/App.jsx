import React, { useEffect, useMemo, useRef } from "https://esm.sh/react@19.1.1";
import { startGame, stopGame } from "./index.js";

function sceneIdFromRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "game" && parts[1] ? parts[1] : "scene";
}

export default function App() {
  const containerRef = useRef(null);

  const sceneId = useMemo(
    () => sceneIdFromRoute(window.location.pathname),
    []
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    startGame({ containerElement: container }).catch(() => {
      // Error already shown in container by startGame.
    });

    return () => {
      stopGame();
    };
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", {
      id: "container",
      ref: containerRef,
      style: { width: "100vw", height: "100vh" },
    }),
    React.createElement(
      "a",
      {
        href: `/edit-game/${sceneId}`,
        style: {
          position: "fixed",
          top: "12px",
          right: "12px",
          zIndex: 9999,
          padding: "8px 12px",
          borderRadius: "8px",
          background: "#2563eb",
          color: "#fff",
          textDecoration: "none",
          fontFamily:
            "Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
          fontSize: "14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        },
      },
      "Edit"
    )
  );
}
