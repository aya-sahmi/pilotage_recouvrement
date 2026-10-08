const { query } = require('../config/database');

function buildHeaders() {
  const apiKey = process.env.THREECX_API_KEY || '';
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = 'Bearer ' + apiKey;
  }

  return headers;
}

async function fetchCallsFrom3CX() {
  if (!process.env.THREECX_API_URL) {
    return [];
  }

  const baseUrl = process.env.THREECX_API_URL.replace(/\/$/, '');
  const candidates = [
    baseUrl + '/api/v1/calls',
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
      const rows = Array.isArray(payload) ? payload : payload.calls || payload.data || payload.results || [];

      if (Array.isArray(rows)) {
        return rows.map((row, index) => ({
          call_id: row.call_id || row.id || 'cx-' + (index + 1),
          extension: row.extension || row.extension_number || row.assignee || 'n/a',
          direction: row.direction || row.type || 'inbound',
          numero_appelant: row.numero_appelant || row.caller || row.number_from || '',
          numero_destinataire: row.numero_destinataire || row.called || row.number_to || '',
          numero_client: row.numero_client || row.numero_appelant || row.number_from || '',
          date_debut: row.date_debut || row.start_time || row.started_at || new Date().toISOString(),
          date_fin: row.date_fin || row.end_time || row.ended_at || row.date_debut || new Date().toISOString(),
          duree: Number(row.duree || row.duration || row.call_duration || 0),
          statut: row.statut || row.status || 'answered',
          gestionnaire_id: row.gestionnaire_id || null,
        }));
      }
    } catch (error) {
      continue;
    }
  }

  return [];
}

async function get3CxOverview() {
  try {
    const { rows } = await query('SELECT * FROM vue_kpi_3cx LIMIT 20');
    if (rows && rows.length) {
      return {
        totalAppels: Number(rows[0].total_appels || 0),
        dureeTotale: Number(rows[0].duree_totale_secondes || rows[0].duree_totale || 0),
        tauxRattachement: Number(rows[0].taux_rattachement || 0),
        appelsNonRattaches: Number(rows[0].appels_non_rattaches || 0),
      };
    }

    return {
      totalAppels: 0,
      dureeTotale: 0,
      tauxRattachement: 0,
      appelsNonRattaches: 0,
    };
  } catch (error) {
    return {
      totalAppels: 0,
      dureeTotale: 0,
      tauxRattachement: 0,
      appelsNonRattaches: 0,
    };
  }
}

module.exports = {
  fetchCallsFrom3CX,
  get3CxOverview,
};
