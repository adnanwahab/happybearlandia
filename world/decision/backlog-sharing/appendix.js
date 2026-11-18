const escape = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
/** Exact saved manifests only; callers fetch through client.manifest(id). */
export function reproductionAppendix(manifest) {
 if (!manifest || typeof manifest !== 'object') return {html:'<section><h2>Reproduction appendix</h2><p>Saved manifest unavailable.</p></section>',json:null};
 const json = JSON.stringify(manifest,null,2);
 const bytes = new TextEncoder().encode(json).length;
 if(bytes > 8388608) throw new RangeError('Manifest exceeds 8 MiB export bound');
 return {json,html:`<section aria-label="Reproduction appendix"><h2>Reproduction appendix</h2><p>Exact saved manifest; ${bytes} UTF-8 bytes. Units, seeds, model versions and time retain their recorded meaning. Trace URLs require the original server.</p>${bytes <= 131072 ? `<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(json)}</pre>` : '<p>Above 128 KiB print bound. Download the complete manifest; this appendix does not contain all records.</p>'}</section>`};
}
export function downloadManifest(manifest, document = globalThis.document) {
 const {json} = reproductionAppendix(manifest);
 if(json === null) throw new Error('Saved manifest unavailable');
 const url = URL.createObjectURL(new Blob([json],{type:'application/json'}));
 const a = document.createElement('a'); a.href=url; a.download='reproduction-manifest.json'; a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function savedReadonlyLink(base,id) {
 if(typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new TypeError('Saved experiment ID required');
 const url=new URL(base); if(!['http:','https:'].includes(url.protocol)) throw new TypeError('HTTP required');
 url.username='';url.password='';url.search='';url.hash='';url.searchParams.set('experiment',id);url.searchParams.set('readonly','1');return url.href;
}
