/** Display-only v1 policy. Counts never estimate independently updated states. */
export const POPULATION_LOD_VERSION='population-display-lod.v1';
export function populationLOD(distance){return distance>=900?'heat':distance>=350?'clusters':'residents';}
export function clusterPopulationRows(rows,cellSize=40){
  const cells=new Map();
  for(const row of rows){const key=`${Math.floor(row.x/cellSize)}:${Math.floor(row.z/cellSize)}`;let cell=cells.get(key);if(!cell){cell={id:`sample-cell:${key}`,x:0,z:0,count:0,memberIds:[]};cells.set(key,cell);}cell.x+=row.x;cell.z+=row.z;cell.count++;cell.memberIds.push(row.id);}
  return [...cells.values()].map(cell=>({...cell,x:cell.x/cell.count,z:cell.z/cell.count}));
}
export function populationDisplayCounts(frame,{active=true,near=0,far=0,heatCells=0,mode='residents'}={}){
  const value=frame?.metrics?.syntheticPopulation??frame?.population;
  return {residentRecords:Number.isSafeInteger(value)&&value>=0?value:null,drawnIndividuals:active?near+(mode==='residents'?far:0):0,drawnClusters:active&&mode==='clusters'?far:0,heatCells:active?heatCells:0};
}
