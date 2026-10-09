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
      `INSERT INTO gestionnaires (nom, prenom, photo_url, extension_3cx, actif)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
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
      `UPDATE gestionnaires
       SET nom = COALESCE($1, nom),
           prenom = COALESCE($2, prenom),
           photo_url = COALESCE($3, photo_url),
           extension_3cx = COALESCE($4, extension_3cx),
           actif = COALESCE($5, actif),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
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
    await query('DELETE FROM gestionnaires WHERE id = $1', [id]);
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
