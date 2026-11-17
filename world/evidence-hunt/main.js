import {mountEvidenceHunt} from './panel.js';
if(new URLSearchParams(location.search).get('embed')!=='1'){
  let hunt=mountEvidenceHunt({container:document.body});
  addEventListener('pagehide',()=>hunt.destroy());
  addEventListener('pageshow',event=>{if(event.persisted)hunt=mountEvidenceHunt({container:document.body});});
}
