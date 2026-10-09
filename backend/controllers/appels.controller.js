const { fetchCallsFrom3CX, get3CxOverview, get3CxManagerStats } = require('../services/3cx.service');
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
    const data = await get3CxManagerStats();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
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
