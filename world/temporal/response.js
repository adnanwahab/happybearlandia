/** A missing/stale dev route can return text or HTML. Never pass that through
 * response.json() and expose a SyntaxError as the feature's error message. */
export async function readTemporalResponse(response){
 const type=response.headers.get('content-type')??'';
 if(!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(type)){
  if(response.status===404)throw new Error('City Time Machine API is unavailable on this server (HTTP 404). Refresh the page after restarting the updated HappyBearLandia server.');
  throw new Error(`Historical map service returned a non-JSON response (HTTP ${response.status}). Please try again.`);
 }
 let data;try{data=await response.json();}catch{throw new Error(`Historical map service returned invalid JSON (HTTP ${response.status}). Please try again.`);}
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:`Historical request failed (HTTP ${response.status}).`);
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Historical map service returned an invalid response.');
 return data;
}
