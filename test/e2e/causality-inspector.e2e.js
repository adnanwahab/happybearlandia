import { test, expect } from '@playwright/test';

const runId = 'run:test:1';
const source = {
  id: 'event:test:1',
  type: 'Construction inputs',
  context: { runId, tick: 4 },
  entityIds: ['project:test:1'],
  provenance: { kind: 'assumed', source: 'fixture' },
};
const target = {
  id: 'event:test:2',
  type: 'Project completed',
  context: { runId, tick: 5 },
  entityIds: ['project:test:2'],
  provenance: { kind: 'simulated', source: 'fixture' },
};
const edge = {
  id: 'edge:test:1',
  fromId: source.id,
  toId: target.id,
  relation: 'contributes',
  evidenceIds: [source.id],
};
const inspect = record => '/world/causality/inspect.html?' + new URLSearchParams({
  runId, targetId: record.id,
});
const explanation = '**/api/causality/explain?**';

test('shows a recorded connection, provenance and evidence, and reselects a node with the keyboard', async ({ page }) => {
  await page.route(explanation, route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: params.get('targetId') === source.id
      ? { targetId: source.id, nodes: [source], edges: [], evidence: [] }
      : { targetId: target.id, nodes: [target, source], edges: [edge], evidence: [source] } });
  });
  await page.goto(inspect(target));
  const graph = page.getByRole('region', { name: 'Recorded evidence graph' });
  const connection = graph.locator('[data-relation="contributes"]');
  await expect(connection.getByText('Contributes to', { exact: true })).toBeVisible();
  await expect(connection.getByText('→')).toBeVisible();
  await expect(connection.getByText('Provenance · assumed')).toBeVisible();
  await expect(connection.getByText('Provenance · simulated')).toBeVisible();
  await expect(connection.getByText('1 evidence record returned')).toBeVisible();
  await expect(graph.getByRole('heading', { name: target.type, exact: true })).toHaveCount(1);

  await graph.getByText('Raw recorded response').click();
  await expect(graph.locator('pre')).toContainText('"relation": "contributes"');
  const next = page.waitForRequest(request => new URL(request.url()).searchParams.get('targetId') === source.id);
  await connection.getByRole('button', { name: 'Inspect Construction inputs' }).press('Enter');
  const params = new URL((await next).url()).searchParams;
  expect(params.get('tick')).toBe('4');
  expect(params.get('entityId')).toBe('project:test:1');
  await expect(page.getByRole('textbox', { name: 'Record', exact: true })).toHaveValue(source.id);
  await expect(graph.getByRole('button', { name: 'Inspect Construction inputs' })).toBeFocused();
  await expect.poll(() => new URL(page.url()).searchParams.get('targetId')).toBe(source.id);
  await expect(graph.getByText('No recorded connections')).toBeVisible();
  await expect(graph.locator('.is-directed')).toHaveCount(0);
});

test('keeps correlations separate, reports missing endpoints, and treats record labels as text', async ({ page }) => {
  const text = '<img src=x onerror=alert(1)>';
  const association = { ...edge, relation: 'correlates', evidenceIds: [source.id, 'event:test:missing'] };
  const missing = { ...edge, id: 'edge:test:2', fromId: 'event:test:missing' };
  await page.route(explanation, route => {
    const params = new URL(route.request().url()).searchParams;
    const includeAssociations = params.get('includeAssociations') === 'true';
    return route.fulfill({ json: {
      targetId: target.id, nodes: [target, { ...source, type: text }],
      edges: includeAssociations ? [association, missing] : [],
      evidence: includeAssociations ? [source] : [],
      incomplete: includeAssociations, reasons: includeAssociations ? ['missing-dependency'] : [],
      missingIds: includeAssociations ? ['event:test:missing'] : [],
    } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(inspect(target));
  const graph = page.getByRole('region', { name: 'Recorded evidence graph' });
  await expect(graph.getByText('No recorded connections')).toBeVisible();
  await expect(graph.locator('.evidence-graph__edge')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show recorded correlations' }).check();
  await expect(page.getByRole('status')).toContainText('Incomplete graph');
  const connection = graph.locator('[data-relation="correlates"]');
  await expect(connection.getByText('Association only')).toBeVisible();
  await expect(connection.getByText('1 evidence record returned of 2 cited')).toBeVisible();
  await expect(graph.locator('.is-directed')).toHaveCount(0);
  await expect(graph.getByText('1 returned connection omitted because an endpoint record is unavailable.')).toBeVisible();
  await expect(graph.getByText('1 referenced record is unavailable.')).toBeVisible();
  await expect(graph.getByRole('heading', { name: text, exact: true })).toBeVisible();
  await expect(graph.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('bounds large responses and keeps empty, tab navigation, and retry states available', async ({ page }) => {
  await page.goto('/world/causality/inspect.html');
  await expect(page.getByRole('status')).toContainText('Choose a stored run');
  const nodes = [target, ...Array.from({ length: 29 }, (_, index) => ({
    ...source, id: 'event:test:extra-' + index, type: 'Dependency ' + index,
  }))];
  const edges = Array.from({ length: 40 }, (_, index) => ({
    ...edge, id: 'edge:test:extra-' + index, fromId: nodes[1 + index % 29].id,
  }));
  await page.route(explanation, route => route.fulfill({ json: { nodes, edges, evidence: [], incomplete: false } }));
  await page.getByRole('textbox', { name: 'Run', exact: true }).fill(runId);
  await page.getByRole('textbox', { name: 'Record', exact: true }).fill(target.id);
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  const graph = page.getByRole('region', { name: 'Recorded evidence graph' });
  await expect(graph.getByText('Preview shows 24 of 30 records')).toBeVisible();
  expect(await graph.locator('.evidence-graph__edge').count()).toBeLessThanOrEqual(32);
  await expect(graph.getByRole('heading', { name: 'Dependency 28', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Why', exact: true }).press('End');
  await expect(page.getByRole('tab', { name: 'Evidence', exact: true })).toHaveAttribute('aria-selected', 'true');
  let attempts = 0;
  await page.route('**/api/causality/timeline?**', route => ++attempts === 1
    ? route.fulfill({ status: 500, json: { error: 'Fixture temporarily unavailable' } })
    : route.fulfill({ json: { items: [source], nextCursor: null } }));
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not load records: Fixture temporarily unavailable');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: source.type, exact: true })).toBeVisible();
});

test('pulses resolve events and entities, and reduced motion disables animation', async ({ page }) => {
  await page.route(explanation, route => route.fulfill({json:{targetId:target.id,nodes:[source,target],edges:[edge],evidence:[source]}}));
  await page.goto(inspect(target));
  const pulse = page.locator('.evidence-graph__pulse');
  await expect(pulse).toHaveAttribute('data-from-event', source.id);
  await expect(pulse).toHaveAttribute('data-to-event', target.id);
  await expect(page.getByText('Entity · project:test:2').first()).toBeVisible();
  expect(await pulse.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('causal-pulse');
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await pulse.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
});
