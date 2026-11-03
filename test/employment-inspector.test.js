import {test,expect} from 'bun:test';
import {employmentInspectorRows} from '../world/population/employment-inspector.js';
test('worker inspector joins only the retained employer ID and preserves zero/false fields',()=>{
 const person={id:'p',employment:{employerId:'b',jobId:'j',remoteToday:false,workedMinutes:0,healthProxy:70}},snapshot={minute:600,employment:{employers:[{id:'b',headcount:2,lastPayroll:0},{id:'other',headcount:900}]},config:{workPaidSickDays:0}},copy=structuredClone({person,snapshot}),rows=employmentInspectorRows(person,snapshot);
 expect(rows).toContainEqual(['Remote today',false]);expect(rows).toContainEqual(['Worked minutes',0]);expect(rows).toContainEqual(['Employer · headcount',2]);expect(rows).toContainEqual(['Declared policy input · workPaidSickDays',0]);expect(rows.some(([,v])=>v===900)).toBe(false);expect({person,snapshot}).toEqual(copy);expect(employmentInspectorRows({id:'unknown'},snapshot)).toEqual([]);
});
