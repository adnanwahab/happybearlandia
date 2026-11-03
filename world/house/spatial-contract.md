Spatial owner exports from `spatial-system.js`:

- `createSpatialSystem({catalog: HOUSE_FURNITURE})` returns descriptor id `spatial` for static installation after core initialization. No self-registration or model import.
- Storage is **home.systems.spatial**. Read-only inspector returns it at inspectedHome.systems.spatial. Legacy home.spatial is read only as a compatibility fallback.
- `runtime.householdSystemCommand({householdId, system:'spatial', type:<op>, ...payload})` operations: configure(enabled boolean), surface(wallId,finish,color,trim), lighting(objectId,brightness,warmth,direction,automatic), roof(roomId,roofType,enabled), level(label,height), activeLevel(levelId), stairs(fromLevelId,toLevelId,position,rotation), outdoor(kind,polygon,levelId), duplicate(objectId,position,rotation,levelId), roomTransform(roomId,dx,dz,scaleX,scaleZ), blueprint(template,polygon,levelId), doorPermission(openingId,mode,personIds).
- Blueprint templates: bedroom, kitchen, bathroom, office, nursery, gym. Object catalog/cash are supplied by authority. Construction does not alter frozen exterior rings.
- `actionPlan` returns routes in data; **core must retain the returned data under action.systemData.spatial** before admitAction. `admitAction` sets action.start to latest actual arrival and action.until=start+duration; existing recordHouseInterval already intersects against action.start, so no attended action time is granted during travel/wait. needRates returns travel baseline until arrival. Core must call these published generic hooks; without them navigation is not authoritative and must not be advertised as active.
- Explicit configure enables routing; absent optional state remains backward compatible. Scene uses committed positions/trips; never advances them on RAF.
- `advance` updates body-clearance reservations, committed positions and cell heatmap; `prepare` releases interrupted/completed trip reservations. No movement through unreachable furniture/locked walls fallback.
- Pure helpers: applySpatialCommand, planHouseRoute, reserveHouseRoute, advanceHouseNavigation, attendedSpatialMinutes, cancelHouseRoute, spatialGeometry, spatialDoorAllowed, validateSpatialState.

Renderer API additions (view only, no separate Build entry):
- setHouseHeatmap(rows|null), rows {roomId,personMinutes,waitMinutes,value:0..1,source}; clips real floor removal/courtyards and skips empty geometry.
- setCameraPreset('follow'|'room'|'free'|'dollhouse'|'first-person',{personId?,roomId?}); first-person uses perspective camera and hides only the tracked figure's own body.
- setRoofVisible(boolean); optional roofs remain sourced from persisted spatial construction.
- Existing setBuildTool({type:'door'|'window',width}) -> onBuildCommit structural attachment; HouseEditor paint mode -> onSelectWall(actualID). Activating a structural tool clears furniture floor ghosts.
- Spatial construction, lighting and placements are read from inspectedHome.systems.spatial. Other active levels hide ground structures and show the requested level's placed inventory. Frozen footprint rings are unchanged.
