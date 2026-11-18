/** Order-independent JSON comparison. Reports paths only to avoid leaking values. */
export function structuralDiff(a,b,path='$') {
 if(Object.is(a,b))return [];
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return [path];
 if(Array.isArray(a)!==Array.isArray(b))return [path];
 const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 return [...keys].flatMap(key=>!Object.hasOwn(a,key)||!Object.hasOwn(b,key)?[`${path}.${key}`]:structuralDiff(a[key],b[key],`${path}.${key}`));
}
export function compareManifestExports(a,b) {
 const paths=structuralDiff(a,b);
 const validTimestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
 const timestampOnly=paths.includes('$.exportedAt')&&validTimestamp(a.exportedAt)&&validTimestamp(b.exportedAt);
 return {differences:paths,material:paths.filter(p=>!(timestampOnly&&p==='$.exportedAt'))};
}
