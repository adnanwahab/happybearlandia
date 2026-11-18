import QRCode from './vendor/index.js';
import levels from './vendor/QRErrorCorrectLevel.js';
import {savedReadonlyLink} from './appendix.js';
/** ASCII URL byte mode, ECC M; bounded to avoid synchronous oversized work. */
export function shareQR(base,id) {
 const url=savedReadonlyLink(base,id);
 if(url.length>512 || /[^\x20-\x7e]/.test(url)) throw new RangeError('Share URL exceeds QR capacity (512 ASCII bytes)');
 const qr=new QRCode(-1,levels.M);qr.addData(url);qr.make();
 const matrix=qr.modules.map(row=>row.slice());
 return {url,matrix};
}
export function mountPresentationShare(container,base,id) {
 container.replaceChildren();
 const doc=container.ownerDocument;
 const heading=doc.createElement('h2');heading.textContent='Read-only experiment';container.append(heading);
 try {
 const {url,matrix}=shareQR(base,id),size=matrix.length+8;
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox',`0 0 ${size} ${size}`);svg.setAttribute('width','256');svg.setAttribute('height','256');svg.setAttribute('role','img');svg.setAttribute('aria-label','QR code for the saved read-only experiment');
 const rect=doc.createElementNS(svg.namespaceURI,'rect');rect.setAttribute('width',size);rect.setAttribute('height',size);rect.setAttribute('fill','white');svg.append(rect);
 const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('fill','black');path.setAttribute('d',matrix.flatMap((row,y)=>row.flatMap((dark,x)=>dark?[`M${x+4},${y+4}h1v1h-1z`]:[])).join(''));svg.append(path);
 const link=doc.createElement('a');link.href=url;link.textContent='Open saved read-only experiment';container.append(svg,link);
 return {url,matrix};
 } catch(error) {const p=doc.createElement('p');p.setAttribute('role','status');p.textContent=`Share unavailable: ${error.message}`;container.append(p);return null;}
}
