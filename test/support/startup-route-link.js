/** Compare route identity while retaining navigation context in the returned URL. */
export function sameOriginRouteURL(href,baseURL,pathname){
 if(typeof href!=='string'||!href.trim())return null;
 try{const url=new URL(href,baseURL),base=new URL(baseURL);return url.origin===base.origin&&url.pathname===pathname?url.href:null;}catch{return null;}
}
