import {CONTRACTS, VERSION, draw, validateState} from './contracts.js';
/** Import real entity rows by passing CityState.v1; this fixture is explicitly synthetic. */
export function createCity({seed = 42, households = 120, districts: supplied} = {}) {
  if(!Number.isInteger(seed) || seed<0 || seed>4294967295 || !Number.isInteger(households) || households<1 || households>10000) throw new Error('Invalid seed or household count');
  const districts = supplied || ['Center','Riverside','Uptown'].map((name,i)=>({id:`d${i}`,name, floodRisk:i===1?.7:.1,accessibility:1,parkingPrice: i===0?8:2}));
  if(!Array.isArray(districts)||!districts.length||districts.length>32)throw new Error('1–32 districts required');
  const s = {schemaVersion:CONTRACTS.CityState, version:VERSION, seed, month:0, revision:0,
    provenance:{type:'synthetic-assumption',datasetVersion:'illustrative-city.v1',populationSnapshot:`synthetic-${seed}-${households}`,worldRevision:'seed.v1',confidence:'low'},
    districts:structuredClone(districts),parcels:[],buildings:[],units:[],households:[],workers:[],businesses:[],jobs:[],links:[],facilities:[],utilities:[],projects:[],policies:[],shocks:[],
    finance:{balance:10000000,debt:0,allowDebt:false,maxDebt:50000000,revenue:0,operatingExpense:0,capitalExpense:0},
    parameters:{contractors:100,labor:80,materials:90,equipment:100,permits:3,administration:3,interestRate:.05,constructionCost:140000,annualGrowth:.01},systems:{}, flows:[]};
  for(const [i,d] of s.districts.entries()) {
    s.parcels.push({id:`parcel-${d.id}`,districtId:d.id,landArea:20000,currentUse:'residential',far:8,heightLimit:12,existingFloors:1,landValue:1000000,capacity:1000});
    s.buildings.push({id:`building-${d.id}`,parcelId:`parcel-${d.id}`,districtId:d.id,floors:1});
    const n = Math.ceil(households / districts.length * 1.12);
    for(let j=0;j<n;j++)s.units.push({id:`unit-${d.id}-${j}`,buildingId:`building-${d.id}`,districtId:d.id,bedrooms:1+j%3,floorArea:50+20*(j%3),quality:1,rent:1000+i*150,tenure:'rental',status:'available',householdId:null,daysVacant:0});
    s.businesses.push({id:`business-${d.id}`,districtId:d.id,type:'services',status:'open',badMonths:0,commercialRent:1000,operatingCost:1000,viability:0,demand:0});
    for(let j=0;j<Math.ceil(households/districts.length*.8);j++)s.jobs.push({id:`job-${d.id}-${j}`,businessId:`business-${d.id}`,districtId:d.id,occupation:'general',wage:4000,workerId:null});
    for(const type of ['school','park','healthcare','emergency','library']) s.facilities.push({id:`${type}-${d.id}`,districtId:d.id,type,capacity:Math.ceil(households/districts.length*(type==='school'?.5:3)),demand:0,utilization:0});
    for(const type of ['electric','water','sewer','stormwater'])s.utilities.push({id:`${type}-${d.id}`,districtId:d.id,type,capacity:Math.ceil(households/districts.length*1.4),demand:0,serviceLevel:1});
    for(const other of s.districts) if(d.id!==other.id)for(const mode of ['road','transit'])s.links.push({id:`${mode}-${d.id}-${other.id}`,from:d.id,to:other.id,mode,capacity:mode==='road'?25:15,freeTime:mode==='road'?12:18,flow:0,travelTime:mode==='road'?12:18});
  }
  for(let i=0;i<households;i++) {
    const d=s.districts[i%districts.length],u=s.units.find(u=>u.districtId===d.id&&!u.householdId);
    const id=`household-${i}`, income=3000+draw(seed,i,'income')*5000;
    s.households.push({id,districtId:d.id,unitId:u.id,size:2+i%3,children:i%3===0?1:0,income,otherIncome:income*.3,bedrooms:1+i%2,leaseUntil:1+i%12,age:25+i%45,savings:income*3});
    u.status='occupied';u.householdId=id;
    s.workers.push({id:`worker-${i}`,householdId:id,districtId:d.id,occupation:'general',jobId:null,available:true,age:25+i%45});
  }
  validateState(s);return s;
}

/** OSM geometry is evidence only: inferred units/zoning/parcels remain assumptions. */
export function createCityFromArea(area,options={}) {
  if(!area||area.source!=='osm'||!Array.isArray(area.buildings)||!area.buildings.length)throw new Error('An OSM area with building footprints is required');
  const footprints=area.buildings.filter(b=>Array.isArray(b.pts)&&b.pts.length>=3&&b.pts.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite))).slice(0,2000);
  if(!footprints.length)throw new Error('No valid building footprints');
  const state=createCity(options),districtIds=state.districts.map(d=>d.id);
  state.buildings=footprints.map((b,i)=>{
    const ring=b.pts.map(([lat,lng])=>[lng,lat]);if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])ring.push([...ring[0]]);
    const coordinates=[ring],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
    return {id:`osm-${b.id||i}`,districtId:districtIds[i%districtIds.length],parcelId:`inferred-parcel-${i}`,floors:Number.isFinite(b.levels)?Math.max(1,b.levels):1,geometry:{type:'Polygon',coordinates},bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],sourceId:b.id||null,source:'osm',name:b.name||null};
  });
  state.parcels=state.buildings.map((b,i)=>({id:b.parcelId,districtId:b.districtId,landArea:1000,currentUse:'inferred',far:4,heightLimit:8,existingFloors:b.floors,landValue:300000,capacity:20,geometry:b.geometry,bbox:b.bbox,source:'synthetic-footprint-proxy'}));
  for(const u of state.units){const buildings=state.buildings.filter(b=>b.districtId===u.districtId);if(!buildings.length){u.districtId=state.buildings[0].districtId;u.buildingId=state.buildings[0].id;const h=state.households.find(h=>h.id===u.householdId);if(h){h.districtId=u.districtId;for(const w of state.workers.filter(w=>w.householdId===h.id))w.districtId=h.districtId;}}else u.buildingId=buildings[Number(u.id.split('-').at(-1))%buildings.length].id;}
  const origin=area.origin||{},snapshot=`osm-${origin.lat??'unknown'}-${origin.lng??'unknown'}-${area.radiusM||400}-${footprints.length}`;
  state.provenance={...state.provenance,type:'mixed-evidence',datasetVersion:snapshot,worldRevision:snapshot,geometrySource:'OpenStreetMap',origin,assumptions:['District assignments, household inventory, jobs, utility capacities, costs, rents and zoning are synthetic.','Parcel geometries are building footprint proxies, not cadastral boundaries.','Road and transit links are synthetic district connections, not imported OSM routes.']};
  validateState(state);return state;
}
