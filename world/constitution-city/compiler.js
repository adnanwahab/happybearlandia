/** Rule-based constitution candidates, never legal adjudication.
 * compileConstitution(text,{sourcePlan?}) preserves the entire exact source.
 * Only explicit [source_id] prefixes bind reviewed source proposals. Unbound,
 * unknown and duplicate bindings remain visible and unmodeled. Editing prose
 * never changes numeric adapter assumptions, costs, rights checks or outcomes.
 */
import publicSource from './dear-congress-plan.json' with {type:'json'};
import {normalizeDearCongressPlan} from './plan.js';
import {mappingForClause} from './mappings.js';
export const CONSTITUTION_COMPILER_VERSION='constitution-compiler.v1';
export const CONSTITUTION_COMPILER_LIMITS=Object.freeze({maxSourceCharacters:128000,maxClauses:128,maxClauseCharacters:20000,maxMarkersPerClause:32,maxMarkerCharacters:4000,maxLexicalCandidatesPerClause:128,maxCandidateCharacters:4000});
const categories=['rights','powers','institutions','procedures','constraints'];
const clone=value=>structuredClone(value);
const digest=text=>{let hash=2166136261;for(const character of text)hash=Math.imul(hash^character.charCodeAt(0),16777619);return(hash>>>0).toString(16).padStart(8,'0');};
const safeId=id=>/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id);
const categoryFor=word=>({right:'rights',rights:'rights',power:'powers',powers:'powers',institution:'institutions',institutions:'institutions',procedure:'procedures',procedures:'procedures',constraint:'constraints',constraints:'constraints'})[word.toLowerCase()];
const markerPattern=/^\s*(?:\[\s*(rights?|powers?|institutions?|procedures?|constraints?)\s*\]|(rights?|powers?|institutions?|procedures?|constraints?)\s*:)\s*(.*)$/i;
function binding(line){const match=/^\s*\[([^\]\r\n]{1,128})\]/.exec(line);return match&&!categoryFor(match[1].trim())?{id:match[1],prefix:match[0]}:null;}
function linesOf(text){const rows=[];let offset=0,index=1;for(const match of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)){if(!match[0].length)break;const raw=match[0];rows.push({text:raw.replace(/(?:\r\n|\r|\n)$/,''),start:offset,end:offset+raw.length,line:index++});offset+=raw.length;}return rows;}
function blocksOf(text){const blocks=[];let current=[];const flush=()=>{if(current.length){blocks.push(current);current=[];}};for(const line of linesOf(text)){if(!line.text.trim()){flush();continue;}if(binding(line.text)||/^\s*(?:article|section)\s+[A-Za-z0-9IVX]+\b/i.test(line.text))flush();current.push(line);}flush();if(blocks.length>128)throw new Error('Constitution source exceeds 128 clauses; no clauses were silently dropped');return blocks;}
// Lexical cues classify candidate sentence spans only. They do not establish
// rights, identify actual authority, interpret negation, or enable a mechanism.
const lexicalRules={
 rights:/\b(?:rights?\s+to|entitled(?:\s+to)?|guarantee(?:d|s)?|guaranteeing)\b/i,
 powers:/\b(?:Congress|Parliament|Council|Assembly|Senate|President|Governor|Mayor|agenc(?:y|ies)|authority|commission|board|department|court|legislature)\b[^.!?;]{0,100}?\b(?:may|shall|authorized)\b/i,
 institutions:/\b(?:Congress|Parliament|Senate|House\s+of\s+Representatives|departments?|ministr(?:y|ies)|offices?|bureaus?|agenc(?:y|ies)|authorit(?:y|ies)|commissions?|councils?|assembl(?:y|ies)|courts?|legislatures?|boards?|tribunals?|universit(?:y|ies)|police|public\s+works)\b/i,
 procedures:/\b(?:within\s+\d+\s*days?|by\s+(?:(?:a|the)\s+)?vote|annually|before|after)\b/i,
 constraints:/\b(?:shall\s+not|may\s+not|at\s+least|at\s+most|unless)\b/i,
};
function* proseSentences(text,lines){
 let segment=null;
 function* spans(range){if(!range)return;const value=text.slice(range.start,range.end);let start=0;
  for(let i=0;i<=value.length;i++){const character=value[i];if(i<value.length&&(!'.!?;'.includes(character)||(character==='.'&&/\d/.test(value[i-1]??'')&&/\d/.test(value[i+1]??''))))continue;
   const end=i<value.length?i+1:i,raw=value.slice(start,end),leading=raw.length-raw.trimStart().length,trimmed=raw.trim();if(trimmed)yield{text:trimmed,start:range.start+start+leading,end:range.start+start+leading+trimmed.length};start=end;
  }
 }
 for(const line of lines){if(markerPattern.test(line.text)||/^\s*(?:article|section)\s+[A-Za-z0-9IVX]+\b/i.test(line.text)){yield* spans(segment);segment=null;continue;}
  const prefix=binding(line.text)?.prefix.length??0,start=line.start+prefix;
  if(!segment)segment={start,end:line.end};else segment.end=line.end;
 }
 yield* spans(segment);
}
function lexicalCandidates(text,lines,id,extracted,fields){let count=0;
 for(const span of proseSentences(text,lines))for(const[category,rule]of Object.entries(lexicalRules)){const cue=rule.exec(span.text);if(!cue)continue;
  if(span.text.length>4000)throw new Error('Lexical candidate sentence exceeds 4000 characters; split the source into bounded sentences');
  if(++count>128)throw new Error(`Clause at line ${lines[0].line} exceeds 128 lexical candidates; no candidates were silently dropped`);
  const line=lines.find(row=>span.start>=row.start&&span.start<row.end)?.line??lines[0].line,endLine=lines.find(row=>span.end>row.start&&span.end<=row.end)?.line??line;
  const record={id:`${id}-${category}-${extracted[category].length+1}`,clauseId:id,category,text:span.text,rawText:span.text,sourceRange:{start:span.start,end:span.end,line,endLine},interpretation:'lexical candidate; not legal adjudication',extraction:{method:'lexical',rule:category,cue:cue[0],cueRange:{start:span.start+cue.index,end:span.start+cue.index+cue[0].length}},legalDetermination:false,implementedConstraint:false};
  extracted[category].push(record);fields[category].push(record);
 }
}
function traceFor(source,mapping,supported,reason){
 if(!supported)return{status:'unmodeled',sourceClauseId:source?.id??null,mechanism:null,parameters:[],outcomeKeys:[],outcomes:[],chain:[],limitations:[reason||'No reviewed, explicitly bound mechanism is available.']};
 const parameters=[{name:'addIntervention.type',value:mapping.type},{name:'addIntervention.amount',value:mapping.amount,basis:'reviewed synthetic adapter assumption'},{name:'addIntervention.compliance',source:'scenario.compliance',default:1},{name:'addIntervention.delay',source:'scenario.delayMonths',default:0},{name:'addIntervention.cost',expression:'sourceClause.costB * 1e9 * scenario.costScale; allocated once per clause',sourceCostB:source.costB}];
 const mechanism={type:mapping.type,label:mapping.label,implementation:'world/city/systems.js',allocation:mapping.allocation,assumption:mapping.assumption};
 const outcomeKeys=[...mapping.modeledMetrics],outcomes=outcomeKeys.map(key=>({key,source:'cityMetrics',status:'requires actual simulation',value:null}));
 return{status:'reviewed-mechanism-candidate',sourceClauseId:source.id,mechanism,parameters,outcomeKeys,outcomes,chain:[{kind:'clause',id:source.id},{kind:'mechanism',id:mapping.type,label:mapping.label},...parameters.map(parameter=>({kind:'parameter',...parameter})),...outcomes.map(outcome=>({kind:'outcome',...outcome}))],limitations:[mapping.assumption,...mapping.limitations,'This trace declares model wiring, not observed causal effects or a legal interpretation. Edited prose does not supply new numerical effect sizes.']};
}
export function compileConstitution(text,{sourcePlan}={}){
 if(typeof text!=='string'||text.length>128000)throw new Error('Constitution text must be a string of at most 128000 characters');
 // Apply the existing public-field allowlist even to caller-supplied plans.
 const source=normalizeDearCongressPlan(sourcePlan??publicSource);
 const sourceById=new Map(source.clauses.map(clause=>[clause.id,clause])),blocks=blocksOf(text),counts=new Map();
 for(const lines of blocks){const token=binding(lines[0].text);if(token)counts.set(token.id,(counts.get(token.id)||0)+1);}
 const diagnostics=[],fields=Object.fromEntries(categories.map(category=>[category,[]]));
 const addDiagnostic=(code,message,clauseId,line,severity='warning')=>diagnostics.push({code,severity,clauseId:clauseId??null,line:line??null,message});
 const clauses=blocks.map((lines,index)=>{
  const start=lines[0].start,end=lines.at(-1).end,raw=text.slice(start,end),token=binding(lines[0].text),sourceId=token?.id??null;
  if(raw.length>20000)throw new Error(`Clause at line ${lines[0].line} exceeds 20000 characters`);
  const reviewed=sourceById.get(sourceId),duplicate=sourceId&&counts.get(sourceId)>1,id=reviewed&&!duplicate?reviewed.id:`text-${index+1}-${digest(raw)}`;
  let reason=null;
  if(!token)reason='No explicit [source_id] binding; free text is retained without a simulation mapping.';
  else if(!safeId(sourceId))reason='The binding is not a valid source proposal identifier.';
  else if(duplicate)reason='Duplicate source binding is ambiguous; all occurrences are unmodeled to prevent double authorizations.';
  else if(!reviewed)reason='The explicit identifier is absent from the supplied public source plan.';
  const mapping=reviewed?mappingForClause(reviewed.id):{supported:false,label:'Forecast unavailable',modeledMetrics:[],limitations:[reason]};
  const supported=!reason&&reviewed.supported===true&&mapping.supported===true&&Number.isFinite(reviewed.costB);
  if(!reason&&!supported)reason=!Number.isFinite(reviewed?.costB)?'A source cost is unavailable; no free implementation is assumed.':mapping.limitations[0]??'The explicitly bound source clause has no reviewed mechanism.';
  if(!token)addDiagnostic('UNBOUND_TEXT',reason,id,lines[0].line);
  else if(!safeId(sourceId))addDiagnostic('INVALID_SOURCE_ID',reason,id,lines[0].line);
  else if(duplicate)addDiagnostic('DUPLICATE_SOURCE_BINDING',reason,id,lines[0].line,'error');
  else if(!reviewed)addDiagnostic('UNKNOWN_SOURCE_ID',reason,id,lines[0].line);
  else if(!supported)addDiagnostic('MECHANISM_UNAVAILABLE',reason,id,lines[0].line);
  const body=token?raw.slice(raw.indexOf(token.prefix)+token.prefix.length):raw;
  if(reviewed&&body.trim()!==reviewed.text.trim())addDiagnostic('EDITED_BOUND_SOURCE','Edited text explicitly selects the reviewed source mechanism; its numeric assumptions and source cost are unchanged. Prose is not interpreted as a parameter override.',id,lines[0].line,'info');
  const extracted=Object.fromEntries(categories.map(category=>[category,[]]));let markerCount=0;
  for(const line of lines){const match=markerPattern.exec(line.text);if(!match)continue;if(++markerCount>32)throw new Error(`Clause at line ${lines[0].line} exceeds 32 explicit field markers`);const category=categoryFor(match[1]??match[2]),value=match[3];if(value.length>4000)throw new Error('Constitution field marker exceeds 4000 characters');if(!value.trim()){addDiagnostic('EMPTY_FIELD_MARKER',`${category} marker has no text.`,id,line.line);continue;}
   const valueStart=line.start+line.text.length-value.length,record={id:`${id}-${category}-${extracted[category].length+1}`,clauseId:id,category,text:value,rawText:line.text,sourceRange:{start:valueStart,end:valueStart+value.length,line:line.line},interpretation:'rule-based explicit-marker candidate',extraction:{method:'explicit-marker'},legalDetermination:false,implementedConstraint:false};
   extracted[category].push(record);fields[category].push(record);
  }
  lexicalCandidates(text,lines,id,extracted,fields);
  const trace=traceFor(reviewed,mapping,supported,reason);
  return{id,index,sourceId,sourceText:raw,text:raw,rawText:raw,bodyText:body,sourceRange:{start,end,line:lines[0].line,endLine:lines.at(-1).line},title:reviewed?.title??lines[0].text.trim().slice(0,200),binding:token?{sourceId,explicit:true,status:duplicate?'ambiguous':reviewed?'source-found':'source-unavailable',sourcePlanId:source.id,sourceTitle:reviewed?.title??null,sourceText:reviewed?.text??null,edited:reviewed?body.trim()!==reviewed.text.trim():null}:null,...extracted,supported,status:supported?'reviewed-mechanism-candidate':'unmodeled',trace,interpretation:'Rule-based candidate structure and explicit mechanism binding; not legal adjudication.',limitations:[...(reason?[reason]:[]),...mapping.limitations]};
 });
 const planClauses=clauses.map(clause=>{
  const reviewed=sourceById.get(clause.sourceId),base=reviewed?clone(reviewed):{needId:'',costB:null,mechanism:'',authority:'',jurisdiction:'',legalChange:'',changeLevel:null,evidence:null,metrics:[],dependencies:[],conflicts:[]};
  return{...base,id:clause.id,title:clause.title,text:clause.sourceText,textSource:'editable-constitution-text',supported:clause.supported,mapping:clause.supported?mappingForClause(clause.sourceId):{supported:false,label:'Forecast unavailable',modeledMetrics:[],limitations:clause.limitations},rightsContext:{legalDetermination:false,note:'Text-marker and lexical candidates are not legal findings or encoded numerical rights constraints.'},compiler:{version:CONSTITUTION_COMPILER_VERSION,sourceId:clause.sourceId,range:clause.sourceRange,binding:clause.binding,trace:clause.trace},limitations:clause.limitations};
 });
 if(!clauses.length)addDiagnostic('EMPTY_SOURCE','No nonblank clauses were supplied; the resulting plan contains no interventions.',null,null,'info');
 const plan={schemaVersion:'constitution-city-plan.v1',id:`constitution-${digest(text)}-${digest(source.id)}`,label:'Editable constitution · explicit reviewed bindings',clauses:planClauses,provenance:{...clone(source.provenance),compilerVersion:CONSTITUTION_COMPILER_VERSION,sourcePlanId:source.id,sourceType:'editable candidate constitution; source bindings select illustrative policy-proposal mechanisms, not enacted law',sourceText:text,interpretation:'Rule-based candidates, not adjudication',privacy:'Public source fields and exact user-supplied constitution text only.',assumptions:['Only unique explicit [source_id] prefixes bind mechanisms from the reviewed source registry.','Unrecognized prose remains unmodeled. Numerical costs and effects stay at the reviewed source/adapter assumptions.','Rights, powers, institutions, procedures and constraints are explicit text-marker or lexical candidates; no legal meaning, institutional implementation or outcome is inferred.']}};
 return{schemaVersion:CONSTITUTION_COMPILER_VERSION,sourceText:text,clauses,...fields,diagnostics,plan,traces:clauses.map(clause=>({clauseId:clause.id,...clone(clause.trace)})),interpretation:'Rule-based candidate interpretation; not legal adjudication',limits:clone(CONSTITUTION_COMPILER_LIMITS)};
}
