import {mountPairedComparison} from '/tools/paired-comparison.js';
/** Shared inspector. All explanations come from recorded run APIs. */
export class CausalInspector extends HTMLElement {
  static observedAttributes = ['run-id', 'entity-id', 'tick', 'target-id'];
  constructor() { super(); this.attachShadow({mode:'open'}); this.tab='Why'; this.serial=0; }
  connectedCallback() { this.render(); }
  disconnectedCallback() { this.serial++; this.controller?.abort(); }
  attributeChangedCallback(name) { if(name!=='target-id')this.historyCursor=null; if(this.isConnected) this.render(); }
  set context(value) { this._context={...value}; for(const key of ['runId','entityId','tick','targetId']) { const attr=key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()); if(value[key]!=null) this.setAttribute(attr,String(value[key])); else this.removeAttribute(attr); } this.render(); }
  get context() { return {...this._context,runId:this.getAttribute('run-id'),entityId:this.getAttribute('entity-id'),tick:this.getAttribute('tick'),targetId:this.getAttribute('target-id')}; }
  async render() {
    const serial=++this.serial; this.controller?.abort(); this.controller=new AbortController();
    const root=this.shadowRoot; root.replaceChildren();
    const style=document.createElement('style'); style.textContent=':host{display:block;font:16px system-ui;color:#173330;background:#f5faf7;border:1px solid #9ebbb1;border-radius:12px;padding:20px}button,input{font:inherit;padding:8px}button{cursor:pointer}nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button[aria-selected=true]{background:#173f36;color:white}label{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}article{border-top:1px solid #b6cbc3;padding:12px 0}a{color:#135b91}:focus-visible{outline:3px solid #b76518;outline-offset:3px}'; root.append(style);
    const heading=document.createElement('h2'); heading.textContent='Causal inspector';root.append(heading);
    const form=document.createElement('form');
    for(const [key,label] of [['runId','Run'],['entityId','Entity'],['tick','Tick'],['targetId','Record']]) { const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.name=key;input.value=this.context[key]??'';if(key==='tick'){input.type='number';input.min='0';input.step='1';}wrap.append(input);form.append(wrap); }
    const submit=document.createElement('button');submit.textContent='Inspect';form.append(submit);form.onsubmit=e=>{e.preventDefault();this.historyCursor=null;this.context={...this.context,...Object.fromEntries(new FormData(form))};this.dispatchEvent(new CustomEvent('inspector-navigate',{detail:this.context,bubbles:true,composed:true}));};root.append(form);
    const nav=document.createElement('nav');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Inspector views');
    const tabs=['Why','History','What if','Evidence'];
    tabs.forEach((name,index)=>{const b=document.createElement('button');b.textContent=name;b.id='tab-'+index;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(name===this.tab));b.tabIndex=name===this.tab?0:-1;b.setAttribute('aria-controls','panel');b.onclick=()=>{this.tab=name;this.render();this.shadowRoot.getElementById('tab-'+index)?.focus();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?3:(index+(e.key==='ArrowRight'?1:3))%4;this.tab=tabs[next];this.render();this.shadowRoot.getElementById('tab-'+next)?.focus();}};nav.append(b);});root.append(nav);
    const panel=document.createElement('section');panel.id='panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+tabs.indexOf(this.tab));root.append(panel);
    const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
    if(!this.context.runId){status.textContent='Choose a stored run to inspect. No records loaded.';return;}
    if(this.tab==='What if'){status.textContent='Counterfactuals require a new recorded branch and an allowlisted intervention. This read-only inspector does not infer alternate outcomes.'; const comparison=document.createElement('div');panel.append(comparison);await mountPairedComparison(comparison,{runId:this.context.runId,entityId:this.context.entityId});return;}
    const params=new URLSearchParams();for(const [k,v] of Object.entries(this.context))if(v!==null&&v!==undefined&&v!=='')params.set(k,String(v));
    if(this.tab==='Why'||this.tab==='Evidence'){if(!this.context.targetId){status.textContent='Choose a recorded event or observation to explain.';return;}params.set('targetId',this.context.targetId);}
    if(this.tab==='History'&&this.historyCursor!=null)params.set('afterSequence',String(this.historyCursor));
    status.textContent='Loading recorded evidence…';
    try {const response=await fetch('/api/causality/'+(this.tab==='History'?'timeline':'explain')+'?'+params,{signal:this.controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load records');if(serial!==this.serial)return;
      status.textContent=data.incomplete?'Incomplete graph: some dependencies are unavailable or outside traversal limits.': 'Recorded model dependencies; these are not proof of real-world causation.';
      const records=this.tab==='History'?data.items:this.tab==='Evidence'?[...(data.evidence||[]),...(data.nodes||[]),...(data.edges||[])]:[...(data.nodes||[]),...(data.edges||[])];
      if(!records?.length)status.textContent='No matching stored records in this page.';
      if(this.tab==='History'&&data.nextCursor!=null){const next=document.createElement('button');next.textContent='Next records';next.onclick=()=>{this.historyCursor=data.nextCursor;this.render();};panel.append(next);}
      for(const record of records){const article=document.createElement('article');const title=document.createElement('h3');title.textContent=record.label||record.type||(record.relation?record.relation+' · '+record.fromId+' → '+record.toId:null)||record.id||'Recorded item';article.append(title);const pre=document.createElement('pre');pre.textContent=JSON.stringify(record,null,2);article.append(pre);if(record.id&&this.tab==='History'){const b=document.createElement('button');b.textContent='Explain this record';b.onclick=()=>{this.tab='Why';this.setAttribute('target-id',record.id);};article.append(b);}panel.append(article);}
    }catch(error){if(serial!==this.serial||error.name==='AbortError')return;status.setAttribute('role','alert');status.textContent='Could not load records: '+error.message;const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>this.render();panel.append(retry);}
  }
}
if(!customElements.get('causal-inspector'))customElements.define('causal-inspector',CausalInspector);
