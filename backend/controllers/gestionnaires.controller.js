const { query } = require('../config/database');

async function listGestionnaires(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM gestionnaires ORDER BY nom ASC LIMIT 100');
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
  }
}

async function createGestionnaire(req, res, next) {
  try {
    const { nom, prenom, photo_url, extension_3cx, actif } = req.body || {};
    const result = await query(
      'INSERT INTO gestionnaires (nom, prenom, photo_url, extension_3cx, actif) VALUES (, , , , ) RETURNING *',
      [nom, prenom, photo_url || null, extension_3cx || null, actif !== false]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Gestionnaire créé.' });
  } catch (error) {
    next(error);
  }
}

async function updateGestionnaire(req, res, next) {
  try {
    const { id } = req.params;
    const { nom, prenom, photo_url, extension_3cx, actif } = req.body || {};
    const result = await query(
      'UPDATE gestionnaires SET nom = COALESCE(, nom), prenom = COALESCE(, prenom), photo_url = COALESCE(, photo_url), extension_3cx = COALESCE(, extension_3cx), actif = COALESCE(, actif) WHERE gestionnaire_id =  RETURNING *',
      [nom, prenom, photo_url, extension_3cx, actif, id]
    );
    res.json({ success: true, data: result.rows[0], message: 'Gestionnaire modifié.' });
  } catch (error) {
    next(error);
  }
}

async function deleteGestionnaire(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM gestionnaires WHERE gestionnaire_id = ', [id]);
    res.json({ success: true, message: 'Gestionnaire supprimé.', data: { id } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listGestionnaires,
  createGestionnaire,
  updateGestionnaire,
  deleteGestionnaire,
};
