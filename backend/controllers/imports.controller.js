const {
  parsePerformanceWorkbook,
  parsePortefeuilleWorkbook,
  parseResponsablesRankingWorkbook,
  parseClientsRankingWorkbook,
} = require('../services/excel-import.service');
const { pool, query } = require('../config/database');
const { persistRankingImport } = require('../services/classement.service');

function normalizeImportStatus(status) {
  if (!status) return 'TERMINE';
  const normalized = String(status).trim().toUpperCase();
  if (normalized === 'ERREUR' || normalized === 'ERROR') return 'ERREUR';
  if (normalized === 'OK' || normalized === 'TERMINE') return 'TERMINE';
  if (normalized === 'VIDE') return 'TERMINE';
  return 'TERMINE';
}

function normalizeImportType(type) {
  const normalized = String(type || '').trim().toUpperCase();
  if (normalized === 'PERFORMANCE') return 'CLASSEMENT';
  if (normalized === 'PORTEFEUILLE' || normalized === 'PORTFOLIO') return 'PORTEFEUILLE';
  return 'PORTEFEUILLE';
}

function normalizeManagerName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const managerNameAliases = new Map([
  ['chakir fatimzahra', 'fatimazahra chakir'],
]);

async function getGestionnaireIdByName(name, runQuery = query) {
  const rawName = String(name || '').trim();
  if (!rawName) return null;

  const normalized = managerNameAliases.get(normalizeManagerName(rawName)) || normalizeManagerName(rawName);
  if (!normalized) return null;

  const { rows } = await runQuery(
    `SELECT id FROM gestionnaires
      WHERE LOWER(nom_normalise) = $1
        OR LOWER(nom_affichage) = $1
        OR LOWER(TRIM(CONCAT_WS(' ', nom, prenom))) = $1
      LIMIT 1`,
    [normalized]
  );

  return rows[0]?.id || null;
}

async function upsertGestionnaireFromSource(name) {
  const rawName = String(name || '').trim();
  if (!rawName) return null;

  const existing = await getGestionnaireIdByName(rawName);
  if (existing) return existing;

  const parts = rawName.split(/\s+/).filter(Boolean);
  const nom = parts[0] || rawName;
  const prenom = parts.length > 1 ? parts.slice(1).join(' ') : null;

  const { rows } = await query(
    `INSERT INTO gestionnaires (
      nom,
      prenom,
      nom_affichage,
      nom_normalise,
      actif,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW()) RETURNING id`,
    [nom, prenom, rawName, normalizeManagerName(rawName)]
  );

  return rows[0]?.id || null;
}

