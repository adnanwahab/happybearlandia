import {test, expect} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CityStore} from '../world/city/storage.js';
import {createCityApi} from '../world/city/api.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createExperiment} from '../world/future-machine/data/index.js';
import {createRunReceipt, canonicalReceiptJSON} from '../world/future-machine/share/run-receipt.js';
import {MAX_RECEIPT_BYTES, parseReceiptText, readReceiptFile, importReceiptText} from '../world/future-machine/share/import-receipt.js';

test('paste JSON and upload bounds reject before parsing, reading or replay/network', async () => {
  for (const value of ['', '   ', null, '<script>bad()</script>', '{']) expect(()=>parseReceiptText(value)).toThrow();
  expect(()=>parseReceiptText(' '.repeat(MAX_RECEIPT_BYTES+1))).toThrow('4.5 MB');
  expect(()=>parseReceiptText('"'+'é'.repeat(MAX_RECEIPT_BYTES/2)+'"')).toThrow('4.5 MB');
  let reads=0;
  await expect(readReceiptFile({size:MAX_RECEIPT_BYTES+1,text(){reads++;}})).rejects.toThrow('4.5 MB');
  expect(reads).toBe(0);
  expect(parseReceiptText(await readReceiptFile(new File(['{"ok":true}'],'receipt.json')))).toEqual({ok:true});
  const old=globalThis.fetch; let calls=0; globalThis.fetch=()=>{calls++;throw Error('unexpected network');};
  try {
    await expect(importReceiptText('{')).rejects.toThrow('valid JSON');
    await expect(importReceiptText('{"schemaVersion":"future"}')).rejects.toThrow('could not be verified');
    await expect(importReceiptText('"'+'x'.repeat(MAX_RECEIPT_BYTES)+'"')).rejects.toThrow('4.5 MB');
    expect(calls).toBe(0);
  } finally {globalThis.fetch=old;}
});

test('paste/file import verifies a real persisted replay and rejects tampering, missing records and cancellation', async () => {
  const root=mkdtempSync(join(tmpdir(),'receipt-import-')), store=new CityStore(root), handle=createCityApi({store});
  const old=globalThis.fetch; let requests=0;
  globalThis.fetch=(path,options)=>{requests++;return handle(new Request('http://localhost'+path,options));};
  try {
    const history=await createExperiment({...DEFAULT_RECIPE,households:2,seed:0});
    const receipt=await createRunReceipt(history,{month:16}), text=canonicalReceiptJSON(receipt);
    const pasted=await importReceiptText(text);
    expect(pasted.history).toEqual(history); expect(pasted.month).toBe(16); expect(pasted.receipt).toEqual(receipt);
    const uploaded=await importReceiptText(await readReceiptFile(new File([text],'run.json')));
    expect(uploaded.history).toEqual(pasted.history);
    const bad=structuredClone(receipt);bad.checksum='0'.repeat(64);const before=requests;
    await expect(importReceiptText(JSON.stringify(bad))).rejects.toThrow('checksum mismatch');
    expect(requests).toBe(before);
    const future=structuredClone(receipt);future.schemaVersion='unsupported.v99';
    await expect(importReceiptText(JSON.stringify(future))).rejects.toThrow('unsupported schema');
    const abort=new AbortController();abort.abort();
    await expect(importReceiptText(text,{signal:abort.signal})).rejects.toThrow();
    expect(requests).toBe(before);
    globalThis.fetch=()=>new Response(JSON.stringify({error:'Saved experiment is unavailable'}),{status:404});
    await expect(importReceiptText(text)).rejects.toThrow('Saved experiment is unavailable');
  } finally {globalThis.fetch=old;store.close();rmSync(root,{recursive:true,force:true});}
},15000);
