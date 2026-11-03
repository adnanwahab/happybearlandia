import {test,expect} from 'bun:test';
import {COMPLETE_SAVE_MAX_BYTES} from '../world/save-limits.js';
import {MAX_CHECKPOINT_BYTES,encodeCheckpointGraph,decodeCheckpointGraph} from '../world/population/checkpoint.js';
import {EXPERIMENT_MAX_BYTES} from '../world/experiments/persistence-api.js';
import {HOUSE_SESSION_MAX_BYTES} from '../world/experiments/house-session-store.js';
test('capture, HTTP and autosession limits agree and preserve data beyond the old32MiB boundary',()=>{expect(COMPLETE_SAVE_MAX_BYTES).toBe(64*1024*1024);expect([MAX_CHECKPOINT_BYTES,EXPERIMENT_MAX_BYTES,HOUSE_SESSION_MAX_BYTES]).toEqual([COMPLETE_SAVE_MAX_BYTES,COMPLETE_SAVE_MAX_BYTES,COMPLETE_SAVE_MAX_BYTES]);const text='x'.repeat(33*1024*1024),graph=encodeCheckpointGraph({text});expect(decodeCheckpointGraph(graph).text).toBe(text);});
