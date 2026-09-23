import React, { useEffect, useMemo, useState } from "https://esm.sh/react@19.1.1";
import "./index.js";

const h = React.createElement;

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

      return h(
        "article",
        {
          key: file.name,
          style: {
            border: "1px solid #334155",
            borderRadius: "10px",
            overflow: "hidden",
            background: "#111827",
            minHeight: "180px",
          },
        },
        h("img", {
          src: file.url,
          alt: file.name,
          loading: "lazy",
          style: {
            width: "100%",
            height: "180px",
            objectFit: "cover",
            display: "block",
            background: "#020617",
          },
        }),
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
            },
          },
          h(
            "div",
            {
              style: {
                fontSize: "13px",
                color: "#cbd5e1",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            },
            file.name,
          ),
          h(
            "a",
            {
              href: sceneId ? `/game/${sceneId}` : "/game/1",
              style: {
                color: "#93c5fd",
                fontSize: "13px",
                textDecoration: "none",
              },
            },
            sceneId ? `Play /game/${sceneId}` : "Play scene",
          ),
        ),
      );
    });
  }, [files]);

  return h(
    "main",
    {
      style: {
        position: "fixed",
        inset: 0,
        overflow: "auto",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        zIndex: 10002,
      },
    },
    h(
      "div",
      {
        style: {
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px",
        },
      },
      h("h1", { style: { margin: "0 0 8px", fontSize: "28px" } }, "Game Screenshots"),
      h(
        "p",
        { style: { margin: "0 0 20px", color: "#94a3b8" } },
        "3x3 gallery from data/screenshots",
      ),
      status === "loading"
        ? h("div", null, "Loading screenshots...")
        : null,
      status === "error"
        ? h(
            "div",
            {
              style: {
                border: "1px dashed #334155",
                borderRadius: "10px",
                padding: "24px",
                color: "#94a3b8",
              },
            },
            error,
          )
        : null,
      status === "ready" && files.length === 0
        ? h(
            "div",
            {
              style: {
                border: "1px dashed #334155",
                borderRadius: "10px",
                padding: "24px",
                color: "#94a3b8",
              },
            },
            "No screenshots found yet. Add images to data/screenshots or run bun run screenshot:index.",
          )
        : null,
      status === "ready" && files.length > 0
        ? h(
            "section",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "16px",
              },
            },
            ...gridContent,
          )
        : null,
    ),
  );
}

function GameplayOverlay() {
  return null;
}

export default function App() {
  const gallery = isGalleryRoute(window.location.pathname);
  return gallery ? h(ScreenshotGallery) : h(GameplayOverlay);
}
