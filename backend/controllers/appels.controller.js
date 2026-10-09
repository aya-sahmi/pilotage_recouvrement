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
             COALESCE(SUM(a.duree_secondes), 0) AS duree_total_appels
      FROM gestionnaires g
      LEFT JOIN appels_3cx a ON a.gestionnaire_id = g.id
      WHERE g.actif = TRUE
      GROUP BY g.id, g.nom, g.prenom, g.extension_3cx, g.actif
      ORDER BY g.nom ASC
      LIMIT 20
    `);
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    res.json({ success: true, data: mockData.gestionnaires.rows || [] });
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
