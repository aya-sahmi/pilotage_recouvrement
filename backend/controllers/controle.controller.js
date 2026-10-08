const { query } = require('../config/database');

async function getControle(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM controles_donnees ORDER BY date_controle DESC LIMIT 50');
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getControle,
};
