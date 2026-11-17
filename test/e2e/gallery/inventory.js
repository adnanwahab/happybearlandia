import catalog from './catalog.json' with {type:'json'};

// Ordered by failure impact: correctness/privacy, lifetime, then interaction.
// A supporting regression is deliberately not a claim of feature completion.
export const paths = [
  [198,'future-machine-inputs','/world/future-machine.html','pinned recipe versus edited inputs','Share/reopen preserves committed inputs'],
  [198,'future-machine-share-reliability','/world/future-machine.html','saved replay, corrupt/missing replay','Copy link and reopen exact month'],
  [198,'renderer-disposal','/world/future-machine.html','30 create/dispose cycles, canvas/webgl/auto','Focus entity; seek; dispose'],
  [198,'pipeline-device-loss','/world/future-machine.html','actual GPU device loss and fallback','Seek then lose initialized device'],
  [198,'pipeline-resize','/world/future-machine.html','resize and committed frame agreement','Seek and resize at narrow widths'],
  [108,'evidence-trail-real','/world/future-machine.html','recorded causal trail and aligned months','Open event; jump to exact recorded month'],
  [112,'population-trips','/world?source=none&seed=42&living=1','current trip, retained samples and stationary gap','Select sample with Enter; close inspector'],
  [113,'decision-rotation','/world/decision.html','unavailable then real four-run theater','Rotate keyboard/touch; preserve source runs'],
  [114,'minimap','/world?demo=1&synthetic=1&people=16','bookmarks, selection and restored camera','Arrow pan; Enter bookmark; Escape'],
  [119,'transition-diagnostics','/','opt-in, unsupported API, repeated transitions','Space consent; Enter preview; revoke consent'],
  [117,'motion','/','native, immediate and live reduced motion','Enter preview; Escape restores focus'],
  [118,'navigation-accessibility','/','native navigation and focus','Keyboard navigation; visible focus and return'],
  [120,'demo-calm-updates','/world/future-machine.html?renderer=canvas','live demo captions and stable controls','Inspect household while replay updates'],
  [121,'infrastructure-scanner.component','https://scanner.test/','component fixture: sourced, unsupported, failure and cleanup','Enter Scan center; Escape and restore focus'],
  [124,'ghost-footsteps','http://ghost.local/','component fixture: preview, failure, moved actor and cleanup','Confirm explicitly; Escape cancels'],
  [129,'inspection-freeze.component','https://freeze.test/','component fixture: pause, unsupported, failure and cleanup','Enter freeze; route change releases'],
  [101,'universe-real-journey','/?app=worldline','canonical scope preserved; mapping is not model equivalence','Navigate child; Back; refresh'],
  [109,'camera-presets.component','https://camera.test/','component fixture: interruption and cleanup','Return camera; reduced motion'],
  [116,'spatial-targets','/world/?demo=1&synthetic=1&people=16','semantic targets and unavailable area','Tab; arrows; inspect; Escape'],
  [110,'house-character-focus-control','/world/house','worker save and refreshed character controls','Change focus; verify persisted model state'],
].map(([feature,file,route,state,keyboard],i)=>({
  rank:i+1,feature:`HBL-FUN-${feature}`,file:`test/e2e/${file}.e2e.js`,
  expectedTests:[2,5,3,2,2,2,2,1,2,2,3,5,1,2,2,1,3,1,2,1][i],
  route,state,keyboard,scope:state.startsWith('component fixture:')?'component':'native',
  limitation:'Supporting regression only; feature acceptance requires its own source/contract review and applicable missing-data, denial, mobile and reduced-motion evidence.',
}));

export const inventory = Array.from({length:100},(_,i)=>{
  const id=`HBL-FUN-${i+101}`,issue=catalog.issues.find(x=>x.title.startsWith(`[${id}]`));
  const automation=paths.filter(x=>x.feature===id);
  return {id,issue:issue?.id??null,title:issue?.title??'Source title unavailable: intake mapping required',
    source:issue?.url??null,implementation:automation.length?'supporting-regression-present':'not-audited',
    evidence:'missing',route:automation[0]?.route??null,state:automation[0]?.state??'No verified representative state',
    keyboard:automation[0]?.keyboard??'Not verified',screenshot:null,receipt:null,
    automation:automation.map(x=>x.rank),gaps:automation.length?
      ['Not full feature acceptance; inspect path limitations and actual receipts']:
      ['Representative route, pinned state, keyboard flow and evidence require source audit']};
});
