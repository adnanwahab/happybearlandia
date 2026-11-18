import {test,expect} from 'bun:test';
import {matchingTideBatch,tideSummary} from '../world/uncertainty-tides.js';
import {tideFixture} from './fixtures/uncertainty-tides/batch.js';
test('deterministic paired quantiles, recorded years and sample slots',()=>{
 const batch=tideFixture(), options={baseSeed:'fixture',sampleSize:10};
 const r=tideSummary(batch,options);
 expect(r.rows[0]).toEqual({year:1,count:10,baseline:[1.9,5.5,9.1],plan:[11.9,15.5,19.1]});
 expect(tideSummary(batch,options)).toEqual(r);
 expect(tideSummary(batch,{baseSeed:'fixture'}).rows[0].count).toBe(100);
 batch.cfg.step=2;
 expect(tideSummary(batch,options).rows.map(r=>r.year)).toEqual([1,3]);
});
test('exclude failed, nonfinite, missing, duplicate and mismatched pairs without replacement',()=>{
 const b=tideFixture(); b.futures[0].status='failed'; b.futures[1].seed='wrong';
 b.futures[2].years[1].baseline.avgMood=null; b.futures[3].years[1].plans[0].avgMood=Infinity;
 b.futures[4].simYears=[2,3]; b.futures.push({...b.futures[5]});
 b.futures=b.futures.filter(f=>f.index!==6);
 const r=tideSummary(b,{baseSeed:'fixture',sampleSize:10});
 expect(r.rows[0].count).toBe(3); expect(r.rows[1].count).toBe(6);
 b.futures=[]; expect(tideSummary(b,{baseSeed:'fixture'}).rows[0].baseline).toBeNull();
});
test('cache identity and schema fail closed',()=>{
 const b=tideFixture(), key='hbl:lab:snapshot:fixture:3:60:1:a:';
 const storage={getItem:k=> k.startsWith('hbl:lab-latest:')?key:JSON.stringify(b)};
 const ctx={snapshotId:'snapshot',baseSeed:'fixture',years:3,people:60};
 expect(matchingTideBatch(storage,ctx)).toEqual(b);
 expect(matchingTideBatch(storage,{...ctx,people:61})).toBeNull();
 b.version='unknown'; expect(matchingTideBatch(storage,ctx)).toBeNull();
 expect(tideSummary(b,{baseSeed:'fixture'})).toBeNull();
 expect(tideSummary(tideFixture(),{sampleSize:NaN})).toBeNull();
});
