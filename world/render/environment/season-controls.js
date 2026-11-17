export function mountSeasonControls(container,onChange){
 const root=document.createElement('div');
 const label=document.createElement('label');label.textContent='Season decorations ';
 const select=document.createElement('select');select.setAttribute('aria-label','Season decorations');
 for(const value of ['auto','off','spring','summer','autumn','winter']){const option=document.createElement('option');option.value=value;option.textContent=value==='auto'?'Illustrative calendar':value;select.append(option);}
 select.onchange=()=>onChange(select.value);label.append(select);root.append(label);
 const note=document.createElement('p');note.textContent='Illustrative decorations only. Four 90-day seasons from elapsed day zero; no climate, vegetation or model outcome claim. Off restores original foliage. Static detail supports reduced motion; 2D uses park colors.';root.append(note);container.append(root);
 return {destroy(){select.onchange=null;root.remove();}};
}
