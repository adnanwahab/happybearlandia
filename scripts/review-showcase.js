/** Read-only editorial evidence generator. Does not consent, publish or edit files. */
import {Database} from 'bun:sqlite';
import {reviewShowcaseSource} from '../world/reality/showcase-review.js';
const [dbPath,id]=process.argv.slice(2);
if(!dbPath||!id||!/^[A-Za-z0-9_-]{8,16}$/.test(id))throw new Error('Usage: bun scripts/review-showcase.js <existing-local-share-db> <share-id>');
// Refuse typos rather than creating an empty database as an incidental write.
if(!await Bun.file(dbPath).exists())throw new Error('Share database does not exist.');
const db=new Database(dbPath,{readonly:true});
try{
 const consent=db.query('SELECT consent,revision FROM reality_showcase_owners WHERE id=?').get(id),row=db.query('SELECT data,expires_at FROM reality_shares WHERE id=?').get(id);
 const record=row&&row.expires_at>Date.now()?JSON.parse(row.data):null;
 if(!record||!consent?.consent)throw new Error('A current source and explicit owner consent are required.');
 const proof=await reviewShowcaseSource(record);
 console.log(JSON.stringify({...proof,consentRevision:consent.revision,title:'REPLACE with reviewed editorial title',summary:'REPLACE with reviewed non-identifying summary'},null,2));
}finally{db.close();}
