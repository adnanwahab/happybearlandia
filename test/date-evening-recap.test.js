import {test,expect} from 'bun:test';
import {dateEveningRecap} from '../world/house/date-memory-ui.js';
test('evening recap includes actual shared moments and photos, not status logs or another outing',()=>{
 const record={id:'tonight',place:{name:'Cafe'},moments:[{id:'paused',type:'activity-interrupted',text:'Participant temporarily unavailable'},{id:'joke',type:'conversation',text:'They would rather take this moment seriously.'},{id:'song',type:'activity-completed',text:'Completed a shared duet.'}]};
 const recap=dateEveningRecap(record,{photos:[{id:'photo1',dateId:'tonight',place:{name:'Cafe'}},{id:'photo2',dateId:'yesterday'}],couple:{insideJokes:[{sourceMomentId:'song',label:'Our encore'},{sourceMomentId:'old-song',label:'Another evening'}],learnedPreferences:[{category:'golf',enjoyment:1}]},active:{id:'tonight',experience:{learned:[{category:'music',enjoyment:1}]},suggestedDestination:{name:'Quiet music cafe'}}});
 expect(recap.map(r=>r.text)).toContain('Our joke met a serious response.');expect(recap.map(r=>r.kind)).toContain('Kept a photo');expect(recap.map(r=>r.text)).toContain('Our encore');
 expect(JSON.stringify(recap)).not.toContain('temporarily unavailable');expect(JSON.stringify(recap)).not.toContain('Another evening');expect(JSON.stringify(recap)).not.toContain('golf');
 expect(recap.find(r=>r.kind==='Learned something').text).toBe('Your partner enjoys music.');
 expect(recap.find(r=>r.kind==='Found a next possibility').text).toBe('Quiet music cafe');
 expect(dateEveningRecap({id:'empty',moments:[]})).toEqual([]);
});
test('past evening does not borrow current preferences, suggestions or photos',()=>{
 expect(dateEveningRecap({id:'old',moments:[]},{active:{id:'new',experience:{learned:[{category:'music',enjoyment:1}]},suggestedDestination:{name:'Cafe'}},photos:[{dateId:'new'}]})).toEqual([]);
});
