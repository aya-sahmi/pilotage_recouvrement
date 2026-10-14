const { query } = require('../config/database');
const mockData = require('../data/mock-data');

function normalizeExtension(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\D/g, '');
}

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let pendingTokenRequest = null;
let cachedCalls = null;
let cachedCallsAt = 0;
let cachedDirectionalCalls = null;
let cachedDirectionalCallsAt = 0;
let cachedExtensionMissed = null;
let cachedExtensionMissedAt = 0;
let cachedExtensionMissedKey = '';
const dailyManagerStatsCache = new Map();
const CALLS_TIME_ZONE = 'Africa/Casablanca';
const DAILY_STATS_CACHE_TTL = 30000;

function getApiBaseUrl() {
  return (process.env.THREECX_API_URL || '').replace(/#.*$/, '').replace(/\/xapi\/v1\/?$/, '').replace(/\/$/, '');
}

async function getAccessToken() {
  if (!process.env.THREECX_CLIENT_ID || !process.env.THREECX_CLIENT_SECRET) {
    throw new Error('Configurez THREECX_CLIENT_ID et THREECX_CLIENT_SECRET pour accéder aux rapports 3CX.');
  }

  if (cachedToken && Date.now() < cachedTokenExpiresAt - 30000) {
    return cachedToken;
  }
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = (async () => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.THREECX_CLIENT_ID,
      client_secret: process.env.THREECX_CLIENT_SECRET,
    });
    const response = await fetch(`${getApiBaseUrl()}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });

    if (!response.ok) {
      throw new Error(`Authentification 3CX refusée (${response.status}).`);
    }

    const payload = await response.json();
    if (!payload.access_token) {
      throw new Error('La réponse d’authentification 3CX ne contient pas de jeton.');
    }

    cachedToken = payload.access_token;
    cachedTokenExpiresAt = Date.now() + Number(payload.expires_in || 300) * 1000;
    return cachedToken;
  })();

  try {
    return await pendingTokenRequest;
  } finally {
    pendingTokenRequest = null;
  }
}

async function getGestionnairesByExtension() {
  try {
    const { rows } = await query(`
      SELECT id, extension_3cx, nom, prenom
      FROM gestionnaires
      WHERE actif = TRUE
    `);

    const managers = new Map();
    for (const row of rows || []) {
      const ext = normalizeExtension(row.extension_3cx);
      if (!ext) {
        continue;
      }

      managers.set(ext, {
        id: Number(row.id),
        nom: row.nom || '',
        prenom: row.prenom || '',
      });
    }

    return managers;
  } catch (error) {
    const managers = new Map();
    for (const row of mockData.managerRows || []) {
      const ext = normalizeExtension(row.extension_3cx);
      if (ext) {
        managers.set(ext, {
          id: Number(row.id),
          nom: row.nom || '',
          prenom: row.prenom || '',
        });
      }
    }
    return managers;
  }
}

async function getGestionnaires() {
  try {
    const { rows } = await query(`
      SELECT id, extension_3cx, nom, prenom
      FROM gestionnaires
      WHERE actif = TRUE
    `);
    return rows || [];
  } catch (error) {
    return mockData.managerRows || [];
  }
}

function attachManagerToCall(call, managers) {
  const candidates = [
    normalizeExtension(call.extension),
    normalizeExtension(call.extension_3cx),
    normalizeExtension(call.numero_destinataire),
    normalizeExtension(call.numero_appelant),
  ].filter(Boolean);

  for (const extension of candidates) {
    const manager = managers.get(extension);
    if (manager) {
      return {
        ...call,
        gestionnaire_id: Number(manager.id),
        gestionnaire_nom: manager.nom,
        gestionnaire_prenom: manager.prenom,
        extension_3cx: extension,
      };
    }
  }

  return {
    ...call,
    gestionnaire_id: call.gestionnaire_id || null,
    gestionnaire_nom: null,
    gestionnaire_prenom: null,
    extension_3cx: normalizeExtension(call.extension_3cx || call.extension || call.numero_destinataire),
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidates = [
    payload.calls,
    payload.data,
    payload.results,
    payload.rows,
    payload.items,
    payload.value,
    payload.call_logs,
    payload.callLogs,
    payload.call_reports,
    payload.callReports,
    payload.inbound_calls,
    payload.inboundCalls,
    payload.outbound_calls,
    payload.outboundCalls,
    payload.extension_statistics,
    payload.extensionStatistics,
    payload.extension_statistic,
    payload.reports,
    payload.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.data)) {
      return candidate.data;
    }
  }

  return [];
}

function durationToSeconds(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value || '').trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);

  const iso = text.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    return Number(iso[1] || 0) * 86400 + Number(iso[2] || 0) * 3600 + Number(iso[3] || 0) * 60 + Number(iso[4] || 0);
  }

  const clock = text.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  return clock ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]) + Number(`0.${clock[4] || 0}`) : 0;
}

function normalizeCall(row, index, directionOverride) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const rawDirection = String(directionOverride || row.Direction || row.direction || row.type || row.call_direction || 'Inbound').toLowerCase();
  const rawStatus = String(row.Status || row.statut || row.status || row.state || '').toLowerCase();
  const callId = row.CallHistoryId || row.CdrId || row.CallId || row.call_id || row.id || row.callId || row.uuid || 'cx-' + (index + 1);
  const direction = rawDirection.includes('out') || rawDirection.includes('sort') ? 'outbound' : 'inbound';
  const notAnswered = rawStatus.includes('unanswered') || rawStatus.includes('not answered') || rawStatus.includes('no answer') || rawStatus.includes('miss') || rawStatus.includes('busy') || rawStatus.includes('failed');
  const answered = typeof row.Answered === 'boolean'
    ? row.Answered
    : !notAnswered && (rawStatus.includes('answer') || rawStatus.includes('repon') || rawStatus.includes('connect'));
  const status = answered ? 'answered' : 'missed';
  const startDate = row.StartTime || row.date_debut || row.start_time || row.started_at || row.date || row.begin || new Date().toISOString();
  const extension = direction === 'inbound'
    ? row.DestinationDn || row.extension || row.extension_number || row.assignee || row.agent
    : row.SourceDn || row.extension || row.extension_number || row.assignee || row.agent;
  const caller = row.SourceCallerId || row.numero_appelant || row.caller || row.number_from || row.from || row.SourceDn || '';
  const called = row.DestinationCallerId || row.DestinationCalleeId || row.numero_destinataire || row.called || row.number_to || row.to || row.DestinationDn || '';

  return {
    call_id: callId,
    extension: extension || 'n/a',
    direction,
    numero_appelant: caller,
    numero_destinataire: called,
    numero_client: direction === 'inbound' ? caller : called,
    date_debut: startDate,
    date_fin: row.date_fin || row.end_time || row.ended_at || startDate,
    duree: durationToSeconds(row.TalkingDuration || row.duree || row.duration || row.call_duration || row.length),
    duree_sonnerie: durationToSeconds(row.RingingDuration || row.duree_sonnerie),
    duree_totale: durationToSeconds(row.CallDuration || row.duree_totale),
    statut: status,
    gestionnaire_id: row.gestionnaire_id || row.agent_id || row.manager_id || null,
  };
}

async function fetchReportRows(reportName, functionName, parameters, token) {
  const pageSize = 1000;
  const allRows = [];

  for (let skip = 0; skip < 20000; skip += pageSize) {
    const queryParams = new URLSearchParams({ $top: String(pageSize), $skip: String(skip) });
    const response = await fetch(`${getApiBaseUrl()}/xapi/v1/${reportName}/${functionName}(${parameters})?${queryParams}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Le rapport 3CX ${reportName} a répondu ${response.status}.`);
      error.statusCode = response.status;
      error.reportName = reportName;
      throw error;
    }

    const rows = extractRows(await response.json());
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  return allRows;
}

async function fetchCallLogRows(token, period = getReportPeriod()) {
  const { from, to } = period;
  return fetchReportRows(
    'ReportCallLogData',
    'Pbx.GetCallLogData',
    `periodFrom=${from},periodTo=${to},sourceType=0,sourceFilter='',destinationType=0,destinationFilter='',callsType=0,callTimeFilterType=0,callTimeFilterFrom='0:00:0',callTimeFilterTo='0:00:0',hidePcalls=true`,
    token,
  );
}

async function fetchDirectionalRows(token, period = getReportPeriod()) {
  const { from, to } = period;
  return Promise.all([
    fetchReportRows('ReportInboundCalls', 'Pbx.GetInboundCalls', `periodFrom=${from},periodTo=${to},trunkDns='',callsType=0`, token),
    fetchReportRows('ReportOutboundCalls', 'Pbx.GetOutboundCalls', `periodFrom=${from},periodTo=${to},trunkDns='',callsType=0`, token),
  ]);
}

function normalizeDirectionalCalls(inbound, outbound, managers) {
  return [...inbound.map((row, index) => normalizeCall(row, index, 'Inbound')), ...outbound.map((row, index) => normalizeCall(row, inbound.length + index, 'Outbound'))]
    .filter(Boolean)
    .map((call) => attachManagerToCall(call, managers));
}

function getReportPeriod() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  return {
    from: encodeURIComponent(process.env.THREECX_PERIOD_FROM || monthStart),
    to: encodeURIComponent(process.env.THREECX_PERIOD_TO || now.toISOString()),
  };
}

function getDateInTimeZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALLS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getDateInTimeZoneAsUtc(date, hour) {
  const targetAsUtc = Date.parse(`${date}T${hour}:00:00.000Z`);
  let utcTimestamp = targetAsUtc;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CALLS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcTimestamp));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    utcTimestamp += targetAsUtc - representedAsUtc;
  }

  return new Date(utcTimestamp);
}

function getDailyReportPeriod(date) {
  const selectedDate = date || getDateInTimeZone();
  if (!isValidIsoDate(selectedDate)) {
    const error = new Error('La date doit être au format AAAA-MM-JJ et correspondre à une date valide.');
    error.statusCode = 400;
    error.error = 'INVALID_DATE';
    throw error;
  }

  const nextDate = new Date(`${selectedDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateString = nextDate.toISOString().slice(0, 10);
  return {
    date: selectedDate,
    from: encodeURIComponent(getDateInTimeZoneAsUtc(selectedDate, '00').toISOString()),
    to: encodeURIComponent(getDateInTimeZoneAsUtc(nextDateString, '00').toISOString()),
  };
}

function getCallDirection(row) {
  const direction = String(row.Direction || row.direction || '').trim().toLowerCase();
  if (direction === 'inbound' || direction === 'entrant') return 'inbound';
  if (direction === 'outbound' || direction === 'sortant') return 'outbound';
  return null;
}

function getAnsweredStatus(row) {
  if (typeof row.Answered === 'boolean') return row.Answered;
  if (typeof row.answered === 'boolean') return row.answered;

  const status = String(row.Status || row.statut || row.status || '').trim().toLowerCase();
  if (/\b(unanswered|not answered|no answer|missed|busy|failed|abandoned|rejected|declined|non repondu|non répondu|manque)\b/.test(status)) return false;
  if (/\b(answered|connected|repondu|répondu)\b/.test(status)) return true;
  return null;
}

function getCallStartTime(row) {
  const value = row.StartTime || row.date_debut || row.start_time || row.started_at || row.date;
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

function getCallFamilyId(row, index) {
  return String(row.MainCallHistoryId || row.main_call_history_id || row.CallHistoryId || row.call_history_id || row.CdrId || row.cdr_id || row.call_id || row.id || `daily-row-${index}`);
}

function getCallManager(row, direction, managersByExtension, managersById) {
  const extension = normalizeExtension(
    direction === 'inbound'
      ? row.DestinationDn || row.destination_dn || row.extension_3cx || row.extension
      : row.SourceDn || row.source_dn || row.extension_3cx || row.extension,
  );
  const manager = extension ? managersByExtension.get(extension) : null;
  if (manager) return manager;

  const managerId = row.gestionnaire_id || row.manager_id || row.agent_id;
  return managerId === null || managerId === undefined ? null : managersById.get(String(managerId)) || null;
}

function createDailyManagerStats(manager) {
  const name = `${manager.prenom || ''} ${manager.nom || ''}`.trim();
  return {
    id: Number(manager.id),
    nom: manager.nom || '',
    prenom: manager.prenom || '',
    name: name || 'Gestionnaire',
    extension_3cx: manager.extension_3cx || null,
    sortants: { total: 0, repondus: 0, nonRepondus: 0, tempsCommunicationSecondes: 0, dureeMoyenneSecondes: 0 },
    entrants: { total: 0, repondus: 0, nonRepondus: 0, tempsCommunicationSecondes: 0, dureeMoyenneSecondes: 0 },
  };
}

function aggregateDailyManagerStats(rows, managers, selectedDate) {
  const managerStats = new Map();
  const managersByExtension = new Map();
  const managersById = new Map();
  for (const manager of managers) {
    const stats = createDailyManagerStats(manager);
    managerStats.set(String(manager.id), stats);
    managersById.set(String(manager.id), stats);
    const extension = normalizeExtension(manager.extension_3cx);
    if (extension) managersByExtension.set(extension, stats);
  }

  const families = new Map();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object') continue;
    const direction = getCallDirection(row);
    const startTime = getCallStartTime(row);
    if (!direction || startTime === null || getDateInTimeZone(new Date(startTime)) !== selectedDate) continue;

    const familyId = getCallFamilyId(row, index);
    if (!families.has(familyId)) families.set(familyId, []);
    families.get(familyId).push({ row, direction, startTime, index });
  }

  for (const familyRows of families.values()) {
    const orderedRows = [...familyRows].sort((left, right) => left.startTime - right.startTime || left.index - right.index);
    const direction = orderedRows[0].direction;
    const candidatesByManager = new Map();
    const seenLegs = new Set();

    for (const entry of orderedRows) {
      if (entry.direction !== direction) continue;
      const manager = getCallManager(entry.row, direction, managersByExtension, managersById);
      const answered = getAnsweredStatus(entry.row);
      if (!manager || answered === null) continue;

      const legId = String(entry.row.CdrId || entry.row.cdr_id || `${manager.id}|${entry.startTime}|${answered}`);
      if (seenLegs.has(legId)) continue;
      seenLegs.add(legId);
      if (!candidatesByManager.has(String(manager.id))) candidatesByManager.set(String(manager.id), []);
      candidatesByManager.get(String(manager.id)).push({ ...entry, manager, answered });
    }

    const candidates = [...candidatesByManager.values()].flat();
    if (!candidates.length) continue;
    const answeredCandidates = candidates.filter((candidate) => candidate.answered);
    const eligibleCandidates = answeredCandidates.length ? answeredCandidates : candidates;
    eligibleCandidates.sort((left, right) => left.startTime - right.startTime || left.index - right.index);
    const selected = eligibleCandidates[eligibleCandidates.length - 1];
    const stats = managerStats.get(String(selected.manager.id));
    const section = direction === 'inbound' ? stats.entrants : stats.sortants;
    section.total += 1;
    if (answeredCandidates.length) section.repondus += 1;
    else section.nonRepondus += 1;

    const selectedManagerAnsweredLegs = candidates
      .filter((candidate) => candidate.manager.id === selected.manager.id && candidate.answered);
    section.tempsCommunicationSecondes += selectedManagerAnsweredLegs.reduce((total, candidate) => {
      const duration = candidate.row.TalkingDuration ?? candidate.row.duree ?? candidate.row.duration ?? candidate.row.call_duration ?? 0;
      return total + durationToSeconds(duration);
    }, 0);
  }

  for (const manager of managerStats.values()) {
    manager.sortants.dureeMoyenneSecondes = manager.sortants.repondus
      ? manager.sortants.tempsCommunicationSecondes / manager.sortants.repondus
      : 0;
    manager.entrants.dureeMoyenneSecondes = manager.entrants.repondus
      ? manager.entrants.tempsCommunicationSecondes / manager.entrants.repondus
      : 0;
  }

  const totals = [...managerStats.values()].reduce((total, manager) => {
    for (const direction of ['sortants', 'entrants']) {
      total[direction].total += manager[direction].total;
      total[direction].repondus += manager[direction].repondus;
      total[direction].nonRepondus += manager[direction].nonRepondus;
      total[direction].tempsCommunicationSecondes += manager[direction].tempsCommunicationSecondes;
    }
    return total;
  }, {
    sortants: { total: 0, repondus: 0, nonRepondus: 0, tempsCommunicationSecondes: 0, dureeMoyenneSecondes: 0 },
    entrants: { total: 0, repondus: 0, nonRepondus: 0, tempsCommunicationSecondes: 0, dureeMoyenneSecondes: 0 },
  });
  totals.sortants.dureeMoyenneSecondes = totals.sortants.repondus ? totals.sortants.tempsCommunicationSecondes / totals.sortants.repondus : 0;
  totals.entrants.dureeMoyenneSecondes = totals.entrants.repondus ? totals.entrants.tempsCommunicationSecondes / totals.entrants.repondus : 0;

  return {
    date: selectedDate,
    timeZone: CALLS_TIME_ZONE,
    totalAppels: totals.sortants.total + totals.entrants.total,
    totals,
    managers: [...managerStats.values()].sort((left, right) => left.name.localeCompare(right.name, 'fr')),
  };
}

async function get3CxDailyManagerStats(date) {
  const period = getDailyReportPeriod(date);
  const cached = dailyManagerStatsCache.get(period.date);
  if (cached && Date.now() - cached.cachedAt < DAILY_STATS_CACHE_TTL) return cached.data;

  let rows;
  if (process.env.THREECX_API_URL) {
    const token = await getAccessToken();
    try {
      rows = await fetchCallLogRows(token, period);
    } catch (error) {
      if (error.statusCode !== 401 && error.statusCode !== 403) throw error;

      console.warn(`3CX ${error.reportName || 'call log report'} returned ${error.statusCode}; trying inbound and outbound reports for the selected day.`);
      const [inbound, outbound] = await fetchDirectionalRows(token, period);
      rows = [
        ...inbound.map((row) => ({ ...row, Direction: 'Inbound' })),
        ...outbound.map((row) => ({ ...row, Direction: 'Outbound' })),
      ];
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('THREECX_API_URL n’est pas configurée sur le serveur.');
    }
    rows = Array.isArray(mockData?.threeCx?.calls) ? mockData.threeCx.calls : [];
  }

  const data = aggregateDailyManagerStats(rows, await getGestionnaires(), period.date);
  dailyManagerStatsCache.set(period.date, { data, cachedAt: Date.now() });
  if (dailyManagerStatsCache.size > 7) {
    const oldestDate = dailyManagerStatsCache.keys().next().value;
    dailyManagerStatsCache.delete(oldestDate);
  }
  return data;
}

async function fetchCallsFrom3CX() {
  const fallbackCalls = Array.isArray(mockData?.threeCx?.calls) ? mockData.threeCx.calls : [];
  if (!process.env.THREECX_API_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('THREECX_API_URL n’est pas configurée sur le serveur.');
    }
    const managers = await getGestionnairesByExtension();
    return fallbackCalls.map((call) => attachManagerToCall(call, managers));
  }

  if (cachedCalls && Date.now() - cachedCallsAt < 15000) {
    return cachedCalls;
  }

  const token = await getAccessToken();
  let calls;
  try {
    const journalRows = await fetchCallLogRows(token);
    const managers = await getGestionnairesByExtension();
    calls = journalRows.map((row, index) => normalizeCall(row, index)).filter(Boolean)
      .map((call) => attachManagerToCall(call, managers));
  } catch (error) {
    if (error.statusCode !== 401 && error.statusCode !== 403) throw error;

    console.warn(`3CX ${error.reportName || 'call log report'} returned ${error.statusCode}; trying inbound and outbound call reports.`);
    const [inbound, outbound] = await fetchDirectionalRows(token);
    const managers = await getGestionnairesByExtension();
    calls = normalizeDirectionalCalls(inbound, outbound, managers);
  }
  cachedCalls = calls;
  cachedCallsAt = Date.now();
  return cachedCalls;
}

async function fetchDirectionalCallsFrom3CX() {
  if (!process.env.THREECX_API_URL) return fetchCallsFrom3CX();
  if (cachedDirectionalCalls && Date.now() - cachedDirectionalCallsAt < 15000) return cachedDirectionalCalls;

  const token = await getAccessToken();
  let inbound;
  let outbound;
  try {
    [inbound, outbound] = await fetchDirectionalRows(token);
  } catch (error) {
    if (error.statusCode !== 401 && error.statusCode !== 403) throw error;

    console.warn(`3CX ${error.reportName || 'directional call report'} returned ${error.statusCode}; falling back to ReportCallLogData.`);
    const journalRows = await fetchCallLogRows(token);
    const managers = await getGestionnairesByExtension();
    cachedDirectionalCalls = journalRows.map((row, index) => normalizeCall(row, index)).filter(Boolean)
      .map((call) => attachManagerToCall(call, managers));
    cachedDirectionalCallsAt = Date.now();
    return cachedDirectionalCalls;
  }

  const managers = await getGestionnairesByExtension();
  cachedDirectionalCalls = normalizeDirectionalCalls(inbound, outbound, managers);
  cachedDirectionalCallsAt = Date.now();
  return cachedDirectionalCalls;
}

async function fetchExtensionMissedFrom3CX() {
  if (!process.env.THREECX_API_URL) return new Map();
  const groupNumber = String(process.env.THREECX_GROUP_NUMBER || 'GRP2').replace(/'/g, '');
  const cacheKey = `${getApiBaseUrl()}|${groupNumber}|${process.env.THREECX_PERIOD_FROM || ''}|${process.env.THREECX_PERIOD_TO || ''}`;
  if (cachedExtensionMissed && cachedExtensionMissedKey === cacheKey && Date.now() - cachedExtensionMissedAt < 15000) return cachedExtensionMissed;

  let rows;
  try {
    const token = await getAccessToken();
    const { from, to } = getReportPeriod();
    rows = await fetchReportRows(
      'ReportExtensionStatisticsByGroup',
      'Pbx.GetExtensionStatisticsByGroupData',
      `groupNumber='${groupNumber}',periodFrom=${from},periodTo=${to},callArea=0`,
      token,
    );
  } catch (error) {
    if (error.statusCode !== 401 && error.statusCode !== 403) throw error;
    console.warn(`3CX extension statistics returned ${error.statusCode}; using unanswered counts from the inbound report.`);
    cachedExtensionMissed = new Map();
    cachedExtensionMissedAt = Date.now();
    cachedExtensionMissedKey = cacheKey;
    return cachedExtensionMissed;
  }

  cachedExtensionMissed = new Map(rows
    .filter((row) => row.Dn !== null && row.Dn !== undefined)
    .map((row) => [normalizeExtension(row.Dn), Number(row.InboundUnansweredCount || 0)]));
  cachedExtensionMissedAt = Date.now();
  cachedExtensionMissedKey = cacheKey;
  return cachedExtensionMissed;
}

async function get3CxOverview() {
  const [calls, extensionMissed] = await Promise.all([fetchDirectionalCallsFrom3CX(), fetchExtensionMissedFrom3CX()]);
  const incoming = calls.filter((call) => call.direction === 'inbound');
  const attached = calls.filter((call) => call.gestionnaire_id !== null && call.gestionnaire_id !== undefined).length;
  const unansweredInbound = extensionMissed.size
    ? [...extensionMissed.values()].reduce((total, count) => total + count, 0)
    : incoming.filter((call) => call.statut === 'missed').length;
  return {
    totalAppels: calls.length,
    dureeTotale: calls.reduce((total, call) => total + Number(call.duree || 0), 0),
    tauxRattachement: calls.length ? (attached / calls.length) * 100 : 0,
    appelsNonRattaches: calls.length - attached,
    appelsSortants: calls.filter((call) => call.direction === 'outbound').length,
    appelsEntrantsRepondues: incoming.filter((call) => call.statut === 'answered').length,
    appelsEntrantsNonRepondues: unansweredInbound,
  };
}

async function get3CxManagerStats() {
  const [managers, calls, extensionMissed] = await Promise.all([getGestionnaires(), fetchDirectionalCallsFrom3CX(), fetchExtensionMissedFrom3CX()]);
  const stats = new Map();

  for (const manager of managers) {
    const id = Number(manager.id);
    stats.set(String(id), {
      id,
      nom: manager.nom || '',
      prenom: manager.prenom || '',
      extension_3cx: manager.extension_3cx || null,
      total_appels: 0,
      total_sortants: 0,
      entrants_repondues: 0,
      entrants_non_repondues: 0,
      duree_total_secondes: 0,
      duree_moyenne_secondes: 0,
    });
  }

  for (const call of calls) {
    const manager = stats.get(String(call.gestionnaire_id));
    if (!manager) continue;
    manager.total_appels += 1;
    manager.duree_total_secondes += Number(call.duree || 0);
    if (call.direction === 'outbound') manager.total_sortants += 1;
    if (call.direction === 'inbound' && call.statut === 'answered') manager.entrants_repondues += 1;
    if (call.direction === 'inbound' && call.statut === 'missed') manager.entrants_non_repondues += 1;
  }

  return [...stats.values()].map((manager) => ({
    ...manager,
    entrants_non_repondues: extensionMissed.get(normalizeExtension(manager.extension_3cx)) ?? manager.entrants_non_repondues,
    duree_moyenne_secondes: manager.total_appels ? manager.duree_total_secondes / manager.total_appels : 0,
  }));
}

module.exports = {
  fetchCallsFrom3CX,
  get3CxDailyManagerStats,
  get3CxOverview,
  get3CxManagerStats,
  aggregateDailyManagerStats,
  getDateInTimeZone,
  getDailyReportPeriod,
};
