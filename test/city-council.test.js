import {test,expect} from 'bun:test';
import {councilFeedback,trustChange} from '../world/city-council.js';
import {households,projectHousehold} from '../world/follow-family.js';
test('residents object to displacement and an unsuitable studio',()=>{
 expect(councilFeedback({id:'affordability'},[2])[0].text).toContain('take-home pay would fall');
 expect(councilFeedback({id:'family'},[2])[0].text).toContain('too small');
});
test('transit earns support while school access remains an explicit concern',()=>{
 const comments=councilFeedback({id:'commute'},[0,1]);
 expect(comments[0].stance).toBe('Supportive');
 expect(comments[2].text).toContain('school access');
});
test('trust responds to household outcomes and missed objectives',()=>{
 const before=projectHousehold(households[0]);
 const improved=projectHousehold(households[0],{commute:[0,1]});
 const damaged=projectHousehold(households[0],{affordability:[2]});
 expect(trustChange(before,improved,true)).toBeGreaterThan(0);
 expect(trustChange(before,damaged,false)).toBeLessThan(0);
 expect(trustChange(before,before,false)).toBe(-3);
});
