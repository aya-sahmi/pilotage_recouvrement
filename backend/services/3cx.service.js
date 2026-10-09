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
let cachedCalls = null;
let cachedCallsAt = 0;
let cachedDirectionalCalls = null;
let cachedDirectionalCallsAt = 0;
let cachedExtensionMissed = null;
let cachedExtensionMissedAt = 0;
let cachedExtensionMissedKey = '';

function getApiBaseUrl() {
  return (process.env.THREECX_API_URL || '').replace(/#.*$/, '').replace(/\/xapi\/v1\/?$/, '').replace(/\/$/, '');
}

async function getAccessToken() {
  if (process.env.THREECX_CLIENT_ID && process.env.THREECX_CLIENT_SECRET) {
    if (cachedToken && Date.now() < cachedTokenExpiresAt - 30000) {
      return cachedToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.THREECX_CLIENT_ID,
      client_secret: process.env.THREECX_CLIENT_SECRET,
      scope: 'pbxConfigApi',
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
  }

  if (process.env.THREECX_API_KEY) {
    return process.env.THREECX_API_KEY;
  }

  throw new Error('Configurez THREECX_CLIENT_ID et THREECX_CLIENT_SECRET pour accéder aux rapports 3CX.');
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
  const pageSize = 100;
  const allRows = [];

  for (let skip = 0; skip < 20000; skip += pageSize) {
    const queryParams = new URLSearchParams({ $top: String(pageSize), $skip: String(skip) });
    const response = await fetch(`${getApiBaseUrl()}/xapi/v1/${reportName}/${functionName}(${parameters})?${queryParams}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = new Error(`Le rapport 3CX ${reportName} a répondu ${response.status}.`);
      error.statusCode = response.status;
      throw error;
    }

    const rows = extractRows(await response.json());
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  return allRows;
}

function getReportPeriod() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  return {
    from: encodeURIComponent(process.env.THREECX_PERIOD_FROM || monthStart),
    to: encodeURIComponent(process.env.THREECX_PERIOD_TO || now.toISOString()),
  };
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
  const { from, to } = getReportPeriod();
  const journalRows = await fetchReportRows(
    'ReportCallLogData',
    'Pbx.GetCallLogData',
    `periodFrom=${from},periodTo=${to},sourceType=0,sourceFilter='',destinationType=0,destinationFilter='',callsType=0,callTimeFilterType=0,callTimeFilterFrom='0:00:0',callTimeFilterTo='0:00:0',hidePcalls=true`,
    token,
  );
  const managers = await getGestionnairesByExtension();
  cachedCalls = journalRows.map((row, index) => normalizeCall(row, index)).filter(Boolean)
    .map((call) => attachManagerToCall(call, managers));
  cachedCallsAt = Date.now();
  return cachedCalls;
}

async function fetchDirectionalCallsFrom3CX() {
  if (!process.env.THREECX_API_URL) return fetchCallsFrom3CX();
  if (cachedDirectionalCalls && Date.now() - cachedDirectionalCallsAt < 15000) return cachedDirectionalCalls;

  const token = await getAccessToken();
  const { from, to } = getReportPeriod();
  const [inbound, outbound] = await Promise.all([
    fetchReportRows('ReportInboundCalls', 'Pbx.GetInboundCalls', `periodFrom=${from},periodTo=${to},trunkDns='',callsType=0`, token),
    fetchReportRows('ReportOutboundCalls', 'Pbx.GetOutboundCalls', `periodFrom=${from},periodTo=${to},trunkDns='',callsType=0`, token),
  ]);
  const managers = await getGestionnairesByExtension();
  cachedDirectionalCalls = [...inbound.map((row, index) => normalizeCall(row, index, 'Inbound')), ...outbound.map((row, index) => normalizeCall(row, inbound.length + index, 'Outbound'))]
    .filter(Boolean)
    .map((call) => attachManagerToCall(call, managers));
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
    if (error.statusCode !== 401) throw error;
    console.warn('3CX extension statistics returned 401; using unanswered counts from the inbound report.');
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
  get3CxOverview,
  get3CxManagerStats,
};
