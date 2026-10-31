
import React, { useEffect, useMemo, useRef, useState } from "react";
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
    return parts.slice(1).join("/");
  }

  return "1";
}

const CONSTITUTION_NEIGHBORHOOD_SCENE_ID = "constitution-neighborhood";

function neighborhoodRouteForCity(citySlug) {
  return `/game/${CONSTITUTION_NEIGHBORHOOD_SCENE_ID}/${citySlug}`;
}

const CONSTITUTION_SCOPE_TABS = [
  {
    id: "world",
    label: "World",
    subtitle: "Treaties, trade rules, migration rules",
  },
  {
    id: "country",
    label: "Country",
    subtitle: "Constitution (hard limits)",
  },
  {
    id: "city",
    label: "City",
    subtitle: "Ordinances, zoning, taxes, policing budget",
  },
  {
    id: "neighborhood",
    label: "Neighborhood",
    subtitle: "HOA rules and local norms",
  },
  {
    id: "house",
    label: "House",
    subtitle: "Chores, curfew, screen time, rent",
  },
];

const DEFAULT_CONSTITUTION_SCOPE_DOCS = {
  world: `# World\n\nScope: treaties, trade rules, migration rules\n\n- treaty_open_labor_mobility:\n  - migration_permit_score >= 0.70\n  - annual cap by corridor\n- trade_rule_food_imports:\n  - tariff: 2%\n  - subsidy: staple foods +3%\n- sanctions_rule:\n  - restricted goods list maintained quarterly\n`,
  country: `# Country\n\nScope: the constitution, which sets hard limits on everything below it\n\nHard limits:\n- Equal protection and due process\n- No city/neighborhood/house rule may violate constitutional rights\n- Rule conflicts are flagged and invalidated at compile time\n\nConstitutional checker:\n- lower_scope_rule must narrow, never broaden, higher-scope constraints\n`,
  city: `# City\n\nScope: ordinances, zoning, taxes, policing budget\n\n- zoning:\n  - max_building_height: 3 stories (in residential district R1)\n- tax:\n  - sales_tax_local: 1.5%\n  - property_tax: progressive by assessed value\n- policing_budget:\n  - patrol_hours_weight: 0.35\n  - response_time_target_minutes: 9\n`,
  neighborhood: `# Neighborhood\n\nScope: HOA rules, local norms\n\n- quiet_hours: 22:00-07:00\n- shared_space_rules:\n  - park_cleanup_rotation: weekly\n  - pet_leash_required: true\n- norm_spread_model:\n  - influence_radius: 3 homes\n  - adoption_decay: 0.12\n`,
  house: `# House\n\nScope: house rules (chores, curfew, screen time, who pays rent)\n\nHouse A:\n- chores: dishes by 20:00\n- curfew: 21:30\n\nHouse B:\n- screen_time_weekday_minutes: 90\n- chores: laundry on Tue/Thu\n\nHouse C:\n- shared_rent_split: 40/30/30\n- late_rent_penalty: 5%\n\nHouse D:\n- quiet_after: 22:00\n- chores: trash out on Wednesday\n`,
};

const DEFAULT_ACTIVE_SCOPE_TAB = "world";

const HOUSE_TASKS = [
  "House A: resident doing dishes (chores)",
  "House B: resident on timed screen session (screen time)",
  "House C: resident bookkeeping rent split (who pays rent)",
  "House D: resident preparing for curfew routine",
];

