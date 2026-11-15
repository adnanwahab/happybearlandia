/** Keep independently mounted status widgets in one measured layout lane. */
export function mountWorldStatusStack(doc=document){
 if(doc.getElementById('world-status-stack'))return;
 const stack=doc.createElement('aside');stack.id='world-status-stack';stack.setAttribute('aria-label','World status and shortcuts');doc.body.append(stack);
 const selectors=['#world-quick-toolbar','#world-playback-facts','.world-fps-meter'];
 function collect(){for(const selector of selectors){const node=doc.querySelector(selector);if(node&&node.parentElement!==stack)stack.append(node);}}
 const observer=new MutationObserver(collect);observer.observe(doc.body,{childList:true});collect();
 function measure(){const bounds=stack.getBoundingClientRect();doc.body.style.setProperty('--world-status-bottom',`${Math.ceil(bounds.bottom+8)}px`);}
 const resize=new ResizeObserver(measure);resize.observe(stack);doc.defaultView.addEventListener('resize',measure);measure();
 doc.defaultView.addEventListener('pagehide',()=>{observer.disconnect();resize.disconnect();doc.defaultView.removeEventListener('resize',measure);},{once:true});
}
