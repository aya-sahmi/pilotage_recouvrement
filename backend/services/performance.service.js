const { query } = require('../config/database');

function emptyDashboardSnapshot() {
  return {
    totalCommission: 0,
    totalEncaissement: 0,
    totalObjectif: 0,
    tauxGlobal: 0,
    totalDossiers: 0,
    soldeTotalPortefeuille: 0,
    totalAppels: 0,
    dureeTotaleAppels: 0,
    trend: [],
    byManager: [],
  };
}

function emptyPerformanceDashboard() {
  return {
    totalCommission: 0,
    totalObjectif: 0,
    tauxGlobal: 0,
    ranking: [],
    kpis: {
      totalCommission: 0,
      totalObjectif: 0,
      tauxGlobal: 0,
      totalAppels: 0,
    },
  };
}

async function getDashboardSnapshot() {
  try {
    const { rows } = await query('SELECT * FROM vue_dashboard_global LIMIT 1');
    if (rows && rows.length) {
      const row = rows[0];
      return {
        totalCommission: Number(row.total_commission || row.commission_total || 0),
        totalEncaissement: Number(row.total_encaissement || row.encaissement_total || 0),
        totalObjectif: Number(row.total_objectif || row.objectif_total || 0),
        tauxGlobal: Number(row.taux_global || ((row.total_commission || 0) / (row.total_objectif || 1)) * 100),
        totalDossiers: Number(row.total_dossiers || 0),
        soldeTotalPortefeuille: Number(row.total_solde || row.solde_total || 0),
        totalAppels: Number(row.total_appels || 0),
        dureeTotaleAppels: Number(row.duree_totale_appels || 0),
        trend: [],
        byManager: [],
      };
    }

    return emptyDashboardSnapshot();
  } catch (error) {
    throw error;
  }
}

async function getPerformanceDashboard() {
  try {
    const { rows } = await query('SELECT * FROM vue_performance_gestionnaires');
    if (rows && rows.length) {
      const totalCommission = rows.reduce((sum, row) => sum + Number(row.commission || 0), 0);
      const totalObjectif = rows.reduce((sum, row) => sum + Number(row.objectif || 0), 0);
      const ranking = rows
        .map((row) => ({
          gestionnaire_id: row.gestionnaire_id,
          manager: row.nom_gestionnaire || row.nom_affichage || `${row.prenom || ''} ${row.nom || ''}`.trim(),
          photo_url: row.photo_url || null,
          commission: Number(row.commission || 0),
          objectif: Number(row.objectif || 0),
          taux: Number(row.taux || ((Number(row.commission || 0) / (Number(row.objectif || 1))) * 100)),
          appels: Number(row.total_appels || row.nombre_appels || 0),
        }))
        .sort((a, b) => b.taux - a.taux)
        .map((row, index) => ({ ...row, rank: index + 1 }));

      return {
        totalCommission,
        totalObjectif,
        tauxGlobal: totalObjectif > 0 ? (totalCommission / totalObjectif) * 100 : 0,
        ranking,
        kpis: {
          totalCommission,
          totalObjectif,
          tauxGlobal: totalObjectif > 0 ? (totalCommission / totalObjectif) * 100 : 0,
          totalAppels: rows.reduce((sum, row) => sum + Number(row.total_appels || row.nombre_appels || 0), 0),
        },
      };
    }

    return emptyPerformanceDashboard();
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getDashboardSnapshot,
  getPerformanceDashboard,
};
