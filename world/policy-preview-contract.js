import {createHash} from 'node:crypto';
import {mappingForClause} from './constitution-city/mappings.js';
export const POLICY_PREVIEW_SCHEMA='policy-impact-preview.v1';
export const POLICY_MAPPING_VERSION='policy-preview-mappings.1.0.0';
export const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
export const policyHash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
function shape(value,keys,name){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(`Invalid ${name} fields`);}
function str(value,name,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)fail(`Invalid ${name}`);}
function url(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)fail('Source URL must be a credential-free public HTTP URL without query or fragment');}catch{fail('Invalid source URL');}}
export function validatePolicyPreview(value){
 shape(value,['schemaVersion','source','legal','baseline','simulation','modelRunId'],'preview');
 if(value.schemaVersion!==POLICY_PREVIEW_SCHEMA)fail('Unsupported schemaVersion');
 const {source,legal,baseline,simulation}=value;
 shape(source,['system','proposalId','versionId','contentHash','type','title','url','visibility'],'source');
 for(const key of ['system','proposalId','versionId','title'])str(source[key],`source.${key}`,key==='title'?500:200);
 if(!['bill','constitutional-amendment'].includes(source.type))fail('Unsupported source.type');
 if(source.visibility!=='public')fail('Only explicitly public proposal content is accepted');url(source.url);
 shape(legal,['baseVersionId','clauses'],'legal');str(legal.baseVersionId,'legal.baseVersionId');
 if(!Array.isArray(legal.clauses)||legal.clauses.length<1||legal.clauses.length>32)fail('Use1–32 clauses');
 const ids=new Set(),policies=new Set();
 for(const clause of legal.clauses){shape(clause,['clauseId','sourcePolicyId','operation','beforeText','afterText'],'clause');
 for(const key of ['clauseId','sourcePolicyId'])str(clause[key],key,96);
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(clause.sourcePolicyId)||ids.has(clause.clauseId)||policies.has(clause.sourcePolicyId))fail('Duplicate clause/policy IDs or invalid policy ID');ids.add(clause.clauseId);policies.add(clause.sourcePolicyId);
 if(!['add','remove','modify'].includes(clause.operation))fail('Unsupported clause operation');
 for(const key of ['beforeText','afterText'])if(typeof clause[key]!=='string'||clause[key].length>20000)fail('Invalid exact clause text');
 if(clause.operation==='add'&&(clause.beforeText!==''||!clause.afterText.trim())||clause.operation==='remove'&&(clause.afterText!==''||!clause.beforeText.trim())||clause.operation==='modify'&&(!clause.beforeText.trim()||!clause.afterText.trim()))fail('Clause text does not match operation');
 }
 if(source.contentHash!==policyHash(legal))fail('contentHash must equal SHA256 of canonical legal object');
 shape(baseline,['kind','versionId','label'],'baseline');
 if(!['current-law','prior-proposal-version'].includes(baseline.kind))fail('Unsupported baseline.kind');str(baseline.versionId,'baseline.versionId');str(baseline.label,'baseline.label');
 if(baseline.versionId!==legal.baseVersionId)fail('Baseline version must equal legal.baseVersionId');
 shape(simulation,['seed','runs','months'],'simulation');
 for(const [key,min,max] of [['seed',0,4294967295],['runs',1,100],['months',1,24]])if(!Number.isInteger(simulation[key])||simulation[key]<min||simulation[key]>max)fail(`Invalid simulation.${key}`);
 if(value.modelRunId!==undefined){str(value.modelRunId,'modelRunId',96);if(!/^[A-Za-z0-9_-]+$/.test(value.modelRunId))fail('Invalid modelRunId');}
 return structuredClone(value);
}
export function previewParameterDiff(input){return input.legal.clauses.map(clause=>{
 const mapping=mappingForClause(clause.sourcePolicyId),changed=mapping.supported&&clause.operation!=='modify';
 return {sourceClauseId:clause.clauseId,sourcePolicyId:clause.sourcePolicyId,parameterId:mapping.type||null,before:changed?(clause.operation==='remove'?mapping.amount:0):null,after:changed?(clause.operation==='add'?mapping.amount:0):null,
 units:({upzone:'additional permitted homes per modeled parcel',resilience:'district resilience index',transit:'rider capacity per incident link'})[mapping.type]||null,mappingVersion:POLICY_MAPPING_VERSION,
 supportStatus:changed?'supported':mapping.supported?'unchanged':'unavailable',explanation:changed?mapping.label:mapping.supported?'Wording changed; reviewed mechanism is unchanged. No numerical effect inferred.':'No reviewed mechanism. Effects unavailable.',
 assumptions:[...(mapping.assumption?[mapping.assumption]:[]),'Reviewed registry identity is asserted by the authorized integration; human legal review must establish applicability before submission.','Synthetic local capital envelope is $1000 per included mechanism; no proposal appropriation is inferred.'],limitations:mapping.limitations};});}
