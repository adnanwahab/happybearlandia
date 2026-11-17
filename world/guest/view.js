const $=id=>document.getElementById(id),status=$('status');
let revokeToken;
async function call(method,credential,body){const response=await fetch('/api/guest-snapshots',{method,cache:'no-store',headers:{...(credential?{Authorization:`Bearer ${credential}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
function show(record){$('data').textContent=JSON.stringify(record,null,2);status.textContent=`Read-only snapshot. Expires ${record.expiresAt}. Submitted metrics require replay verification.`;}
const credential=location.hash.slice(1);
if(credential){history.replaceState(null,'',location.pathname);$('publish').hidden=true;try{show(await call('GET',credential));}catch{status.textContent='Snapshot unavailable, expired or revoked.';}}
$('create').onclick=async()=>{try{
 if(!$('consent').checked||!$('rights').checked)throw new Error('Confirm sharing and data rights first.');
 const file=$('file').files[0];if(!file||file.size>8000000)throw new Error('Choose a JSON run under 8 MB.');
 const input=JSON.parse(await file.text());const record=await call('POST',null,{...input,publishConsent:true,rightsConfirmed:true,ttlSeconds:3600});revokeToken=record.revokeToken;$('link').href=record.url;$('management').hidden=false;const {revokeToken:secret,...display}=record;show(display);
 }catch(error){status.textContent=error.message;}};
$('revoke').onclick=async()=>{try{await call('DELETE',revokeToken);revokeToken=null;$('management').hidden=true;$('data').textContent='';status.textContent='Shared snapshot deleted. Previously downloaded copies cannot be recalled.';}catch(error){status.textContent=error.message;}};
