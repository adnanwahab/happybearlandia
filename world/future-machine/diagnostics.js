// Release-owned constant. Never derive version or diagnostics from URLs or errors.
export const APP_VERSION = 'future-machine.2026-11-12';
const renderers = new Set(['webgpu', 'webgl', 'canvas2d', 'inventory-fallback']);
const types = new Set(['boot-failure', 'comparison-failure', 'invalid-share']);

/** Allowlist construction: raw errors and contextual data are never accepted. */
export function createDiagnosticBundle({renderer, errorType, traceId} = {}) {
  return Object.freeze({
    schemaVersion: 'hbl.first-play-diagnostic.v1',
    appVersion: APP_VERSION,
    renderer: renderers.has(renderer) ? renderer : 'unknown',
    errorType: types.has(errorType) ? errorType : 'unknown',
    traceId: typeof traceId === 'string' && /^hbl-[0-9a-f]{32}$/.test(traceId) ? traceId : 'unavailable',
  });
}

export function newTraceId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `hbl-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** No network or storage. Each failure gets one stable report until cleared. */
export function mountDiagnosticReport(container, {clipboard = globalThis.navigator?.clipboard, traceId = newTraceId} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Optional error report');
  root.hidden = true;
  const title = doc.createElement('h2'); title.textContent = 'Optional error report';
  const explanation = doc.createElement('p');
  explanation.textContent = 'Review this local report before copying. It contains only app version, renderer, error category and a random local trace ID. Nothing is sent automatically. The ID is not linked to server logs.';
  const preview = doc.createElement('textarea');
  preview.readOnly = true; preview.rows = 9; preview.style.width = '100%';
  preview.setAttribute('aria-label', 'Diagnostic report preview');
  const label = doc.createElement('label');
  const consent = doc.createElement('input'); consent.type = 'checkbox';
  label.append(consent, doc.createTextNode(' I agree to copy this diagnostic report.'));
  const copy = doc.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy diagnostic report'; copy.disabled = true;
  const status = doc.createElement('p'); status.setAttribute('role', 'status');
  let generation = 0;
  consent.onchange = () => { copy.disabled = !consent.checked; };
  copy.onclick = async () => {
    if (!consent.checked) return;
    const current = generation; const text = preview.value;
    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text);
      if (current === generation) status.textContent = 'Diagnostic report copied. Share it only if you choose.';
    } catch {
      if (current !== generation) return;
      preview.focus(); preview.select();
      status.textContent = 'Clipboard unavailable. Copy the selected report manually.';
    }
  };
  root.append(title, explanation, preview, label, copy, status); container.append(root);
  return {
    show({renderer, errorType} = {}) {
      generation++; consent.checked = false; copy.disabled = true; status.textContent = '';
      let id; try { id = traceId(); } catch { id = 'unavailable'; }
      preview.value = JSON.stringify(createDiagnosticBundle({renderer, errorType, traceId: id}), null, 2);
      root.hidden = false;
    },
    clear() { generation++; root.hidden = true; preview.value = ''; consent.checked = false; copy.disabled = true; status.textContent = ''; },
    dispose() { generation++; root.remove(); },
  };
}
