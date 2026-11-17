const root=document.getElementById('circle');
root.innerHTML=`<h2>Deliberation Circle</h2><p>Private, opt-in discussion of one saved scenario and seed. Up to 12 participants, 60 claims, 24 hours. Rooms disappear on server restart. Keep your access keys private. Sharing a join key permits access; do not include personal or unlicensed content.</p><p>Unofficial preferences only: no public representation, mandate, or automated summary. Sources support inspection, not automatic fact checking. Opinions and questions must not disguise factual assertions.</p>
<label><input id="circle-consent" type="checkbox"> I consent to storing my contributions temporarily and have rights to share them.</label>
<button id="circle-create" type="button">Create room for selected scenario and run</button>
<label>Room ID<input id="circle-id" autocomplete="off"></label><label>Private access or join key<input id="circle-key" type="password" autocomplete="off"></label>
<button id="circle-join" type="button">Join with consent</button><button id="circle-read" type="button">Refresh room</button>
<p id="circle-status" role="status" aria-live="polite">Select a completed experiment and choose a scenario and run in Enter future.</p><div id="circle-content"></div>`;
const $=id=>document.getElementById(`circle-${id}`);
let room=null;
async function request(action,extra={}) {
 const id=$('id').value,key=$('key').value;
 const response=await fetch(`/api/city-experiments/circles/${encodeURIComponent(id)}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({action,consent:$('consent').checked,...extra})});
 const data=await response.json();if(!response.ok)throw Error(data.error);return data;
}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function button(label,action){const b=node('button',label);b.type='button';b.onclick=()=>run(action);return b;}
async function run(action){try{await action();}catch(e){$('content').replaceChildren();room=null;$('status').textContent=e.message;}}
function render(data){room=data;const content=$('content');content.replaceChildren();
 $('status').textContent=`${data.notice} ${data.closed?'Closed.':'Open.'} Expires ${new Date(data.expires).toISOString()}`;
 const p=data.pin;content.append(node('p',`${p.experimentId} / ${p.runId} · seed ${p.seed} · ${p.manifest.version} · manifest SHA256 ${p.manifestDigest}`));
 const details=node('details','');details.append(node('summary','Pinned inputs, versions and source provenance'),node('pre',JSON.stringify(p.manifest,null,2)));content.append(details);
 content.append(node('p',`${data.participants} participants; support ${data.tally.support}, oppose ${data.tally.oppose}, unsure ${data.tally.unsure}. Nonresponses excluded; participants are access keys, not verified people.`));
 for(const c of data.claims){const article=node('article','');article.append(node('p',`${c.kind} · ${c.classification}: ${c.text}`));if(c.source){const e=p.evidence.find(e=>e.id===c.source);article.append(node('p',`Pinned modeled result ${e.id}: ${e.value}. Synthetic model units and assumptions: see pinned manifest.`));const a=node('a','Source run archive');a.href=e.source;article.append(a);}if(data.host||c.author===data.ownId)article.append(button('Remove contribution',async()=>render(await request('remove',{id:c.id}))));content.append(article);}
 if(data.ownId&&!data.closed){
 const form=node('form','');const select=(label,values)=>{const l=node('label',label),s=node('select','');for(const v of values){const o=node('option',v);o.value=v;s.append(o);}l.append(s);form.append(l);return s;};
 const kind=select('Argument',['pro','con','question']),classification=select('Claim type',['opinion','assertion','question']);
 const label=node('label','Contribution'),input=node('textarea','');input.maxLength=1000;input.required=true;label.append(input);form.append(label);
 const source=select('Pinned source',['',...p.evidence.map(e=>e.id)]);
 const submit=node('button','Add contribution');form.append(submit);form.onsubmit=e=>{e.preventDefault();run(async()=>render(await request('claim',{kind:kind.value,classification:classification.value,text:input.value,source:source.value})));};content.append(form);
 for(const preference of ['support','oppose','unsure',null])content.append(button(preference||'Withdraw preference',async()=>render(await request('vote',{preference}))));
 }
 if(data.ownId)content.append(button('Withdraw consent and delete my content',async()=>{await request('leave');$('key').value='';$('content').replaceChildren();$('consent').checked=false;$('status').textContent='Your content and preference were deleted.';room=null;}));
 if(data.host){content.append(button('Close discussion',async()=>render(await request('close'))),button('Delete room and all content',async()=>{await request('delete-room');$('content').replaceChildren();$('key').value='';$('status').textContent='Room deleted.';room=null;}));}
}
$('create').onclick=()=>run(async()=>{
 const experiment=new URL(location.href).searchParams.get('experiment');if(!experiment)throw Error('Select a completed experiment first');
 const response=await fetch(`/api/city-experiments/${encodeURIComponent(experiment)}/circle`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenarioId:document.getElementById('replay-scenario').value,runIndex:Number(document.getElementById('replay-index').value),consent:$('consent').checked})});
 const data=await response.json();if(!response.ok)throw Error(data.error);$('id').value=data.id;$('key').value=data.owner;render(await request('read'));
 const l=node('label','Opt-in join key (copy privately; retain owner key for deletion)'),key=node('input','');key.readOnly=true;key.value=data.invite;l.append(key);$('content').prepend(l);
});
$('join').onclick=()=>run(async()=>{const data=await request('join');$('key').value=data.member;render(await request('read'));});
$('read').onclick=()=>run(async()=>render(await request('read')));
// Keys are held in DOM memory only; never URLs, localStorage, logs, or analytics.
