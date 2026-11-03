import {randomBytes} from 'node:crypto';
import {readPopulationCheckpoint} from '../population/checkpoint.js';
import {validDateCoordinates} from '../house/date-place.js';
export const DATE_MEDIA_MAX_IMAGE_BYTES=256*1024;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export function decodeDatePhoto(image){
 if(typeof image!=='string'||Buffer.byteLength(image)>DATE_MEDIA_MAX_IMAGE_BYTES)fail('Date photo exceeds the 256 KiB encoded image limit.',413);
 const match=image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||match[2].length%4!==0)fail('Use a PNG, JPEG or WebP base64 date photo.');
 const data=Buffer.from(match[2],'base64');if(data.toString('base64')!==match[2])fail('Invalid photo base64 encoding.');
 let valid=false,width,height;
 if(match[1]==='png'){
  valid=data.length>=45&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&data.toString('ascii',12,16)==='IHDR'&&data.toString('ascii',data.length-8,data.length-4)==='IEND';
  if(valid){width=data.readUInt32BE(16);height=data.readUInt32BE(20);valid=width>0&&height>0&&width<=4096&&height<=4096;}
 }else if(match[1]==='jpeg')valid=data.length>=12&&data[0]===255&&data[1]===216&&data[2]===255&&data.at(-2)===255&&data.at(-1)===217;
 else valid=data.length>=20&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'&&data.readUInt32LE(4)===data.length-8&&['VP8 ','VP8L','VP8X'].includes(data.toString('ascii',12,16));
 if(!valid)fail('Date photo bytes do not match a bounded PNG, JPEG or WebP image.');
 return{data,mimeType:'image/'+match[1],encodedBytes:Buffer.byteLength(image),...(width?{width,height}:{})};
}
export function createDateMediaStore(db,{getExperiment,getHouseSession,maxPhotos=24,maxBytes=4*1024*1024,maxWritesPerMinute=30,idFactory=()=> 'photo_'+randomBytes(15).toString('base64url')}={}){
 if(!Number.isInteger(maxPhotos)||maxPhotos<1||maxPhotos>24||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>4*1024*1024||!Number.isInteger(maxWritesPerMinute)||maxWritesPerMinute<1||maxWritesPerMinute>120)throw Error('Use bounded date-photo quotas.');
 db.exec('CREATE TABLE IF NOT EXISTS world_date_media(id TEXT PRIMARY KEY,experiment_id TEXT NOT NULL,created_at INTEGER NOT NULL,bytes INTEGER NOT NULL,mime_type TEXT NOT NULL,metadata TEXT NOT NULL,image BLOB NOT NULL); CREATE INDEX IF NOT EXISTS world_date_media_experiment ON world_date_media(experiment_id); CREATE TABLE IF NOT EXISTS world_date_media_write_attempts(at INTEGER NOT NULL);');
 const reserve=db.transaction(time=>{
  db.query('DELETE FROM world_date_media_write_attempts WHERE at<=?').run(time-60000);
  if(db.query('SELECT COUNT(*) AS n FROM world_date_media_write_attempts').get().n>=maxWritesPerMinute)fail('Date photo write limit reached; retry in one minute.',429);
  db.query('INSERT INTO world_date_media_write_attempts(at) VALUES(?)').run(time);
 });
 const commit=db.transaction((experimentId,metadata,image,time)=>{
  const usage=db.query('SELECT COUNT(*) AS n,COALESCE(SUM(bytes),0) AS bytes FROM world_date_media WHERE experiment_id=?').get(experimentId);
  if(usage.n>=maxPhotos||usage.bytes+image.encodedBytes>maxBytes)fail('Date photo quota reached. Existing photos were preserved.',507);
  if(db.query('SELECT 1 FROM world_date_media WHERE id=?').get(metadata.id))fail('Date photo identity already exists; photos are immutable.',409);
  db.query('INSERT INTO world_date_media(id,experiment_id,created_at,bytes,mime_type,metadata,image) VALUES(?,?,?,?,?,?,?)').run(metadata.id,experimentId,time,image.encodedBytes,image.mimeType,JSON.stringify(metadata),image.data);
  return metadata;
 });
 function put(experimentId,input,createdAt){
  const time=Date.parse(createdAt);if(!Number.isFinite(time))fail('Use a valid photo creation timestamp.');reserve.immediate(time);
  const experiment=getExperiment(experimentId);if(!experiment)fail('Parent experiment not found.',404);
  if(experiment.save?.mode!=='living')fail('Date photos require an actual population experiment.');
  if(!plain(input)||Object.keys(input).some(key=>!['schemaVersion','householdId','personIds','dateId','minute','place','image'].includes(key))||(input.schemaVersion!==undefined&&input.schemaVersion!=='date-media-upload.v1'))fail('Use a bounded date-media upload.');
  if(typeof input.householdId!=='string'||input.householdId.length>160||typeof input.dateId!=='string'||!/^[A-Za-z0-9:_.-]{1,180}$/.test(input.dateId)||!Number.isFinite(input.minute)||input.minute<0||!Array.isArray(input.personIds)||input.personIds.length!==2||new Set(input.personIds).size!==2||input.personIds.some(id=>typeof id!=='string'||id.length>160))fail('Choose an actual household, date and two participants.');
  const session=getHouseSession(experimentId,input.householdId),model=readPopulationCheckpoint(session?.checkpoint??experiment.save.checkpoint).model,h=Number(input.householdId.slice((model.prefix+'-h').length));
  if(!Number.isInteger(h)||input.householdId!==model.prefix+'-h'+h||h<0||h>=model.households.size.length)fail('Photo household is not in this saved population.');
  const active=model.houses?.homes?.[h]?.systems?.dates?.active;
  if(!active||active.id!==input.dateId||active.personIds?.length!==2||!active.personIds.every(id=>input.personIds.includes(id)))fail('Save the current active date and its exact participants before attaching a photo.');
  for(const id of input.personIds){const index=Number(id.slice((model.prefix+'-p').length));if(!Number.isInteger(index)||index<0||index>=model.people.age.length||id!==model.prefix+'-p'+index)fail('Photo participants must be actual saved population IDs.');}
  if(input.minute>model.minute||input.minute<active.startedMinute||Number.isFinite(active.endedMinute)&&input.minute>active.endedMinute||active.openEnded!==true&&Number.isFinite(active.untilMinute)&&input.minute>active.untilMinute)fail('Photo minute must belong to the actual saved date.');
  if(!plain(input.place)||typeof input.place.id!=='string'||!input.place.id.trim()||input.place.id.length>180||typeof input.place.name!=='string'||!input.place.name.trim()||input.place.name.length>160||!validDateCoordinates(input.place))fail('Photo requires a bounded actual geographic place.');
  const activePlace=active.globalPlace??active.place??active.destination??active.venue?.place??active.venue;
  if(activePlace?.id?.startsWith('osm:')&&activePlace.id!==input.place.id)fail('Photo place must match the active date destination.');
  if(validDateCoordinates(activePlace)&&(Math.abs(activePlace.lat-input.place.lat)>1e-5||Math.abs(activePlace.lng-input.place.lng)>1e-5))fail('Photo coordinates must match the active date destination.');
  const image=decodeDatePhoto(input.image),id=idFactory();if(!/^photo_[A-Za-z0-9_-]{20}$/.test(id))fail('Unable to allocate a safe photo identity.',500);
  const imageUrl=`/api/world-experiments/${experimentId}/date-media/${id}/image`,metadata={schemaVersion:'date-media.v1',id,mediaId:id,experimentId,householdId:input.householdId,dateId:input.dateId,personIds:[...input.personIds],minute:input.minute,place:{id:input.place.id,name:input.place.name.trim(),lat:input.place.lat,lng:input.place.lng},createdAt,mimeType:image.mimeType,bytes:image.data.length,imageUrl,url:imageUrl,...(image.width?{width:image.width,height:image.height}:{})};
  return commit.immediate(experimentId,metadata,image,time);
 }
 return{put,get(experimentId,id,{image=false}={}){
  const row=db.query('SELECT metadata,mime_type'+(image?',image':'')+' FROM world_date_media WHERE experiment_id=? AND id=?').get(experimentId,id);
  if(!row)return null;return image?{metadata:JSON.parse(row.metadata),mimeType:row.mime_type,image:row.image}:JSON.parse(row.metadata);
 },usage(experimentId){return db.query('SELECT COUNT(*) AS photos,COALESCE(SUM(bytes),0) AS encodedBytes FROM world_date_media WHERE experiment_id=?').get(experimentId);}};
}
