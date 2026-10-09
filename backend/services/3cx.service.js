const { query } = require('../config/database');
const mockData = require('../data/mock-data');

function normalizeExtension(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\D/g, '');
}

function buildHeaders() {
  const apiKey = process.env.THREECX_API_KEY || '';
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = 'Bearer ' + apiKey;
    headers['X-API-Key'] = apiKey;
    headers['api-key'] = apiKey;
  }

  return headers;
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

function normalizeCall(row, index) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const rawDirection = String(row.direction || row.type || row.call_direction || 'inbound').toLowerCase();
  const rawStatus = String(row.statut || row.status || row.state || 'answered').toLowerCase();
  const callId = row.call_id || row.id || row.callId || row.uuid || 'cx-' + (index + 1);
  const direction = rawDirection.includes('sort') ? 'outbound' : rawDirection.includes('entr') || rawDirection.includes('inbound') ? 'inbound' : 'inbound';
  const status = rawStatus.includes('miss') || rawStatus.includes('non') || rawStatus.includes('no_') || rawStatus.includes('busy') || rawStatus.includes('failed') ? 'missed' : rawStatus.includes('answer') || rawStatus.includes('repon') || rawStatus.includes('connect') ? 'answered' : 'answered';
  const startDate = row.date_debut || row.start_time || row.started_at || row.date || row.begin || new Date().toISOString();

  return {
    call_id: callId,
    extension: row.extension || row.extension_number || row.assignee || row.agent || 'n/a',
    direction,
    numero_appelant: row.numero_appelant || row.caller || row.number_from || row.from || '',
    numero_destinataire: row.numero_destinataire || row.called || row.number_to || row.to || '',
    numero_client: row.numero_client || row.numero_appelant || row.number_from || row.from || '',
    date_debut: startDate,
    date_fin: row.date_fin || row.end_time || row.ended_at || row.date_debut || startDate,
    duree: Number(row.duree || row.duration || row.call_duration || row.length || 0),
    statut: status,
    gestionnaire_id: row.gestionnaire_id || row.agent_id || row.manager_id || null,
  };
}

async function fetchCallsFrom3CX() {
  const fallbackCalls = Array.isArray(mockData?.threeCx?.calls) ? mockData.threeCx.calls : [];
  const managers = await getGestionnairesByExtension();

  if (!process.env.THREECX_API_URL) {
    return fallbackCalls.map((call) => attachManagerToCall(call, managers));
  }

  const baseUrl = process.env.THREECX_API_URL.replace(/\/$/, '').replace(/#.*$/, '');
  const candidates = [
    baseUrl + '/api/v1/calls',
    baseUrl + '/api/v1/call-logs',
    baseUrl + '/api/v1/call-reports',
    baseUrl + '/api/v1/inbound-calls',
    baseUrl + '/api/v1/outbound-calls',
    baseUrl + '/api/v1/extension-statistic',
    baseUrl + '/api/v1/extension-statistics',
    baseUrl + '/api/v1/reports',
    baseUrl + '/api/v1/reports/call-reports',
    baseUrl + '/api/v1/reports/inbound-calls',
    baseUrl + '/api/v1/reports/outbound-calls',
    baseUrl + '/api/v1/reports/extension-statistic',
    baseUrl + '/restapi/v1/calls',
    baseUrl + '/calls',
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const rows = extractRows(payload);

      if (Array.isArray(rows) && rows.length) {
        return rows
          .map((row, index) => attachManagerToCall(normalizeCall(row, index), managers))
          .filter(Boolean);
      }
    } catch (error) {
      continue;
    }
  }

  return fallbackCalls.map((call) => attachManagerToCall(call, managers));
}

async function get3CxOverview() {
  const fallbackOverview = mockData?.threeCx?.kpis || {
    totalAppels: 0,
    dureeTotale: 0,
    tauxRattachement: 0,
    appelsNonRattaches: 0,
    appelsSortants: 0,
    appelsEntrantsRepondues: 0,
    appelsEntrantsNonRepondues: 0,
  };

  if (!process.env.DATABASE_URL) {
    return fallbackOverview;
  }

  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)::INT AS total_appels,
        COUNT(*) FILTER (WHERE LOWER(direction::text) = 'sortant')::INT AS total_sortants,
        COUNT(*) FILTER (WHERE LOWER(direction::text) = 'entrant' AND LOWER(COALESCE(statut, '')) IN ('answered', 'repondu', 'repondue', 'completed', 'answered_call'))::INT AS total_entrants_repondues,
        COUNT(*) FILTER (WHERE LOWER(direction::text) = 'entrant' AND LOWER(COALESCE(statut, '')) NOT IN ('answered', 'repondu', 'repondue', 'completed', 'answered_call'))::INT AS total_entrants_non_repondues,
        COALESCE(SUM(duree_secondes), 0)::INT AS duree_totale_secondes,
        COALESCE(SUM(CASE WHEN communication_non_rattachee = TRUE THEN 1 ELSE 0 END), 0)::INT AS appels_non_rattaches
      FROM appels_3cx
    `);

    if (rows && rows.length) {
      const row = rows[0];
      const totalAppels = Number(row.total_appels || 0);
      const entrantsNonRepondues = Number(row.total_entrants_non_repondues || 0);
      return {
        totalAppels,
        dureeTotale: Number(row.duree_totale_secondes || 0),
        tauxRattachement: totalAppels ? Number(((totalAppels - Number(row.appels_non_rattaches || 0)) / totalAppels) * 100) : 0,
        appelsNonRattaches: Number(row.appels_non_rattaches || 0),
        appelsSortants: Number(row.total_sortants || 0),
        appelsEntrantsRepondues: Number(row.total_entrants_repondues || 0),
        appelsEntrantsNonRepondues: entrantsNonRepondues,
      };
    }

    return fallbackOverview;
  } catch (error) {
    return fallbackOverview;
  }
}

module.exports = {
  fetchCallsFrom3CX,
  get3CxOverview,
};