const CITY_NEIGHBORHOOD_MAP_CONFIG = {
  "new-york": {
    cityLabel: "New York",
    grass: "#3f7f43",
    accentA: { x: 36, y: 20, w: 34, h: 22, color: "#334155", label: "Skyline" },
    accentB: { x: 40, y: 48, w: 26, h: 12, color: "#0f172a", label: "Subway" },
  },
  london: {
    cityLabel: "London",
    grass: "#4a874a",
    accentA: { x: 36, y: 20, w: 12, h: 24, color: "#c2410c", label: "Tower" },
    accentB: { x: 52, y: 48, w: 22, h: 10, color: "#dc2626", label: "Bus" },
  },
  tokyo: {
    cityLabel: "Tokyo",
    grass: "#4a8b4a",
    accentA: { x: 34, y: 20, w: 26, h: 8, color: "#dc2626", label: "Torii" },
    accentB: { x: 42, y: 46, w: 24, h: 10, color: "#f59e0b", label: "Lanterns" },
  },
  lagos: {
    cityLabel: "Lagos",
    grass: "#3a7a3f",
    accentA: { x: 34, y: 20, w: 30, h: 12, color: "#0369a1", label: "Lagoon" },
    accentB: { x: 40, y: 44, w: 26, h: 12, color: "#22c55e", label: "Market" },
  },
  "sao-paulo": {
    cityLabel: "Sao Paulo",
    grass: "#4c8445",
    accentA: { x: 34, y: 20, w: 30, h: 8, color: "#7c3aed", label: "Mural" },
    accentB: { x: 38, y: 44, w: 30, h: 12, color: "#1d4ed8", label: "Court" },
  },
  sydney: {
    cityLabel: "Sydney",
    grass: "#4f8f4f",
    accentA: { x: 34, y: 20, w: 30, h: 10, color: "#e2e8f0", label: "Opera" },
    accentB: { x: 38, y: 44, w: 30, h: 12, color: "#0ea5e9", label: "Harbor" },
  },
  cairo: {
    cityLabel: "Cairo",
    grass: "#879a4b",
    accentA: { x: 34, y: 20, w: 24, h: 12, color: "#ca8a04", label: "Pyramids" },
    accentB: { x: 40, y: 44, w: 26, h: 12, color: "#f59e0b", label: "Bazaar" },
  },
  mumbai: {
    cityLabel: "Mumbai",
    grass: "#4d8447",
    accentA: { x: 34, y: 20, w: 30, h: 10, color: "#64748b", label: "Rail" },
    accentB: { x: 40, y: 44, w: 26, h: 12, color: "#b45309", label: "Kiosk" },
  },
  paris: {
    cityLabel: "Paris",
    grass: "#5a9150",
    accentA: { x: 36, y: 20, w: 16, h: 12, color: "#d4d4d8", label: "Arch" },
    accentB: { x: 52, y: 44, w: 18, h: 12, color: "#7c2d12", label: "Cafe" },
  },
  "mexico-city": {
    cityLabel: "Mexico City",
    grass: "#4c8a47",
    accentA: { x: 34, y: 20, w: 30, h: 12, color: "#9ca3af", label: "Zocalo" },
    accentB: { x: 40, y: 44, w: 26, h: 12, color: "#16a34a", label: "Market" },
  },
};

function getConstitutionNeighborhoodCitySlug(sceneId) {
  if (!sceneId || typeof sceneId !== "string") {
    return null;
  }

  if (!sceneId.startsWith(`${CONSTITUTION_NEIGHBORHOOD_SCENE_ID}/`)) {
    return null;
  }

  const suffix = sceneId.slice(`${CONSTITUTION_NEIGHBORHOOD_SCENE_ID}/`.length).trim();

  return suffix || null;
}

