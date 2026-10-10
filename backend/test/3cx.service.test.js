const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchCallsFrom3CX, get3CxOverview, get3CxManagerStats } = require('../services/3cx.service');

test('fetchCallsFrom3CX falls back to mock data when no 3CX API is configured', async () => {
  delete process.env.THREECX_API_URL;
  delete process.env.THREECX_API_KEY;
  delete process.env.NODE_ENV;

  const calls = await fetchCallsFrom3CX();

  assert.ok(Array.isArray(calls), 'calls should be an array');
  assert.ok(calls.length > 0, 'mock calls should be returned');
  assert.equal(calls[0].call_id, 'CX-101');
});

test('fetchCallsFrom3CX does not return mock calls in production without 3CX configuration', async () => {
  delete process.env.THREECX_API_URL;
  process.env.NODE_ENV = 'production';

  await assert.rejects(fetchCallsFrom3CX(), /THREECX_API_URL n’est pas configurée/);

  delete process.env.NODE_ENV;
});

test('get3CxOverview falls back to mock KPI when database is not configured', async () => {
  delete process.env.DATABASE_URL;

  const overview = await get3CxOverview();

  assert.ok(overview.totalAppels > 0, 'mock totalAppels should be returned');
  assert.ok(overview.dureeTotale >= 0, 'duration should be numeric');
  assert.ok(overview.appelsNonRattaches >= 0, 'unattached calls should be numeric');
});

test('3CX XAPI report rows are normalized and used for KPIs and manager rankings', async () => {
  const originalFetch = global.fetch;
  const envKeys = ['THREECX_API_URL', 'THREECX_CLIENT_ID', 'THREECX_CLIENT_SECRET', 'THREECX_API_KEY', 'THREECX_GROUP_NUMBER'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const requestedUrls = [];

  process.env.THREECX_API_URL = 'https://pbx.example:5001';
  process.env.THREECX_CLIENT_ID = 'test-client';
  process.env.THREECX_CLIENT_SECRET = 'test-secret';
  delete process.env.THREECX_API_KEY;
  let denyInboundReport = false;
  global.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);
    if (requestUrl.endsWith('/connect/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 300 }) };
    }

    if (requestUrl.includes('ReportCallLogData')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            { CallHistoryId: 'in-1', Direction: 'Inbound', DestinationDn: '101', SourceCallerId: 'caller', StartTime: '2026-10-09T10:00:00Z', Status: 'Unanswered', RingingDuration: 'PT8.25S', TalkingDuration: 'PT0S' },
            { CallHistoryId: 'out-1', Direction: 'Outbound', SourceDn: '103', DestinationCallerId: 'callee', StartTime: '2026-10-09T11:00:00Z', Status: 'Answered', Answered: true, RingingDuration: 'PT2S', TalkingDuration: 'PT2M5.5S' },
          ],
        }),
      };
    }

    if (requestUrl.includes('ReportExtensionStatisticsByGroup')) {
      if (requestUrl.includes("groupNumber='DENIED'")) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ value: [{ Dn: '101', InboundUnansweredCount: 1 }, { Dn: '103', InboundUnansweredCount: 0 }] }),
      };
    }

    const inbound = requestUrl.includes('ReportInboundCalls');
    if (inbound && denyInboundReport) {
      return { ok: false, status: 401, json: async () => ({}) };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: inbound
          ? [{ CallHistoryId: 'in-1', DestinationDn: '101', SourceCallerId: 'caller', StartTime: '2026-10-09T10:00:00Z', Status: 'Unanswered', RingingDuration: 'PT8.25S', TalkingDuration: 'PT0S' }]
          : [{ CallHistoryId: 'out-1', SourceDn: '103', DestinationCallerId: 'callee', StartTime: '2026-10-09T11:00:00Z', Status: 'Answered', Answered: true, RingingDuration: 'PT2S', TalkingDuration: 'PT2M5.5S' }],
      }),
    };
  };

  try {
    const calls = await fetchCallsFrom3CX();
    assert.equal(calls.length, 2);
    assert.equal(calls.find((call) => call.call_id === 'in-1').direction, 'inbound');
    assert.equal(calls.find((call) => call.call_id === 'in-1').statut, 'missed');
    assert.equal(calls.find((call) => call.call_id === 'out-1').duree, 125.5);
    assert.ok(requestedUrls.some((url) => url.includes('ReportCallLogData/Pbx.GetCallLogData')));

    denyInboundReport = true;
    const overview = await get3CxOverview();
    assert.equal(overview.totalAppels, 2);
    assert.equal(overview.appelsSortants, 1);
    assert.equal(overview.appelsEntrantsNonRepondues, 1);
    assert.ok(requestedUrls.some((url) => url.includes('ReportInboundCalls/Pbx.GetInboundCalls')));
    assert.ok(requestedUrls.some((url) => url.includes('ReportOutboundCalls/Pbx.GetOutboundCalls')));
    assert.ok(requestedUrls.some((url) => url.includes('ReportCallLogData/Pbx.GetCallLogData')));
    assert.ok(requestedUrls.some((url) => url.includes('ReportExtensionStatisticsByGroup/Pbx.GetExtensionStatisticsByGroupData')));

    const managerStats = await get3CxManagerStats();
    assert.equal(managerStats.reduce((sum, manager) => sum + manager.total_sortants, 0), 1);
    assert.equal(managerStats.reduce((sum, manager) => sum + manager.entrants_non_repondues, 0), 1);

    process.env.THREECX_GROUP_NUMBER = 'DENIED';
    const overviewWithoutExtensionReport = await get3CxOverview();
    assert.equal(overviewWithoutExtensionReport.appelsEntrantsNonRepondues, 1);
  } finally {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
