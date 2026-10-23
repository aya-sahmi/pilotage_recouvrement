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

let encaissementTablesReady = null;

function ensureEncaissementTables() {
  if (!encaissementTablesReady) {
    encaissementTablesReady = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS encaissements_imports (
        id SERIAL PRIMARY KEY,
        nom_fichier TEXT,
        nombre_lignes INTEGER NOT NULL DEFAULT 0,
        date_import TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS encaissements (
        id SERIAL PRIMARY KEY,
        import_id INTEGER NOT NULL REFERENCES encaissements_imports(id) ON DELETE CASCADE,
        id_interne TEXT,
        id_externe TEXT,
        client TEXT,
        debiteur TEXT,
        montant NUMERIC(14,2) NOT NULL DEFAULT 0,
        taux NUMERIC(10,4) NOT NULL DEFAULT 0,
        commission NUMERIC(14,2) NOT NULL DEFAULT 0,
        mode_reglement TEXT,
        statut TEXT,
        gestionnaire TEXT,
        responsable TEXT,
        date_encaissement DATE NOT NULL
      )`);
      await query('CREATE INDEX IF NOT EXISTS idx_encaissements_date ON encaissements (import_id, date_encaissement)');
    })().catch((error) => {
      encaissementTablesReady = null;
      throw error;
    });
  }
  return encaissementTablesReady;
}

// Le fichier est cumulatif (1er janvier → aujourd'hui) : chaque import remplace le précédent.
async function persistEncaissementsImport({ fileName, rows }) {
  await ensureEncaissementTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM encaissements_imports');
    const { rows: created } = await client.query(
      'INSERT INTO encaissements_imports (nom_fichier, nombre_lignes) VALUES ($1, $2) RETURNING id',
      [fileName, rows.length]
    );
    const importId = created[0].id;

    const chunkSize = 500;
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const values = [];
      const placeholders = chunk.map((row, index) => {
        const base = index * 13;
        values.push(
          importId, row.idInterne, row.idExterne, row.client, row.debiteur, row.montant, row.taux,
          row.commission, row.mode, row.statut, row.gestionnaire, row.responsable, row.date
        );
        return `(${Array.from({ length: 13 }, (_, i) => `$${base + i + 1}`).join(', ')})`;
      });
      await client.query(
        `INSERT INTO encaissements (
           import_id, id_interne, id_externe, client, debiteur, montant, taux, commission,
           mode_reglement, statut, gestionnaire, responsable, date_encaissement
         ) VALUES ${placeholders.join(', ')}`,
        values
      );
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

const PERIOD_MONTHS = { '3m': 3, '6m': 6, '1y': 12 };
const GROUP_COLUMNS = {
  gestionnaires: 'gestionnaire',
  responsables: 'responsable',
  clients: 'client',
};

async function getEncaissementRanking(period, group) {
  const column = GROUP_COLUMNS[group];
  const months = PERIOD_MONTHS[period];
  if (!column || !months) {
    const error = new Error('Période ou type de classement invalide.');
    error.statusCode = 400;
    throw error;
  }

  await ensureEncaissementTables();
  const { rows: imports } = await query(
    'SELECT id, nom_fichier, date_import FROM encaissements_imports ORDER BY date_import DESC, id DESC LIMIT 1'
  );
  const latestImport = imports[0];
  if (!latestImport) return { import: null, from: null, rows: [] };

  const { rows } = await query(
    `SELECT MIN(TRIM(${column})) AS nom,
            SUM(montant) AS encaissement,
            SUM(commission) AS commission,
            COUNT(*)::int AS nombre
     FROM encaissements
     WHERE import_id = $1
       AND date_encaissement >= (CURRENT_DATE - ($2 || ' months')::interval)::date
       AND COALESCE(TRIM(${column}), '') <> ''
     GROUP BY LOWER(TRIM(${column}))
     ORDER BY SUM(montant) DESC, MIN(TRIM(${column})) ASC`,
    [latestImport.id, String(months)]
  );

  return {
    import: latestImport,
    rows: rows.map((row) => ({
      nom: row.nom,
      encaissement: Number(row.encaissement || 0),
      commission: Number(row.commission || 0),
      nombre: row.nombre,
    })),
  };
}

// Mois actuel : issu des classements importés (gestionnaires, responsables, clients).
async function getCurrentMonthRanking(group) {
  if (group === 'responsables') {
    const { import: rankingImport, rows } = await getLatestResponsibleRanking();
    return {
      import: rankingImport,
      rows: rows
        .map((row) => ({
          nom: row.nom_affichage || `${row.prenom || ''} ${row.nom || ''}`.trim(),
          encaissement: Number(row.encaissement || 0),
          commission: Number(row.commission || 0),
        }))
        .sort((a, b) => b.encaissement - a.encaissement),
    };
  }

  if (group === 'clients') {
    const { import: rankingImport, rows } = await getLatestClientRanking();
    return {
      import: rankingImport,
      rows: rows.map((row) => ({
        nom: row.nom,
        encaissement: Number(row.encaissement || 0),
        commission: Number(row.commission_srm || 0),
      })),
    };
  }

  const { rows: latest } = await query(
    'SELECT MAX(import_id) AS import_id FROM performances WHERE import_id IS NOT NULL'
  );
  const importId = latest[0]?.import_id;
  if (!importId) return { import: null, rows: [] };

  const { rows } = await query(
    `SELECT COALESCE(NULLIF(TRIM(g.nom_affichage), ''), p.nom_source) AS nom,
            SUM(p.encaissement) AS encaissement, SUM(p.commission) AS commission
     FROM performances p
     LEFT JOIN gestionnaires g ON g.id = p.gestionnaire_id
     WHERE p.import_id = $1
     GROUP BY COALESCE(NULLIF(TRIM(g.nom_affichage), ''), p.nom_source)
     ORDER BY SUM(p.encaissement) DESC`,
    [importId]
  );
  return {
    import: { id: importId },
    rows: rows.map((row) => ({
      nom: row.nom,
      encaissement: Number(row.encaissement || 0),
      commission: Number(row.commission || 0),
    })),
  };
}

module.exports = {
  persistRankingImport,
  getLatestResponsibleRanking,
  getLatestClientRanking,
  persistEncaissementsImport,
  ensureEncaissementTables,
  getEncaissementRanking,
  getCurrentMonthRanking,
};
