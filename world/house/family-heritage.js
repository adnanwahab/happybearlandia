import {personalityFor} from './relationships.js';
import {PROFILE_VERSION,PROFILE_TRAITS,PROFILE_INTERESTS} from './profiles.js';
import {HOUSE_SKILLS} from './progression-catalog.js';

/** Seeded household influences, not genetic predictions or inherited skill points.
 * Learning multipliers apply only to actual attended practice. */
export const HERITAGE_VERSION='house-heritage.v1';
const clone=value=>structuredClone(value);
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const personId=(m,i)=>m.prefix+'-p'+i;
const actual=(m,i)=>Number.isInteger(i)&&i>=0&&i<m.people.age.length;
const check=(value,message)=>{if(!value)throw Error(message);};
const level=minutes=>Math.min(10,1+Math.floor(Math.sqrt(Math.max(0,minutes)/60)));
const trait=id=>id==='hotheaded'?'hot-headed':id;
const resources={cooking:['stove','books'],gardening:['plant','gardenBed','toyBox'],creativity:['books','artEasel','toyBox'],logic:['books','computer','toyBox'],charisma:['books','toyBox'],handiness:['toolbox','books'],fitness:['rug','toyBox'],programming:['computer','books'],music:['music','books'],painting:['artEasel','books'],repair:['toolbox','books']};
function parentSkills(model,index){const rows=Object.values(model.houses?.homes??{}).map(home=>home.progression?.skills?.[index]??{});return Object.fromEntries(Object.keys(HOUSE_SKILLS).map(skill=>[skill,Math.max(0,...rows.map(row=>row[skill]??0))]));}
export function initializeChildHeritage(model,index,parentIndices,{minute=model.minute}={}){
 check(actual(model,index),'Heritage requires a real appended population agent');
 check(Array.isArray(parentIndices)&&parentIndices.length>=1&&parentIndices.length<=2&&new Set(parentIndices).size===parentIndices.length&&parentIndices.every(p=>actual(model,p)&&p!==index&&model.people.ageYears[p]>=18),'Use one or two actual adult parents');
 check(Number.isFinite(minute)&&minute>=0&&minute<=model.minute,'Heritage requires a committed birth or placement minute');
 const id=personId(model,index),existing=model.houseHeritage?.people?.[id];if(existing){check(existing.parentIds.join('|')===parentIndices.map(i=>personId(model,i)).join('|'),'A child’s established lineage cannot be replaced');return clone(existing);}
 const canonical=[model.people.parent1?.[index],model.people.parent2?.[index]].filter(i=>Number.isInteger(i)&&i>=0);
 check(canonical.length===parentIndices.length&&canonical.every(i=>parentIndices.includes(i)),'Set canonical parent links before creating heritage');
 check(Object.keys(model.houseHeritage?.people??{}).length<1000,'Family heritage retention limit reached');
 let sequence=0;const random=()=>hash(model.config.seed+':'+id+':heritage.v1:'+sequence++)/4294967296;
 const parents=parentIndices.map(i=>({i,profile:model.houseProfiles?.people?.[personId(model,i)],personality:personalityFor(model,personId(model,i)),skills:parentSkills(model,i)}));
 const chosen=[];for(const parent of parents){const options=parent.personality.traits.map(t=>trait(t.id)).filter(t=>PROFILE_TRAITS.includes(t)&&!chosen.includes(t));if(options.length)chosen.push(options[Math.floor(random()*options.length)]);}
 while(chosen.length<3){const options=PROFILE_TRAITS.filter(t=>!chosen.includes(t));chosen.push(options[Math.floor(random()*options.length)]);}
 const interestPool=[...new Set(parents.flatMap(p=>p.personality.interests??[p.personality.preferredTopic]).filter(t=>PROFILE_INTERESTS.includes(t)))],interests=interestPool.length?[interestPool[Math.floor(random()*interestPool.length)]]:['family'];
 const home=model.houses?.homes?.[model.people.household[index]],inventory=[...new Set((home?.objects??[]).map(o=>o.type))],learning={},parentSkillLevels={};
 for(const skill of Object.keys(HOUSE_SKILLS)){const levels=parents.map(p=>p.skills[skill]>0?level(p.skills[skill]):0);parentSkillLevels[skill]=levels;const teaching=Math.max(...levels)/10*.15,material=inventory.some(type=>resources[skill]?.includes(type))?.025:0,variation=.65+random()*.35;learning[skill]=Number((1+Math.min(.2,(teaching+material)*variation)).toFixed(6));}
 const profile={name:'Child '+(index+1),skinColor:'#c99978',shirtColor:'#8fbea7',hairColor:'#49392f',voice:'bright',traits:chosen,interests};for(const key of['skinColor','shirtColor','hairColor']){const options=parents.map(p=>p.profile?.[key]).filter(v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v));if(options.length)profile[key]=options[Math.floor(random()*options.length)];}
 const row={parentIds:parentIndices.map(i=>personId(model,i)),bornMinute:minute,learning,parentSkillLevels,homeResources:inventory.slice(0,64),source:'Seeded family and home learning influences. Traits are probabilistic; skills start unearned and require actual practice. These are game rules, not genetic or educational predictions.'};
 model.houseProfiles??={schemaVersion:PROFILE_VERSION,people:{},households:{}};model.houseProfiles.people[id]={...(model.houseProfiles.people[id]??{}),...profile,name:model.houseProfiles.people[id]?.name??profile.name};model.houseHeritage??={schemaVersion:HERITAGE_VERSION,people:{}};model.houseHeritage.people[id]=row;return clone(row);
}
export function familyLearningMultiplier(model,index,skill){const value=model.houseHeritage?.people?.[personId(model,index)]?.learning?.[skill];return Number.isFinite(value)?Math.max(1,Math.min(1.2,value)):1;}
export function inspectFamilyHeritage(model,index){const row=model.houseHeritage?.people?.[personId(model,index)];return row?clone(row):null;}
export function validateFamilyHeritage(model){const state=model.houseHeritage;if(state===undefined)return;check(state?.schemaVersion===HERITAGE_VERSION&&state.people&&typeof state.people==='object'&&!Array.isArray(state.people)&&Object.keys(state.people).length<=1000,'Invalid saved family heritage');for(const [id,row]of Object.entries(state.people)){const i=Number(id.slice((model.prefix+'-p').length));check(actual(model,i)&&id===personId(model,i),'Heritage must belong to an actual resident');const canonical=[model.people.parent1?.[i],model.people.parent2?.[i]].filter(p=>Number.isInteger(p)&&p>=0).map(p=>personId(model,p));check(Array.isArray(row.parentIds)&&row.parentIds.length>=1&&row.parentIds.length<=2&&new Set(row.parentIds).size===row.parentIds.length&&row.parentIds.length===canonical.length&&row.parentIds.every(p=>canonical.includes(p)),'Heritage ancestry differs from canonical parents');check(Number.isFinite(row.bornMinute)&&row.bornMinute>=0&&row.bornMinute<=model.minute&&typeof row.source==='string'&&row.source.length<=1000,'Invalid heritage birth provenance');check(row.learning&&typeof row.learning==='object'&&!Array.isArray(row.learning)&&Object.keys(row.learning).length<=Object.keys(HOUSE_SKILLS).length&&Object.entries(row.learning).every(([skill,value])=>Object.hasOwn(HOUSE_SKILLS,skill)&&Number.isFinite(value)&&value>=1&&value<=1.2),'Invalid inherited learning influence');check(Array.isArray(row.homeResources)&&row.homeResources.length<=64&&row.homeResources.every(type=>typeof type==='string'&&type.length<=80),'Invalid family learning resources');check(row.parentSkillLevels&&Object.keys(row.parentSkillLevels).length<=Object.keys(HOUSE_SKILLS).length&&Object.entries(row.parentSkillLevels).every(([skill,levels])=>Object.hasOwn(HOUSE_SKILLS,skill)&&Array.isArray(levels)&&levels.length===row.parentIds.length&&levels.every(n=>Number.isInteger(n)&&n>=0&&n<=10)),'Invalid parental practice snapshot');}}
