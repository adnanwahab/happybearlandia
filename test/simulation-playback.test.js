import { describe, test, expect } from 'bun:test';
import { createSimulationPlayback } from '../world/simulation-playback.js';

describe('simulation playback clock', () => {
  test('scales simulation milliseconds while leaving the supplied real clock untouched', () => {
    const clock = createSimulationPlayback({ initialSpeed: 10 });
    expect(clock.update(100).deltaMs).toBe(0);
    expect(clock.update(116)).toEqual({ simulationNow: 160, deltaMs: 160, paused: false, speed: 10 });
    expect(clock.update(132).simulationNow).toBe(320);
  });
  test('pause freezes visible simulation time and resume never catches up wall elapsed', () => {
    const clock = createSimulationPlayback({ initialSpeed: 5 });
    clock.update(0); clock.update(20);
    clock.pause();
    expect(clock.update(5000)).toEqual({ simulationNow: 100, deltaMs: 0, paused: true, speed: 5 });
    expect(clock.update(10000).simulationNow).toBe(100);
    clock.resume();
    expect(clock.update(20000).deltaMs).toBe(0);
    expect(clock.update(20020).simulationNow).toBe(200);
  });
  test('resume without paused frames reanchors and preserves a changed speed', () => {
    const clock = createSimulationPlayback({ initialSpeed: 2 });
    clock.update(0); clock.update(10); clock.pause(); clock.setSpeed(4); clock.resume();
    expect(clock.update(60000)).toEqual({ simulationNow: 20, deltaMs: 0, paused: false, speed: 4 });
    expect(clock.update(60010).simulationNow).toBe(60);
  });
  test('long frame gaps are bounded and never accumulated for later frames', () => {
    const clock = createSimulationPlayback({ initialSpeed: 1, maxFrameMs: 50 });
    clock.update(0);
    expect(clock.update(60000).deltaMs).toBe(50);
    expect(clock.update(60010).deltaMs).toBe(10);
    expect(clock.getState().simulationNow).toBe(60);
    expect(clock.update(100).deltaMs).toBe(0);
    expect(clock.update(110).simulationNow).toBe(70);
  });
  test('actual changes notify once so runtime/panel pause synchronization does not loop', () => {
    const changes = [], clock = createSimulationPlayback({ onChange: state => changes.push(state) });
    let calls = 0; const stop = clock.subscribe(() => calls++);
    clock.pause(); clock.pause(); clock.setSpeed(10); clock.update(10); clock.resume(); clock.resume();
    expect(changes.map(state => state.paused)).toEqual([true, false]);
    expect(calls).toBe(3);
    stop(); clock.pause(); expect(calls).toBe(3);
    clock.destroy(); expect(clock.update(99999).deltaMs).toBe(0);
  });
  test('invalid controls cannot create a negative or nonfinite simulation clock', () => {
    expect(() => createSimulationPlayback({ initialSpeed: 0 })).toThrow();
    const clock = createSimulationPlayback();
    for (const speed of [0, -1, Infinity, NaN, 101]) expect(() => clock.setSpeed(speed)).toThrow();
    expect(() => clock.update(NaN)).toThrow();
  });
});
