import { expect, test } from 'bun:test';
import {
  AGENT_COUNT, COMMUNITY_COUNT, COMMUNITY_SIZE, ROUND_COUNT, mindURL, readMindURL, runCollectiveMind,
} from '../world/collective-mind/model.js';
import { networkLayout } from '../world/collective-mind/render.js';

function components(edges) {
  const graph = Array.from({ length: AGENT_COUNT }, () => []);
  for (const [a, b] of edges) {
    graph[a].push(b);
    graph[b].push(a);
  }
  let groups = 0;
  const visited = new Set();
  for (let i = 0; i < graph.length; i++) {
    if (visited.has(i)) continue;
    groups++;
    const pending = [i];
    while (pending.length) {
      const node = pending.pop();
      if (visited.has(node)) continue;
      visited.add(node);
      pending.push(...graph[node]);
    }
  }
  return groups;
}

test('all topologies reuse the same starting agents and have their declared connectivity', () => {
  const separate = runCollectiveMind({ network: 'districts' });
  const bridged = runCollectiveMind({ network: 'bridges' });
  const citywide = runCollectiveMind({ network: 'citywide' });
  expect(separate.frames[0]).toEqual(bridged.frames[0]);
  expect(citywide.frames[0]).toEqual(bridged.frames[0]);
  expect(components(separate.edges)).toBe(COMMUNITY_COUNT);
  expect(components(bridged.edges)).toBe(1);
  expect(components(citywide.edges)).toBe(1);
  expect(separate.edges.every(([a, b]) => Math.floor(a / COMMUNITY_SIZE) === Math.floor(b / COMMUNITY_SIZE))).toBe(true);
  expect(new Set(citywide.edges.map(edge => edge.join('/'))).size).toBe(citywide.edges.length);
  expect(separate.frames.at(-1)).not.toEqual(citywide.frames.at(-1));
  expect(separate.stats.at(-1).agreement).toBeGreaterThan(separate.stats.at(-1).leadingShare);
});

test('round totals, agreement, and changes reconcile to exact frames', () => {
  const run = runCollectiveMind({ seed: 456, network: 'citywide' });
  expect(run.frames).toHaveLength(ROUND_COUNT + 1);
  expect(run.stats).toHaveLength(ROUND_COUNT + 1);
  for (let i = 0; i < run.frames.length; i++) {
    const frame = run.frames[i];
    const { counts, leadingShare, agreement, changed } = run.stats[i];
    expect(frame.length).toBe(AGENT_COUNT);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(AGENT_COUNT);
    expect(leadingShare).toBe(Math.max(...counts) / AGENT_COUNT);
    expect(agreement).toBe(run.edges.filter(([a, b]) => frame[a] === frame[b]).length / run.edges.length);
    const previous = run.frames[Math.max(i - 1, 0)];
    expect(changed).toBe(frame.filter((option, id) => option !== previous[id]).length);
  }
  const unchanged = runCollectiveMind({ seed: 456, openness: 0 });
  expect(unchanged.frames.every(frame => frame.every((option, i) => option === unchanged.frames[0][i]))).toBe(true);
});

test('versioned URLs reproduce a round and the drawing uses only matching links', () => {
  const input = { seed: 812, network: 'bridges', question: 'Which option?', options: ['A', 'B', 'C'] };
  const url = new URL(mindURL(input, 23), 'http://localhost');
  const { recipe, round } = readMindURL(url.search);
  expect(round).toBe(23);
  const run = runCollectiveMind(recipe);
  expect(run).toEqual(runCollectiveMind(input));
  const draw = networkLayout(run);
  const scene = draw(run.frames[round], true);
  expect(scene.points).toHaveLength(AGENT_COUNT * 6);
  expect(scene.lines.length).toBeGreaterThan(0);
  for (let i = 0; i < scene.lines.length; i += 12) {
    expect(scene.lines.slice(i + 2, i + 5)).toEqual(scene.lines.slice(i + 8, i + 11));
  }
  expect(draw(run.frames[round], false).lines).toHaveLength(0);
  expect(() => readMindURL('?recipe=%7B%7D')).toThrow('supported recipe');
  expect(() => runCollectiveMind({ options: ['same', ' SAME ', 'different'] })).toThrow('different label');
  expect(() => runCollectiveMind({ openness: 1.2 })).toThrow('openness');
});
