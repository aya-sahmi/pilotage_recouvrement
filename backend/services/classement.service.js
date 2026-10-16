const { pool, query } = require('../config/database');

function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitResponsibleName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    nom: parts[0] || '',
    prenom: parts.slice(1).join(' '),
  };
}

async function persistRankingImport({ type, fileName, rows }) {
  const client = await pool.connect();
  const importTable = type === 'responsables'
    ? 'classement_responsables_imports'
    : 'classement_clients_imports';
  const rankingTable = type === 'responsables'
    ? 'classement_responsables'
    : 'classement_clients';
  const entityTable = type === 'responsables' ? 'responsables' : 'clients';

  try {
    await client.query('BEGIN');
    const importResult = await client.query(
      `INSERT INTO ${importTable} (nom_fichier, nombre_lignes)
       VALUES ($1, $2)
       RETURNING id`,
      [fileName, rows.length]
    );
    const importId = importResult.rows[0].id;

    for (const row of rows) {
      const normalizedName = normalizeName(type === 'responsables' ? row.nomAffichage : row.nom);
      let entityResult;

      if (type === 'responsables') {
        const { nom, prenom } = splitResponsibleName(row.nomAffichage);
        entityResult = await client.query(
          `INSERT INTO ${entityTable} (
             nom, prenom, nom_affichage, nom_normalise, photo_url, actif, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
           ON CONFLICT (nom_normalise) DO UPDATE
             SET nom = EXCLUDED.nom,
                 prenom = EXCLUDED.prenom,
                 nom_affichage = EXCLUDED.nom_affichage,
                 photo_url = COALESCE(EXCLUDED.photo_url, responsables.photo_url),
                 updated_at = NOW()
           RETURNING id`,
          [nom, prenom, row.nomAffichage, normalizedName, row.photoUrl || null]
        );
        await client.query(
          `INSERT INTO ${rankingTable} (import_id, responsable_id, encaissement, commission, objectif)
           VALUES ($1, $2, $3, $4, $5)`,
          [importId, entityResult.rows[0].id, row.encaissement, row.commission, row.objectif]
        );
      } else {
        entityResult = await client.query(
          `INSERT INTO ${entityTable} (nom, nom_normalise, photo_url, actif, created_at, updated_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())
           ON CONFLICT (nom_normalise) DO UPDATE
             SET nom = EXCLUDED.nom,
                 photo_url = COALESCE(EXCLUDED.photo_url, clients.photo_url),
                 updated_at = NOW()
           RETURNING id`,
          [row.nom, normalizedName, row.photoUrl || null]
        );
        await client.query(
          `INSERT INTO ${rankingTable} (import_id, client_id, encaissement, commission_srm)
           VALUES ($1, $2, $3, $4)`,
          [importId, entityResult.rows[0].id, row.encaissement, row.commissionSrm]
        );
      }
    }

    await client.query('COMMIT');
    return { importId, importedCount: rows.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getLatestResponsibleRanking() {
  const { rows: imports } = await query(
    `SELECT id, nom_fichier, date_import, nombre_lignes
     FROM classement_responsables_imports
     ORDER BY date_import DESC, id DESC
     LIMIT 1`
  );
  const latestImport = imports[0];
  if (!latestImport) return { import: null, rows: [] };

  const { rows } = await query(
    `SELECT r.id, r.nom, r.prenom, r.nom_affichage, r.photo_url,
            cr.encaissement, cr.commission, cr.objectif
     FROM classement_responsables cr
     JOIN responsables r ON r.id = cr.responsable_id
     WHERE cr.import_id = $1 AND COALESCE(r.actif, TRUE)
     ORDER BY CASE WHEN cr.objectif > 0 THEN cr.commission / cr.objectif ELSE 0 END DESC,
              r.nom_affichage ASC`,
    [latestImport.id]
  );

  return {
    import: latestImport,
    rows: rows.map((row) => ({
      ...row,
      taux: Number(row.objectif) > 0
        ? (Number(row.commission) / Number(row.objectif)) * 100
        : 0,
    })),
  };
}

async function getLatestClientRanking() {
  const { rows: imports } = await query(
    `SELECT id, nom_fichier, date_import, nombre_lignes
     FROM classement_clients_imports
     ORDER BY date_import DESC, id DESC
     LIMIT 1`
  );
  const latestImport = imports[0];
  if (!latestImport) return { import: null, rows: [] };

  const { rows } = await query(
    `SELECT c.id, c.nom, c.photo_url, cc.encaissement, cc.commission_srm
     FROM classement_clients cc
     JOIN clients c ON c.id = cc.client_id
     WHERE cc.import_id = $1 AND COALESCE(c.actif, TRUE)
     ORDER BY cc.encaissement DESC, c.nom ASC`,
    [latestImport.id]
  );

  return { import: latestImport, rows };
}

module.exports = {
  persistRankingImport,
  getLatestResponsibleRanking,
  getLatestClientRanking,
};
