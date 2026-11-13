import { mountPairedComparison } from '/tools/paired-comparison.js';
import { graphStyles, renderEvidenceGraph } from './graph-view.js';

const attributes = { runId: 'run-id', entityId: 'entity-id', tick: 'tick', targetId: 'target-id' };
const tabs = ['Why', 'Ripple', 'History', 'What if', 'Evidence'];
const inspectorStyles = `
  :host { display: block; font: 16px system-ui; color: #173330; background: #f5faf7;
    border: 1px solid #9ebbb1; border-radius: 12px; padding: clamp(12px, 4vw, 20px); }
  button, input { font: inherit; padding: 8px; min-width: 0; }
  button { cursor: pointer; }
  nav, form { display: flex; gap: 8px; flex-wrap: wrap; }
  nav { margin: 16px 0; }
  button[aria-selected=true] { background: #173f36; color: white; }
  label { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px; }
  input { box-sizing: border-box; max-width: 100%; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }
  article { border-top: 1px solid #b6cbc3; padding: 12px 0; }
  a { color: #135b91; }
  :focus-visible { outline: 3px solid #b76518; outline-offset: 3px; }
`;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shared inspector. All explanations come from recorded run APIs. */
export class CausalInspector extends HTMLElement {
  static observedAttributes = Object.values(attributes);

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.tab = 'Why';
    this.serial = 0;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.serial++;
    this.controller?.abort();
  }

  attributeChangedCallback(name) {
    if (this.settingContext) return;
    if (name !== 'target-id') this.historyCursor = null;
    if (this.isConnected) this.render();
  }

  set context(value) {
    this._context = { ...value };
    this.settingContext = true;
    try {
      for (const [key, attribute] of Object.entries(attributes)) {
        if (value[key] == null) this.removeAttribute(attribute);
        else this.setAttribute(attribute, String(value[key]));
      }
    } finally {
      this.settingContext = false;
    }
    this.historyCursor = null;
    if (this.isConnected) this.render();
  }

  get context() {
    return {
      ...this._context,
      ...Object.fromEntries(Object.entries(attributes).map(([key, attribute]) => [key, this.getAttribute(attribute)])),
    };
  }

  navigate() {
    this.dispatchEvent(new CustomEvent('inspector-navigate', { detail: this.context, bubbles: true, composed: true }));
  }

  selectRecord(record) {
    this.tab = 'Why';
    this.focusRecord = record.id;
    this.context = {
      ...this.context,
      targetId: record.id,
      tick: record.context?.tick ?? this.context.tick,
      entityId: record.entityId ?? record.entityIds?.[0] ?? null,
    };
    this.navigate();
  }

  renderForm(root, context) {
    const form = element('form');
    for (const [key, label] of [['runId', 'Run'], ['entityId', 'Entity'], ['tick', 'Tick'], ['targetId', 'Record']]) {
      const wrap = element('label', label);
      const input = element('input');
      input.name = key;
      input.value = context[key] ?? '';
      if (key === 'tick') {
        input.type = 'number';
        input.min = '0';
        input.step = '1';
      }
      wrap.append(input);
      form.append(wrap);
    }
    const submit = element('button', 'Inspect');
    form.append(submit);
    form.onsubmit = event => {
      event.preventDefault();
      this.context = { ...this.context, ...Object.fromEntries(new FormData(form)) };
      this.navigate();
    };
    root.append(form);
  }

  renderTabs(root) {
    const nav = element('nav');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Inspector views');
    const switchTab = index => {
      this.tab = tabs[index];
      this.render();
      root.getElementById('tab-' + index)?.focus();
    };
    tabs.forEach((name, index) => {
      const tab = element('button', name);
      tab.id = 'tab-' + index;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(name === this.tab));
      tab.setAttribute('aria-controls', 'panel');
      tab.tabIndex = name === this.tab ? 0 : -1;
      tab.onclick = () => switchTab(index);
      tab.onkeydown = event => {
        const key = event.key;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
        event.preventDefault();
        const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 :
          (index + (key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        switchTab(next);
      };
      nav.append(tab);
    });
    root.append(nav);
  }

  renderRecords(panel, status, data, tab) {
    const records = tab === 'History' ? (data.items ?? []) :
      [...(data.evidence ?? []), ...(data.nodes ?? []), ...(data.edges ?? [])];
    if (!records.length) status.textContent = 'No matching stored records in this page.';
    if (tab === 'History' && data.nextCursor != null) {
      const next = element('button', 'Next records');
      next.onclick = () => {
        this.historyCursor = data.nextCursor;
        this.render();
      };
      panel.append(next);
    }
    for (const record of records) {
      const article = element('article');
      const heading = record.label || record.type ||
        (record.relation ? `${record.relation} · ${record.fromId} → ${record.toId}` : record.id) || 'Recorded item';
      article.append(element('h3', heading), element('pre', JSON.stringify(record, null, 2)));
      if (record.id && tab === 'History') {
        const button = element('button', 'Explain this record');
        button.onclick = () => this.selectRecord(record);
        article.append(button);
      }
      panel.append(article);
    }
  }

  async render({ focusAssociations = false } = {}) {
    const serial = ++this.serial;
    this.controller?.abort();
    this.controller = new AbortController();
    const root = this.shadowRoot;
    const context = this.context;
    const tab = this.tab;
    const focusRecord = this.focusRecord;
    this.focusRecord = null;
    root.replaceChildren(element('style', inspectorStyles + graphStyles), element('h2', 'Causal inspector'));
    this.renderForm(root, context);
    this.renderTabs(root);

    const panel = element('section');
    panel.id = 'panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-' + tabs.indexOf(tab));
    root.append(panel);
    const status = element('p');
    status.setAttribute('role', 'status');
    panel.append(status);
    if (!context.runId) {
      status.textContent = 'Choose a stored run to inspect. No records loaded.';
      return;
    }
    if (tab === 'What if') {
      status.textContent = 'Counterfactuals require a new recorded branch and an allowlisted intervention. This view shows stored comparisons.';
      const comparison = element('div');
      panel.append(comparison);
      await mountPairedComparison(comparison, { runId: context.runId, entityId: context.entityId });
      return;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(context)) {
      if (value != null && value !== '') params.set(key, String(value));
    }
    if (tab !== 'History' && !context.targetId) {
      status.textContent = 'No event selected. Choose a recorded event or observation from History to inspect its evidence. No cause has been identified.';
      return;
    }
    if (tab === 'Why') {
      const label = element('label', 'Show recorded correlations');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(this.includeAssociations);
      checkbox.onchange = () => {
        this.includeAssociations = checkbox.checked;
        this.render({ focusAssociations: true });
      };
      label.prepend(checkbox);
      panel.append(label);
      if (focusAssociations) checkbox.focus();
    }
    if (tab !== 'History' && this.includeAssociations) params.set('includeAssociations', 'true');
    if (tab === 'History' && this.historyCursor != null) params.set('afterSequence', String(this.historyCursor));
    status.textContent = 'Loading recorded evidence…';
    try {
      const endpoint = tab === 'History' ? 'timeline' : tab === 'Ripple' ? 'ripple' : 'explain';
      const response = await fetch('/api/causality/' + endpoint + '?' + params, { signal: this.controller.signal });
      const data = await response.json();
      if (serial !== this.serial) return;
      if (response.status === 404) {
        status.textContent = 'No stored run or target record was found for this selection. The record may be unavailable or may not have been retained. This does not establish that no event occurred or identify a cause. Check the run and record IDs, or choose a record from History.';
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Unable to load records');
      if (serial !== this.serial) return;
      status.textContent = data.incomplete ? 'Incomplete graph: some dependencies are unavailable or outside traversal limits.' :
        'Recorded model dependencies; these are not proof of real-world causation.';
      if (tab === 'Ripple') panel.append(element('p', 'Downstream ripple · at most five recorded connections. ' + data.interpretation), element('p', 'Limits and gaps: ' + (data.reasons.join(', ') || 'none within returned chain')));
      if (tab === 'Why' || tab === 'Ripple') {
        const graph = renderEvidenceGraph(data, context.targetId, record => this.selectRecord(record), { showAttribution: tab === 'Why' });
        panel.append(graph.root);
        if (focusRecord === context.targetId) graph.targetButton?.focus();
      } else {
        this.renderRecords(panel, status, data, tab);
      }
    } catch (error) {
      if (serial !== this.serial || error.name === 'AbortError') return;
      status.setAttribute('role', 'alert');
      status.textContent = 'Could not load records: ' + error.message;
      const retry = element('button', 'Retry');
      retry.onclick = () => this.render();
      panel.append(retry);
      if (focusRecord) retry.focus();
    }
  }
}

if (!customElements.get('causal-inspector')) customElements.define('causal-inspector', CausalInspector);
