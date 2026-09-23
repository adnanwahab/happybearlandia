import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@19.1.1";
import { startGame, stopGame } from "./index.js";

import { Description, Dialog, DialogPanel, DialogTitle } from "https://esm.sh/@headlessui/react@2.2.10";

function Example() {
  let [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open dialog</button>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel className="max-w-lg space-y-4 border bg-white p-12">
            <DialogTitle className="font-bold">Deactivate account</DialogTitle>
            <Description>This will permanently deactivate your account</Description>
            <p>Are you sure you want to deactivate your account? All of your data will be permanently removed.</p>
            <div className="flex gap-4">
              <button onClick={() => setIsOpen(false)}>Cancel</button>
              <button onClick={() => setIsOpen(false)}>Deactivate</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}

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

  return (
    <>
      {/* <Example></Example>*/}
      <div
        id="container"
        ref={containerRef}
        style={{ width: "100vw", height: "100vh" }}
      />
      <a
        href={`/edit-game/${sceneId}`}
        style={{
          position: "fixed",
          top: "12px",
          right: "12px",
          zIndex: 9999,
          padding: "8px 12px",
          borderRadius: "8px",
          background: "#2563eb",
          color: "#fff",
          textDecoration: "none",
          fontFamily: "Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
          fontSize: "14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        }}
      >
        Edit
      </a>
    </>
  );
}
