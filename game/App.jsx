import React, { useState } from "https://esm.sh/react@19.1.1";
import "./index.js";

const h = React.createElement;

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return h(
    React.Fragment,
    null,
    h(
      "div",
      {
        style: {
          position: "fixed",
          top: "12px",
          right: "12px",
          zIndex: 10001,
        },
      },
      h(
        "button",
        {
          type: "button",
          onClick: () => setIsModalOpen(true),
          style: {
            padding: "8px 12px",
            borderRadius: "8px",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontFamily:
              "Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
            fontSize: "14px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            cursor: "pointer",
          },
        },
        "Edit"
      )
    ),
    isModalOpen
      ? h(
          "div",
          {
            onClick: () => setIsModalOpen(false),
            style: {
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              display: "grid",
              placeItems: "center",
              zIndex: 10000,
            },
          },
          h(
            "div",
            {
              onClick: (event) => event.stopPropagation(),
              style: {
                background: "#fff",
                color: "#111827",
                borderRadius: "10px",
                padding: "20px",
                minWidth: "280px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
                fontFamily:
                  "Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
              },
            },
            h(
              "p",
              {
                style: {
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 600,
                },
              },
              "hello world"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => setIsModalOpen(false),
                style: {
                  marginTop: "16px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                },
              },
              "Close"
            )
          )
        )
      : null
  );
}
