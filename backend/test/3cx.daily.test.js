const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateDailyManagerStats,
  get3CxDailyManagerStats,
  getDailyReportPeriod,
  normalizeStoredCallsForDailyStats,
} = require('../services/3cx.service');

const managers = [
  { id: 1, nom: 'Martin', prenom: 'Sofia', extension_3cx: '101' },
  { id: 2, nom: 'Lemoine', prenom: 'Hugo', extension_3cx: '102' },
  { id: 3, nom: 'Dupont', prenom: 'Claire', extension_3cx: '103' },
];

test('stored 3CX calls are normalized for daily aggregation', () => {
  const calls = normalizeStoredCallsForDailyStats([
    {
      call_id: 'stored-answered',
      gestionnaire_id: 1,
      extension_3cx: '101',
      direction: 'entrant',
      date_debut: '2026-10-14T10:00:00+01:00',
      duree_secondes: 90,
      statut: 'answered',
    },
    {
      call_id: 'stored-missed',
      gestionnaire_id: 2,
      direction: 'sortant',
      date_debut: '2026-10-14T11:00:00+01:00',
      duree_secondes: 0,
      statut: 'non répondu',
    },
    {
      call_id: 'stored-unknown',
      direction: 'entrant',
      date_debut: '2026-10-14T12:00:00+01:00',
      statut: 'inconnu',
    },
  ]);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].Direction, 'entrant');
  assert.equal(calls[0].Answered, true);
  assert.equal(calls[0].TalkingDuration, 90);
  assert.equal(calls[1].Direction, 'sortant');
  assert.equal(calls[1].Answered, false);
});

test('daily report period follows the 3CX business timezone and rejects invalid dates', () => {
  const period = getDailyReportPeriod('2026-10-14');

  assert.equal(period.date, '2026-10-14');
  assert.equal(decodeURIComponent(period.from), '2026-10-13T23:00:00.000Z');
  assert.equal(decodeURIComponent(period.to), '2026-10-14T23:00:00.000Z');
  assert.throws(() => getDailyReportPeriod('2026-02-30'), { statusCode: 400, error: 'INVALID_DATE' });
});

