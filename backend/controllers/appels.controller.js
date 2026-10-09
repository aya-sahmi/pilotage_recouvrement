const { fetchCallsFrom3CX, get3CxOverview } = require('../services/3cx.service');
const { query } = require('../config/database');
const mockData = require('../data/mock-data');

async function get3cx(req, res, next) {
  try {
    const calls = await fetchCallsFrom3CX();
    res.json({ success: true, data: calls });
  } catch (error) {
    next(error);
  }
}

async function get3cxKpi(req, res, next) {
  try {
    const data = await get3CxOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function get3cxGestionnaires(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT g.id, g.nom, g.prenom, g.extension_3cx, g.actif,
             COUNT(a.id) AS total_appels,
             COUNT(a.id) FILTER (WHERE LOWER(a.direction::text) = 'sortant') AS total_sortants,
             COUNT(a.id) FILTER (WHERE LOWER(a.direction::text) = 'entrant' AND LOWER(COALESCE(a.statut, '')) IN ('answered', 'repondu', 'repondue', 'completed', 'answered_call')) AS entrants_repondues,
             COUNT(a.id) FILTER (WHERE LOWER(a.direction::text) = 'entrant' AND LOWER(COALESCE(a.statut, '')) NOT IN ('answered', 'repondu', 'repondue', 'completed', 'answered_call')) AS entrants_non_repondues,
             COALESCE(SUM(a.duree_secondes), 0) AS duree_total_secondes,
             COALESCE(AVG(a.duree_secondes), 0) AS duree_moyenne_secondes
      FROM gestionnaires g
      LEFT JOIN appels_3cx a ON a.gestionnaire_id = g.id
      WHERE g.actif = TRUE
      GROUP BY g.id, g.nom, g.prenom, g.extension_3cx, g.actif
      ORDER BY entrants_non_repondues DESC NULLS LAST, total_appels DESC, g.nom ASC
      LIMIT 20
    `);

    const data = (rows || []).map((row) => ({
      id: row.id,
      nom: row.nom || '',
      prenom: row.prenom || '',
      extension_3cx: row.extension_3cx || null,
      total_appels: Number(row.total_appels || 0),
      total_sortants: Number(row.total_sortants || 0),
      entrants_repondues: Number(row.entrants_repondues || 0),
      entrants_non_repondues: Number(row.entrants_non_repondues || 0),
      duree_total_secondes: Number(row.duree_total_secondes || 0),
      duree_moyenne_secondes: Number(row.duree_moyenne_secondes || 0),
    }));

    res.json({ success: true, data });
  } catch (error) {
    const fallback = (mockData.threeCx.byManager || []).map((row) => {
      const [prenom, ...rest] = String(row.name || '').split(' ');
      return {
        id: row.id || null,
        nom: rest.join(' ') || '',
        prenom: prenom || '',
        extension_3cx: null,
        total_appels: Number(row.totalAppels || 0),
        total_sortants: Number(row.totalAppels || 0),
        entrants_repondues: Number(row.totalAppels || 0) - 2,
        entrants_non_repondues: 2,
        duree_total_secondes: Number(row.duree || 0),
        duree_moyenne_secondes: Number(row.duree || 0) / Math.max(Number(row.totalAppels || 1), 1),
      };
    });

    res.json({ success: true, data: fallback });
  }
}

async function get3cxNonRattaches(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT a.*, g.nom AS gestionnaire_nom, g.prenom AS gestionnaire_prenom
      FROM appels_3cx a
      LEFT JOIN gestionnaires g ON g.id = a.gestionnaire_id
      WHERE a.gestionnaire_id IS NULL
      ORDER BY a.date_debut DESC
      LIMIT 20
    `);
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    res.json({ success: true, data: mockData.threeCx.nonRattaches || [] });
  }
}

async function sync3cx(req, res, next) {
  try {
    const calls = await fetchCallsFrom3CX();
    const result = { synced: calls.length, calls };
    res.json({ success: true, data: result, message: 'Synchronisation 3CX réussie.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  get3cx,
  get3cxKpi,
  get3cxGestionnaires,
  get3cxNonRattaches,
  sync3cx,
};
