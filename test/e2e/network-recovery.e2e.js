import {test,expect} from '@playwright/test';

for(const mode of ['offline','slow-3g'])test(`${mode}: bounded map failure and comparison recovery`,async({page,context})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const [{createMapStreamer},{projector},{createQuickDemoController},{mountFirstRunGuide}]=await Promise.all([
      import('/world/render/map-streamer.js'),import('/world/gen.js'),import('/world/onboarding/quick-demo-controller.js'),import('/world/first-run-guide.js')]);
    window.recoveryModules={createMapStreamer,projector,createQuickDemoController,mountFirstRunGuide};
  });
  if(mode==='offline')await context.setOffline(true);
  else await (await context.newCDPSession(page)).send('Network.emulateNetworkConditions',{
    offline:false,latency:400,downloadThroughput:50000,uploadThroughput:50000});
  const evidence=await page.evaluate(async()=>{
    const {createMapStreamer,projector,createQuickDemoController,mountFirstRunGuide}=window.recoveryModules;
    const origin={lat:29.75,lng:-95.35};
    const streamer=createMapStreamer({origin,projector:projector(origin),initialArea:{source:'osm',origin,radiusM:400},
      maxTiles:2,requestTimeoutMs:100,attachBuilding:()=>()=>{}});
    streamer.update({x:0,z:0});
    while(streamer.getState().activeFetches)await new Promise(r=>setTimeout(r,10));
    const map=streamer.getState();streamer.dispose();
    let attempt=0,controller;
    const guide=mountFirstRunGuide({container:document.body,onQuickDemo:()=>controller.start({seed:176}),
      onReplay:()=>controller.replay(),onStop:()=>controller.stop()});
    controller=createQuickDemoController({operationTimeoutMs:100,onState:s=>guide.update(s),
      runComparison:async()=>{attempt++;if(attempt===1)await fetch('/api/area?lat=29.75&lng=-95.35&radiusM=400&core=1');return {seed:176};}});
    guide.update({ready:true});window.recoveryController=controller;
    return {map,browser:navigator.userAgent,seed:176};
  });
  expect(evidence.map.activeFetches).toBe(0);
  expect(evidence.map.tiles.find(t=>t.key==='0:0').status).toBe('resident');
  expect(evidence.map.tiles.some(t=>t.status==='error')).toBe(true);
  await page.getByTestId('quick-demo').click();
  await expect(page.getByTestId('quick-demo-replay')).toHaveText('Retry comparison');
  await expect(page.getByTestId('quick-demo')).toBeEnabled();
  await expect(page.getByTestId('quick-demo-replay')).toBeEnabled();
  expect(await page.evaluate(()=>window.recoveryController.getState().status)).toBe('error');
  await page.getByTestId('quick-demo-replay').click();
  await expect.poll(()=>page.evaluate(()=>window.recoveryController.getState().status)).toBe('completed');
  console.log(JSON.stringify({mode,...evidence}));
});