function titleCaseLabel(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMiniMapConfigFromSceneData(sceneId, sceneData) {
  const citySlug = getConstitutionNeighborhoodCitySlug(sceneId);
  const staticConfig = citySlug ? CITY_NEIGHBORHOOD_MAP_CONFIG[citySlug] ?? null : null;
  const objects = Array.isArray(sceneData?.objects) ? sceneData.objects : [];

  const floorObject = objects.find(object => object?.id === "floor");
  const floorHalfWidth = Math.max(40, (floorObject?.size?.[0] ?? 180) / 2);
  const floorHalfDepth = Math.max(40, (floorObject?.size?.[2] ?? 180) / 2);

  const toMiniMapPoint = (worldX, worldZ) => ({
    x: 180 + (worldX / floorHalfWidth) * 140,
    y: 90 + (worldZ / floorHalfDepth) * 64,
  });

  const cultureObjects = objects.filter(object =>
    typeof object?.id === "string" && object.id.startsWith("culture-")
  );

  const accentObjects = cultureObjects.slice(0, 2);

  const accentA = accentObjects[0]
    ? {
        color: accentObjects[0].color ?? staticConfig?.accentA?.color ?? "#475569",
        label: titleCaseLabel(
          accentObjects[0].id
            .replace(/^culture-/, "")
            .split("-")
            .slice(1)
            .join("-")
        ),
      }
    : staticConfig?.accentA ?? null;

  const accentB = accentObjects[1]
    ? {
        color: accentObjects[1].color ?? staticConfig?.accentB?.color ?? "#64748b",
        label: titleCaseLabel(
          accentObjects[1].id
            .replace(/^culture-/, "")
            .split("-")
            .slice(1)
            .join("-")
        ),
      }
    : staticConfig?.accentB ?? null;

  const houseFloors = objects
    .filter(object =>
      typeof object?.id === "string" &&
      /^house-\d+-floor$/i.test(object.id)
    )
    .map((house, index) => {
      const point = toMiniMapPoint(
        house.position?.[0] ?? 0,
        house.position?.[2] ?? 0
      );

      return {
        id: house.id,
        number: index + 1,
        x: point.x,
        y: point.y,
      };
    });

  const residentPoints = objects
    .filter(object =>
      typeof object?.id === "string" &&
      object.id.startsWith("resident-house-")
    )
    .map(object => {
      const point = toMiniMapPoint(
        object.position?.[0] ?? 0,
        object.position?.[2] ?? 0
      );

      return {
        id: object.id,
        x: point.x,
        y: point.y,
      };
    });

  return {
    cityLabel:
      staticConfig?.cityLabel ??
      (citySlug ? titleCaseLabel(citySlug) : null),
    grass:
      floorObject?.color ??
      staticConfig?.grass ??
      "#315f2d",
    accentA: accentA
      ? {
          x: staticConfig?.accentA?.x ?? 36,
          y: staticConfig?.accentA?.y ?? 20,
          w: staticConfig?.accentA?.w ?? 28,
          h: staticConfig?.accentA?.h ?? 12,
          ...accentA,
        }
      : null,
    accentB: accentB
      ? {
          x: staticConfig?.accentB?.x ?? 40,
          y: staticConfig?.accentB?.y ?? 44,
          w: staticConfig?.accentB?.w ?? 26,
          h: staticConfig?.accentB?.h ?? 12,
          ...accentB,
        }
      : null,
    houses: houseFloors,
    residents: residentPoints,
  };
}

function NeighborhoodMiniMap({ citySlug = null, mapConfig = null }) {
  const cityConfig =
    mapConfig ??
    (citySlug ? CITY_NEIGHBORHOOD_MAP_CONFIG[citySlug] ?? null : null);

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
      <rect x="0" y="0" width="360" height="180" fill={cityConfig?.grass ?? "#315f2d"} />

      <rect x="40" y="84" width="280" height="12" rx="6" fill="#8b7d67" />
      <rect x="174" y="24" width="12" height="132" rx="6" fill="#8b7d67" />
      <rect x="156" y="72" width="48" height="36" rx="8" fill="#9ca3af" opacity="0.85" />

      {(cityConfig?.houses?.length > 0
        ? cityConfig.houses
        : [
            { id: "fallback-house-1", number: 1, x: 101, y: 57 },
            { id: "fallback-house-2", number: 2, x: 259, y: 57 },
            { id: "fallback-house-3", number: 3, x: 101, y: 123 },
            { id: "fallback-house-4", number: 4, x: 259, y: 123 },
          ]).map(house => (
        <g key={house.id}>
          <rect
            x={house.x - 11}
            y={house.y - 8}
            width="22"
            height="16"
            rx="4"
            fill="#f8fafc"
            stroke="#334155"
            strokeWidth="1"
          />
          <text
            x={house.x}
            y={house.y + 3}
            textAnchor="middle"
            fontSize="9"
            fill="#0f172a"
          >
            {house.number}
          </text>
        </g>
      ))}

      {(cityConfig?.residents?.length > 0
        ? cityConfig.residents
        : [
            { id: "fallback-resident-1", x: 96, y: 62 },
            { id: "fallback-resident-2", x: 254, y: 62 },
            { id: "fallback-resident-3", x: 96, y: 128 },
            { id: "fallback-resident-4", x: 254, y: 128 },
          ]).map(resident => (
        <circle
          key={resident.id}
          cx={resident.x}
          cy={resident.y}
          r="2.6"
          fill="#facc15"
          stroke="#f8fafc"
          strokeWidth="1"
        />
      ))}

      {cityConfig?.accentA ? (
        <>
          <rect
            x={cityConfig.accentA.x}
            y={cityConfig.accentA.y}
            width={cityConfig.accentA.w}
            height={cityConfig.accentA.h}
            rx="4"
            fill={cityConfig.accentA.color}
            opacity="0.92"
          />
          <text
            x={cityConfig.accentA.x + cityConfig.accentA.w / 2}
            y={cityConfig.accentA.y + cityConfig.accentA.h / 2 + 3}
            textAnchor="middle"
            fontSize="9"
            fill="#f8fafc"
          >
            {cityConfig.accentA.label}
          </text>
        </>
      ) : null}

      {cityConfig?.accentB ? (
        <>
          <rect
            x={cityConfig.accentB.x}
            y={cityConfig.accentB.y}
            width={cityConfig.accentB.w}
            height={cityConfig.accentB.h}
            rx="4"
            fill={cityConfig.accentB.color}
            opacity="0.92"
          />
          <text
            x={cityConfig.accentB.x + cityConfig.accentB.w / 2}
            y={cityConfig.accentB.y + cityConfig.accentB.h / 2 + 3}
            textAnchor="middle"
            fontSize="9"
            fill="#f8fafc"
          >
            {cityConfig.accentB.label}
          </text>
        </>
      ) : null}

      <text x="8" y="172" fontSize="11" fill="#dbeafe">
        {cityConfig?.cityLabel
          ? `${cityConfig.cityLabel}: ${(cityConfig?.houses?.length ?? 0) || 4} houses, city landmarks`
          : "Neighborhood: grassy park + dynamic house layouts"}
      </text>
    </svg>
  );
}

