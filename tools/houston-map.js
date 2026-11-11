const host = document.querySelector('#map');
const status = document.querySelector('#status');
const flat = document.querySelector('#flat');
const reset = document.querySelector('#reset');
const areaURL = '/world/area-cache/29.728600,-95.474600,400.json';

function coordinates({ pts }) {
  return pts.map(([lat, lng]) => [lng, lat]);
}

async function openMap() {
  const api = globalThis.deck;
  if (!api) throw new Error('The deck.gl library could not be loaded.');

  const response = await fetch(areaURL);
  if (!response.ok) throw new Error('The neighborhood geometry could not be loaded.');
  const { origin, buildings, roads } = await response.json();
  const parks = buildings.filter(feature => feature.park && feature.pts.length >= 3);
  const footprints = buildings.filter(feature => !feature.park && feature.pts.length >= 3);
  const streets = roads.filter(feature => feature.pts.length >= 2);
  if (!footprints.length) throw new Error('The neighborhood snapshot contains no buildings.');

  const start = { longitude: origin.lng, latitude: origin.lat, zoom: 15.6, pitch: 52, bearing: -25 };
  let view = start;
  let isFlat = false;
  const groundLayers = [
    new api.PolygonLayer({
      id: 'parks', data: parks, getPolygon: coordinates, stroked: false, getFillColor: [62, 134, 100],
    }),
    new api.PathLayer({
      id: 'streets', data: streets, getPath: coordinates, getColor: [154, 176, 187],
      getWidth: 1.4, widthMinPixels: 1,
    }),
  ];
  function layers() {
    return [...groundLayers, new api.PolygonLayer({
      id: 'buildings', data: footprints, getPolygon: coordinates, getFillColor: [242, 199, 122],
      stroked: false, extruded: !isFlat, getElevation: 10, pickable: true, autoHighlight: true,
    })];
  }

  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Houston map. Arrow keys pan, plus and minus zoom.');
  host.append(canvas);

  function showError() {
    status.textContent = 'The map could not render. This view needs WebGL 2.';
    status.hidden = false;
    flat.disabled = true;
    reset.disabled = true;
  }

  const map = new api.Deck({
    canvas,
    width: '100%',
    height: '100%',
    initialViewState: start,
    controller: { touchRotate: true },
    useDevicePixels: 1,
    layers: layers(),
    onViewStateChange: ({ viewState }) => { view = viewState; },
    getTooltip: ({ object }) => object ? (object.name || object.address?.label || 'Building footprint') : null,
    onError: showError,
    onLoad: () => {
      status.hidden = true;
      flat.disabled = false;
      reset.disabled = false;
    },
  });
  flat.addEventListener('click', () => {
    isFlat = !isFlat;
    flat.setAttribute('aria-pressed', String(isFlat));
    view = { ...view, pitch: isFlat ? 0 : start.pitch, bearing: isFlat ? 0 : start.bearing };
    map.setProps({
      controller: { dragRotate: !isFlat, touchRotate: !isFlat },
      initialViewState: view,
      layers: layers(),
    });
  });
  reset.addEventListener('click', () => {
    view = { ...start, ...(isFlat && { pitch: 0, bearing: 0 }) };
    map.setProps({ initialViewState: view });
  });
}

// The standalone bundle is a deferred classic script. Wait for both script types to finish.
document.addEventListener('DOMContentLoaded', () => {
  openMap().catch(error => { status.textContent = error.message; });
}, { once: true });
