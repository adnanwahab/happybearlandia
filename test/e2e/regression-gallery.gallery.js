import {test,expect} from '@playwright/test';
import {collectBrowserEvidence} from '../helpers/browser-evidence.js';
import {sourceIdentity} from './gallery/source.js';

// Reuse behavioral assertions through their normal entries; no copied test logic.
import './future-machine-inputs.e2e.js';
import './future-machine-share-reliability.e2e.js';
import './renderer-disposal.e2e.js';
import './pipeline-device-loss.e2e.js';
import './pipeline-resize.e2e.js';
import './evidence-trail-real.e2e.js';
import './population-trips.e2e.js';
import './decision-rotation.e2e.js';
import './minimap.e2e.js';
import './transition-diagnostics.e2e.js';
import './motion.e2e.js';
import './navigation-accessibility.e2e.js';
import './demo-calm-updates.e2e.js';
import './infrastructure-scanner.component.e2e.js';
import './ghost-footsteps.e2e.js';
import './inspection-freeze.component.e2e.js';
import './universe-real-journey.e2e.js';
import './camera-presets.component.e2e.js';
import './spatial-targets.e2e.js';
import './house-character-focus-control.e2e.js';

const observations=new WeakMap();
test.beforeEach(async({page},info)=>{
  observations.set(page,{collector:collectBrowserEvidence(page),source:sourceIdentity()});
});
test.afterEach(async({page},info)=>{
  const observation=observations.get(page);
  if(!observation)return;
  const {collector,source}=observation;
  try{
    const model=await page.evaluate(()=>{
      const api=window.futureMachine;
      if(!api?.history)return null;
      const h=api.history,s=api.state;
      return {seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,
        recipe:h.recipe,provenance:h.provenance,month:s.month,
        frameMonths:[s.frame?.baseline?.month,s.frame?.plan?.month],
        sceneMonth:api.stats?.scene?.month,status:s.status,backend:api.stats?.scene?.backend};
    });
    let canvas=null;
    if(model?.status==='ready'&&model.backend==='canvas2d'){
      canvas=await page.locator('[data-testid="future-machine-stage"] canvas').first().evaluate(node=>{
        const ctx=node.getContext('2d'),{width,height}=node;
        if(!ctx||!width||!height)return {nonblank:false,width,height};
        const pixels=ctx.getImageData(0,0,width,height).data,colors=new Set();
        for(let i=0;i<pixels.length;i+=Math.max(4,Math.floor(pixels.length/4096/4)*4)){
          colors.add(pixels.slice(i,i+4).join(','));
          if(colors.size>1)break;
        }
        return {nonblank:colors.size>1,width,height};
      });
    }
    await info.attach('gallery-screen',{body:await page.screenshot(),contentType:'image/png'});
    await info.attach('gallery-observation',{body:JSON.stringify({version:1,source,model,canvas,
      limitations:['Screenshot is current final state, not a visual baseline approval.',
        'Blank pixel check covers ready Future Machine Canvas2D only; other backends require path-specific checks.',
        'No GPU memory certification; lifecycle budgets are path-specific.',
        'No real user data, outreach, analytics or public sharing authorization.']}),
      contentType:'application/json'});
    if(model?.status==='ready'&&model.backend!=='disposed'){
      expect(model.frameMonths,'committed model frames must match visible month').toEqual([model.month,model.month]);
      expect(model.sceneMonth,'scene must match committed model month').toBe(model.month);
      expect(model.modelVersion).toBeTruthy();expect(model.initialHash).toBeTruthy();
    }
    if(canvas)expect(canvas.nonblank,'ready Canvas2D must contain drawn content').toBe(true);
    // Expected HTTP denials/aborts are retained as evidence, not JS exceptions.
    expect(collector.events.filter(x=>['exception','console'].includes(x.kind)),
      'uncaught JS exceptions and console errors fail the gallery').toEqual([]);
    expect(collector.dropped,'truncated collection cannot certify a clean browser').toBe(0);
  }finally{await collector.attach(info);collector.dispose();observations.delete(page);}
});