test('daily stats fall back to directional reports with the selected date when call-log access is denied', async () => {
  const originalFetch = global.fetch;
  const envKeys = ['DATABASE_URL', 'THREECX_API_URL', 'THREECX_CLIENT_ID', 'THREECX_CLIENT_SECRET', 'NODE_ENV'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const requestedUrls = [];
  process.env.THREECX_API_URL = 'https://pbx.example:5001';
  process.env.THREECX_CLIENT_ID = 'test-client';
  process.env.THREECX_CLIENT_SECRET = 'test-secret';
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;

  global.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);
    if (requestUrl.endsWith('/connect/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 300 }) };
    }
    if (requestUrl.includes('ReportCallLogData')) {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    const inbound = requestUrl.includes('ReportInboundCalls');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: inbound
          ? [{
            MainCallHistoryId: 'daily-inbound',
            CallHistoryId: 'daily-inbound-leg',
            Direction: 'Inbound',
            DestinationDn: '101',
            StartTime: '2026-10-14T10:00:00+01:00',
            Answered: true,
            Status: 'Answered',
            TalkingDuration: 'PT2M',
          }]
          : [{
            MainCallHistoryId: 'daily-outbound',
            CallHistoryId: 'daily-outbound-leg',
            Direction: 'Outbound',
            SourceDn: '103',
            StartTime: '2026-10-14T11:00:00+01:00',
            Answered: false,
            Status: 'Unanswered',
          }],
      }),
    };
  };

  try {
    const result = await get3CxDailyManagerStats('2026-10-14');
    const inbound = requestedUrls.find((url) => url.includes('ReportInboundCalls'));
    const outbound = requestedUrls.find((url) => url.includes('ReportOutboundCalls'));

    assert.equal(result.totals.entrants.repondus, 1);
    assert.equal(result.totals.entrants.tempsCommunicationSecondes, 120);
    assert.equal(result.totals.sortants.nonRepondus, 1);
    assert.ok(inbound.includes(encodeURIComponent('2026-10-13T23:00:00.000Z')));
    assert.ok(inbound.includes(encodeURIComponent('2026-10-14T23:00:00.000Z')));
    assert.ok(outbound.includes(encodeURIComponent('2026-10-13T23:00:00.000Z')));
    assert.ok(outbound.includes(encodeURIComponent('2026-10-14T23:00:00.000Z')));
  } finally {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

test('daily stats fall back to appels_3cx when all 3CX daily reports are unauthorized', async () => {
  const originalFetch = global.fetch;
  const envKeys = ['DATABASE_URL', 'THREECX_API_URL', 'THREECX_CLIENT_ID', 'THREECX_CLIENT_SECRET', 'NODE_ENV'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const requestedUrls = [];
  process.env.THREECX_API_URL = 'https://pbx.example:5001';
  process.env.THREECX_CLIENT_ID = 'test-client';
  process.env.THREECX_CLIENT_SECRET = 'test-secret';
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;

  global.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);
    if (requestUrl.endsWith('/connect/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 300 }) };
    }
    return { ok: false, status: 401, json: async () => ({}) };
  };

  try {
    await assert.rejects(
      get3CxDailyManagerStats('2026-10-02'),
      /rapports 3CX sont refusés et le repli sur la base appels_3cx a échoué.*DATABASE_URL/
    );
    assert.ok(requestedUrls.some((url) => url.includes('ReportExtensionStatisticsByGroup')));
  } finally {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

test('daily stats use per-extension totals when all call-detail reports are denied', async () => {
  const originalFetch = global.fetch;
  const envKeys = ['DATABASE_URL', 'THREECX_API_URL', 'THREECX_CLIENT_ID', 'THREECX_CLIENT_SECRET', 'THREECX_GROUP_NUMBER', 'NODE_ENV'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const requestedUrls = [];
  process.env.THREECX_API_URL = 'https://pbx.example:5001';
  process.env.THREECX_CLIENT_ID = 'test-client';
  process.env.THREECX_CLIENT_SECRET = 'test-secret';
  process.env.THREECX_GROUP_NUMBER = 'GRP2';
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;

  global.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);
    if (requestUrl.endsWith('/connect/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 300 }) };
    }
    if (requestUrl.includes('ReportExtensionStatisticsByGroup')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              Dn: '101',
              InboundAnsweredCount: 4,
              InboundAnsweredTalkingDur: 'PT8M',
              InboundUnansweredCount: 2,
              OutboundAnsweredCount: 3,
              OutboundAnsweredTalkingDur: 'PT6M',
              OutboundUnansweredCount: 1,
            },
            {
              Dn: '103',
              InboundAnsweredCount: 1,
              InboundAnsweredTalkingDur: 'PT2M',
              InboundUnansweredCount: 0,
              OutboundAnsweredCount: 5,
              OutboundAnsweredTalkingDur: 'PT15M',
              OutboundUnansweredCount: 2,
            },
          ],
        }),
      };
    }
    return { ok: false, status: 401, json: async () => ({}) };
  };

  try {
    const result = await get3CxDailyManagerStats('2026-10-13');
    const reportUrl = requestedUrls.find((url) => url.includes('ReportExtensionStatisticsByGroup'));
    const byExtension = new Map(result.managers.map((manager) => [manager.extension_3cx, manager]));

    assert.equal(result.totals.entrants.total, 7);
    assert.equal(result.aggregationMode, 'extension-summary');
    assert.equal(result.totals.entrants.repondus, 5);
    assert.equal(result.totals.entrants.nonRepondus, 2);
    assert.equal(result.totals.sortants.total, 11);
    assert.equal(result.totals.sortants.repondus, 8);
    assert.equal(result.totals.sortants.nonRepondus, 3);
    assert.equal(result.totals.entrants.tempsCommunicationSecondes, 600);
    assert.equal(result.totals.sortants.tempsCommunicationSecondes, 1260);
    assert.equal(byExtension.get('101').entrants.dureeMoyenneSecondes, 120);
    assert.equal(byExtension.get('103').sortants.dureeMoyenneSecondes, 180);
    assert.ok(reportUrl.includes("groupNumber='GRP2'"));
    assert.ok(reportUrl.includes(encodeURIComponent('2026-10-12T23:00:00.000Z')));
    assert.ok(reportUrl.includes(encodeURIComponent('2026-10-13T23:00:00.000Z')));
  } finally {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

test('daily manager metrics deduplicate transferred legs and use explicit 3CX answer status', () => {
  const calls = [
    {
      MainCallHistoryId: 'in-transfer',
      CallHistoryId: 'in-transfer-a',
      CdrId: 'in-transfer-cdr-a',
      Direction: 'Inbound',
      DestinationDn: '101',
      StartTime: '2026-10-14T09:00:00+01:00',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT1M',
    },
    {
      MainCallHistoryId: 'in-transfer',
      CallHistoryId: 'in-transfer-b',
      CdrId: 'in-transfer-cdr-b',
      Direction: 'Inbound',
      DestinationDn: '102',
      StartTime: '2026-10-14T09:02:00+01:00',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT30S',
    },
    {
      MainCallHistoryId: 'in-missed-transfer',
      CdrId: 'in-missed-cdr-a',
      Direction: 'Inbound',
      DestinationDn: '101',
      StartTime: '2026-10-14T10:00:00+01:00',
      Answered: false,
      Status: 'Unanswered',
      RingingDuration: 'PT45S',
    },
    {
      MainCallHistoryId: 'in-missed-transfer',
      CdrId: 'in-missed-cdr-b',
      Direction: 'Inbound',
      DestinationDn: '102',
      StartTime: '2026-10-14T10:01:00+01:00',
      Answered: false,
      Status: 'Unanswered',
      RingingDuration: 'PT60S',
    },
    {
      MainCallHistoryId: 'out-answered',
      CdrId: 'out-answered-cdr',
      Direction: 'Outbound',
      SourceDn: '103',
      StartTime: '2026-10-14T11:00:00+01:00',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT0S',
    },
    {
      MainCallHistoryId: 'out-answered',
      CdrId: 'out-answered-cdr',
      Direction: 'Outbound',
      SourceDn: '103',
      StartTime: '2026-10-14T11:00:00+01:00',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT5M',
    },
    {
      MainCallHistoryId: 'out-missed',
      CdrId: 'out-missed-cdr',
      Direction: 'Outbound',
      SourceDn: '101',
      StartTime: '2026-10-14T12:00:00+01:00',
      Answered: false,
      Status: 'Unanswered',
      TalkingDuration: 'PT5M',
    },
    {
      MainCallHistoryId: 'in-boundary',
      CdrId: 'in-boundary-cdr',
      Direction: 'Inbound',
      DestinationDn: '101',
      StartTime: '2026-10-13T23:30:00.000Z',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT90S',
    },
    {
      MainCallHistoryId: 'in-previous-day',
      CdrId: 'in-previous-day-cdr',
      Direction: 'Inbound',
      DestinationDn: '101',
      StartTime: '2026-10-13T21:59:00.000Z',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT10M',
    },
    {
      MainCallHistoryId: 'in-unknown-status',
      CdrId: 'in-unknown-status-cdr',
      Direction: 'Inbound',
      DestinationDn: '103',
      StartTime: '2026-10-14T13:00:00+01:00',
      TalkingDuration: 'PT10M',
    },
    {
      MainCallHistoryId: 'in-not-answered',
      CdrId: 'in-not-answered-cdr',
      Direction: 'Inbound',
      DestinationDn: '101',
      StartTime: '2026-10-14T13:30:00+01:00',
      Status: 'Not Answered',
    },
    {
      MainCallHistoryId: 'in-non-repondu',
      CdrId: 'in-non-repondu-cdr',
      Direction: 'Inbound',
      DestinationDn: '102',
      StartTime: '2026-10-14T13:40:00+01:00',
      Status: 'Non répondu',
    },
    {
      MainCallHistoryId: 'internal-call',
      CdrId: 'internal-cdr',
      Direction: 'Internal',
      DestinationDn: '103',
      StartTime: '2026-10-14T14:00:00+01:00',
      Answered: true,
      Status: 'Answered',
      TalkingDuration: 'PT10M',
    },
  ];

  const result = aggregateDailyManagerStats(calls, managers, '2026-10-14');
  const byId = new Map(result.managers.map((manager) => [manager.id, manager]));

  assert.equal(result.totalAppels, 7);
  assert.equal(result.totals.entrants.total, 5);
  assert.equal(result.totals.entrants.repondus, 2);
  assert.equal(result.totals.entrants.nonRepondus, 3);
  assert.equal(result.totals.sortants.total, 2);
  assert.equal(result.totals.sortants.repondus, 1);
  assert.equal(result.totals.sortants.nonRepondus, 1);
  assert.equal(byId.get(1).entrants.total, 2);
  assert.equal(byId.get(1).entrants.nonRepondus, 1);
  assert.equal(byId.get(1).entrants.tempsCommunicationSecondes, 90);
  assert.equal(byId.get(1).sortants.nonRepondus, 1);
  assert.equal(byId.get(1).sortants.tempsCommunicationSecondes, 0);
  assert.equal(byId.get(2).entrants.total, 3);
  assert.equal(byId.get(2).entrants.repondus, 1);
  assert.equal(byId.get(2).entrants.nonRepondus, 2);
  assert.equal(byId.get(2).entrants.tempsCommunicationSecondes, 30);
  assert.equal(byId.get(3).sortants.repondus, 1);
  assert.equal(byId.get(3).sortants.tempsCommunicationSecondes, 0);
});
