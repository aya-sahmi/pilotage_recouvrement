const { fetchCallsFrom3CX, get3CxOverview } = require('../services/3cx.service');
const { query } = require('../config/database');

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
    const { rows } = await query('SELECT * FROM vue_appels_gestionnaires LIMIT 20');
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
  }
}

async function get3cxNonRattaches(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM vue_appels_non_rattaches LIMIT 20');
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
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
