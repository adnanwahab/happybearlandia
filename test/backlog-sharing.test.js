import {test,expect} from 'bun:test';
import {reproductionAppendix,savedReadonlyLink} from '../world/decision/backlog-sharing/appendix.js';
test('exact manifest and escaped printable records',()=>{const m={seed:0,unit:'USD',missing:null,modelVersion:'1',time:'month',note:'<script>'};const r=reproductionAppendix(m);expect(JSON.parse(r.json)).toEqual(m);expect(r.html).not.toContain('<script>');});
test('bounds and unavailable records',()=>{expect(reproductionAppendix(null).json).toBeNull();expect(reproductionAppendix({data:'x'.repeat(140000)}).html).toContain('print bound');expect(()=>reproductionAppendix({data:'x'.repeat(8388608)})).toThrow();});
test('saved URL roundtrip strips credentials and state',()=>{const u=new URL(savedReadonlyLink('https://u:p@example.com/decision?secret=x#f','experiment_1'));expect(u.searchParams.get('experiment')).toBe('experiment_1');expect(u.searchParams.get('readonly')).toBe('1');expect(u.username).toBe('');expect(u.searchParams.has('secret')).toBe(false);});
import {shareQR} from '../world/decision/backlog-sharing/qr.js';
import QRCode from '../world/decision/backlog-sharing/vendor/index.js';
import levels from '../world/decision/backlog-sharing/vendor/QRErrorCorrectLevel.js';
test('QR known byte-mode codewords and bounded URL matrix',()=>{
 const qr=new QRCode(1,levels.L);qr.addData('HELLO WORLD');qr.make();
 expect(qr.dataCache.slice(0,13)).toEqual([64,180,132,84,196,196,242,5,116,245,36,196,64]);
 const result=shareQR('https://example.com/decision?secret=x','experiment_1');
 expect(result.matrix.length).toBe(37);expect(result.url).toBe('https://example.com/decision?experiment=experiment_1&readonly=1');
 expect(result.matrix.slice(0,7).map(row=>row.slice(0,7).map(Number).join(''))).toEqual(['1111111','1000001','1011101','1011101','1011101','1000001','1111111']);
 expect(()=>shareQR('https://example.com/'+ 'x'.repeat(520),'e')).toThrow(RangeError);
});
import {compareManifestExports} from './backlog-sharing-structural.js';
test('manifest comparison ignores key order and only permits valid export timestamps',()=>{
 expect(compareManifestExports({seed:42,exportedAt:'2026-11-11T00:00:00Z'},{exportedAt:'2026-11-11T01:00:00Z',seed:42}).material).toEqual([]);
 expect(compareManifestExports({experiment:{seed:42}},{experiment:{seed:43}}).material).toEqual(['$.experiment.seed']);
 expect(compareManifestExports({exportedAt:'invalid'},{exportedAt:'2026-11-11T00:00:00Z'}).material).toEqual(['$.exportedAt']);
});
