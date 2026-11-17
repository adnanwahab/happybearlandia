// Two-sided 95% Student-t intervals of paired seed differences. The seed is
// the replicate, not a resident. No normal 1.96 shortcut for small samples.
const T=[null,12.706204736,4.30265273,3.182446305,2.776445105,2.570581836,2.446911851,2.364624252,2.306004135,2.262157163,2.228138852,2.20098516,2.17881283,2.160368656,2.144786688,2.131449546,2.119905299,2.109815578,2.10092204,2.093024054,2.085963447,2.079613845,2.073873068,2.06865761,2.063898562,2.059538553,2.055529439,2.051830516,2.048407142,2.045229642,2.042272456,2.039513446];
export function pairedSeedBand(pairs){
 if(!Array.isArray(pairs)||pairs.length>32)throw Error('Expected at most 32 seed pairs');
 const seeds=new Set();
 for(const pair of pairs){if(!Number.isInteger(pair.seed)||pair.seed<0||pair.seed>0xffffffff||seeds.has(pair.seed))throw Error('Unique uint32 seed required');seeds.add(pair.seed);}
 const missingSeeds=pairs.filter(p=>!Number.isFinite(p.full)||!Number.isFinite(p.control)).map(p=>p.seed);
 if(pairs.length<3||missingSeeds.length)return {status:'unavailable',seedCount:pairs.length,missingSeeds,meanDifference:null,interval95:null,excludesZero:false};
 const deltas=pairs.map(p=>p.full-p.control),mean=deltas.reduce((s,v)=>s+v,0)/deltas.length;
 const variance=deltas.reduce((s,v)=>s+(v-mean)**2,0)/(deltas.length-1),half=T[deltas.length-1]*Math.sqrt(variance/deltas.length);
 if(!Number.isFinite(mean)||!Number.isFinite(half))throw Error('Nonfinite paired interval');
 const interval95=[mean-half,mean+half];
 return {status:'available',seedCount:pairs.length,missingSeeds,meanDifference:mean,interval95,excludesZero:interval95[0]>0||interval95[1]<0,
  method:'paired mean difference, two-sided Student-t 95%; iid seed assumption, pointwise across outcomes; no multiplicity correction'};
}
