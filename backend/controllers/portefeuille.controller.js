const { getPortefeuilleSnapshot, getPortefeuilleKpis } = require('../services/portefeuille.service');
const { query } = require('../config/database');

async function getPortefeuille(req, res, next) {
  try {
    const data = await getPortefeuilleSnapshot();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getPortefeuilleKpisHandler(req, res, next) {
  try {
    const data = await getPortefeuilleKpis();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getPortefeuilleStatuts(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM vue_portefeuille_statuts LIMIT 20');
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
  }
}

async function getPortefeuilleTypesLot(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM vue_portefeuille_types_lot LIMIT 20');
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPortefeuille,
  getPortefeuilleKpisHandler,
  getPortefeuilleStatuts,
  getPortefeuilleTypesLot,
};