async function insertImportLog(type, fileName, parsed, runQuery = query) {
  const data = {
    type_import: normalizeImportType(type),
    nom_fichier: fileName,
    nombre_lignes: Number(parsed?.stats?.lignes || 0),
    nombre_lignes_importees: Number(parsed?.stats?.importees || 0),
    nombre_lignes_erreur: Number(parsed?.stats?.erreurs || 0),
    statut: normalizeImportStatus(parsed?.stats?.statut),
    message_erreur: parsed?.stats?.erreur || null,
  };

  const { rows } = await runQuery(
    `INSERT INTO imports (
      type_import,
      nom_fichier,
      nombre_lignes,
      nombre_lignes_importees,
      nombre_lignes_erreur,
      statut,
      message_erreur
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      data.type_import,
      data.nom_fichier,
      data.nombre_lignes,
      data.nombre_lignes_importees,
      data.nombre_lignes_erreur,
      data.statut,
      data.message_erreur,
    ]
  );

  return rows[0];
}

async function persistPerformanceRows(importId, rows, runQuery = query) {
  for (const row of rows || []) {
    const gestionnaireId = await getGestionnaireIdByName(
      row.nomPrenom || row.nom_prenom || row.gestionnaire || '',
      runQuery
    );
    await runQuery(
      `INSERT INTO performances (
        gestionnaire_id,
        import_id,
        periode_debut,
        periode_fin,
        nom_source,
        encaissement,
        commission,
        objectif,
        created_at
      ) VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, NOW())`,
      [
        gestionnaireId,
        importId,
        row.nomPrenom || row.nom_prenom || row.gestionnaire || null,
        Number(row.encaissement || 0),
        Number(row.commission || 0),
        Number(row.objectif || 0),
      ]
    );
  }
}

async function persistPortefeuilleRows(importId, rows) {
  for (const row of rows || []) {
    const gestionnaireId = await upsertGestionnaireFromSource(row.nom_gestionnaire_source || row.gestionnaire || row.responsable || '');
    const values = [
      row.id_externe || null,
      row.nom_client || null,
      row.debiteur || null,
      row.statut || null,
      Number(row.solde || 0),
      row.cin_debiteur || null,
      row.date_reception || null,
      row.type_lot || null,
      gestionnaireId,
      row.nom_gestionnaire_source || null,
      row.responsable || null,
      row.telephone_debiteur || null,
      row.telephone_normalise || null,
      row.employeur_client || null,
      row.adresse_employeur_client || null,
      row.ville_employeur_client || null,
      row.nombre_titre2 ? Number(row.nombre_titre2) : 0,
      row.historique || null,
      importId,
    ];

    await query(
      `INSERT INTO dossiers (
        id_externe,
        nom_client,
        debiteur,
        statut,
        solde,
        cin_debiteur,
        date_reception,
        type_lot,
        gestionnaire_id,
        nom_gestionnaire_source,
        responsable,
        telephone_debiteur,
        telephone_normalise,
        employeur_client,
        adresse_employeur_client,
        ville_employeur_client,
        nombre_titre2,
        historique,
        import_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())`,
      values
    );
  }
}

async function importPerformance(req, res, next) {
  try {
    const file = req.file || req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, message: 'Veuillez fournir un fichier Excel.', error: 'MISSING_FILE' });
    }

    const parsed = await parsePerformanceWorkbook(file.buffer || file.data);
    if (!parsed.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucune ligne importable. Vérifiez que le fichier contient une colonne « Nom et Prenom » ou « Gestionnaire ».',
        error: 'EMPTY_PERFORMANCE_IMPORT',
      });
    }

    const client = await pool.connect();
    let importRecord;
    try {
      await client.query('BEGIN');
      const runQuery = (text, params) => client.query(text, params);
      importRecord = await insertImportLog('performance', file.originalname, parsed, runQuery);
      await persistPerformanceRows(importRecord.id, parsed.rows, runQuery);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, data: { ...parsed, import_id: importRecord.id }, message: 'Import performance terminé.' });
  } catch (error) {
    next(error);
  }
}

async function importPortefeuille(req, res, next) {
  try {
    const file = req.file || req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, message: 'Veuillez fournir un fichier Excel.', error: 'MISSING_FILE' });
    }

    const parsed = await parsePortefeuilleWorkbook(file.buffer || file.data);
    const importRecord = await insertImportLog('portefeuille', file.originalname, parsed);
    await persistPortefeuilleRows(importRecord.id, parsed.rows);

    res.json({ success: true, data: { ...parsed, import_id: importRecord.id }, message: 'Import portefeuille terminé.' });
  } catch (error) {
    next(error);
  }
}

async function importResponsablesRanking(req, res, next) {
  try {
    const file = req.file || req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, message: 'Veuillez fournir un fichier Excel.', error: 'MISSING_FILE' });
    }

    const parsed = await parseResponsablesRankingWorkbook(file.buffer || file.data);
    const result = await persistRankingImport({
      type: 'responsables',
      fileName: file.originalname,
      rows: parsed.rows,
    });

    res.json({
      success: true,
      data: { ...parsed, import_id: result.importId },
      message: 'Import du classement des responsables terminé.',
    });
  } catch (error) {
    next(error);
  }
}

async function importClientsRanking(req, res, next) {
  try {
    const file = req.file || req.files?.[0];
    if (!file) {
      return res.status(400).json({ success: false, message: 'Veuillez fournir un fichier Excel.', error: 'MISSING_FILE' });
    }

    const parsed = await parseClientsRankingWorkbook(file.buffer || file.data);
    const result = await persistRankingImport({
      type: 'clients',
      fileName: file.originalname,
      rows: parsed.rows,
    });

    res.json({
      success: true,
      data: { ...parsed, import_id: result.importId },
      message: 'Import du classement des clients terminé.',
    });
  } catch (error) {
    next(error);
  }
}

async function getImports(req, res, next) {
  try {
    const { rows } = await query(`
      SELECT id, 'standard' AS source, type_import::text AS type_import, nom_fichier, date_import, nombre_lignes,
             nombre_lignes_importees, nombre_lignes_erreur, statut::text AS statut
      FROM imports
      UNION ALL
      SELECT id, 'responsables' AS source, 'CLASSEMENT RESPONSABLES' AS type_import, nom_fichier, date_import,
             nombre_lignes, nombre_lignes AS nombre_lignes_importees,
             0 AS nombre_lignes_erreur, 'TERMINE' AS statut
      FROM classement_responsables_imports
      UNION ALL
      SELECT id, 'clients' AS source, 'CLASSEMENT CLIENTS' AS type_import, nom_fichier, date_import,
             nombre_lignes, nombre_lignes AS nombre_lignes_importees,
             0 AS nombre_lignes_erreur, 'TERMINE' AS statut
      FROM classement_clients_imports
      ORDER BY date_import DESC
      LIMIT 50
    `);
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    next(error);
  }
}

// Tables enfants à vider avant de supprimer l'import parent.
const IMPORT_SOURCES = {
  standard: { table: 'imports', children: ['performances', 'dossiers'] },
  responsables: { table: 'classement_responsables_imports', children: ['classement_responsables'] },
  clients: { table: 'classement_clients_imports', children: ['classement_clients'] },
};

async function deleteImport(req, res, next) {
  const source = IMPORT_SOURCES[req.params.source];
  const id = Number(req.params.id);
  if (!source || !Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'Import invalide.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (source.children.includes('dossiers')) {
      await client.query(
        'UPDATE appels_3cx SET dossier_id = NULL WHERE dossier_id IN (SELECT id FROM dossiers WHERE import_id = $1)',
        [id]
      );
    }
    for (const child of source.children) {
      await client.query(`DELETE FROM ${child} WHERE import_id = $1`, [id]);
    }
    const result = await client.query(`DELETE FROM ${source.table} WHERE id = $1`, [id]);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Import introuvable.' });
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { id }, message: 'Import supprimé.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') {
      return res.status(409).json({ success: false, message: 'Suppression impossible : des données dépendent encore de cet import.' });
    }
    next(error);
  } finally {
    client.release();
  }
}

module.exports = {
  importPerformance,
  importPortefeuille,
  importResponsablesRanking,
  importClientsRanking,
  getImports,
  deleteImport,
};
