export const DATE_BUCKET_WISHES=Object.freeze([
 {id:'karaoke',label:'Sing karaoke together',activity:'karaoke',known:true},
 {id:'museum',label:'Discover an art museum',activity:'museum',known:true},
 {id:'picnic',label:'Share a picnic',activity:'picnic',known:true},
 {id:'beach',label:'Spend a day at the beach',activity:'beach',known:true},
 {id:'tokyo-karaoke',label:'Sing karaoke in Tokyo',activity:'karaoke',region:'tokyo',known:false},
 {id:'photography',label:'Take a picture somewhere new',activity:'photography',known:false},
 {id:'festival',label:'Find a local festival',activity:'festival',known:false},
 {id:'hiking',label:'Go hiking together',activity:'hiking',known:false},
 {id:'louvre',label:'Visit the Louvre',activity:'museum',placePattern:'louvre',known:false},
 {id:'arcade',label:'Challenge each other at an arcade',activity:'arcade',known:false}
]);
export function bucketWishMatches(wish,moment,place={}){if(moment.activity!==wish.activity)return false;if(wish.placePattern&&!String(place.name??'').toLowerCase().includes(wish.placePattern))return false;if(wish.region==='tokyo'&&!(Math.abs((place.lat??-90)-35.68)<.8&&Math.abs((place.lng??-180)-139.76)<.8))return false;return true;}
export function updateDateBucketList(couple,moment,place){for(const wish of DATE_BUCKET_WISHES){const row=couple.bucketList.find(r=>r.id===wish.id);if(row&&bucketWishMatches(wish,moment,place)&&row.completedMinute==null){row.known=true;row.completedMinute=moment.minute;row.dateId=moment.dateId;}}if(moment.activity==='talk'){const undiscovered=couple.bucketList.find(r=>!r.known);if(undiscovered){undiscovered.known=true;undiscovered.discoveredMinute=moment.minute;}}}