const WORLD_CITIES = [
  { slug: "new-york", name: "New York", country: "USA", coordinates: [-74.006, 40.7128] },
  { slug: "london", name: "London", country: "UK", coordinates: [-0.1276, 51.5072] },
  { slug: "tokyo", name: "Tokyo", country: "Japan", coordinates: [139.6917, 35.6895] },
  { slug: "lagos", name: "Lagos", country: "Nigeria", coordinates: [3.3792, 6.5244] },
  { slug: "sao-paulo", name: "Sao Paulo", country: "Brazil", coordinates: [-46.6333, -23.5505] },
  { slug: "sydney", name: "Sydney", country: "Australia", coordinates: [151.2093, -33.8688] },
  { slug: "cairo", name: "Cairo", country: "Egypt", coordinates: [31.2357, 30.0444] },
  { slug: "mumbai", name: "Mumbai", country: "India", coordinates: [72.8777, 19.076] },
  { slug: "paris", name: "Paris", country: "France", coordinates: [2.3522, 48.8566] },
  { slug: "mexico-city", name: "Mexico City", country: "Mexico", coordinates: [-99.1332, 19.4326] },
];

let cachedDeckScriptPromise = null;

function ensureDeckGlScript() {
  if (window.deck) {
    return Promise.resolve(window.deck);
  }

  if (cachedDeckScriptPromise) {
    return cachedDeckScriptPromise;
  }

  cachedDeckScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/deck.gl@9.0.35/dist.min.js";
    script.async = true;
    script.onload = () => resolve(window.deck);
    script.onerror = () => reject(new Error("Unable to load deck.gl"));
    document.head.appendChild(script);
  });

  return cachedDeckScriptPromise;
}

function WorldMiniMap({ onCityClick }) {
  const containerRef = useRef(null);
  const deckInstanceRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    async function mountDeck() {
      try {
        const deck = await ensureDeckGlScript();

        if (cancelled || !containerRef.current || !deck) {
          return;
        }

        const { Deck, GeoJsonLayer, ScatterplotLayer, TextLayer } = deck;

        const worldLayer = new GeoJsonLayer({
          id: "world-countries",
          data: "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson",
          filled: true,
          stroked: true,
          getFillColor: [24, 73, 120, 180],
          getLineColor: [148, 163, 184, 190],
          lineWidthMinPixels: 1,
          pickable: false,
        });

        const cityLayer = new ScatterplotLayer({
          id: "world-cities",
          data: WORLD_CITIES,
          getPosition: d => d.coordinates,
          getRadius: 260000,
          radiusMinPixels: 4,
          radiusMaxPixels: 10,
          getFillColor: [250, 204, 21, 230],
          getLineColor: [255, 255, 255, 220],
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: true,
          onClick: info => {
            const city = info?.object;

            if (city?.slug && typeof onCityClick === "function") {
              onCityClick(city);
            }
          },
        });

        const cityLabels = new TextLayer({
          id: "world-city-labels",
          data: WORLD_CITIES,
          getPosition: d => d.coordinates,
          getText: d => d.name,
          getSize: 11,
          sizeUnits: "pixels",
          getColor: [226, 232, 240, 255],
          getTextAnchor: "start",
          getAlignmentBaseline: "center",
          getPixelOffset: [8, -2],
          pickable: false,
        });

        const deckInstance = new Deck({
          parent: containerRef.current,
          initialViewState: {
            longitude: 10,
            latitude: 18,
            zoom: 0.9,
            minZoom: 0.7,
            maxZoom: 4,
            pitch: 0,
            bearing: 0,
          },
          controller: true,
          layers: [worldLayer, cityLayer, cityLabels],
          getTooltip: ({ object }) =>
            object?.name
              ? `${object.name}, ${object.country}`
              : null,
          parameters: {
            clearColor: [11, 18, 32, 1],
          },
        });

        deckInstanceRef.current = deckInstance;
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    mountDeck();

    return () => {
      cancelled = true;

      if (deckInstanceRef.current) {
        deckInstanceRef.current.finalize();
        deckInstanceRef.current = null;
      }
    };
  }, [onCityClick]);

  return (
    <div
      style={{
        width: "100%",
        height: "170px",
        borderRadius: "10px",
        border: "1px solid rgba(148, 163, 184, 0.35)",
        background: "#0b1220",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {status !== "ready" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#cbd5e1",
            fontSize: "11px",
            background: "rgba(2, 6, 23, 0.6)",
          }}
        >
          {status === "loading" ? "Loading deck.gl world map..." : "Unable to load deck.gl map"}
        </div>
      ) : null}
    </div>
  );
}

