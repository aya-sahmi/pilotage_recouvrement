const { query } = require('../config/database');

const ENTITIES = {
  responsables: {
    label: 'Responsable',
    fields: ['nom', 'prenom', 'nom_affichage', 'photo_url'],
    required: ['nom'],
    order: 'nom_affichage ASC NULLS LAST, nom ASC',
  },
  clients: {
    label: 'Client',
    fields: ['nom', 'photo_url'],
    required: ['nom'],
    order: 'nom ASC',
  },
};

let schemaReady = null;

// Les tables importées depuis Neon peuvent ne pas avoir la colonne "actif".
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = Promise.all(
      Object.keys(ENTITIES).map((table) =>
        query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE`)
      )
    ).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function clean(value) {
  if (value === undefined) return undefined;
  const text = value === null ? '' : String(value).trim();
  return text === '' ? null : text;
}

function buildPayload(config, body, { creating }) {
  const payload = {};
  for (const field of config.fields) {
    const value = clean(body[field]);
    if (value !== undefined) payload[field] = value;
  }
  if (body.actif !== undefined) payload.actif = body.actif === true || body.actif === 'true';

  if (creating && config.fields.includes('nom_affichage') && !payload.nom_affichage) {
    payload.nom_affichage = [payload.prenom, payload.nom].filter(Boolean).join(' ') || payload.nom;
  }
  return payload;
}

function makeController(table) {
  const config = ENTITIES[table];

  return {
    async list(req, res, next) {
      try {
        await ensureSchema();
        const { rows } = await query(`SELECT * FROM ${table} ORDER BY ${config.order}`);
        res.json({ success: true, data: rows });
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        await ensureSchema();
        const payload = buildPayload(config, req.body || {}, { creating: true });
        const missing = config.required.filter((field) => !payload[field]);
        if (missing.length) {
          return res.status(400).json({ success: false, message: `Champ requis : ${missing.join(', ')}` });
        }
        const columns = Object.keys(payload);
        const placeholders = columns.map((_, index) => `$${index + 1}`);
        const { rows } = await query(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          columns.map((column) => payload[column])
        );
        res.status(201).json({ success: true, data: rows[0], message: `${config.label} créé.` });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        await ensureSchema();
        const payload = buildPayload(config, req.body || {}, { creating: false });
        const columns = Object.keys(payload);
        if (!columns.length) {
          return res.status(400).json({ success: false, message: 'Aucune modification.' });
        }
        if (columns.includes('nom') && !payload.nom) {
          return res.status(400).json({ success: false, message: 'Le nom est requis.' });
        }
        const sets = columns.map((column, index) => `${column} = $${index + 1}`);
        const { rows } = await query(
          `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${columns.length + 1} RETURNING *`,
          [...columns.map((column) => payload[column]), req.params.id]
        );
        if (!rows[0]) {
          return res.status(404).json({ success: false, message: `${config.label} introuvable.` });
        }
        res.json({ success: true, data: rows[0], message: `${config.label} modifié.` });
      } catch (error) {
        next(error);
      }
    },
    async remove(req, res, next) {
      try {
        const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
        if (!rowCount) {
          return res.status(404).json({ success: false, message: `${config.label} introuvable.` });
        }
        res.json({ success: true, data: { id: req.params.id }, message: `${config.label} supprimé.` });
      } catch (error) {
        if (error.code === '23503') {
          return res.status(409).json({ success: false, message: 'Suppression impossible : élément lié à des données. Désactivez-le à la place.' });
        }
        next(error);
      }
    },
  };
}

module.exports = {
  responsables: makeController('responsables'),
  clients: makeController('clients'),
};
