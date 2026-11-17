// Minimal DOM for executing UI controllers without starting a browser or frames.
export function createUIDocument(){
 const document={hidden:false,defaultView:{},listeners:{}};
 class Node{
  constructor(tag){this.tag=tag;this.nodeType=tag==='#fragment'?11:1;this.ownerDocument=document;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.value='';this._text='';this.className='';this.hidden=false;this.style={setProperty(key,value){this[key]=value;}};this.clientWidth=900;this.offsetWidth=300;this.scrollLeft=0;}
  set textContent(value){this._text=String(value);this.replaceChildren();}
  get textContent(){return this._text+this.children.map(node=>node.textContent).join(' ');}
  get offsetLeft(){return (this.parentNode?.children.indexOf(this)||0)*320;}
  set href(value){this.setAttribute('href',value);}
  get href(){return this.getAttribute('href');}
  set src(value){this.setAttribute('src',value);}
  get src(){return this.getAttribute('src');}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  prepend(node){node.remove();node.parentNode=this;this.children.unshift(node);}
  replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);if(key==='class')this.className=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(key){if(key==='id')return this.id??null;if(key==='class')return this.className;if(key.startsWith('data-'))return this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??null;return this.attributes[key]??null;}
  hasAttribute(key){return this.getAttribute(key)!==null;}
  removeAttribute(key){delete this.attributes[key];}
  get classList(){return{contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,force)=>{const names=new Set(this.className.split(/\s+/).filter(Boolean));const enabled=force??!names.has(name);if(enabled)names.add(name);else names.delete(name);this.className=[...names].join(' ');return enabled;},add:name=>this.classList.toggle(name,true),remove:name=>this.classList.toggle(name,false)};}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  async dispatch(type,event={}){await Promise.all((this.listeners[type]||[]).map(handler=>handler(event)));}
  click(){return this.dispatch('click');}
  matches(selector){const tag=selector.match(/^[\w-]+/);if(tag&&this.tag!==tag[0])return false;const id=selector.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;const className=selector.match(/\.([\w-]+)/);if(className&&!this.classList.contains(className[1]))return false;const attr=selector.match(/\[([\w-]+)(?:="([^"]*)")?\]/);return !attr||(this.hasAttribute(attr[1])&&(attr[2]===undefined||this.getAttribute(attr[1])===attr[2]));}
  querySelectorAll(selector){const parts=selector.split(/\s+/);const descendants=this.children.flatMap(node=>[node,...node.querySelectorAll('*')]);return descendants.filter(node=>{if(!node.matches(parts.at(-1)))return false;let parent=node.parentNode;for(let index=parts.length-2;index>=0;index--){while(parent&&!parent.matches(parts[index]))parent=parent.parentNode;if(!parent)return false;parent=parent.parentNode;}return true;});}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  scrollTo({left}){this.scrollLeft=left;}
  focus(){}
  scrollIntoView(){}
 }
 document.createElement=tag=>new Node(tag);
 document.createElementNS=(_,tag)=>new Node(tag);
 document.createDocumentFragment=()=>new Node('#fragment');
 document.head=new Node('head');document.body=new Node('body');
 document.querySelectorAll=selector=>[...document.head.querySelectorAll(selector),...document.body.querySelectorAll(selector)];
 document.querySelector=selector=>document.querySelectorAll(selector)[0]||null;
 document.getElementById=id=>document.querySelector('#'+id);
 document.addEventListener=(type,handler)=>{document.listeners[type]=handler;};
 return document;
}
