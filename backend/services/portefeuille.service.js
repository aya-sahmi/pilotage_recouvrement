const { query } = require('../config/database');

async function getPortefeuilleSnapshot() {
  try {
    const { rows } = await query('SELECT * FROM vue_portefeuille_gestionnaires LIMIT 20');
    if (rows && rows.length) {
      return {
        totalDossiers: rows.reduce((sum, row) => sum + Number(row.nombre_dossiers || row.total_dossiers || 0), 0),
        soldeTotal: rows.reduce((sum, row) => sum + Number(row.solde_total || 0), 0),
        byManager: rows.map((row) => ({
          name: row.nom_affichage || row.gestionnaire || 'Inconnu',
          dossiers: Number(row.nombre_dossiers || row.total_dossiers || 0),
          solde: Number(row.solde_total || 0),
        })),
      };
    }

    return {
      totalDossiers: 0,
      soldeTotal: 0,
      byManager: [],
    };
  } catch (error) {
    throw error;
  }
}

async function getPortefeuilleKpis() {
  try {
    const { rows } = await query('SELECT * FROM vue_kpi_portefeuille LIMIT 10');
    if (rows && rows.length) {
      return rows[0];
    }

    return {
      total_dossiers: 0,
      solde_total: 0,
      dossiers_sans_gestionnaire: 0,
      nouveaux_dossiers_30j: 0,
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getPortefeuilleSnapshot,
  getPortefeuilleKpis,
};
