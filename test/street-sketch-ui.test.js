import { expect, test } from 'bun:test';
// Minimal DOM harness runs the actual controller when native browser launch is unavailable.
class Node {
  constructor() { this.listeners = {}; this.attrs = {}; this.children = []; this.value = ''; this.hidden = false; }
  append(node) { this.children.push(node); if (!this.value) this.value = node.value; }
  setAttribute(key, value) { this.attrs[key] = value; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; }
}
test('actual controller supports keyboard, touch-generated click, refusal, undo and redraw', async () => {
  const previous = globalThis.document;
  const nodes = Object.fromEntries(['drawing','kind','policy','line','vertices','pencil','preview','undo','redraw','result','status','download','run'].map(id => [id, new Node()]));
  nodes.kind.value = 'transit';
  globalThis.document = { getElementById: id => nodes[id], createElement: () => new Node(), createElementNS: () => new Node() };
  try {
    await import('../world/invention/sketch/page.js');
    const key = key => nodes.drawing.listeners.keydown({ key, preventDefault() {} });
    key('Enter'); key('ArrowDown'); key('Enter');
    expect(nodes.preview.textContent).toContain('2 points');
    nodes.kind.value = 'road'; nodes.kind.onchange(); nodes.run.onclick();
    expect(nodes.status.textContent).toContain('Refused');
    expect(nodes.download.hidden).toBe(true);
    nodes.kind.value = 'transit'; nodes.kind.onchange(); nodes.run.onclick();
    expect(nodes.result.textContent).toContain('"cost": 80000');
    expect(nodes.result.textContent).toContain('"geometryRole": "schematic-only"');
    expect(nodes.download.hidden).toBe(false);
    key('Backspace');
    expect(nodes.preview.textContent).toContain('1 points');
    expect(nodes.download.hidden).toBe(true);
    nodes.redraw.onclick();
    // Touch taps dispatch the same click path as pointer clicks, with viewport coordinates.
    nodes.drawing.listeners.click({ clientX: 24, clientY: 45 });
    nodes.drawing.listeners.click({ clientX: 62, clientY: 85 });
    expect(nodes.line.attrs.points).toBe('20,40 60,80');
    nodes.undo.onclick(); expect(nodes.preview.textContent).toContain('1 points');
    nodes.redraw.onclick(); expect(nodes.preview.textContent).toContain('0 points');
    expect(nodes.undo.disabled).toBe(true);
  } finally { globalThis.document = previous; }
});
