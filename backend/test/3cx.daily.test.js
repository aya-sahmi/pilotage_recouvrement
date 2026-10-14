const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateDailyManagerStats,
  getDailyReportPeriod,
} = require('../services/3cx.service');

const managers = [
  { id: 1, nom: 'Martin', prenom: 'Sofia', extension_3cx: '101' },
  { id: 2, nom: 'Lemoine', prenom: 'Hugo', extension_3cx: '102' },
  { id: 3, nom: 'Dupont', prenom: 'Claire', extension_3cx: '103' },
];

test('daily report period follows the 3CX business timezone and rejects invalid dates', () => {
  const period = getDailyReportPeriod('2026-10-14');

  assert.equal(period.date, '2026-10-14');
  assert.equal(decodeURIComponent(period.from), '2026-10-13T23:00:00.000Z');
  assert.equal(decodeURIComponent(period.to), '2026-10-14T23:00:00.000Z');
  assert.throws(() => getDailyReportPeriod('2026-02-30'), { statusCode: 400, error: 'INVALID_DATE' });
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
