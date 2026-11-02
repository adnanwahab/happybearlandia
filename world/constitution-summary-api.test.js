import {test,expect} from 'bun:test';
import {handleConstitutionSummary} from './constitution-summary-api.js';
import {compactConstitutionResult,localConstitutionSummary} from './constitution-summary.js';
const result={meta:{seeds:8},futures:{year:5},final:{displacedResidents:{baseline:{mean:14},plan:{mean:8},delta:{mean:-6,p10:-9,p90:-3}}}};
test('summary uses supplied values and qualifies spread and geometry',()=>{const summary=localConstitutionSummary(compactConstitutionResult(result));expect(summary).toContain('14');expect(summary).toContain('-9 to -3');expect(summary).toContain('not forecasts');expect(summary).toContain('not engineering');});
test('summary API validates input and method',async()=>{expect((await handleConstitutionSummary(new Request('http://x'))).status).toBe(405);expect((await handleConstitutionSummary(new Request('http://x',{method:'POST',body:'{}'}))).status).toBe(400);const response=await handleConstitutionSummary(new Request('http://x',{method:'POST',body:JSON.stringify(result)}));expect(response.status).toBe(200);expect((await response.json()).source).toBe('local');});

test('configured provider failures retain local summary',async()=>{const response=await handleConstitutionSummary(new Request('http://x',{method:'POST',body:JSON.stringify(result)}),{env:{OPENAI_API_KEY:'test',OPENAI_MODEL:'test'},providers:{openai:async()=>{throw new Error('offline')}}});expect((await response.json()).source).toBe('local');});