function ConstitutionNeighborhoodPanel({
  scopeDocs,
  activeScopeTab,
  onSelectScopeTab,
  onScopeDocChange,
  onCityClick,
  citySlug,
  cityMiniMapConfig,
}) {
  const activeTabMeta = CONSTITUTION_SCOPE_TABS.find(tab => tab.id === activeScopeTab) ?? CONSTITUTION_SCOPE_TABS[0];
  const activeDocText = scopeDocs?.[activeTabMeta.id] ?? "";

  return (
    <aside
      style={{
        position: "fixed",
        top: "12px",
        left: "12px",
        width: "min(620px, 48vw)",
        height: "calc(100vh - 24px)",
        background: "rgba(2, 6, 23, 0.9)",
        border: "1px solid rgba(148, 163, 184, 0.45)",
        borderRadius: "12px",
        boxShadow: "0 16px 50px rgba(0, 0, 0, 0.45)",
        color: "#e2e8f0",
        display: "grid",
        gridTemplateRows: "auto auto auto auto auto 1fr",
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
          Grassy park neighborhood with 4 houses and household rule-behavior tasks.
        </div>
      </div>

      <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#93c5fd", marginBottom: "4px" }}>
            Neighborhood map{cityMiniMapConfig?.cityLabel ? ` (${cityMiniMapConfig.cityLabel})` : citySlug ? ` (${citySlug})` : ""}
          </div>
          <NeighborhoodMiniMap citySlug={citySlug} mapConfig={cityMiniMapConfig} />
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#93c5fd", marginBottom: "4px" }}>World map (click a city)</div>
          <WorldMiniMap onCityClick={onCityClick} />
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#94a3b8", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: "8px", padding: "8px" }}>
        <div style={{ fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>Household task simulation in-scene</div>
        {HOUSE_TASKS.map(task => (
          <div key={task}>• {task}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {CONSTITUTION_SCOPE_TABS.map(tab => {
          const active = tab.id === activeTabMeta.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectScopeTab(tab.id)}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.45)",
                borderRadius: "999px",
                background: active ? "#1d4ed8" : "rgba(30, 41, 59, 0.92)",
                color: "#f8fafc",
                fontSize: "12px",
                padding: "5px 10px",
                cursor: "pointer",
              }}
              title={tab.subtitle}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: "12px", color: "#94a3b8" }}>
        <strong style={{ color: "#cbd5e1" }}>{activeTabMeta.label}</strong>: {activeTabMeta.subtitle}
      </div>

      <textarea
        value={activeDocText}
        onChange={event => onScopeDocChange(activeTabMeta.id, event.target.value)}
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

function getOrCreateConversationPlayerId() {
  const storageKey = "hbl:conversation-player-id";

  try {
    const existing = localStorage.getItem(storageKey);

    if (typeof existing === "string" && existing.trim()) {
      return existing.trim();
    }

    const generated =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return "local-player";
  }
}

function getFirstConversation(npc) {
  if (!npc) {
    return null;
  }

  if (Array.isArray(npc.conversations) && npc.conversations.length > 0) {
    return npc.conversations[0] ?? null;
  }

  const starter = npc?.conversation_mode?.starter;

  if (typeof starter !== "string" || !starter.trim()) {
    return null;
  }

  const suggestedPrompts = Array.isArray(npc?.conversation_mode?.suggested_player_prompts)
    ? npc.conversation_mode.suggested_player_prompts
    : [];

  return {
    id: `${npc.id}-open-ended`,
    start: "start",
    tree: {
      start: {
        speaker: npc.name ?? "Resident",
        text: starter,
        choices: suggestedPrompts.slice(0, 6).map((text, index) => ({
          id: `${npc.id}-suggested-${index + 1}`,
          text,
          next: null,
        })),
      },
    },
  };
}

const POKER_UI_EVENT_NAME = "hbl:poker-ui";
const POKER_ACTION_EVENT_NAME = "hbl:poker-action";
const CONVERSATION_CHOICE_EVENT_NAME = "hbl:conversation-choice";
const CONVERSATION_SOCIAL_RESULT_EVENT_NAME = "hbl:conversation-social-result";

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
  const currentConstitutionCitySlug = getConstitutionNeighborhoodCitySlug(sceneId);

  const isConstitutionNeighborhoodRoute =
    sceneId === CONSTITUTION_NEIGHBORHOOD_SCENE_ID ||
    sceneId.startsWith(`${CONSTITUTION_NEIGHBORHOOD_SCENE_ID}/`);

  const [activeScopeTab, setActiveScopeTab] = useState(() => {
    if (!isConstitutionNeighborhoodRoute) {
      return DEFAULT_ACTIVE_SCOPE_TAB;
    }

    try {
      return localStorage.getItem("hbl:constitution-neighborhood:active-scope") ?? DEFAULT_ACTIVE_SCOPE_TAB;
    } catch {
      return DEFAULT_ACTIVE_SCOPE_TAB;
    }
  });

  const [constitutionScopeDocs, setConstitutionScopeDocs] = useState(() => {
    if (!isConstitutionNeighborhoodRoute) {
      return DEFAULT_CONSTITUTION_SCOPE_DOCS;
    }

    try {
      const stored = localStorage.getItem("hbl:constitution-neighborhood:scope-docs");

      if (!stored) {
        return DEFAULT_CONSTITUTION_SCOPE_DOCS;
      }

      const parsed = JSON.parse(stored);

      if (!parsed || typeof parsed !== "object") {
        return DEFAULT_CONSTITUTION_SCOPE_DOCS;
      }

      return {
        ...DEFAULT_CONSTITUTION_SCOPE_DOCS,
        ...parsed,
      };
    } catch {
      return DEFAULT_CONSTITUTION_SCOPE_DOCS;
    }
  });

  const [cityMiniMapConfig, setCityMiniMapConfig] = useState(() => {
    if (!isConstitutionNeighborhoodRoute) {
      return null;
    }

    return buildMiniMapConfigFromSceneData(sceneId, null);
  });

  const [conversationScene, setConversationScene] = useState(
    () => window.__hblConversationScene ?? { npcs: [], range: 5 },
  );

  const conversationPlayerId = useMemo(() => getOrCreateConversationPlayerId(), []);

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
  const [openEndedPrompt, setOpenEndedPrompt] = useState("");
  const [openEndedReply, setOpenEndedReply] = useState("");
  const [openEndedTranscript, setOpenEndedTranscript] = useState([]);
  const [openEndedError, setOpenEndedError] = useState("");
  const [openEndedLoading, setOpenEndedLoading] = useState(false);
  const [socialFeedback, setSocialFeedback] = useState(null);

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
    setOpenEndedPrompt("");
    setOpenEndedReply("");
    setOpenEndedTranscript([]);
    setOpenEndedError("");
    setOpenEndedLoading(false);
    setSocialFeedback(null);
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
    setSocialFeedback(null);
    setOpenEndedTranscript([]);
    setDialogActiveFlag(true);

    return true;
  }

  function chooseDialogOption(choiceIndex) {
    const choice = dialogChoices[choiceIndex];

    if (!choice) {
      return;
    }

    const nextNodeId = choice.next;

    setSocialFeedback(null);

    window.dispatchEvent(
      new CustomEvent(CONVERSATION_CHOICE_EVENT_NAME, {
        detail: {
          sceneId,
          npcId: activeNpcId,
          conversationId: activeConversationId,
          nodeId: currentNodeId,
          choice,
          nextNodeId,
          at: Date.now(),
        },
      }),
    );

    if (!nextNodeId) {
      if (typeof choice.text === "string" && choice.text.trim()) {
        setOpenEndedPrompt(choice.text);
      }
      return;
    }

    if (!activeConversation?.tree?.[nextNodeId]) {
      closeConversation();
      return;
    }

    setCurrentNodeId(nextNodeId);
  }

  async function submitOpenEndedPrompt() {
    const message = openEndedPrompt.trim();

    if (!message || openEndedLoading || !activeNpcId) {
      return;
    }

    const normalizedMessage = message.toLowerCase();

    const wantsFollow =
      normalizedMessage.includes("follow me") ||
      normalizedMessage.includes("come with me") ||
      normalizedMessage.includes("walk with me");

    const wantsStopFollowing =
      normalizedMessage.includes("wait here") ||
      normalizedMessage.includes("stay here") ||
      normalizedMessage.includes("stop following");

    if (wantsFollow || wantsStopFollowing) {
      window.dispatchEvent(
        new CustomEvent(CONVERSATION_CHOICE_EVENT_NAME, {
          detail: {
            sceneId,
            npcId: activeNpcId,
            conversationId: activeConversationId,
            nodeId: currentNodeId,
            choice: {
              id: "open-ended-social-action",
              text: message,
              socialAction: {
                type: wantsFollow
                  ? "start_following"
                  : "stop_following",
              },
            },
            nextNodeId: currentNodeId,
            at: Date.now(),
          },
        }),
      );
    }

    setOpenEndedLoading(true);
    setOpenEndedError("");

    try {
      setOpenEndedTranscript(previous => [
        ...previous,
        {
          role: "player",
          text: message,
          at: Date.now(),
        },
      ]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let response;

      try {
        response = await fetch("/api/conversations/open-ended", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sceneId,
            npcId: activeNpcId,
            npcName: currentNode?.speaker ?? activeNpc?.name ?? "Resident",
            conversationContext: currentNode?.text ?? activeNpc?.conversation_mode?.starter ?? "",
            npcProfile: {
              name: activeNpc?.name ?? null,
              personality: activeNpc?.personality ?? null,
              current_state: activeNpc?.current_state ?? null,
              relationship_defaults: activeNpc?.relationship_defaults ?? null,
              conversation_mode: activeNpc?.conversation_mode ?? null,
            },
            playerId: conversationPlayerId,
            message,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok !== true || typeof payload?.reply !== "string") {
        const detailSuffix =
          typeof payload?.details === "string" && payload.details.trim()
            ? `\n${payload.details.trim()}`
            : "";
        throw new Error((payload?.error ?? `Request failed (HTTP ${response.status})`) + detailSuffix);
      }

      setOpenEndedReply(payload.reply);
      setOpenEndedTranscript(previous => [
        ...previous,
        {
          role: "npc",
          text: payload.reply,
          at: Date.now(),
        },
      ]);
      setOpenEndedPrompt("");
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      setOpenEndedError(
        isAbort
          ? "NPC response timed out. Please try again."
          : (error?.message ?? "Unable to get NPC response."),
      );
    } finally {
      setOpenEndedLoading(false);
    }
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
    function handleConversationSocialResultEvent(event) {
      const detail = event?.detail ?? null;

      if (!detail || detail.sceneId !== sceneId) {
        return;
      }

      if (!activeNpcId || detail.npcId !== activeNpcId) {
        return;
      }

      if (typeof detail.message !== "string" || !detail.message.trim()) {
        return;
      }

      setSocialFeedback({
        stance: detail.stance ?? (detail.accepted ? "accept" : "reject"),
        message: detail.message,
        at: detail.at ?? Date.now(),
      });
    }

    window.addEventListener(CONVERSATION_SOCIAL_RESULT_EVENT_NAME, handleConversationSocialResultEvent);

    return () => {
      window.removeEventListener(CONVERSATION_SOCIAL_RESULT_EVENT_NAME, handleConversationSocialResultEvent);
    };
  }, [activeNpcId, sceneId]);

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
      localStorage.setItem("hbl:constitution-neighborhood:scope-docs", JSON.stringify(constitutionScopeDocs));
      localStorage.setItem("hbl:constitution-neighborhood:active-scope", activeScopeTab);
    } catch {
      // Ignore storage errors in private/incognito contexts.
    }
  }, [constitutionScopeDocs, activeScopeTab, isConstitutionNeighborhoodRoute]);

  useEffect(() => {
    if (!isConstitutionNeighborhoodRoute) {
      setCityMiniMapConfig(null);
      return;
    }

    let cancelled = false;

    async function loadSceneMiniMapConfig() {
      try {
        const response = await fetch(`/api/scenes/${sceneId}`);

        if (!response.ok) {
          if (!cancelled) {
            setCityMiniMapConfig(buildMiniMapConfigFromSceneData(sceneId, null));
          }

          return;
        }

        const sceneData = await response.json();

        if (!cancelled) {
          setCityMiniMapConfig(buildMiniMapConfigFromSceneData(sceneId, sceneData));
        }
      } catch {
        if (!cancelled) {
          setCityMiniMapConfig(buildMiniMapConfigFromSceneData(sceneId, null));
        }
      }
    }

    loadSceneMiniMapConfig();

    return () => {
      cancelled = true;
    };
  }, [isConstitutionNeighborhoodRoute, sceneId]);

  return (
    <>
      {isConstitutionNeighborhoodRoute ? (
        <ConstitutionNeighborhoodPanel
          scopeDocs={constitutionScopeDocs}
          activeScopeTab={activeScopeTab}
          onSelectScopeTab={setActiveScopeTab}
          onScopeDocChange={(scopeId, value) => {
            setConstitutionScopeDocs(prev => ({
              ...prev,
              [scopeId]: value,
            }));
          }}
          onCityClick={city => {
            if (!city?.slug) {
              return;
            }

            window.location.href = neighborhoodRouteForCity(city.slug);
          }}
          citySlug={currentConstitutionCitySlug}
          cityMiniMapConfig={cityMiniMapConfig}
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
              maxHeight: "90vh",
              overflowY: "auto",
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
            {socialFeedback?.message ? (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "9px 11px",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.45)",
                  background:
                    socialFeedback.stance === "accept"
                      ? "rgba(20, 83, 45, 0.38)"
                      : socialFeedback.stance === "delay"
                        ? "rgba(113, 63, 18, 0.38)"
                        : "rgba(127, 29, 29, 0.38)",
                  color:
                    socialFeedback.stance === "accept"
                      ? "#86efac"
                      : socialFeedback.stance === "delay"
                        ? "#fcd34d"
                        : "#fecaca",
                  fontSize: "13px",
                }}
              >
                {socialFeedback.message}
              </div>
            ) : null}
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
                marginTop: "14px",
                borderTop: "1px solid rgba(148, 163, 184, 0.3)",
                paddingTop: "12px",
                display: "grid",
                gap: "8px",
                position: "sticky",
                bottom: 0,
                background: "rgba(15, 23, 42, 0.98)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#93c5fd", fontWeight: 600 }}>
                Ask an open-ended question
              </div>
              <textarea
                value={openEndedPrompt}
                onChange={event => setOpenEndedPrompt(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitOpenEndedPrompt();
                  }
                }}
                placeholder="Ask this resident anything..."
                rows={3}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.5)",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#e2e8f0",
                  padding: "8px 10px",
                  resize: "vertical",
                  fontSize: "13px",
                }}
              />
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={submitOpenEndedPrompt}
                  disabled={openEndedLoading || !openEndedPrompt.trim()}
                  style={{
                    background: "#0f766e",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    cursor: openEndedLoading || !openEndedPrompt.trim() ? "not-allowed" : "pointer",
                    opacity: openEndedLoading || !openEndedPrompt.trim() ? 0.6 : 1,
                  }}
                >
                  {openEndedLoading ? "Asking..." : "Ask NPC"}
                </button>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Enter to send • Shift+Enter newline
                </span>
              </div>

              {openEndedError ? (
                <div style={{ fontSize: "12px", color: "#fda4af" }}>{openEndedError}</div>
              ) : null}

              {openEndedTranscript.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    paddingRight: "2px",
                  }}
                >
                  {openEndedTranscript.map((turn, index) => {
                    const isNpc = turn?.role === "npc";

                    return (
                      <div
                        key={`${turn?.at ?? "turn"}-${index}`}
                        style={{
                          fontSize: "13px",
                          lineHeight: 1.45,
                          color: "#e2e8f0",
                          background: isNpc ? "rgba(30, 41, 59, 0.8)" : "rgba(15, 118, 110, 0.22)",
                          border: "1px solid rgba(148, 163, 184, 0.45)",
                          borderRadius: "8px",
                          padding: "10px",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#93c5fd", marginBottom: "4px" }}>
                          {isNpc ? "NPC" : "You"}
                        </div>
                        {turn?.text ?? ""}
                      </div>
                    );
                  })}
                </div>
              ) : openEndedReply ? (
                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.45,
                    color: "#e2e8f0",
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(148, 163, 184, 0.45)",
                    borderRadius: "8px",
                    padding: "10px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#93c5fd", marginBottom: "4px" }}>
                    NPC
                  </div>
                  {openEndedReply}
                </div>
              ) : null}
            </div>

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
