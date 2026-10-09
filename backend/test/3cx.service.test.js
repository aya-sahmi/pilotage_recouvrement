const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchCallsFrom3CX, get3CxOverview } = require('../services/3cx.service');

test('fetchCallsFrom3CX falls back to mock data when no 3CX API is configured', async () => {
  delete process.env.THREECX_API_URL;
  delete process.env.THREECX_API_KEY;

  const calls = await fetchCallsFrom3CX();

  assert.ok(Array.isArray(calls), 'calls should be an array');
  assert.ok(calls.length > 0, 'mock calls should be returned');
  assert.equal(calls[0].call_id, 'CX-101');
});

test('get3CxOverview falls back to mock KPI when database is not configured', async () => {
  delete process.env.DATABASE_URL;

  const overview = await get3CxOverview();

  assert.ok(overview.totalAppels > 0, 'mock totalAppels should be returned');
  assert.ok(overview.dureeTotale >= 0, 'duration should be numeric');
  assert.ok(overview.appelsNonRattaches >= 0, 'unattached calls should be numeric');
});
