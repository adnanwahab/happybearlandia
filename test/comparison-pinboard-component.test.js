import {test,expect} from 'bun:test';
import {mountComparisonPinboard} from '../world/comparison-pinboard.js';
// Minimal injected DOM, following the existing panel tests; browser layout is separate.
function fixture(){
 const doc={createElement:tag=>node(tag),createComment:()=>node('comment')};
 function node(tag){return {tag,ownerDocument:doc,children:[],attrs:{},classList:{toggle(){}},
  append(...items){for(const item of items){item.parentNode?.children.splice(item.parentNode.children.indexOf(item),1);this.children.push(item);item.parentNode=this;}},
  before(item){const p=this.parentNode;p.children.splice(p.children.indexOf(this),0,item);item.parentNode=p;},
  insertBefore(item,next){item.parentNode?.children.splice(item.parentNode.children.indexOf(item),1);const i=this.children.indexOf(next);this.children.splice(i<0?this.children.length:i,0,item);item.parentNode=this;},
  replaceChildren(...items){this.children=[];this.append(...items);},setAttribute(k,v){this.attrs[k]=v;},focus(){doc.activeElement=this;},
 };}
 doc.body=node('body');const controls=node('details'),host=node('div');doc.body.append(controls);controls.append(host);
 const nodes=Object.fromEntries(['summary','[data-capture]','[data-pin-status]','[data-pins]','[data-fields]','form'].map(key=>[key,node(key)]));
 nodes.form.elements={type:{value:'building'},id:{value:''}};host.querySelector=selector=>nodes[selector];
 const text=n=>[n.textContent??'',...n.children.map(text)].join(' ');
 return {doc,controls,host,nodes,text};
}
test('component retains two visible IDs outside collapsed controls; clear restores focus and normal capture',()=>{
 const f=fixture(),ui=mountComparisonPinboard(f.host,{resolve:(type,id)=>({type,id,name:'<literal name>',authority:'legacy-world',fields:{area:0},source:'Synthetic fixture'})});
 const {nodes,host,doc,controls,text}=f;
 expect(text(nodes['[data-pins]'])).toContain('A: Empty');nodes['[data-capture]'].onclick();expect(host.parentNode).toBe(doc.body);
 ui.observe('building','A/469');ui.observe('building','B/469');ui.observe('building','C/469');
 expect(nodes.summary.textContent).toContain('A: A/469');expect(nodes.summary.textContent).toContain('B: B/469');
 expect(text(nodes['[data-fields]'])).toContain('Unavailable');expect(nodes['[data-capture]'].disabled).toBe(true);
 const clearA=nodes['[data-pins]'].children[0].children.at(-1);clearA.onclick();
 expect(doc.activeElement).toBe(nodes['[data-capture]']);expect(text(nodes['[data-pin-status]'])).toContain('Normal selection available');
 ui.observe('building','C/469');expect(text(nodes['[data-pins]'])).toContain('A: Empty');expect(text(nodes['[data-pins]'])).toContain('B/469');
 nodes['[data-pins]'].children[1].children.at(-1).onclick();expect(host.parentNode).toBe(controls);
});
test('component form handles unavailable and incompatible IDs without losing existing pins',()=>{
 const f=fixture();let available=true;mountComparisonPinboard(f.host,{available:()=>available,resolve:(type,id)=>id==='missing'?null:{type,id,authority:'legacy-world',fields:{},source:'Synthetic fixture'}});
 const submit=(type,id)=>{f.nodes.form.elements.type.value=type;f.nodes.form.elements.id.value=id;f.nodes.form.onsubmit({preventDefault(){},currentTarget:f.nodes.form});};
 submit('building','A');submit('building','missing');expect(f.text(f.nodes['[data-pin-status]'])).toContain('unavailable');
 available=false;submit('person','P');expect(f.text(f.nodes['[data-pin-status]'])).toContain('identities are not mapped');
 expect(f.text(f.nodes['[data-pins]'])).toContain('A: building A');available=true;submit('person','P');
 expect(f.text(f.nodes['[data-fields]'])).toContain('Different entity types');
});
